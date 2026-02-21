// src/app/api/patients/[id]/callbacks/[callbackId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { format } from 'date-fns';
import { calculatePatientStatus } from '@/utils/patientUtils';

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
  
  if (ObjectId.isValid(patientId)) {
    patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    if (patient) {
      console.log('✅ ObjectId로 환자 찾음:', patient.name);
      return patient;
    }
  }
  
  patient = await db.collection('patients').findOne({ id: patientId });
  if (patient) {
    console.log('✅ id 필드로 환자 찾음:', patient.name);
    return patient;
  }
  
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

// 🔥 내원 콜백 체크 함수
function checkIfVisitManagementCallback(callbackHistory: any[], callbackId: string) {
  const callback = callbackHistory.find((cb: any) => cb.id === callbackId);
  return callback?.isVisitManagementCallback === true;
}

// 🔥 내원 후 상태 초기화 함수
function shouldResetPostVisitStatus(callbackHistory: any[], deletedCallback: any) {
  // 삭제되는 콜백이 내원 관리 콜백이 아니면 초기화하지 않음
  if (!deletedCallback.isVisitManagementCallback) {
    return false;
  }
  
  // 삭제 후에도 다른 내원 관리 콜백이 남아있는지 확인
  const remainingVisitCallbacks = callbackHistory.filter(cb => 
    cb.id !== deletedCallback.id && cb.isVisitManagementCallback === true
  );
  
  // 내원 관리 콜백이 모두 삭제되면 상태 초기화
  return remainingVisitCallbacks.length === 0;
}

// 콜백 업데이트 (PUT) - 기존 로직 유지
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
    
    const patient = await findPatient(db, patientId);
    
    if (!patient) {
      console.error('❌ 환자를 찾을 수 없음:', patientId);
      
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
    
    const callbackHistory = patient.callbackHistory || [];
    const callbackIndex = callbackHistory.findIndex((cb: any) => cb.id === callbackId);
    
    if (callbackIndex === -1) {
      console.error('❌ 콜백을 찾을 수 없음:', callbackId);
      
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
    
    const originalCallback = { ...callbackHistory[callbackIndex] };
    
    // 🔥 수정된 부분: 콜백 데이터 업데이트
    callbackHistory[callbackIndex] = {
      ...callbackHistory[callbackIndex],
      ...updateData,
      updatedAt: new Date().toISOString(),
      // 🆕 상담내용 기록 처리 추가
      ...(updateData.consultationRecord && {
        consultationRecord: updateData.consultationRecord
      }),
      // 기존 완료 처리 로직 유지
      ...(updateData.status === '완료' && !updateData.actualCompletedDate && {
        actualCompletedDate: format(new Date(), 'yyyy-MM-dd'),
        actualCompletedTime: format(new Date(), 'HH:mm'),
        completedAt: new Date().toISOString()
      })
    };

    console.log('🔄 콜백 업데이트 완료:', {
      callbackId,
      originalType: originalCallback.type,
      originalStatus: originalCallback.status,
      newType: callbackHistory[callbackIndex].type,
      newStatus: callbackHistory[callbackIndex].status,
      isVisitManagementCallback: callbackHistory[callbackIndex].isVisitManagementCallback,
      // 🔥 디버깅: 날짜 정보 확인
      originalDate: originalCallback.date,
      updatedDate: callbackHistory[callbackIndex].date,
      actualCompletedDate: callbackHistory[callbackIndex].actualCompletedDate
    });

    // 🔥 콜백 업데이트 후 환자 상태 재계산
    const tempPatient = {
      ...patient,
      callbackHistory: callbackHistory
    } as any;

    console.log('🔥 상태 재계산 전 콜백 히스토리:', {
      patientName: patient.name,
      totalCallbacks: callbackHistory.length,
      callbackDetails: callbackHistory.map((cb: { id: any; type: any; status: any; date: any; isCompletionRecord: any; }, idx: any) => ({
        index: idx,
        id: cb.id,
        type: cb.type,
        status: cb.status,
        date: cb.date,
        isCompletionRecord: cb.isCompletionRecord
      }))
    });

    const newStatus = calculatePatientStatus(tempPatient);

    const patientUpdateData = {
      callbackHistory,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    console.log('🔥 calculatePatientStatus 결과:', {
      patientName: patient.name,
      previousStatus: patient.status,
      calculatedStatus: newStatus,
      hasScheduledCallbacks: callbackHistory.some((cb: { status: string; isCompletionRecord: any; }) => cb.status === '예정' && !cb.isCompletionRecord),
      scheduledCallbacks: callbackHistory.filter((cb: { status: string; isCompletionRecord: any; }) => cb.status === '예정' && !cb.isCompletionRecord)
    });
    
    const result = await updatePatientData(db, patient, patientId, patientUpdateData);
    
    if (!result) {
      console.error('❌ 환자 정보 업데이트 실패');
      
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
    
    const updatedPatient = result;
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      (updatedPatient as any)._id = updatedPatient._id.toString();
    }
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }
    
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
      error: '콜백 업데이트에 실패했습니다.'
    }, { status: 500 });
  }
}

// 🔥 콜백 삭제 (DELETE) - 수정된 버전 (환자 상태 업데이트 포함)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, callbackId: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const { id: patientId, callbackId } = params;
    const currentUser = getCurrentUser(request);
    
    console.log(`🗑️ 콜백 삭제 시도 - 환자: ${patientId}, 콜백: ${callbackId}`);
    
    const patient = await findPatient(db, patientId);
    
    if (!patient) {
      console.error('❌ 환자를 찾을 수 없음:', patientId);
      
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
    
    const callbackHistory = patient.callbackHistory || [];
    const callbackIndex = callbackHistory.findIndex((cb: any) => cb.id === callbackId);
    
    if (callbackIndex === -1) {
      console.error('❌ 콜백을 찾을 수 없음:', callbackId);
      
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
    
    // 🔥 콜백 삭제
    callbackHistory.splice(callbackIndex, 1);
    
    console.log('🗑️ 콜백 삭제 완료:', {
      callbackId,
      deletedType: deletedCallback.type,
      deletedStatus: deletedCallback.status,
      isVisitManagementCallback: deletedCallback.isVisitManagementCallback,
      remainingCallbacks: callbackHistory.length
    });
    
    // 🔥 환자 정보 업데이트 데이터 준비
    const patientUpdateData: any = {
      callbackHistory,
      updatedAt: new Date().toISOString()
    };
    
    // 🔥 내원 후 상태 초기화 여부 확인
    if (shouldResetPostVisitStatus(callbackHistory, deletedCallback)) {
      console.log('🔄 내원 관리 콜백이 모두 삭제됨 - 내원 후 상태 초기화');
      
      // 내원 후 상태를 "상태 미설정"으로 변경
      patientUpdateData.postVisitStatus = '';
      
      // 내원 후 상담 정보에서 다음 콜백 관련 정보 제거
      if (patient.postVisitConsultation) {
        patientUpdateData.postVisitConsultation = {
          ...patient.postVisitConsultation,
          nextCallbackDate: undefined,
          nextConsultationPlan: undefined
        };
      }
      
      // 다른 관련 필드들도 초기화
      patientUpdateData.nextCallbackDate = '';
      patientUpdateData.nextVisitDate = '';
      
      console.log('🔄 환자 상태 초기화 완료:', {
        postVisitStatus: '상태 미설정',
        clearedFields: ['nextCallbackDate', 'nextVisitDate', 'postVisitConsultation.nextCallbackDate']
      });
    }
    
    const result = await updatePatientData(db, patient, patientId, patientUpdateData);
    
    if (!result) {
      console.error('❌ 환자 정보 업데이트 실패');
      
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
        patientStatusReset: shouldResetPostVisitStatus(callbackHistory, deletedCallback),
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
      },
      patientStatusReset: shouldResetPostVisitStatus(callbackHistory, deletedCallback)
    }, { status: 200 });
    
  } catch (error) {
    console.error('💥 콜백 삭제 실패:', error);
    
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
      error: '콜백 삭제에 실패했습니다.'
    }, { status: 500 });
  }
}

// 🔥 콜백 조회 (GET) - 기존 로직 유지
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string, callbackId: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const { id: patientId, callbackId } = params;
    
    console.log(`🔍 콜백 조회 시도 - 환자: ${patientId}, 콜백: ${callbackId}`);
    
    const patient = await findPatient(db, patientId);
    
    if (!patient) {
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
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
      error: '콜백 조회에 실패했습니다.'
    }, { status: 500 });
  }
}