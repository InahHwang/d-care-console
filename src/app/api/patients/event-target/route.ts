// /src/app/api/patients/event-targets/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    
    // 이벤트 타겟으로 지정된 환자만 조회
    const eventTargetPatients = await db.collection('patients')
      .find({ 'eventTargetInfo.isEventTarget': true })
      .toArray();
      
    return NextResponse.json(eventTargetPatients, { status: 200 });
  } catch (error) {
    console.error('이벤트 타겟 조회 실패:', error);
    return NextResponse.json({ error: '이벤트 타겟 정보를 불러오는데 실패했습니다.' }, { status: 500 });
  }
}