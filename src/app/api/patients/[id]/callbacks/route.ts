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
    
    console.log(`콜백 추가 시도 - 환자 ID: ${id}`, callbackData);
    
    // 콜백 ID 생성
    const callbackId = `cb-${Date.now()}`;
    const newCallback = {
      id: callbackId,
      ...callbackData,
      time: typeof callbackData.time === 'string' ? callbackData.time : undefined
    };
    
    // 먼저 환자 찾기
    let patient;
    
    // 1. MongoDB ObjectId로 시도
    if (ObjectId.isValid(id)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(id) });
    }
    
    // 2. id 필드로 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ id: id });
    }
    
    // 3. patientId 필드로 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ patientId: id });
    }
    
    if (!patient) {
      console.error(`환자를 찾을 수 없음: ${id}`);
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
    
    // 기존 콜백 이력 가져오기
    const callbackHistory = patient.callbackHistory || [];
    
    // 환자 정보 업데이트
    let result;
    if (ObjectId.isValid(id)) {
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { 
          $set: {
            ...updateData,
            callbackHistory: [...callbackHistory, newCallback]
          }
        },
        { returnDocument: 'after' }
      );
    } else if (patient.id) {
      result = await db.collection('patients').findOneAndUpdate(
        { id: patient.id },
        { 
          $set: {
            ...updateData,
            callbackHistory: [...callbackHistory, newCallback]
          }
        },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('patients').findOneAndUpdate(
        { patientId: patient.patientId },
        { 
          $set: {
            ...updateData,
            callbackHistory: [...callbackHistory, newCallback]
          }
        },
        { returnDocument: 'after' }
      );
    }
    
    // MongoDB 드라이버 버전에 따라 응답 구조 처리
    const updatedPatient = result;
    
    if (!updatedPatient) {
      return NextResponse.json({ error: '환자 정보 업데이트에 실패했습니다.' }, { status: 500 });
    }
    
    // ObjectId를 문자열로 변환
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      updatedPatient._id = updatedPatient._id.toString();
    }
    
    // 호환성을 위해 id 필드가 없거나 undefined면 _id로 설정
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }
    
    console.log(`콜백 추가 성공 - 환자 ID: ${id}, 콜백 ID: ${callbackId}`);
    
    return NextResponse.json(updatedPatient, { status: 200 });
  } catch (error) {
    console.error('콜백 추가 실패:', error);
    return NextResponse.json({ error: '환자 정보 업데이트에 실패했습니다.' }, { status: 500 });
  }
}