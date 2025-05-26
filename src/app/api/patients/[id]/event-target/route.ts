// src/app/api/patients/[id]/event-target/route.ts 파일 생성

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const eventTargetInfo = await request.json();
    
    // MongoDB 연결
    const { db } = await connectToDatabase();
    
    // 환자 ID 검증
    let mongoId;
    try {
      mongoId = new ObjectId(patientId);
    } catch (error) {
      return NextResponse.json(
        { error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }
    
    // 환자 데이터 업데이트
    const result = await db.collection('patients').findOneAndUpdate(
      { $or: [{ _id: mongoId }, { id: patientId }] },
      { $set: { eventTargetInfo: eventTargetInfo } },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      return NextResponse.json(
        { error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('이벤트 타겟 정보 업데이트 오류:', error);
    return NextResponse.json(
      { error: '이벤트 타겟 정보 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}