// src/app/api/cti/test/route.ts
// 테스트용 CID 이벤트 발생 API

import { NextRequest, NextResponse } from 'next/server';
import { getCTIEventStore, CTIEvent } from '@/lib/ctiEventStore';

// 테스트용 전화번호 목록
const TEST_PHONE_NUMBERS = [
  '010-1234-5678',
  '010-9876-5432',
  '02-555-1234',
  '031-123-4567',
  '010-1111-2222',
];

// GET: 테스트 이벤트 발생
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callerNumber = searchParams.get('caller') ||
    TEST_PHONE_NUMBERS[Math.floor(Math.random() * TEST_PHONE_NUMBERS.length)];
  const calledNumber = searchParams.get('called') || '031-567-2278';

  const store = getCTIEventStore();

  const testEvent: CTIEvent = {
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    eventType: 'INCOMING_CALL',
    callerNumber: callerNumber.replace(/-/g, ''),
    calledNumber: calledNumber.replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };

  store.addEvent(testEvent);

  console.log('[CTI Test] 테스트 이벤트 발생:', testEvent.callerNumber);

  return NextResponse.json({
    success: true,
    message: '테스트 CID 이벤트가 발생했습니다',
    event: testEvent,
    connectedClients: store.getClientCount(),
    usage: {
      description: 'URL 파라미터로 전화번호 지정 가능',
      example: '/api/cti/test?caller=010-1234-5678&called=031-567-2278',
    },
  });
}

// POST: 커스텀 테스트 이벤트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      callerNumber = '010-0000-0000',
      calledNumber = '031-567-2278',
      eventType = 'INCOMING_CALL',
    } = body;

    const store = getCTIEventStore();

    const testEvent: CTIEvent = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType: eventType as CTIEvent['eventType'],
      callerNumber: callerNumber.replace(/-/g, ''),
      calledNumber: calledNumber.replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    };

    store.addEvent(testEvent);

    return NextResponse.json({
      success: true,
      message: '테스트 이벤트가 발생했습니다',
      event: testEvent,
      connectedClients: store.getClientCount(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
