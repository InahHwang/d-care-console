// src/app/api/patients/[id]/callbacks/[callbackId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; callbackId: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const patientId = params.id;
    const callbackId = params.callbackId;

    console.log(`콜백 삭제 시도 - 환자 ID: ${patientId}, 콜백 ID: ${callbackId}`);

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

    // 콜백 이력이 없는 경우
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
      return NextResponse.json({ error: "이 환자의 콜백 이력이 없습니다." }, { status: 404 });
    }

    // 삭제할 콜백 찾기
    const callbackIndex = patient.callbackHistory.findIndex((cb: any) => cb.id === callbackId);
    
    if (callbackIndex === -1) {
      return NextResponse.json({ error: "해당 콜백을 찾을 수 없습니다." }, { status: 404 });
    }

    // 삭제할 콜백 정보 저장
    const deletedCallbackInfo = {
      type: patient.callbackHistory[callbackIndex].type,
      status: patient.callbackHistory[callbackIndex].status
    };

    // 콜백 삭제
    const updatedCallbackHistory = [...patient.callbackHistory];
    updatedCallbackHistory.splice(callbackIndex, 1);

    // 환자 정보 업데이트
    const updateData = {
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
      deletedCallbackInfo
    }, { status: 200 });
  } catch (error) {
    console.error('콜백 삭제 오류:', error);
    return NextResponse.json({ error: "콜백 삭제에 실패했습니다." }, { status: 500 });
  }
}