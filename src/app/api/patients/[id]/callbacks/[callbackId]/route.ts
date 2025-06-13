// src/app/api/patients/[id]/callbacks/[callbackId]/route.ts

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; callbackId: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const patientId = params.id;
    const callbackId = params.callbackId;
    const currentUser = getCurrentUser(request);

    console.log(`콜백 삭제 시도 - 환자 ID: ${patientId}, 콜백 ID: ${callbackId}`);

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
        action: 'callback_delete_api_error',
        targetId: patientId,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자를 찾을 수 없음',
          callbackId: callbackId,
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
        }
      });
      
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 콜백 이력이 없는 경우
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
      // 🔥 백엔드 로그 - 콜백 이력 없음
      await logActivityToDatabase({
        action: 'callback_delete_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '콜백 이력이 없음',
          callbackId: callbackId,
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
        }
      });
      
      return NextResponse.json({ error: "이 환자의 콜백 이력이 없습니다." }, { status: 404 });
    }

    // 삭제할 콜백 찾기
    const callbackIndex = patient.callbackHistory.findIndex((cb: any) => cb.id === callbackId);
    
    if (callbackIndex === -1) {
      // 🔥 백엔드 로그 - 콜백 찾기 실패
      await logActivityToDatabase({
        action: 'callback_delete_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '해당 콜백을 찾을 수 없음',
          callbackId: callbackId,
          availableCallbacks: patient.callbackHistory.map((cb: any) => cb.id),
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
        }
      });
      
      return NextResponse.json({ error: "해당 콜백을 찾을 수 없습니다." }, { status: 404 });
    }

    // 삭제할 콜백 정보 저장 (로그용)
    const callbackToDelete = patient.callbackHistory[callbackIndex];
    const deletedCallbackInfo = {
      type: callbackToDelete.type,
      status: callbackToDelete.status,
      date: callbackToDelete.date,
      notes: callbackToDelete.notes
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
      // 🔥 백엔드 로그 - 업데이트 실패
      await logActivityToDatabase({
        action: 'callback_delete_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자 정보 업데이트 실패',
          callbackId: callbackId,
          callbackType: callbackToDelete.type,
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
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

    // 🔥 백엔드 로그 - 콜백 삭제 성공 (프론트엔드 로깅이 없는 경우에만)
    if (!skipFrontendLog) {
      await logActivityToDatabase({
        action: 'callback_delete_api',
        targetId: patient.id || patient._id,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          callbackId: callbackId,
          callbackType: callbackToDelete.type,
          callbackDate: callbackToDelete.date,
          callbackStatus: callbackToDelete.status,
          callbackNotes: callbackToDelete.notes?.substring(0, 200), // 길이 제한
          deletedCallbackInfo: deletedCallbackInfo,
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]',
          userAgent: request.headers.get('user-agent')?.substring(0, 100)
        }
      });
    }

    console.log(`콜백 삭제 성공 - 환자 ID: ${patientId}, 콜백 ID: ${callbackId}`);

    return NextResponse.json({
      updatedPatient,
      deletedCallbackInfo
    }, { status: 200 });
  } catch (error) {
    console.error('콜백 삭제 오류:', error);
    
    // 🔥 백엔드 로그 - 예외 발생
    try {
      const currentUser = getCurrentUser(request);
      await logActivityToDatabase({
        action: 'callback_delete_api_exception',
        targetId: params.id,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
          callbackId: params.callbackId,
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
        }
      });
    } catch (logError) {
      console.warn('예외 로그 기록 실패:', logError);
    }
    
    return NextResponse.json({ error: "콜백 삭제에 실패했습니다." }, { status: 500 });
  }
}