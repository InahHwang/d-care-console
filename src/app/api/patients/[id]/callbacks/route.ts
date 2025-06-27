// src/app/api/patients/[id]/callbacks/route.ts

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const id = params.id;
    const callbackData = await request.json();
    const currentUser = getCurrentUser(request);
    
    console.log(`콜백 추가 시도 - 환자 ID: ${id}`, callbackData);
    
    // 🔥 프론트엔드 로깅 스킵 여부 확인
    const skipFrontendLog = request.headers.get('X-Skip-Activity-Log') === 'true';
    
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
      
      // 🔥 백엔드 로그 - 환자 찾기 실패
      await logActivityToDatabase({
        action: 'callback_create_api_error',
        targetId: id,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자를 찾을 수 없음',
          callbackData: callbackData,
          apiEndpoint: '/api/patients/[id]/callbacks'
        }
      });
      
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 🔥 자동 연동 로직 제거 - 프론트엔드에서 처리
    // 콜백 데이터를 그대로 사용
    
    // 콜백 ID 생성
    const callbackId = `cb-${Date.now()}`;
    const newCallback = {
      id: callbackId,
      ...callbackData,
      time: typeof callbackData.time === 'string' ? callbackData.time : undefined
    };
    
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
      // 🔥 백엔드 로그 - 업데이트 실패
      await logActivityToDatabase({
        action: 'callback_create_api_error',
        targetId: id,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자 정보 업데이트 실패',
          callbackData: callbackData,
          apiEndpoint: '/api/patients/[id]/callbacks'
        }
      });
      
      return NextResponse.json({ error: '환자 정보 업데이트에 실패했습니다.' }, { status: 500 });
    }
    
    // ObjectId를 문자열로 변환
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
        (updatedPatient as any)._id = updatedPatient._id.toString();
      }
    
    // 호환성을 위해 id 필드가 없거나 undefined면 _id로 설정
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }
    
    // 🔥 백엔드 로그 - 콜백 생성 성공 (프론트엔드 로깅이 없는 경우에만)
    if (!skipFrontendLog) {
      await logActivityToDatabase({
        action: 'callback_create_api',
        targetId: patient.id || patient._id,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          callbackId: callbackId,
          callbackType: callbackData.type,
          callbackDate: callbackData.date,
          callbackStatus: callbackData.status,
          previousStatus: patient.status,
          newStatus: updateData.status,
          apiEndpoint: '/api/patients/[id]/callbacks',
          userAgent: request.headers.get('user-agent')?.substring(0, 100) // 길이 제한
        }
      });
    }
    
    console.log(`콜백 추가 성공 - 환자 ID: ${id}, 콜백 ID: ${callbackId}`);
    
    return NextResponse.json(updatedPatient, { status: 200 });
  } catch (error) {
    console.error('콜백 추가 실패:', error);
    
    // 🔥 백엔드 로그 - 예외 발생
    try {
      const currentUser = getCurrentUser(request);
      await logActivityToDatabase({
        action: 'callback_create_api_exception',
        targetId: params.id,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
          apiEndpoint: '/api/patients/[id]/callbacks'
        }
      });
    } catch (logError) {
      console.warn('예외 로그 기록 실패:', logError);
    }
    
    return NextResponse.json({ error: '환자 정보 업데이트에 실패했습니다.' }, { status: 500 });
  }
}