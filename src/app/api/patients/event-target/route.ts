// src/app/api/patients/[id]/event-target/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const patientId = params.id;
    const eventTargetInfo = await request.json();

    console.log(`이벤트 타겟 정보 업데이트 시도 - 환자 ID: ${patientId}`, eventTargetInfo);

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

    // 이벤트 타겟 정보 설정
    const now = new Date().toISOString();
    const currentEventTargetInfo = patient.eventTargetInfo || {};
    
    // 새 이벤트 타겟 정보 병합
    let updatedEventTargetInfo = {
      ...currentEventTargetInfo,
      ...eventTargetInfo
    };
    
    // 타켓 지정 또는 해제에 따라 타임스탬프 설정
    if (eventTargetInfo.isEventTarget === true) {
      // 타겟 지정 또는 업데이트
      updatedEventTargetInfo.updatedAt = now;
      
      // 최초 지정 시에만 createdAt 설정
      if (!currentEventTargetInfo.createdAt) {
        updatedEventTargetInfo.createdAt = now;
      }
    } else if (eventTargetInfo.isEventTarget === false) {
      // 타겟 해제 시 타임스탬프 제거
      delete updatedEventTargetInfo.createdAt;
      delete updatedEventTargetInfo.updatedAt;
    }

    // 환자 정보 업데이트
    const updateData = {
      eventTargetInfo: updatedEventTargetInfo,
      updatedAt: now
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

    // ID를 문자열로 변환
    if (result._id && typeof result._id !== 'string') {
      result._id = result._id.toString();
    }
    
    // 호환성을 위해 id 필드가 없다면 _id로 설정
    if (!result.id && result._id) {
      result.id = result._id;
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('이벤트 타겟 정보 업데이트 오류:', error);
    return NextResponse.json({ error: "이벤트 타겟 정보 업데이트에 실패했습니다." }, { status: 500 });
  }
}