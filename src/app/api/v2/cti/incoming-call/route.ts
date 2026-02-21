// src/app/api/v2/cti/incoming-call/route.ts
// CTI Bridge로부터 수신 통화 CID 데이터를 받아 v2 시스템에 처리

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import Pusher from 'pusher';
import type { PatientV2, CallLogV2, Temperature } from '@/types/v2';

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
function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  } else if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return phone;
}

// v2 환자 검색 (최적화된 쿼리)
async function findPatientV2(db: Awaited<ReturnType<typeof connectToDatabase>>['db'], phoneNumber: string): Promise<PatientV2 | null> {
  if (!phoneNumber) return null;

  const normalized = normalizePhone(phoneNumber);
  const formatted = formatPhone(phoneNumber);

  // 인덱스 활용을 위해 정확한 매칭 우선
  const patient = await db.collection<PatientV2>('patients_v2').findOne(
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
        interest: 1,
        source: 1,
        createdAt: 1,
      },
    }
  );

  return patient;
}

// v2 환자 자동 생성
async function createPatientV2(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  phone: string,
  callTime: string
): Promise<PatientV2> {
  const now = new Date().toISOString();
  const formattedPhone = formatPhone(phone);

  const newPatient: PatientV2 = {
    name: `신규_${formattedPhone.slice(-4)}`,
    phone: formattedPhone,
    status: 'consulting',
    statusChangedAt: now,
    temperature: 'warm' as Temperature,
    source: 'inbound',
    aiRegistered: true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection<PatientV2>('patients_v2').insertOne(newPatient);
  return { ...newPatient, _id: result.insertedId };
}

// v2 통화 기록 생성
async function createCallLogV2(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  callerNumber: string,
  calledNumber: string,
  patientId: string | undefined,
  callTime: string
): Promise<CallLogV2> {
  const now = new Date();
  // ★ 날짜는 반드시 Date 객체로 저장 (String 저장 시 MongoDB 비교 연산 실패)
  const startedAtDate = callTime ? new Date(callTime) : now;

  const callLog: CallLogV2 = {
    phone: formatPhone(callerNumber),
    calledNumber: calledNumber || '',  // ★ 착신번호 (031/070 회선)
    patientId: patientId,
    direction: 'inbound',
    status: 'ringing',  // ★ ringing으로 생성 → "start" 이벤트에서 connected로 전환
    duration: 0,
    startedAt: startedAtDate,
    endedAt: now,  // ★ 임시값; "end" 이벤트에서 실제 종료시간으로 갱신
    aiStatus: 'pending',
    createdAt: now,
  };

  const result = await db.collection<CallLogV2>('callLogs_v2').insertOne(callLog);
  return { ...callLog, _id: result.insertedId };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { callerNumber, calledNumber, timestamp } = body;

    console.log(`[CTI v2] 수신: ${callerNumber} → ${calledNumber}`);

    if (!callerNumber) {
      return NextResponse.json(
        { success: false, error: 'callerNumber is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const callTime = timestamp || new Date().toISOString();
    let isNewPatient = false;

    // 1. 환자 검색 (자동등록 비활성화 - 상담사가 수동으로만 등록)
    const patient = await findPatientV2(db, callerNumber);

    if (!patient) {
      isNewPatient = true;
      console.log(`[CTI v2] 미등록 전화번호: ${formatPhone(callerNumber)} (자동등록 비활성화)`);
    }

    // 2. 통화 기록 생성 (환자가 없어도 통화 기록은 생성)
    const callLog = await createCallLogV2(
      db,
      callerNumber,
      calledNumber,
      patient?._id?.toString(),
      callTime
    );

    // 3. Pusher 실시간 전송
    const event = {
      callLogId: callLog._id?.toString(),
      phone: formatPhone(callerNumber),
      patientId: patient?._id?.toString(),
      patientName: patient?.name || '미등록',
      patientStatus: patient?.status,
      temperature: patient?.temperature,
      isNewPatient,
      callTime,
    };

    try {
      await pusher.trigger('cti-v2', 'incoming-call', event);
    } catch (pusherError) {
      console.error('[CTI v2] Pusher 오류:', pusherError);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[CTI v2] 처리 완료 (${elapsed}ms)`);

    return NextResponse.json({
      success: true,
      isNewPatient,
      patient: patient ? {
        id: patient._id?.toString(),
        name: patient.name,
        phone: patient.phone,
        status: patient.status,
        temperature: patient.temperature,
      } : null,
      callLog: {
        id: callLog._id?.toString(),
        phone: callLog.phone,
        direction: callLog.direction,
        startedAt: callLog.startedAt,
      },
    });
  } catch (error) {
    console.error('[CTI v2] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 상태 확인용 GET
export async function GET() {
  return NextResponse.json({
    status: 'CTI v2 incoming-call API running',
    timestamp: new Date().toISOString(),
  });
}
