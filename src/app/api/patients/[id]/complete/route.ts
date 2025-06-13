// src/app/api/patients/[id]/complete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// 🔥 활동 로깅을 위한 함수 추가
async function logActivityToDatabase(activityData: any) {
  try {
    const { db } = await connectToDatabase();
    
    const logEntry = {
      ...activityData,
      timestamp: new Date().toISOString(),
      source: 'backend_api',
      level: 'audit'
    };
    
    await db.collection('activity_logs').insertOne(logEntry);
    console.log('✅ 백엔드 활동 로그 기록 완료:', activityData.action);
  } catch (error) {
    console.warn('⚠️ 백엔드 활동 로그 기록 실패:', error);
    // 로그 실패는 무시하고 계속 진행
  }
}

// 요청 헤더에서 사용자 정보 추출 (임시)
function getCurrentUser(request: NextRequest) {
  // 실제로는 JWT 토큰에서 추출해야 함
  return {
    id: 'temp-user-001',
    name: '임시 관리자'
  };
}

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
    const currentUser = getCurrentUser(request);

    console.log(`환자 종결 처리 시도 - 환자 ID: ${patientId}, 사유: ${reason}`);

    // 🔥 프론트엔드 로깅 스킵 여부 확인
    const skipFrontendLog = request.headers.get('X-Skip-Activity-Log') === 'true';

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
      // 🔥 백엔드 로그 - 환자 찾기 실패
      await logActivityToDatabase({
        action: 'patient_complete_api_error',
        targetId: patientId,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자를 찾을 수 없음',
          reason: reason,
          apiEndpoint: '/api/patients/[id]/complete'
        }
      });
      
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 이미 종결 처리된 경우
    if (patient.isCompleted) {
      // 🔥 백엔드 로그 - 이미 종결됨
      await logActivityToDatabase({
        action: 'patient_complete_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '이미 종결 처리된 환자',
          reason: reason,
          previousCompletedAt: patient.completedAt,
          previousCompletedReason: patient.completedReason,
          apiEndpoint: '/api/patients/[id]/complete'
        }
      });
      
      return NextResponse.json({ error: "이미 종결 처리된 환자입니다." }, { status: 400 });
    }

    // 예약 완료 여부 확인
    const isReservationCompletion = reason.includes('[예약완료]');
    
    // 한국 시간 기준 오늘 날짜
    const todayKorean = getKoreanToday();
    
    // 콜백 이력 업데이트 - 🔥 핵심 수정 부분
    const callbackHistory = patient.callbackHistory || [];
    
    // 🔥 오늘 날짜에 이미 완료된 콜백이 있는지 확인
    const todayCompletedCallback = callbackHistory.find((cb: { date: string; status: string; isCompletionRecord: any; }) => 
      cb.date === todayKorean && 
      cb.status === '완료' && 
      !cb.isCompletionRecord
    );
    
    // 🔥 오늘 완료된 콜백이 있으면 추가 콜백 기록을 생성하지 않음
    let updatedCallbackHistory = [...callbackHistory];
    
    if (!todayCompletedCallback) {
      // 오늘 완료된 콜백이 없는 경우에만 실제 콜백 완료 기록 추가
      const actualCallbackRecord = {
        id: `callback-${Date.now()}-${generateUUID()}`,
        date: todayKorean,
        status: '완료',
        notes: isReservationCompletion 
          ? `[상담 내용]\n${reason.replace(/\[예약완료\].*?예약일시:\s*[\d-]+\s+[\d:]+\s*/, '').trim() || '예약 완료 상담'}`
          : `[상담 내용]\n${reason}`,
        type: getCallbackTypeBasedOnHistory(callbackHistory),
        time: undefined,
        customerResponse: 'positive',
        nextStep: isReservationCompletion ? '예약_확정' : '종결_처리',
        createdAt: new Date().toISOString()
      };
      
      updatedCallbackHistory.push(actualCallbackRecord);
      console.log('새로운 콜백 완료 기록 추가:', actualCallbackRecord.type);
    } else {
      console.log('오늘 이미 완료된 콜백이 있어서 추가 콜백 기록을 생성하지 않음:', todayCompletedCallback.type);
    }
    
    // 종결 기록은 항상 추가 (예약 완료든 일반 종결이든)
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

    updatedCallbackHistory.push(completionRecord);

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
      // 🔥 백엔드 로그 - 업데이트 실패
      await logActivityToDatabase({
        action: 'patient_complete_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자 정보 업데이트 실패',
          reason: reason,
          isReservationCompletion: isReservationCompletion,
          apiEndpoint: '/api/patients/[id]/complete'
        }
      });
      
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

    // 🔥 백엔드 로그 - 환자 종결 성공 (프론트엔드 로깅이 없는 경우에만)
    if (!skipFrontendLog) {
      await logActivityToDatabase({
        action: 'patient_complete_api',
        targetId: patient.id || patient._id,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          reason: reason,
          isReservationCompletion: isReservationCompletion,
          completedAt: todayKorean,
          previousStatus: patient.status,
          newStatus: updateData.status,
          hadTodayCallback: !!todayCompletedCallback,
          callbackRecordsAdded: todayCompletedCallback ? 1 : 2, // 종결 기록만 또는 콜백+종결 기록
          apiEndpoint: '/api/patients/[id]/complete',
          userAgent: request.headers.get('user-agent')?.substring(0, 100)
        }
      });
    }

    console.log(`환자 종결 처리 성공 - 환자 ID: ${patientId}`);

    return NextResponse.json({
      updatedPatient,
      callbackHistory: updatedCallbackHistory,
      isReservationCompletion
    }, { status: 200 });
  } catch (error) {
    console.error('환자 종결 처리 오류:', error);
    
    // 🔥 백엔드 로그 - 예외 발생
    try {
      const currentUser = getCurrentUser(request);
      await logActivityToDatabase({
        action: 'patient_complete_api_exception',
        targetId: params.id,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
          apiEndpoint: '/api/patients/[id]/complete'
        }
      });
    } catch (logError) {
      console.warn('예외 로그 기록 실패:', logError);
    }
    
    return NextResponse.json({ error: "환자 종결 처리에 실패했습니다." }, { status: 500 });
  }
}