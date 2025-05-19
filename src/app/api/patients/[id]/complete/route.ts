// src/app/api/patients/[id]/complete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// UUID 생성 유틸리티 함수
function generateUUID() {
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, function(c) {
    const r = Math.random() * 16 | 0;
    return r.toString(16);
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const patientId = params.id;
    const data = await request.json();
    const reason = data.reason || '종결 사유 없음';

    console.log(`환자 종결 처리 시도 - 환자 ID: ${patientId}, 사유: ${reason}`);

    // 환자 검색
    let patient;
    
    // 1. ObjectId로 찾기 시도
    if (ObjectId.isValid(patientId)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    }
    
    // 2. id 필드로 찾기 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ id: patientId });
    }
    
    // 3. patientId 필드로 찾기 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ patientId: patientId });
    }
    
    if (!patient) {
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 이미 종결 처리된 경우
    if (patient.isCompleted) {
      return NextResponse.json({ error: "이미 종결 처리된 환자입니다." }, { status: 400 });
    }

    // 예약 완료 여부 확인
    const isReservationCompletion = reason.includes('[예약완료]');
    
    // 종결 기록 생성
    const completionRecord = {
      id: `completion-${Date.now()}-${generateUUID()}`,
      date: new Date().toISOString().split('T')[0],
      status: '종결',
      notes: reason,
      type: isReservationCompletion ? '예약완료' : '종결',
      time: undefined,
      isCompletionRecord: true,
      createdAt: new Date().toISOString()
    };

    // 콜백 이력 업데이트
    const callbackHistory = patient.callbackHistory || [];
    const updatedCallbackHistory = [...callbackHistory, completionRecord];

    // 환자 정보 업데이트
    const updateData = {
      isCompleted: true,
      completedAt: new Date().toISOString().split('T')[0], // YYYY-MM-DD 형식
      completedReason: reason,
      status: isReservationCompletion ? '예약확정' : '종결',
      callbackHistory: updatedCallbackHistory,
      updatedAt: new Date().toISOString()
    };

    // MongoDB에 저장
    let result;
    if (ObjectId.isValid(patientId)) {
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(patientId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    } else if (patient.id) {
      result = await db.collection('patients').findOneAndUpdate(
        { id: patient.id },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('patients').findOneAndUpdate(
        { patientId: patient.patientId },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    }

    if (!result) {
      return NextResponse.json({ error: "환자 정보 업데이트에 실패했습니다." }, { status: 500 });
    }

    const updatedPatient = result;
    
    // ID를 문자열로 변환
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      updatedPatient._id = updatedPatient._id.toString();
    }
    
    // 호환성을 위해 id 필드가 없다면 _id로 설정
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }

    return NextResponse.json({
      updatedPatient,
      callbackHistory: updatedCallbackHistory,
      isReservationCompletion
    }, { status: 200 });
  } catch (error) {
    console.error('환자 종결 처리 오류:', error);
    return NextResponse.json({ error: "환자 종결 처리에 실패했습니다." }, { status: 500 });
  }
}