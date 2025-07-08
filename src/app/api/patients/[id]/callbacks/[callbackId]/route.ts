// src/app/api/patients/[id]/callbacks/[callbackId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { format } from 'date-fns';

// 🔥 활동 로깅을 위한 함수
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
    console.log('✅ 콜백 API 활동 로그 기록 완료:', activityData.action);
  } catch (error) {
    console.warn('⚠️ 콜백 API 활동 로그 기록 실패:', error);
    // 로그 실패는 무시하고 계속 진행
  }
}

// 요청 헤더에서 사용자 정보 추출 (임시)
function getCurrentUser(request: NextRequest) {
  return {
    id: 'temp-user-001',
    name: '임시 관리자'
  };
}

// 🔥 환자 찾기 헬퍼 함수
async function findPatient(db: any, patientId: string) {
  let patient;
  
  // 1. MongoDB ObjectId로 시도
  if (ObjectId.isValid(patientId)) {
    patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    if (patient) {
      console.log('✅ ObjectId로 환자 찾음:', patient.name);
      return patient;
    }
  }
  
  // 2. id 필드로 시도
  patient = await db.collection('patients').findOne({ id: patientId });
  if (patient) {
    console.log('✅ id 필드로 환자 찾음:', patient.name);
    return patient;
  }
  
  // 3. patientId 필드로 시도
  patient = await db.collection('patients').findOne({ patientId: patientId });
  if (patient) {
    console.log('✅ patientId 필드로 환자 찾음:', patient.name);
    return patient;
  }
  
  return null;
}

// 🔥 환자 업데이트 헬퍼 함수
async function updatePatientData(db: any, patient: any, patientId: string, updateData: any) {
  let result;
  
  if (ObjectId.isValid(patientId) && patient._id) {
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
  
  return result;
}

// 콜백 업데이트 (PUT)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string, callbackId: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const { id: patientId, callbackId } = params;
    const updateData = await request.json();
    const currentUser = getCurrentUser(request);
    
    console.log(`🔄 콜백 업데이트 시도 - 환자: ${patientId}, 콜백: ${callbackId}`);
    console.log('📝 업데이트 데이터:', updateData);
    
    // 환자 찾기
    const patient = await findPatient(db, patientId);
    
    if (!patient) {
      console.error('❌ 환자를 찾을 수 없음:', patientId);
      
      // 🔥 에러 로그 기록
      await logActivityToDatabase({
        action: 'callback_update_api_error',
        targetId: patientId,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자를 찾을 수 없음',
          callbackId: callbackId,
          updateData: updateData,
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
        }
      });
      
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 콜백 이력에서 해당 콜백 찾기 및 업데이트
    const callbackHistory = patient.callbackHistory || [];
    const callbackIndex = callbackHistory.findIndex((cb: any) => cb.id === callbackId);
    
    if (callbackIndex === -1) {
      console.error('❌ 콜백을 찾을 수 없음:', callbackId);
      
      // 🔥 에러 로그 기록
      await logActivityToDatabase({
        action: 'callback_update_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '콜백을 찾을 수 없음',
          callbackId: callbackId,
          availableCallbacks: callbackHistory.map((cb: any) => ({ id: cb.id, type: cb.type, status: cb.status })),
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
        }
      });
      
      return NextResponse.json({ error: '콜백을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 🔥 기존 콜백 데이터 백업 (로깅용)
    const originalCallback = { ...callbackHistory[callbackIndex] };
    
    // 콜백 데이터 업데이트
    callbackHistory[callbackIndex] = {
      ...callbackHistory[callbackIndex],
      ...updateData,
      updatedAt: new Date().toISOString(),
      // 🔥 완료 처리 시 현재 시간으로 업데이트
      ...(updateData.status === '완료' && {
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        completedAt: new Date().toISOString()
      })
    };
    
    console.log('🔄 콜백 업데이트 완료:', {
      callbackId,
      originalType: originalCallback.type,
      originalStatus: originalCallback.status,
      newType: callbackHistory[callbackIndex].type,
      newStatus: callbackHistory[callbackIndex].status,
      isVisitManagementCallback: callbackHistory[callbackIndex].isVisitManagementCallback
    });
    
    // 환자 정보 업데이트
    const patientUpdateData = {
      callbackHistory,
      updatedAt: new Date().toISOString()
    };
    
    const result = await updatePatientData(db, patient, patientId, patientUpdateData);
    
    if (!result) {
      console.error('❌ 환자 정보 업데이트 실패');
      
      // 🔥 에러 로그 기록
      await logActivityToDatabase({
        action: 'callback_update_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자 정보 업데이트 실패',
          callbackId: callbackId,
          updateData: updateData,
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
        }
      });
      
      return NextResponse.json({ error: '콜백 업데이트에 실패했습니다.' }, { status: 500 });
    }
    
    // ObjectId를 문자열로 변환
    const updatedPatient = result;
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      (updatedPatient as any)._id = updatedPatient._id.toString();
    }
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }
    
    // 🔥 성공 로그 기록
    await logActivityToDatabase({
      action: 'callback_update_api_success',
      targetId: patient.id || patient._id,
      targetName: patient.name,
      userId: currentUser.id,
      userName: currentUser.name,
      details: {
        callbackId: callbackId,
        callbackType: callbackHistory[callbackIndex].type,
        previousStatus: originalCallback.status,
        newStatus: callbackHistory[callbackIndex].status,
        isVisitManagementCallback: callbackHistory[callbackIndex].isVisitManagementCallback || false,
        visitManagementReason: callbackHistory[callbackIndex].visitManagementReason,
        apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]',
        userAgent: request.headers.get('user-agent')?.substring(0, 100)
      }
    });
    
    console.log('✅ 콜백 업데이트 성공');
    return NextResponse.json(updatedPatient, { status: 200 });
    
  } catch (error) {
    console.error('💥 콜백 업데이트 실패:', error);
    
    // 🔥 예외 로그 기록
    try {
      const currentUser = getCurrentUser(request);
      await logActivityToDatabase({
        action: 'callback_update_api_exception',
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
    
    return NextResponse.json({ 
      error: '콜백 업데이트에 실패했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// 콜백 삭제 (DELETE)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, callbackId: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const { id: patientId, callbackId } = params;
    const currentUser = getCurrentUser(request);
    
    console.log(`🗑️ 콜백 삭제 시도 - 환자: ${patientId}, 콜백: ${callbackId}`);
    
    // 환자 찾기
    const patient = await findPatient(db, patientId);
    
    if (!patient) {
      console.error('❌ 환자를 찾을 수 없음:', patientId);
      
      // 🔥 에러 로그 기록
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
      
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 콜백 이력에서 해당 콜백 찾기
    const callbackHistory = patient.callbackHistory || [];
    const callbackIndex = callbackHistory.findIndex((cb: any) => cb.id === callbackId);
    
    if (callbackIndex === -1) {
      console.error('❌ 콜백을 찾을 수 없음:', callbackId);
      
      // 🔥 에러 로그 기록
      await logActivityToDatabase({
        action: 'callback_delete_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '콜백을 찾을 수 없음',
          callbackId: callbackId,
          availableCallbacks: callbackHistory.map((cb: any) => ({ id: cb.id, type: cb.type, status: cb.status })),
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
        }
      });
      
      return NextResponse.json({ error: '콜백을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 🔥 삭제될 콜백 정보 백업 (로깅용)
    const deletedCallback = { ...callbackHistory[callbackIndex] };
    
    // 콜백 삭제
    callbackHistory.splice(callbackIndex, 1);
    
    console.log('🗑️ 콜백 삭제 완료:', {
      callbackId,
      deletedType: deletedCallback.type,
      deletedStatus: deletedCallback.status,
      isVisitManagementCallback: deletedCallback.isVisitManagementCallback,
      remainingCallbacks: callbackHistory.length
    });
    
    // 환자 정보 업데이트
    const patientUpdateData = {
      callbackHistory,
      updatedAt: new Date().toISOString()
    };
    
    const result = await updatePatientData(db, patient, patientId, patientUpdateData);
    
    if (!result) {
      console.error('❌ 환자 정보 업데이트 실패');
      
      // 🔥 에러 로그 기록
      await logActivityToDatabase({
        action: 'callback_delete_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자 정보 업데이트 실패',
          callbackId: callbackId,
          deletedCallback: deletedCallback,
          apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]'
        }
      });
      
      return NextResponse.json({ error: '콜백 삭제에 실패했습니다.' }, { status: 500 });
    }
    
    // ObjectId를 문자열로 변환
    const updatedPatient = result;
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      (updatedPatient as any)._id = updatedPatient._id.toString();
    }
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }
    
    // 🔥 성공 로그 기록
    await logActivityToDatabase({
      action: 'callback_delete_api_success',
      targetId: patient.id || patient._id,
      targetName: patient.name,
      userId: currentUser.id,
      userName: currentUser.name,
      details: {
        callbackId: callbackId,
        deletedCallbackType: deletedCallback.type,
        deletedCallbackStatus: deletedCallback.status,
        isVisitManagementCallback: deletedCallback.isVisitManagementCallback || false,
        visitManagementReason: deletedCallback.visitManagementReason,
        remainingCallbacksCount: callbackHistory.length,
        apiEndpoint: '/api/patients/[id]/callbacks/[callbackId]',
        userAgent: request.headers.get('user-agent')?.substring(0, 100)
      }
    });
    
    console.log('✅ 콜백 삭제 성공');
    return NextResponse.json({
      success: true,
      message: '콜백이 삭제되었습니다.',
      updatedPatient,
      deletedCallbackInfo: {
        id: deletedCallback.id,
        type: deletedCallback.type,
        status: deletedCallback.status,
        date: deletedCallback.date,
        isVisitManagementCallback: deletedCallback.isVisitManagementCallback
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('💥 콜백 삭제 실패:', error);
    
    // 🔥 예외 로그 기록
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
    
    return NextResponse.json({ 
      error: '콜백 삭제에 실패했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// 🔥 콜백 조회 (GET) - 선택적 기능
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string, callbackId: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const { id: patientId, callbackId } = params;
    
    console.log(`🔍 콜백 조회 시도 - 환자: ${patientId}, 콜백: ${callbackId}`);
    
    // 환자 찾기
    const patient = await findPatient(db, patientId);
    
    if (!patient) {
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 콜백 찾기
    const callback = patient.callbackHistory?.find((cb: any) => cb.id === callbackId);
    
    if (!callback) {
      return NextResponse.json({ error: '콜백을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    console.log('✅ 콜백 조회 성공:', {
      callbackId,
      type: callback.type,
      status: callback.status,
      isVisitManagementCallback: callback.isVisitManagementCallback
    });
    
    return NextResponse.json({
      success: true,
      callback,
      patient: {
        id: patient.id || patient._id,
        name: patient.name,
        phoneNumber: patient.phoneNumber
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('💥 콜백 조회 실패:', error);
    return NextResponse.json({ 
      error: '콜백 조회에 실패했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}