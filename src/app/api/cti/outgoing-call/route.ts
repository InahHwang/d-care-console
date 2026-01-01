// src/app/api/cti/outgoing-call/route.ts
// CTI Bridge로부터 발신 통화 이벤트를 수신하는 API 엔드포인트
// 환자 조회 → 없으면 자동 생성 → Pusher로 브라우저에 전달
// V1과 V2 동시 저장 지원

import { NextRequest, NextResponse } from 'next/server';
import { getCTIEventStore, CTIEvent, PatientInfo } from '@/lib/ctiEventStore';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import Pusher from 'pusher';
import { PatientStatus, Temperature } from '@/types/v2';

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

// ===== V2 관련 함수들 =====

// V2 환자 검색 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findPatientV2ByPhone(db: any, phoneNumber: string) {
  if (!phoneNumber) return null;

  try {
    const normalized = normalizePhone(phoneNumber);
    const formatted = formatPhoneNumber(phoneNumber);

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

// V2 환자 생성 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createPatientV2(db: any, phone: string) {
  const now = new Date();

  const newPatient = {
    name: `발신_${phone.slice(-4)}`,
    phone: phone,
    status: 'consulting' as PatientStatus,
    temperature: 'warm' as Temperature,
    source: '발신전화',
    aiAnalysis: {
      interest: '',
      summary: '',
      classification: 'new_patient',
    },
    createdAt: now,
    updatedAt: now,
    lastContactAt: now,
    statusChangedAt: now,
    callCount: 1,
    memo: '',
    tags: [],
    statusHistory: [],
  };

  const result = await db.collection('patients_v2').insertOne(newPatient);
  return { ...newPatient, _id: result.insertedId };
}

// V2 통화기록 생성 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createCallLogV2(
  db: any,
  phone: string,
  patientId: string | null,
  callerNumber: string,
  calledNumber: string
) {
  const now = new Date();

  const callLog = {
    phone: phone,
    patientId: patientId,
    direction: 'outbound',
    status: 'answered',
    duration: 0,
    startedAt: now,
    endedAt: null,
    callerNumber: callerNumber || '',
    calledNumber: calledNumber || '',
    recordingUrl: null,
    aiStatus: 'pending',
    aiAnalysis: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('callLogs_v2').insertOne(callLog);
  return { ...callLog, _id: result.insertedId };
}

// ===== V1 관련 함수들 =====

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

    // ===== V2 동시 저장 =====
    let v2PatientId: string | null = null;
    let v2CallLogId: string | null = null;
    let isV2NewPatient = false;

    try {
      // V2 환자 검색
      let v2Patient = await findPatientV2ByPhone(db, phoneNumber);

      if (!v2Patient) {
        // V2 신규 환자 생성
        v2Patient = await createPatientV2(db, formattedPhone);
        isV2NewPatient = true;
        console.log(`[발신 API V2] 신규 환자 생성: ${v2Patient._id}`);
      } else {
        // 기존 환자면 lastContactAt, callCount 업데이트
        await db.collection('patients_v2').updateOne(
          { _id: v2Patient._id },
          {
            $set: { lastContactAt: new Date(), updatedAt: new Date(), lastCallDirection: 'outbound' },
            $inc: { callCount: 1 },
          }
        );
        console.log(`[발신 API V2] 기존 환자 업데이트: ${v2Patient._id}`);
      }

      v2PatientId = v2Patient._id.toString();

      // V2 통화 기록 생성
      const v2CallLog = await createCallLogV2(db, formattedPhone, v2PatientId, callerNumber, phoneNumber);
      v2CallLogId = v2CallLog._id.toString();
      console.log(`[발신 API V2] 통화 기록 생성: ${v2CallLogId}`);
    } catch (v2Error) {
      // V2 저장 실패해도 V1은 계속 진행
      console.error('[발신 API V2] 저장 실패 (V1은 정상 진행):', v2Error);
    }

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

    // Pusher로 실시간 전송 (V1 채널)
    try {
      await pusher.trigger('cti-channel', 'outgoing-call', {
        patient: {
          ...patient,
          _id: patient._id.toString(),
          id: patient._id.toString(),
        },
        callLog: callLog,
        isNewPatient: isNewPatient,
        // V2 정보도 함께 전송
        v2: {
          patientId: v2PatientId,
          callLogId: v2CallLogId,
          isNewPatient: isV2NewPatient,
        },
      });
      console.log(`[발신 API] Pusher V1 채널 전송 성공`);
    } catch (pusherError) {
      console.error(`[발신 API] Pusher V1 채널 전송 실패:`, pusherError);
    }

    // Pusher로 V2 채널에도 전송
    if (v2PatientId && v2CallLogId) {
      try {
        await pusher.trigger('cti-v2', 'outgoing-call', {
          callLogId: v2CallLogId,
          phone: formattedPhone,
          patientId: v2PatientId,
          patientName: patient?.name || `발신_${formattedPhone.slice(-4)}`,
          patientStatus: 'consulting',
          temperature: null,
          isNewPatient: isV2NewPatient,
          callTime: timestamp || new Date().toISOString(),
        });
        console.log(`[발신 API] Pusher V2 채널 전송 성공`);
      } catch (pusherError) {
        console.error(`[발신 API] Pusher V2 채널 전송 실패:`, pusherError);
      }
    }

    console.log(`[발신 API] V1 처리 완료 - 신규환자: ${isNewPatient}`);
    console.log(`[발신 API] V2 환자 ID: ${v2PatientId || 'N/A'} - ${isV2NewPatient ? '신규등록' : '기존환자'}`);

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
      // V2 정보
      v2: {
        patientId: v2PatientId,
        callLogId: v2CallLogId,
        isNewPatient: isV2NewPatient,
      },
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
