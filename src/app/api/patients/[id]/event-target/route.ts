// src/app/api/patients/[id]/event-target/route.ts

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
    
    console.log('이벤트 타겟 API 호출:', { patientId, eventTargetInfo });
    
    // MongoDB 연결
    const { db } = await connectToDatabase();
    
    // 환자 찾기 (여러 방법으로 시도)
    let patient;
    
    // 1. ObjectId로 시도
    if (ObjectId.isValid(patientId)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    }
    
    // 2. id 필드로 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ id: patientId });
    }
    
    // 3. patientId 필드로 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ patientId: patientId });
    }
    
    if (!patient) {
      console.error('환자를 찾을 수 없음:', patientId);
      return NextResponse.json(
        { error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    console.log('환자 찾음:', { id: patient._id, name: patient.name });
    
    // 환자 데이터 업데이트
    const updateData = {
      eventTargetInfo: eventTargetInfo,
      updatedAt: new Date().toISOString()
    };
    
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
      console.error('환자 업데이트 실패');
      return NextResponse.json(
        { error: '환자 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }
    
    // ObjectId를 문자열로 변환
    if (result._id && typeof result._id !== 'string') {
        (result as any)._id = result._id.toString();
      }
    
    // 호환성을 위해 id 필드 설정
    if (!result.id && result._id) {
      result.id = result._id;
    }
    
    console.log('이벤트 타겟 업데이트 성공:', { 
      patientId: result._id, 
      name: result.name,
      isEventTarget: result.eventTargetInfo?.isEventTarget 
    });
    
    return NextResponse.json({
      success: true,
      eventTargetInfo: result.eventTargetInfo,
      patient: result
    });
    
  } catch (error) {
    console.error('이벤트 타겟 정보 업데이트 오류:', error);
    return NextResponse.json(
      { error: '이벤트 타겟 정보 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}