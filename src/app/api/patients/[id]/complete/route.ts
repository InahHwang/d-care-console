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

// 콜백 이력을 바탕으로 다음 콜백 타입 결정
function getCallbackTypeBasedOnHistory(callbackHistory: any[]) {
  if (!callbackHistory || callbackHistory.length === 0) {
    return '1차';
  }
  
  // 완료된 콜백만 고려 (종결 기록 제외)
  const completedCallbacks = callbackHistory.filter(cb => 
    cb.status === '완료' && !cb.isCompletionRecord
  );
  
  // 완료된 콜백 타입들 수집
  const completedTypes = completedCallbacks.map(cb => cb.type);
  
  // 다음 단계 결정
  if (completedTypes.includes('4차')) return '5차';
  if (completedTypes.includes('3차')) return '4차';
  if (completedTypes.includes('2차')) return '3차';
  if (completedTypes.includes('1차')) return '2차';
  
  return '1차';
}

// 한국 시간 기준 오늘 날짜 반환 함수 추가
function getKoreanToday() {
  const now = new Date();
  // UTC+9 (한국 시간) 적용
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime.toISOString().split('T')[0];
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
    
    // 한국 시간 기준 오늘 날짜
    const todayKorean = getKoreanToday();
    
    // 콜백 이력 업데이트 - 수정된 부분
    const callbackHistory = patient.callbackHistory || [];
    
    // 실제 콜백 완료 기록 추가 (바로 종결/예약완료 처리된 경우)
    const actualCallbackRecord = {
      id: `callback-${Date.now()}-${generateUUID()}`,
      date: todayKorean,
      status: '완료',
      notes: isReservationCompletion 
        ? `[상담 내용]\n${reason.replace(/\[예약완료\].*?예약일시:\s*[\d-]+\s+[\d:]+\s*/, '').trim() || '예약 완료 상담'}`
        : `[상담 내용]\n${reason}`,
      type: getCallbackTypeBasedOnHistory(callbackHistory), // 콜백 이력을 바탕으로 타입 결정
      time: undefined,
      customerResponse: 'positive', // 예약완료/종결이므로 긍정적으로 간주
      nextStep: isReservationCompletion ? '예약_확정' : '종결_처리',
      createdAt: new Date().toISOString()
    };
    
    // 종결 기록 생성
    const completionRecord = {
      id: `completion-${Date.now()}-${generateUUID()}`,
      date: todayKorean,
      status: '종결',
      notes: reason,
      type: isReservationCompletion ? '예약완료' : '종결',
      time: undefined,
      isCompletionRecord: true,
      createdAt: new Date().toISOString()
    };

    // 콜백 이력에 실제 콜백 완료 기록과 종결 기록 모두 추가
    const updatedCallbackHistory = [...callbackHistory, actualCallbackRecord, completionRecord];

    // 환자 정보 업데이트
    const updateData = {
      isCompleted: true,
      completedAt: todayKorean,
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