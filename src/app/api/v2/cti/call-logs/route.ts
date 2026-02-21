// src/app/api/v2/cti/call-logs/route.ts
// V2 전용 통화 상태 업데이트 엔드포인트
// CTIBridge에서 ring/start/end/missed/outbound_end/no_answer/busy 등 이벤트 수신

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  } else if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return phone;
}

// 제외할 전화번호 (내부 통화)
const EXCLUDED_PHONES = ['07047414471', '0315672278'];

// ★ 발신 통화 성공 시 오늘 예정된 콜백 자동 완료
async function autoCompleteCallbackForOutbound(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  patientId: string,
  callLogId: string
): Promise<{ completed: boolean; callbackId?: string }> {
  const now = new Date();
  const nowIso = now.toISOString();

  // KST 기준 오늘 범위 (UTC+9)
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const kstDateStr = kstNow.toISOString().split('T')[0]; // YYYY-MM-DD
  const todayStart = new Date(`${kstDateStr}T00:00:00+09:00`);
  const todayEnd = new Date(`${kstDateStr}T23:59:59.999+09:00`);

  try {
    // 1. callbacks_v2에서 오늘 pending 콜백 찾기
    const pendingCallback = await db.collection('callbacks_v2').findOne({
      patientId,
      status: 'pending',
      scheduledAt: { $gte: todayStart, $lte: todayEnd },
    });

    if (pendingCallback) {
      await db.collection('callbacks_v2').updateOne(
        { _id: pendingCallback._id },
        { $set: { status: 'completed', completedAt: nowIso, updatedAt: nowIso } }
      );
      // 콜로그에 콜백 연결
      await db.collection('callLogs_v2').updateOne(
        { _id: new ObjectId(callLogId) },
        { $set: { callbackType: pendingCallback.type, callbackId: pendingCallback._id.toString() } }
      );
      console.log(`[CallLogs V2] 콜백 자동 완료: ${pendingCallback._id} (환자: ${patientId})`);
      return { completed: true, callbackId: pendingCallback._id.toString() };
    }

    // 2. patients_v2의 nextActionDate가 오늘인 경우
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(patientId),
      nextActionDate: { $exists: true, $ne: null },
    });

    if (patient?.nextActionDate) {
      const actionDate = new Date(patient.nextActionDate);
      const actionDateStr = new Date(actionDate.getTime() + kstOffset).toISOString().split('T')[0];

      if (actionDateStr === kstDateStr) {
        // callbacks_v2에 완료 레코드 생성
        const callbackType = patient.nextAction === '리콜' ? 'recall' :
                             patient.nextAction === '감사전화' ? 'thanks' : 'callback';
        const newCallback = {
          patientId,
          type: callbackType,
          scheduledAt: new Date(patient.nextActionDate),
          status: 'completed',
          note: patient.nextAction || '',
          completedAt: nowIso,
          createdAt: nowIso,
        };
        const insertResult = await db.collection('callbacks_v2').insertOne(newCallback);

        // 환자의 nextActionDate 클리어
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(patientId) },
          {
            $unset: { nextActionDate: '', nextAction: '' },
            $set: { updatedAt: nowIso },
          }
        );

        // 콜로그에 콜백 연결
        await db.collection('callLogs_v2').updateOne(
          { _id: new ObjectId(callLogId) },
          { $set: { callbackType, callbackId: insertResult.insertedId.toString() } }
        );

        console.log(`[CallLogs V2] 콜백 자동 완료 (patient nextAction): ${insertResult.insertedId} (환자: ${patientId})`);
        return { completed: true, callbackId: insertResult.insertedId.toString() };
      }
    }

    return { completed: false };
  } catch (error) {
    console.error(`[CallLogs V2] 콜백 자동 완료 오류 (환자: ${patientId}):`, error);
    return { completed: false };
  }
}

// callLogId 또는 전화번호로 통화기록 검색
async function findCallLog(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  callLogId: string | null,
  phone: string,
  direction: 'inbound' | 'outbound',
  statusFilter: string[]
) {
  // 1순위: callLogId 직접 매칭
  if (callLogId && ObjectId.isValid(callLogId)) {
    const log = await db.collection('callLogs_v2').findOne({
      _id: new ObjectId(callLogId),
    });
    if (log) return log;
  }

  // 2순위: 전화번호 + 방향 + 상태 (최근 5분)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const formattedPhone = formatPhone(phone);
  const normalizedPhone = normalizePhone(phone);

  return db.collection('callLogs_v2').findOne(
    {
      $or: [
        { phone: formattedPhone },
        { phone: normalizedPhone },
        { phone: phone },
      ],
      direction,
      status: { $in: statusFilter },
      createdAt: { $gte: fiveMinutesAgo },
    },
    { sort: { createdAt: -1 } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventType,
      callerNumber,
      calledNumber,
      timestamp,
      duration,
      callLogId: directCallLogId,
      extInfo,
    } = body;

    console.log(`[CallLogs V2] ${eventType} 이벤트: caller=${callerNumber}, called=${calledNumber}, duration=${duration || 0}, callLogId=${directCallLogId || '없음'}`);

    if (!callerNumber) {
      return NextResponse.json(
        { success: false, error: 'callerNumber is required' },
        { status: 400 }
      );
    }

    // 제외 번호 체크
    const normalizedCaller = normalizePhone(callerNumber);
    if (EXCLUDED_PHONES.includes(normalizedCaller)) {
      return NextResponse.json({ success: true, message: 'Excluded number' });
    }

    const { db } = await connectToDatabase();
    const now = new Date();
    const formattedCaller = formatPhone(callerNumber);

    // ===== 수신(inbound) 이벤트 =====

    if (eventType === 'start') {
      // 수신 통화 시작 (수화기 들었을 때) → ringing → connected
      const callLog = await findCallLog(db, directCallLogId, callerNumber, 'inbound', ['ringing']);

      if (callLog) {
        await db.collection('callLogs_v2').updateOne(
          { _id: callLog._id },
          {
            $set: {
              status: 'connected',
              startedAt: now,  // ★ 실제 통화 연결 시간으로 갱신 (ringing → connected)
              calledNumber: calledNumber || callLog.calledNumber,
              updatedAt: now,
            },
          }
        );
        console.log(`[CallLogs V2] 수신 시작: ${callLog._id} → connected (startedAt 갱신)`);
        return NextResponse.json({ success: true, message: 'Call started', callLogId: callLog._id.toString() });
      }

      console.log(`[CallLogs V2] start: ringing 기록 없음 (무시)`);
      return NextResponse.json({ success: true, message: 'No matching ringing call' });
    }

    if (eventType === 'end') {
      // 수신 통화 종료
      const callLog = await findCallLog(db, directCallLogId, callerNumber, 'inbound', ['ringing', 'connected']);

      if (callLog) {
        const wasMissed = callLog.status === 'ringing';
        const callDuration = duration || (callLog.startedAt
          ? Math.round((now.getTime() - new Date(callLog.startedAt).getTime()) / 1000)
          : 0);

        const updateData: Record<string, unknown> = {
          status: wasMissed ? 'missed' : 'connected',
          duration: wasMissed ? 0 : callDuration,
          endedAt: now,
          updatedAt: now,
        };

        if (wasMissed) {
          updateData.aiStatus = 'completed';
          updateData.aiAnalysis = { classification: '부재중', summary: '부재중 통화' };
        }

        await db.collection('callLogs_v2').updateOne(
          { _id: callLog._id },
          { $set: updateData }
        );
        console.log(`[CallLogs V2] 수신 종료: ${callLog._id} → ${wasMissed ? 'missed' : 'connected'}, ${callDuration}초`);
        return NextResponse.json({ success: true, message: 'Call ended', callLogId: callLog._id.toString() });
      }

      return NextResponse.json({ success: true, message: 'No matching call' });
    }

    if (eventType === 'missed') {
      // 명시적 부재중
      const callLog = await findCallLog(db, directCallLogId, callerNumber, 'inbound', ['ringing']);

      if (callLog) {
        await db.collection('callLogs_v2').updateOne(
          { _id: callLog._id },
          {
            $set: {
              status: 'missed',
              aiStatus: 'completed',
              aiAnalysis: { classification: '부재중', summary: '부재중 통화' },
              updatedAt: now,
            },
          }
        );
        console.log(`[CallLogs V2] 부재중: ${callLog._id}`);
        return NextResponse.json({ success: true, message: 'Marked as missed', callLogId: callLog._id.toString() });
      }

      return NextResponse.json({ success: true, message: 'No matching ringing call' });
    }

    // ===== 발신(outbound) 이벤트 =====

    if (eventType === 'outbound_end') {
      // 발신 통화 정상 종료 (성공한 통화 + 녹취 있음)
      // 녹취는 별도 Recording 이벤트로 도착하므로 여기서는 상태만 업데이트
      const callLog = await findCallLog(db, directCallLogId, callerNumber, 'outbound', ['ringing', 'connected']);

      if (callLog) {
        const callDuration = duration || 0;
        await db.collection('callLogs_v2').updateOne(
          { _id: callLog._id },
          {
            $set: {
              status: 'connected',
              duration: callDuration,
              endedAt: now,
              updatedAt: now,
            },
          }
        );
        console.log(`[CallLogs V2] 발신 정상 종료: ${callLog._id}, ${callDuration}초`);

        // ★ 발신 통화 성공 시 오늘 예정 콜백 자동 완료
        let autoCompletedCallbackId: string | undefined;
        if (callDuration > 0 && callLog.patientId) {
          const result = await autoCompleteCallbackForOutbound(db, callLog.patientId, callLog._id.toString());
          autoCompletedCallbackId = result.callbackId;
        }

        // Pusher 알림
        try {
          await pusher.trigger('cti-v2', 'call-ended', {
            callLogId: callLog._id.toString(),
            phone: callLog.phone,
            duration: callDuration,
            status: 'connected',
            patientId: callLog.patientId,
            autoCompletedCallbackId,
          });
        } catch (pusherError) {
          console.error('[CallLogs V2] Pusher 오류:', pusherError);
        }

        return NextResponse.json({ success: true, message: 'Outbound call ended', callLogId: callLog._id.toString(), autoCompletedCallbackId });
      }

      return NextResponse.json({ success: true, message: 'No matching outbound call' });
    }

    // no_answer, service_stopped, busy, cancelled, rejected → 발신 부재중/실패
    if (['no_answer', 'service_stopped', 'busy', 'cancelled', 'rejected'].includes(eventType)) {
      const isMissed = ['no_answer', 'service_stopped', 'busy'].includes(eventType);
      const callLog = await findCallLog(db, directCallLogId, callerNumber, 'outbound', ['ringing', 'connected']);

      if (callLog) {
        const updateData: Record<string, unknown> = {
          status: isMissed ? 'missed' : 'connected',
          duration: 0,
          endedAt: now,
          updatedAt: now,
        };

        if (isMissed) {
          updateData.aiStatus = 'completed';
          updateData.aiAnalysis = {
            classification: '부재중',
            summary: '발신 부재중 통화',
            interest: '',
            temperature: '',
            followUp: '재통화 필요',
          };
        }

        await db.collection('callLogs_v2').updateOne(
          { _id: callLog._id },
          { $set: updateData }
        );
        console.log(`[CallLogs V2] 발신 ${eventType}: ${callLog._id} → ${isMissed ? 'missed' : 'ended'}`);

        // Pusher 알림
        try {
          await pusher.trigger('cti-v2', 'call-ended', {
            callLogId: callLog._id.toString(),
            phone: callLog.phone,
            duration: 0,
            status: isMissed ? 'missed' : 'connected',
            patientId: callLog.patientId,
          });
        } catch (pusherError) {
          console.error('[CallLogs V2] Pusher 오류:', pusherError);
        }

        return NextResponse.json({ success: true, message: `${eventType} processed`, callLogId: callLog._id.toString() });
      }

      console.log(`[CallLogs V2] ${eventType}: 매칭 발신 통화 없음`);
      return NextResponse.json({ success: true, message: 'No matching outbound call' });
    }

    // 지원하지 않는 eventType
    console.log(`[CallLogs V2] 미지원 eventType: ${eventType} (무시)`);
    return NextResponse.json({ success: true, message: `Unsupported: ${eventType}` });

  } catch (error) {
    console.error('[CallLogs V2] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
