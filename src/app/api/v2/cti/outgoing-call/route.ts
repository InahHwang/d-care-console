// src/app/api/v2/cti/outgoing-call/route.ts
// V2 전용 발신통화 엔드포인트
// CTIBridge ClickCall 시작 시 호출 → callLogId 반환 (녹취 매칭용)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
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

// V2 환자 검색
async function findPatientV2(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  phoneNumber: string
) {
  if (!phoneNumber) return null;

  const normalized = normalizePhone(phoneNumber);
  const formatted = formatPhone(phoneNumber);

  return db.collection('patients_v2').findOne(
    {
      $or: [
        { phone: formatted },
        { phone: normalized },
        { phone: phoneNumber },
      ],
    },
    {
      projection: {
        _id: 1,
        name: 1,
        phone: 1,
        status: 1,
        temperature: 1,
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, callerNumber, timestamp } = body;

    console.log(`[OutgoingCall V2] 발신: ${phoneNumber} (치과: ${callerNumber})`);

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'phoneNumber is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const formattedPhone = formatPhone(phoneNumber);
    const now = new Date();

    // 환자 검색
    const patient = await findPatientV2(db, phoneNumber);
    const patientId = patient?._id?.toString() || null;

    // 기존 환자면 lastContactAt, callCount 업데이트
    if (patient) {
      await db.collection('patients_v2').updateOne(
        { _id: patient._id },
        {
          $set: { lastContactAt: now, updatedAt: now, lastCallDirection: 'outbound' },
          $inc: { callCount: 1 },
        }
      );
    }

    // 통화 기록 생성 (direction=outbound, status=ringing)
    // ★ calledNumber = 치과 회선번호 (031/070) - 착신 컬럼 표시용
    const callLog = {
      phone: formattedPhone,
      calledNumber: callerNumber || '',  // ★ 치과 회선번호 (031/070)
      patientId,
      direction: 'outbound' as const,
      status: 'ringing' as const,
      duration: 0,
      startedAt: now,
      endedAt: null,
      callerNumber: callerNumber || '',
      recordingUrl: null,
      aiStatus: 'pending' as const,
      aiAnalysis: patient?.name ? { patientName: patient.name } : null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('callLogs_v2').insertOne(callLog);
    const callLogId = result.insertedId.toString();

    console.log(`[OutgoingCall V2] 통화기록 생성: ${callLogId} (환자: ${patientId || '미등록'})`);

    // Pusher 실시간 알림
    try {
      await pusher.trigger('cti-v2', 'outgoing-call', {
        callLogId,
        phone: formattedPhone,
        patientId,
        patientName: patient?.name || null,
        patientStatus: patient?.status || null,
        temperature: patient?.temperature || null,
        isRegistered: !!patientId,
        callTime: timestamp || now.toISOString(),
      });
    } catch (pusherError) {
      console.error('[OutgoingCall V2] Pusher 오류:', pusherError);
    }

    return NextResponse.json({
      success: true,
      callLogId,
      patientId,
      isRegistered: !!patientId,
    });
  } catch (error) {
    console.error('[OutgoingCall V2] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 상태 확인용 GET
export async function GET() {
  return NextResponse.json({
    status: 'V2 outgoing-call API running',
    timestamp: new Date().toISOString(),
  });
}
