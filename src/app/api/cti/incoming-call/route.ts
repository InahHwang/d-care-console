// src/app/api/cti/incoming-call/route.ts
// CTI Bridge로부터 CID 데이터를 수신하는 API 엔드포인트
// 환자 조회 → 통화기록 생성 → Pusher로 브라우저에 전달
// V2: 환자 자동 등록 없음 (사용자가 직접 등록)
// V1과 V2 동시 저장 지원

import { NextRequest, NextResponse } from 'next/server';
import { getCTIEventStore, CTIEvent, PatientInfo } from '@/lib/ctiEventStore';
import { connectToDatabase } from '@/utils/mongodb';
import Pusher from 'pusher';

// Pusher 서버 인스턴스
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// 전화번호 정규화 (숫자만 추출)
function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

// 전화번호 포맷팅 (010-1234-5678)
function formatPhoneNumber(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  } else if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return phone;
}

// 환자 ID 생성 (IB-YYMMDDXXX)
function generatePatientId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `IB-${yy}${mm}${dd}${random}`;
}

// 통화 ID 생성
function generateCallId(): string {
  return `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ===== V2 관련 함수들 =====

// V2 환자 검색 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findPatientV2ByPhone(db: any, phoneNumber: string) {
  if (!phoneNumber) return null;

  try {
    const normalized = normalizePhone(phoneNumber);

    // 하이픈 포함 형식으로 변환
    let formatted = normalized;
    if (normalized.length === 11) {
      formatted = `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
    } else if (normalized.length === 10) {
      formatted = `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
    }

    // V2 patients 컬렉션에서 검색
    const patient = await db.collection('patients_v2').findOne({
      $or: [
        { phone: formatted },
        { phone: normalized },
        { phone: phoneNumber },
        { phone: { $regex: normalized.slice(-8) + '$' } },
      ],
    });

    return patient;
  } catch (error) {
    console.error('[V2 환자 검색] 오류:', error);
    return null;
  }
}

// V2 통화기록 생성 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createCallLogV2(
  db: any,
  phone: string,
  patientId: string | null,
  callerNumber: string,
  calledNumber: string,
  _callTime: string
) {
  const now = new Date();

  const callLog = {
    phone: phone,
    patientId: patientId,
    direction: 'inbound',
    status: 'ringing',
    duration: 0,
    startedAt: now,
    endedAt: null,
    callerNumber: callerNumber || '',
    calledNumber: calledNumber || '',
    recordingUrl: null,
    aiStatus: 'pending',  // AI 분석 대기
    aiAnalysis: null,     // 나중에 AI 분석 결과가 들어감
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('callLogs_v2').insertOne(callLog);
  return { ...callLog, _id: result.insertedId };
}

// ===== V1 관련 함수들 =====

// 환자 검색 함수
async function findPatientByPhone(phoneNumber: string): Promise<PatientInfo | null> {
  if (!phoneNumber) return null;

  try {
    const { db } = await connectToDatabase();
    const normalized = normalizePhone(phoneNumber); // 숫자만: 01090115363

    // 하이픈 포함 형식으로 변환: 010-9011-5363
    let formatted = normalized;
    if (normalized.length === 11) {
      formatted = `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
    } else if (normalized.length === 10) {
      formatted = `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
    }

    console.log(`[환자 검색] 원본: ${phoneNumber}`);
    console.log(`[환자 검색] 숫자만: ${normalized}`);
    console.log(`[환자 검색] 포맷: ${formatted}`);

    // 전화번호로 환자 검색 (여러 형식 시도)
    const patient = await db.collection('patients').findOne({
      $or: [
        { phoneNumber: formatted },           // 010-9011-5363
        { phoneNumber: normalized },          // 01090115363
        { phoneNumber: phoneNumber },         // 원본 그대로
        { phoneNumber: { $regex: normalized.slice(-8) + '$' } }, // 뒤 8자리 매칭
      ],
    });

    if (patient) {
      console.log(`[환자 검색] 매칭 성공: ${patient.name} (${patient.phoneNumber})`);
      return {
        id: patient._id.toString(),
        name: patient.name || '이름없음',
        phoneNumber: patient.phoneNumber || '',
        lastVisit: patient.lastVisit || patient.callInDate || '',
        notes: patient.memo || patient.notes || '',
        callCount: patient.callCount || 0,
      };
    }

    console.log(`[환자 검색] 매칭 실패 - 신규 고객`);
    return null;
  } catch (error) {
    console.error('[환자 검색] 오류:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callerNumber, calledNumber, timestamp } = body;

    console.log('='.repeat(50));
    console.log('[CTI API] CID 수신');
    console.log(`  발신번호: ${callerNumber}`);
    console.log(`  수신번호: ${calledNumber}`);
    console.log(`  시각: ${timestamp}`);
    console.log('='.repeat(50));

    if (!callerNumber) {
      return NextResponse.json(
        { success: false, error: 'callerNumber is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const formattedPhone = formatPhoneNumber(callerNumber);
    const callTime = timestamp || new Date().toISOString();
    let isNewPatient = false;

    // 환자 DB에서 검색 (V1은 자동 등록하지 않음)
    let patient = await findPatientByPhone(callerNumber);

    // 환자가 없으면 신규로 표시만 하고 자동 등록은 하지 않음 (V1)
    if (!patient) {
      isNewPatient = true;
      console.log(`[CTI API] V1 신규 고객 - 자동등록 비활성화 (${formattedPhone})`);

      // V1은 환자 정보 없이 통화기록만 남김
      patient = {
        id: '',
        name: `수신_${formattedPhone.slice(-4)}`,
        phoneNumber: formattedPhone,
        lastVisit: '',
        notes: '',
        callCount: 0,
      };
    }

    // 통화 기록 생성
    const callLog = {
      callId: generateCallId(),
      callDirection: 'inbound',
      phoneNumber: formattedPhone,  // 환자 번호
      callerNumber: callerNumber || '',
      calledNumber: calledNumber || '',
      callStatus: 'ringing',
      callStartTime: callTime,
      patientId: patient.id || null,  // 신규면 null
      patientName: patient.name,
      isNewPatient: isNewPatient,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('callLogs').insertOne(callLog);
    console.log(`[CTI API] 통화 기록 생성: ${callLog.callId}`);

    // ===== V2 동시 저장 =====
    let v2PatientId: string | null = null;
    let v2CallLogId: string | null = null;
    let v2PatientName: string | null = null;

    try {
      // V2 환자 검색 (자동 생성하지 않음 - 사용자가 직접 등록)
      const v2Patient = await findPatientV2ByPhone(db, callerNumber);

      if (v2Patient) {
        // 기존 환자면 lastContactAt, callCount 업데이트
        await db.collection('patients_v2').updateOne(
          { _id: v2Patient._id },
          {
            $set: { lastContactAt: new Date(), updatedAt: new Date(), lastCallDirection: 'inbound' },
            $inc: { callCount: 1 },
          }
        );
        v2PatientId = v2Patient._id.toString();
        v2PatientName = v2Patient.name;
        console.log(`[CTI API V2] 기존 환자 업데이트: ${v2Patient._id}`);
      } else {
        // 신규 전화번호 - 환자 자동 등록 안함 (사용자가 직접 등록)
        console.log(`[CTI API V2] 신규 전화번호 - 환자 미등록 상태로 통화기록만 생성`);
      }

      // V2 통화 기록 생성 (환자 등록 여부와 관계없이)
      const v2CallLog = await createCallLogV2(db, formattedPhone, v2PatientId, callerNumber, calledNumber, callTime);
      v2CallLogId = v2CallLog._id.toString();
      console.log(`[CTI API V2] 통화 기록 생성: ${v2CallLogId} (환자ID: ${v2PatientId || '미등록'})`);
    } catch (v2Error) {
      // V2 저장 실패해도 V1은 계속 진행
      console.error('[CTI API V2] 저장 실패 (V1은 정상 진행):', v2Error);
    }

    // CTI 이벤트 생성
    const ctiEvent: CTIEvent = {
      id: callLog.callId,
      eventType: 'INCOMING_CALL',
      callerNumber: callerNumber || '',
      calledNumber: calledNumber || '',
      timestamp: callTime,
      receivedAt: new Date().toISOString(),
      patient: patient,
      isNewCustomer: isNewPatient,
    };

    // 이벤트 저장 및 브로드캐스트 (SSE - 로컬용)
    const store = getCTIEventStore();
    store.addEvent(ctiEvent);

    // Pusher로 실시간 전송 (V1 채널)
    try {
      await pusher.trigger('cti-channel', 'incoming-call', {
        ...ctiEvent,
        isNewPatient: isNewPatient,
        callLog: callLog,
        // V2 정보도 함께 전송
        v2: {
          patientId: v2PatientId,
          callLogId: v2CallLogId,
          isRegistered: !!v2PatientId,  // 환자 등록 여부
        },
      });
      console.log(`[CTI API] Pusher V1 채널 전송 성공`);
    } catch (pusherError) {
      console.error(`[CTI API] Pusher V1 채널 전송 실패:`, pusherError);
    }

    // Pusher로 V2 채널에도 전송 (환자 등록 여부와 관계없이)
    if (v2CallLogId) {
      try {
        await pusher.trigger('cti-v2', 'incoming-call', {
          callLogId: v2CallLogId,
          phone: formattedPhone,
          patientId: v2PatientId,  // null일 수 있음 (미등록)
          patientName: v2PatientName || null,
          patientStatus: v2PatientId ? 'consulting' : null,
          temperature: null,
          isRegistered: !!v2PatientId,  // 환자 등록 여부
          callTime: callTime,
        });
        console.log(`[CTI API] Pusher V2 채널 전송 성공 (등록여부: ${!!v2PatientId})`);
      } catch (pusherError) {
        console.error(`[CTI API] Pusher V2 채널 전송 실패:`, pusherError);
      }
    }

    console.log(`[CTI API] 이벤트 브로드캐스트 완료 (SSE 클라이언트: ${store.getClientCount()}개)`);
    console.log(`[CTI API] V1 환자 정보: ${patient.name} (${patient.phoneNumber}) - ${isNewPatient ? '신규(미등록)' : '기존환자'}`);
    console.log(`[CTI API] V2 환자 ID: ${v2PatientId || '미등록'} - ${v2PatientId ? '기존환자' : '미등록(사용자등록필요)'}`);

    return NextResponse.json({
      success: true,
      message: isNewPatient ? 'New customer (not registered)' : 'Existing patient found',
      event: ctiEvent,
      patient: patient,
      callLog: callLog,
      isNewPatient: isNewPatient,
      connectedClients: store.getClientCount(),
      // V2 정보
      v2: {
        patientId: v2PatientId,
        callLogId: v2CallLogId,
        isRegistered: !!v2PatientId,  // 환자 등록 여부
      },
    });
  } catch (error) {
    console.error('[CTI API] 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 상태 확인용 GET
export async function GET() {
  const store = getCTIEventStore();

  return NextResponse.json({
    status: 'CTI incoming-call API is running',
    endpoint: '/api/cti/incoming-call',
    method: 'POST',
    connectedClients: store.getClientCount(),
    recentEvents: store.getRecentEvents(5),
    timestamp: new Date().toISOString(),
  });
}
