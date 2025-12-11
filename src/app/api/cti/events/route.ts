// src/app/api/cti/events/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { getIO } from '@/lib/socketServer';
import { normalizeNumber, toDigits, extractCallerFromDN } from '@/lib/phone';

// ------------------- Types -------------------
interface PatientInfo {
  confidence: string;
  matchType: string;
  _id?: ObjectId;
  id?: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  lastVisit?: string;
  notes?: string;
  birthDate?: string;
  address?: string;
  emergencyContact?: string;
  treatmentHistory?: any[];
  isActive?: boolean;
}

// ------------------- Helpers -------------------

// (1) 원시 이벤트 → 표준 이벤트로 변환
function unifyEvent(raw: any) {
  // Bridge 포맷(DN1, DN2, Svc, Type, Ext)
  if (raw?.DN1 || raw?.DN2) {
    const { direction, caller } = extractCallerFromDN(raw.DN1, raw.DN2);

    let type: 'ring' | 'connect' | 'hangup' | 'event' = 'event';
    if (raw.Svc === 7 && raw.Type === 1) type = 'ring';
    else if (raw.Svc === 9 && raw.Type === 1) type = 'connect';
    else if (raw.Svc === 9 && raw.Type === 2) type = 'hangup';

    const callId = raw.Ext?.toString?.() ?? `${direction}-${Date.now()}`;
    const ts = Date.now();

    return {
      type,
      direction,
      caller: normalizeNumber(caller),
      callId,
      ts,
      raw,
      // 하위 호환 필드
      EventType: direction === 'IN' ? 'INCOMING_CALL' : 'OUTGOING_CALL',
      PhoneNumber: normalizeNumber(caller),
    };
  }

  // 레거시/기타 포맷(PhoneNumber/caller_number/phoneNumber)
  const caller =
    normalizeNumber(raw?.PhoneNumber) ||
    normalizeNumber(raw?.caller_number) ||
    normalizeNumber(raw?.phoneNumber);

  const direction: 'IN' | 'OUT' = 'IN'; // 정보 부족 시 기본 IN
  const callId = raw?.callId ?? `${direction}-${Date.now()}`;
  const ts = raw?.ts ?? Date.now();

  return {
    type: (raw?.type as any) ?? 'ring',
    direction,
    caller,
    callId,
    ts,
    raw,
    EventType: raw?.EventType ?? (direction === 'IN' ? 'INCOMING_CALL' : 'OUTGOING_CALL'),
    PhoneNumber: caller,
  };
}

// (2) Mongo에서 필드의 "숫자만" 표현을 만드는 $expr 조각
const digitsExpr = (field: string) => ({
  $replaceAll: {
    input: {
      $replaceAll: {
        input: {
          $replaceAll: {
            input: {
              $replaceAll: {
                input: {
                  $replaceAll: { input: `$${field}`, find: '+', replacement: '' },
                },
                find: '-', replacement: '',
              },
            },
            find: ' ', replacement: '',
          },
        },
        find: '(', replacement: '',
      },
    },
    find: ')', replacement: '',
  },
});

// (3) 환자 검색
async function findPatientByPhone(phoneNumber: string): Promise<PatientInfo | null> {
  if (!phoneNumber) {
    console.log('[환자 검색] 전화번호가 없습니다.');
    return null;
  }

  const { db } = await connectToDatabase();

  try {
    const inputNorm = normalizeNumber(phoneNumber);
    const numbersOnly = toDigits(inputNorm);
    console.log(`[환자 검색] 검색 시작(정규화): ${numbersOnly}`);

    // 1) phoneNumber 완전 일치(숫자만)
    let patient = await db.collection('patients').findOne({
      $and: [
        { isActive: { $ne: false } },
        { $expr: { $eq: [digitsExpr('phoneNumber'), numbersOnly] } },
      ],
    });
    if (patient) {
      console.log(`[환자 검색] 정확 매칭 성공: ${patient.name} (${patient.phoneNumber})`);
      return formatPatientInfo(patient);
    }

    // 2) 보조 필드들 완전 일치(숫자만)
    const phoneFields = ['mobile', 'tel', 'phone', 'cellPhone', 'homePhone'];
    patient = await db.collection('patients').findOne({
      $and: [
        { isActive: { $ne: false } },
        {
          $or: phoneFields.map((f) => ({
            $expr: { $eq: [digitsExpr(f), numbersOnly] },
          })),
        },
      ],
    });
    if (patient) {
      console.log(`[환자 검색] 숫자 매칭 성공: ${patient.name}`);
      return formatPatientInfo(patient);
    }

    // 3) 유사(끝 8/4) 매칭
    if (numbersOnly.length >= 8) {
      const last8 = numbersOnly.slice(-8);
      const last4 = numbersOnly.slice(-4);
      console.log(`[환자 검색] 유사 번호 검색: 8(${last8}) / 4(${last4})`);

      const similarPatients = await db
        .collection('patients')
        .find({
          $and: [
            { isActive: { $ne: false } },
            {
              $or: [
                { $expr: { $regexMatch: { input: digitsExpr('phoneNumber'), regex: `${last8}$` } } },
                { $expr: { $regexMatch: { input: digitsExpr('mobile'), regex: `${last8}$` } } },
                { $expr: { $regexMatch: { input: digitsExpr('phone'), regex: `${last8}$` } } },
              ],
            },
          ],
        })
        .limit(3)
        .toArray();

      if (similarPatients.length > 0) {
        console.log(`[환자 검색] 유사 번호 ${similarPatients.length}건 발견`);
        const recentPatient = similarPatients.sort(
          (a, b) =>
            new Date(b.lastVisit || '1900-01-01').getTime() -
            new Date(a.lastVisit || '1900-01-01').getTime(),
        )[0];

        const formatted = formatPatientInfo(recentPatient);
        formatted.matchType = 'SIMILAR_NUMBER';
        formatted.confidence = 'LOW';
        return formatted;
      }
    }

    console.log(`[환자 검색] 매칭 실패: ${phoneNumber}`);
    return null;
  } catch (error) {
    console.error('[환자 검색] 오류:', error);
    return null;
  }
}

// (4) 환자 정보 포맷팅
function formatPatientInfo(patient: any): PatientInfo {
  return {
    id: patient._id?.toString() || patient.id,
    name: patient.name || '이름 없음',
    phoneNumber: patient.phoneNumber || patient.mobile || patient.phone || '',
    email: patient.email || '',
    lastVisit: patient.lastVisit ? formatDate(patient.lastVisit) : '',
    notes: patient.notes || patient.memo || '',
    birthDate: patient.birthDate ? formatDate(patient.birthDate) : '',
    address: patient.address || '',
    emergencyContact: patient.emergencyContact || '',
    treatmentHistory: patient.treatmentHistory || [],
    isActive: patient.isActive !== false,
    matchType: 'EXACT',
    confidence: 'HIGH',
  };
}

// (5) 날짜 포맷팅
function formatDate(date: any): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  } catch {
    return date.toString();
  }
}

// (6) 통화 타입 결정
function getCallType(eventType: string, patient: PatientInfo | null): string {
  if (!patient) return 'NEW_CUSTOMER';
  if (patient.lastVisit) {
    const lastVisitDate = new Date(patient.lastVisit);
    const daysDiff = (Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) return 'RETURNING_CUSTOMER';
    if (daysDiff > 90) return 'REGULAR_CUSTOMER';
    return 'RECENT_CUSTOMER';
  }
  return 'EXISTING_CUSTOMER';
}

// ------------------- Handlers -------------------

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    console.log('[CTI Event] 수신(raw):', raw);

    // 1) 포맷 통일
    const unified = unifyEvent(raw);
    console.log('[CTI Event] 표준화(unified):', unified);

    const { db } = await connectToDatabase();
    let enrichedEventData: any = { ...unified };

    // 2) 착신(IN) 콜이면 환자 매칭
    if (unified.direction === 'IN' && unified.caller) {
      console.log(`[환자 매칭] 시작: ${unified.caller}`);
      const patient = await findPatientByPhone(unified.caller);
      const callType = getCallType(unified.EventType, patient);

      enrichedEventData = {
        ...enrichedEventData,
        patient,
        callType,
        patientFound: !!patient,
        searchTimestamp: new Date().toISOString(),
        matchConfidence: patient?.confidence || 'NONE',
      };

      if (patient) {
        console.log(`[환자 매칭] 성공: ${patient.name} (${patient.phoneNumber}) - ${callType}`);
      } else {
        console.log(`[환자 매칭] 신규 고객: ${unified.caller}`);
      }
    }

    // 3) DB 저장
    const result = await db.collection('cti_events').insertOne({
      ...enrichedEventData,
      receivedAt: new Date(),
      processed: false,
      version: '2.0',
    });

    // 4) 브로드캐스트 (분리된 Socket.IO 서버 사용)
    const io = getIO();
    const broadcastData = {
      ...enrichedEventData,
      id: result.insertedId,
      receivedAt: new Date().toISOString(),
    };

    if (raw.userId) {
      const roomName = `cti-${raw.userId}`;
      io.to(roomName).emit('cti-event', broadcastData);
      console.log(`📡 CTI 이벤트를 룸 ${roomName}으로 브로드캐스트`);
    } else {
      io.emit('cti-event', broadcastData);
      console.log('📡 CTI 이벤트를 모든 클라이언트에게 브로드캐스트');
    }

    if (broadcastData.patient) {
      console.log(`📡 환자 정보 포함: ${broadcastData.patient.name} (${broadcastData.callType})`);
    }

    return NextResponse.json({
      success: true,
      eventId: result.insertedId,
      message: 'CTI 이벤트가 성공적으로 처리되었습니다.',
      patientFound: !!enrichedEventData.patient,
      callType: enrichedEventData.callType,
      broadcast: true,
    });
  } catch (error) {
    console.error('❌ CTI 이벤트 처리 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'CTI 이벤트 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const events = await db
      .collection('cti_events')
      .find({})
      .sort({ receivedAt: -1 })
      .limit(50)
      .toArray();

    const stats = {
      total: events.length,
      withPatients: events.filter((e) => e.patient).length,
      newCustomers: events.filter((e) => e.callType === 'NEW_CUSTOMER').length,
      returningCustomers: events.filter((e) => e.callType === 'RETURNING_CUSTOMER').length,
      recentCustomers: events.filter((e) => e.callType === 'RECENT_CUSTOMER').length,
    };

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
      stats,
    });
  } catch (error) {
    console.error('❌ CTI 이벤트 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: '전화번호가 필요합니다.' },
        { status: 400 },
      );
    }

    const patient = await findPatientByPhone(phoneNumber);

    return NextResponse.json({
      success: true,
      patient,
      found: !!patient,
    });
  } catch (error) {
    console.error('❌ 환자 검색 오류:', error);
    return NextResponse.json(
      { success: false, error: '환자 검색 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
