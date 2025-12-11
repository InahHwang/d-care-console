// src/app/api/cti/incoming-call/route.ts
// CTI Bridge로부터 CID 데이터를 수신하는 API 엔드포인트

import { NextRequest, NextResponse } from 'next/server';
import { getCTIEventStore, CTIEvent, PatientInfo } from '@/lib/ctiEventStore';
import { connectToDatabase } from '@/utils/mongodb';

// 전화번호 정규화 (숫자만 추출)
function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

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

    // 환자 DB에서 검색
    const patient = await findPatientByPhone(callerNumber);

    // CTI 이벤트 생성
    const ctiEvent: CTIEvent = {
      id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType: 'INCOMING_CALL',
      callerNumber: callerNumber || '',
      calledNumber: calledNumber || '',
      timestamp: timestamp || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      patient: patient,
      isNewCustomer: !patient,
    };

    // 이벤트 저장 및 브로드캐스트
    const store = getCTIEventStore();
    store.addEvent(ctiEvent);

    console.log(`[CTI API] 이벤트 브로드캐스트 완료 (클라이언트: ${store.getClientCount()}개)`);
    if (patient) {
      console.log(`[CTI API] 환자 정보: ${patient.name} (${patient.phoneNumber})`);
    } else {
      console.log(`[CTI API] 신규 고객`);
    }

    return NextResponse.json({
      success: true,
      message: 'CID received and broadcasted',
      event: ctiEvent,
      connectedClients: store.getClientCount(),
      patientFound: !!patient,
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
