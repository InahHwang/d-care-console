// /src/app/api/patients/[id]/callbacks/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const id = params.id;
    const callbackData = await request.json();
    
    // 콜백 ID 생성
    const callbackId = `cb-${Date.now()}`;
    const newCallback = {
      id: callbackId,
      ...callbackData,
      time: typeof callbackData.time === 'string' ? callbackData.time : undefined
    };
    
    // 먼저 환자를 찾아 firstConsultDate 확인
    let patient;
    if (ObjectId.isValid(id)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(id) });
    } else {
      patient = await db.collection('patients').findOne({ patientId: id });
    }
    
    if (!patient) {
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 환자 정보 업데이트 준비
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    
    // 콜백 상태에 따른 환자 정보 업데이트
    if (callbackData.status === '부재중') {
      updateData.status = '부재중';
    } else if (callbackData.status === '예정') {
      updateData.status = '콜백필요';
    } else if (callbackData.status === '완료') {
      updateData.status = '콜백필요';
      updateData.reminderStatus = callbackData.type;
      
      // 첫 상담 날짜가 없는 경우만 설정
      if (!patient.firstConsultDate || patient.firstConsultDate === '') {
        updateData.firstConsultDate = callbackData.date;
      }
      
      updateData.lastConsultation = callbackData.date;
    }
    
    // 환자 정보 업데이트
    let result;
    if (ObjectId.isValid(id)) {
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { 
          $push: { callbackHistory: newCallback },
          $set: updateData
        },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('patients').findOneAndUpdate(
        { patientId: id },
        { 
          $push: { callbackHistory: newCallback },
          $set: updateData
        },
        { returnDocument: 'after' }
      );
    }
    
    if (!result.value) {
      return NextResponse.json({ error: '환자 정보 업데이트에 실패했습니다.' }, { status: 500 });
    }
    
    return NextResponse.json(result.value, { status: 200 });
  } catch (error) {
    console.error('콜백 추가 실패:', error);
    return NextResponse.json({ error: '콜백 추가에 실패했습니다.' }, { status: 500 });
  }
}