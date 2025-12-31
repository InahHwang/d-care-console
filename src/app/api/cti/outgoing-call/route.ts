// src/app/api/cti/outgoing-call/route.ts
// CTI Bridge로부터 발신 통화 이벤트를 수신하는 API 엔드포인트
// 환자 조회 → 없으면 자동 생성 → Pusher로 브라우저에 전달

import { NextRequest, NextResponse } from 'next/server';
import { getCTIEventStore, CTIEvent, PatientInfo } from '@/lib/ctiEventStore';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
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

// 환자 ID 생성 (OB-YYMMDDXXX)
function generatePatientId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `OB-${yy}${mm}${dd}${random}`;
}

// 통화 ID 생성
function generateCallId(): string {
  return `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 환자 검색 함수
async function findPatientByPhone(db: any, phoneNumber: string) {
  if (!phoneNumber) return null;

  const normalized = normalizePhone(phoneNumber);
  const formatted = formatPhoneNumber(phoneNumber);

  console.log(`[발신-환자 검색] 원본: ${phoneNumber}`);
  console.log(`[발신-환자 검색] 숫자만: ${normalized}`);
  console.log(`[발신-환자 검색] 포맷: ${formatted}`);

  const patient = await db.collection('patients').findOne({
    $or: [
      { phoneNumber: formatted },
      { phoneNumber: normalized },
      { phoneNumber: phoneNumber },
      { phoneNumber: { $regex: normalized.slice(-8) + '$' } },
    ],
  });

  if (patient) {
    console.log(`[발신-환자 검색] 매칭 성공: ${patient.name} (${patient.phoneNumber})`);
  } else {
    console.log(`[발신-환자 검색] 매칭 실패 - 신규 환자 자동 등록 예정`);
  }

  return patient;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, callerNumber, timestamp } = body;

    console.log('='.repeat(50));
    console.log('[발신 API] 발신 통화 시작');
    console.log(`  환자 번호: ${phoneNumber}`);
    console.log(`  치과 번호: ${callerNumber}`);
    console.log(`  시각: ${timestamp}`);
    console.log('='.repeat(50));

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'phoneNumber is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const formattedPhone = formatPhoneNumber(phoneNumber);
    let isNewPatient = false;
    let patient = await findPatientByPhone(db, phoneNumber);

    // 환자가 없으면 자동 생성
    if (!patient) {
      isNewPatient = true;

      const newPatient = {
        patientId: generatePatientId(),
        name: `발신_${formattedPhone.slice(-4)}`,  // 임시 이름
        phoneNumber: formattedPhone,
        consultationType: 'outbound',
        status: '잠재고객',
        interestedServices: [],
        callInDate: (timestamp || new Date().toISOString()).split('T')[0],
        reminderStatus: '초기',
        visitConfirmed: false,
        callbackHistory: [],
        createdBy: 'system',
        createdByName: '자동등록(발신)',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await db.collection('patients').insertOne(newPatient);
      patient = { ...newPatient, _id: result.insertedId };

      console.log(`[발신 API] 신규 환자 자동 등록: ${patient.patientId} (${formattedPhone})`);
    }

    // 통화 기록 생성
    const callLog = {
      callId: generateCallId(),
      callDirection: 'outbound',
      phoneNumber: formattedPhone,
      callerNumber: callerNumber || '',
      calledNumber: phoneNumber,
      callStatus: 'answered',
      callStartTime: timestamp || new Date().toISOString(),
      patientId: patient._id.toString(),
      patientName: patient.name,
      isNewPatient: isNewPatient,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('callLogs').insertOne(callLog);
    console.log(`[발신 API] 통화 기록 생성: ${callLog.callId}`);

    // PatientInfo 형식으로 변환
    const patientInfo: PatientInfo = {
      id: patient._id.toString(),
      name: patient.name || '이름없음',
      phoneNumber: patient.phoneNumber || '',
      lastVisit: patient.lastVisit || patient.callInDate || '',
      notes: patient.memo || patient.notes || '',
      callCount: patient.callCount || 0,
    };

    // CTI 이벤트 생성
    const ctiEvent: CTIEvent = {
      id: callLog.callId,
      eventType: 'OUTGOING_CALL',
      callerNumber: callerNumber || '',  // 치과 번호
      calledNumber: phoneNumber,          // 환자 번호
      timestamp: timestamp || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      patient: patientInfo,
      isNewCustomer: isNewPatient,
    };

    // 이벤트 저장 (SSE - 로컬용)
    const store = getCTIEventStore();
    store.addEvent(ctiEvent);

    // Pusher로 실시간 전송
    try {
      await pusher.trigger('cti-channel', 'outgoing-call', {
        patient: {
          ...patient,
          _id: patient._id.toString(),
          id: patient._id.toString(),
        },
        callLog: callLog,
        isNewPatient: isNewPatient,
      });
      console.log(`[발신 API] Pusher 전송 성공`);
    } catch (pusherError) {
      console.error(`[발신 API] Pusher 전송 실패:`, pusherError);
    }

    console.log(`[발신 API] 처리 완료 - 신규환자: ${isNewPatient}`);

    return NextResponse.json({
      success: true,
      message: isNewPatient ? 'New patient created' : 'Existing patient found',
      patient: {
        ...patient,
        _id: patient._id.toString(),
        id: patient._id.toString(),
      },
      callLog: callLog,
      isNewPatient: isNewPatient,
    });
  } catch (error) {
    console.error('[발신 API] 처리 오류:', error);
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
    status: 'CTI outgoing-call API is running',
    endpoint: '/api/cti/outgoing-call',
    method: 'POST',
    description: '발신 통화 시 환자 조회/자동 등록',
    connectedClients: store.getClientCount(),
    timestamp: new Date().toISOString(),
  });
}
