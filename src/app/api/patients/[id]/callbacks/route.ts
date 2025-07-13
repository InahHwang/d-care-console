// src/app/api/patients/[id]/callbacks/route.ts - 새로운 첫 상담 후 상태 관리 지원 + 원래 날짜 보존 (완전한 코드)

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
    
    // 콜백 ID 생성
    const callbackId = `cb-${Date.now()}`;
    const newCallback = {
      id: callbackId,
      ...callbackData,
      time: typeof callbackData.time === 'string' ? callbackData.time : undefined,
      createdAt: new Date().toISOString()
    };
    
    // 🔥 새로운 상태별 환자 정보 업데이트 로직
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    
    // 🔥 첫 상담 후 상태에 따른 환자 정보 업데이트
    if (callbackData.firstConsultationResult) {
      const result = callbackData.firstConsultationResult;
      
      switch (result.status) {
        case '예약완료':
          updateData.status = '예약확정';
          updateData.reservationDate = result.reservationDate;
          updateData.reservationTime = result.reservationTime;
          updateData.currentConsultationStage = 'completed';
          updateData.lastFirstConsultationResult = result;
          break;
          
        case '상담진행중':
        case '부재중':
          updateData.status = result.status === '부재중' ? '부재중' : '콜백필요';
          updateData.nextCallbackDate = result.callbackDate;
          updateData.currentConsultationStage = 'callback';
          updateData.lastFirstConsultationResult = result;
          break;
          
        case '종결':
          updateData.status = '종결';
          updateData.isCompleted = true;
          updateData.completedAt = new Date().toISOString();
          updateData.completedReason = result.terminationReason;
          updateData.currentConsultationStage = 'completed';
          updateData.lastFirstConsultationResult = result;
          break;
      }
    }
    
    // 🔥 예약 후 미내원 상태에 따른 업데이트 - "재예약 완료" 케이스 추가
    if (callbackData.postReservationResult) {
      const result = callbackData.postReservationResult;
      
      switch (result.status) {
        case '재예약 완료':  // 🔥 새로 추가
          updateData.status = '재예약확정'; // 🔥 "예약확정"에서 "재예약확정"으로 변경
          updateData.reservationDate = result.reReservationDate;
          updateData.reservationTime = result.reReservationTime;
          updateData.isPostReservationPatient = false; // 현재 미내원 상태는 해제
          updateData.hasBeenPostReservationPatient = true; // 🔥 한번 미내원했던 기록은 유지
          updateData.lastPostReservationResult = result;
          console.log(`재예약 완료 처리: ${result.reReservationDate} ${result.reReservationTime}`);
          break;
          
        case '다음 콜백필요':  // 🔥 "재콜백등록"에서 변경
          updateData.status = '콜백필요';
          updateData.nextCallbackDate = result.callbackDate;
          updateData.isPostReservationPatient = true;
          updateData.hasBeenPostReservationPatient = true; // 🔥 미내원 기록 유지
          updateData.lastPostReservationResult = result;
          break;
          
        case '부재중':        // 🔥 부재중은 단순 상태 변경만
          updateData.status = '부재중';
          updateData.isPostReservationPatient = true;
          updateData.hasBeenPostReservationPatient = true; // 🔥 미내원 기록 유지
          updateData.lastPostReservationResult = result;
          break;
          
        case '종결':
          updateData.status = '종결';
          updateData.isCompleted = true;
          updateData.completedAt = new Date().toISOString();
          updateData.completedReason = result.terminationReason;
          updateData.isPostReservationPatient = false;
          updateData.hasBeenPostReservationPatient = true; // 🔥 종결되어도 미내원 기록은 유지
          updateData.lastPostReservationResult = result;
          break;
      }
    }
    
    // 🔥 콜백 후속 상태에 따른 업데이트
    if (callbackData.callbackFollowupResult) {
      const result = callbackData.callbackFollowupResult;
      
      switch (result.status) {
        case '예약완료':
          updateData.status = '예약확정';
          updateData.reservationDate = result.reservationDate;
          updateData.reservationTime = result.reservationTime;
          updateData.currentConsultationStage = 'completed';
          break;
          
        case '부재중':
        case '상담중':
          updateData.status = result.status === '부재중' ? '부재중' : '콜백필요';
          updateData.nextCallbackDate = result.nextCallbackDate;
          updateData.currentConsultationStage = 'callback';
          break;
      }
    }
    
    // 기본 콜백 상태에 따른 업데이트 (기존 로직)
    if (!callbackData.firstConsultationResult && !callbackData.postReservationResult && !callbackData.callbackFollowupResult) {
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
          firstConsultationResult: callbackData.firstConsultationResult,
          postReservationResult: callbackData.postReservationResult,
          callbackFollowupResult: callbackData.callbackFollowupResult,
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

// 🔥 콜백 업데이트를 위한 PUT 메서드 - 원래 날짜 보존 로직 추가
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const patientId = params.id;
    const url = new URL(request.url);
    const callbackId = url.searchParams.get('callbackId');
    const updateData = await request.json();
    const currentUser = getCurrentUser(request);
    
    if (!callbackId) {
      return NextResponse.json({ error: '콜백 ID가 필요합니다.' }, { status: 400 });
    }
    
    console.log(`콜백 업데이트 시도 - 환자 ID: ${patientId}, 콜백 ID: ${callbackId}`, updateData);
    
    // 환자 찾기
    let patient;
    if (ObjectId.isValid(patientId)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    } else {
      patient = await db.collection('patients').findOne({ 
        $or: [{ id: patientId }, { patientId: patientId }]
      });
    }
    
    if (!patient) {
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 콜백 이력에서 해당 콜백 찾기
    const callbackHistory = patient.callbackHistory || [];
    const callbackIndex = callbackHistory.findIndex((cb: any) => cb.id === callbackId);
    
    if (callbackIndex === -1) {
      return NextResponse.json({ error: '콜백을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 🔥 원래 콜백 정보 보존
    const originalCallback = callbackHistory[callbackIndex];
    
    // 🔥 콜백 정보 업데이트 - 원래 date, time은 보존하고 실제 처리 정보만 추가
    const updatedCallback = {
      ...originalCallback,
      ...updateData,
      // 🔥 원래 예정된 날짜/시간 보존 (updateData에 date, time이 있어도 덮어쓰지 않음)
      date: originalCallback.date,
      time: originalCallback.time,
      // 🔥 실제 처리 시간은 별도 필드로 저장
      actualCompletedDate: updateData.actualCompletedDate || originalCallback.actualCompletedDate,
      actualCompletedTime: updateData.actualCompletedTime || originalCallback.actualCompletedTime,
      updatedAt: new Date().toISOString()
    };
    
    // 🔥 로그를 위해 원래 날짜와 실제 처리 날짜 구분해서 출력
    if (updateData.actualCompletedDate && updateData.actualCompletedTime) {
      console.log(`🔥 콜백 완료 처리:`, {
        callbackType: originalCallback.type,
        originalScheduled: `${originalCallback.date} ${originalCallback.time || '시간미정'}`,
        actualCompleted: `${updateData.actualCompletedDate} ${updateData.actualCompletedTime}`,
        status: updateData.status
      });
    }
    
    callbackHistory[callbackIndex] = updatedCallback;
    
    // 🔥 상태별 환자 정보 업데이트 (POST와 동일한 로직 적용)
    const patientUpdateData: any = {
      updatedAt: new Date().toISOString(),
      callbackHistory
    };
    
    // 첫 상담 결과가 있는 경우
    if (updateData.firstConsultationResult) {
      const result = updateData.firstConsultationResult;
      
      switch (result.status) {
        case '예약완료':
          patientUpdateData.status = '예약확정';
          patientUpdateData.reservationDate = result.reservationDate;
          patientUpdateData.reservationTime = result.reservationTime;
          patientUpdateData.currentConsultationStage = 'completed';
          patientUpdateData.lastFirstConsultationResult = result;
          break;
          
        case '상담진행중':
        case '부재중':
          patientUpdateData.status = result.status === '부재중' ? '부재중' : '콜백필요';
          patientUpdateData.nextCallbackDate = result.callbackDate;
          patientUpdateData.currentConsultationStage = 'callback';
          patientUpdateData.lastFirstConsultationResult = result;
          break;
          
        case '종결':
          patientUpdateData.status = '종결';
          patientUpdateData.isCompleted = true;
          patientUpdateData.completedAt = new Date().toISOString();
          patientUpdateData.completedReason = result.terminationReason;
          patientUpdateData.currentConsultationStage = 'completed';
          patientUpdateData.lastFirstConsultationResult = result;
          break;
      }
    }
    
    // 🔥 예약 후 미내원 결과가 있는 경우 - "재예약 완료" 케이스 추가
    if (updateData.postReservationResult) {
      const result = updateData.postReservationResult;
      
      switch (result.status) {
        case '재예약 완료':  // 🔥 새로 추가
          patientUpdateData.status = '예약확정';
          patientUpdateData.reservationDate = result.reReservationDate;
          patientUpdateData.reservationTime = result.reReservationTime;
          patientUpdateData.isPostReservationPatient = false; // 현재 미내원 상태는 해제
          patientUpdateData.hasBeenPostReservationPatient = true; // 🔥 한번 미내원했던 기록은 유지
          patientUpdateData.lastPostReservationResult = result;
          console.log(`재예약 완료 업데이트: ${result.reReservationDate} ${result.reReservationTime}`);
          break;
          
        case '다음 콜백필요':  // 🔥 "재콜백등록"에서 변경
          patientUpdateData.status = '콜백필요';
          patientUpdateData.nextCallbackDate = result.callbackDate;
          patientUpdateData.isPostReservationPatient = true;
          patientUpdateData.hasBeenPostReservationPatient = true; // 🔥 미내원 기록 유지
          patientUpdateData.lastPostReservationResult = result;
          break;
          
        case '부재중':        // 🔥 부재중은 단순 상태 변경만
          patientUpdateData.status = '부재중';
          patientUpdateData.isPostReservationPatient = true;
          patientUpdateData.hasBeenPostReservationPatient = true; // 🔥 미내원 기록 유지
          patientUpdateData.lastPostReservationResult = result;
          break;
          
        case '종결':
          patientUpdateData.status = '종결';
          patientUpdateData.isCompleted = true;
          patientUpdateData.completedAt = new Date().toISOString();
          patientUpdateData.completedReason = result.terminationReason;
          patientUpdateData.isPostReservationPatient = false;
          patientUpdateData.hasBeenPostReservationPatient = true; // 🔥 종결되어도 미내원 기록은 유지
          patientUpdateData.lastPostReservationResult = result;
          break;
      }
    }
    
    // 콜백 후속 결과가 있는 경우
    if (updateData.callbackFollowupResult) {
      const result = updateData.callbackFollowupResult;
      
      switch (result.status) {
        case '예약완료':
          patientUpdateData.status = '예약확정';
          patientUpdateData.reservationDate = result.reservationDate;
          patientUpdateData.reservationTime = result.reservationTime;
          patientUpdateData.currentConsultationStage = 'completed';
          break;
          
        case '부재중':
        case '상담중':
          patientUpdateData.status = result.status === '부재중' ? '부재중' : '콜백필요';
          patientUpdateData.nextCallbackDate = result.nextCallbackDate;
          patientUpdateData.currentConsultationStage = 'callback';
          break;
      }
    }
    
    // 환자 정보 업데이트
    let result;
    if (ObjectId.isValid(patientId)) {
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(patientId) },
        { $set: patientUpdateData },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('patients').findOneAndUpdate(
        { $or: [{ id: patientId }, { patientId: patientId }] },
        { $set: patientUpdateData },
        { returnDocument: 'after' }
      );
    }
    
    if (!result) {
      return NextResponse.json({ error: '콜백 업데이트에 실패했습니다.' }, { status: 500 });
    }
    
    // ObjectId 문자열 변환
    if (result._id && typeof result._id !== 'string') {
      (result as any)._id = result._id.toString();
    }
    
    if (!result.id && result._id) {
      result.id = result._id;
    }
    
    // 활동 로그
    await logActivityToDatabase({
      action: 'callback_update_api',
      targetId: patient.id || patient._id,
      targetName: patient.name,
      userId: currentUser.id,
      userName: currentUser.name,
      details: {
        callbackId,
        updateData,
        originalScheduled: `${originalCallback.date} ${originalCallback.time || ''}`,
        actualCompleted: updateData.actualCompletedDate && updateData.actualCompletedTime 
          ? `${updateData.actualCompletedDate} ${updateData.actualCompletedTime}`
          : '미완료',
        apiEndpoint: '/api/patients/[id]/callbacks'
      }
    });
    
    console.log(`콜백 업데이트 성공 - 환자 ID: ${patientId}, 콜백 ID: ${callbackId}`);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('콜백 업데이트 실패:', error);
    return NextResponse.json({ error: '콜백 업데이트에 실패했습니다.' }, { status: 500 });
  }
}

// 🔥 콜백 삭제를 위한 DELETE 메서드 추가
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const patientId = params.id;
    const url = new URL(request.url);
    const callbackId = url.searchParams.get('callbackId');
    const currentUser = getCurrentUser(request);
    
    if (!callbackId) {
      return NextResponse.json({ error: '콜백 ID가 필요합니다.' }, { status: 400 });
    }
    
    console.log(`콜백 삭제 시도 - 환자 ID: ${patientId}, 콜백 ID: ${callbackId}`);
    
    // 환자 찾기
    let patient;
    if (ObjectId.isValid(patientId)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    } else {
      patient = await db.collection('patients').findOne({ 
        $or: [{ id: patientId }, { patientId: patientId }]
      });
    }
    
    if (!patient) {
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 콜백 이력에서 해당 콜백 찾기 및 삭제
    const callbackHistory = patient.callbackHistory || [];
    const callbackIndex = callbackHistory.findIndex((cb: any) => cb.id === callbackId);
    
    if (callbackIndex === -1) {
      return NextResponse.json({ error: '콜백을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 삭제할 콜백 정보 저장 (로그용)
    const deletedCallback = callbackHistory[callbackIndex];
    
    // 콜백 삭제
    callbackHistory.splice(callbackIndex, 1);
    
    // 환자 정보 업데이트
    let result;
    if (ObjectId.isValid(patientId)) {
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(patientId) },
        { 
          $set: { 
            callbackHistory,
            updatedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('patients').findOneAndUpdate(
        { $or: [{ id: patientId }, { patientId: patientId }] },
        { 
          $set: { 
            callbackHistory,
            updatedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after' }
      );
    }
    
    if (!result) {
      return NextResponse.json({ error: '콜백 삭제에 실패했습니다.' }, { status: 500 });
    }
    
    // ObjectId 문자열 변환
    if (result._id && typeof result._id !== 'string') {
      (result as any)._id = result._id.toString();
    }
    
    if (!result.id && result._id) {
      result.id = result._id;
    }
    
    // 활동 로그
    await logActivityToDatabase({
      action: 'callback_delete_api',
      targetId: patient.id || patient._id,
      targetName: patient.name,
      userId: currentUser.id,
      userName: currentUser.name,
      details: {
        callbackId,
        deletedCallback,
        apiEndpoint: '/api/patients/[id]/callbacks'
      }
    });
    
    console.log(`콜백 삭제 성공 - 환자 ID: ${patientId}, 콜백 ID: ${callbackId}`);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('콜백 삭제 실패:', error);
    return NextResponse.json({ error: '콜백 삭제에 실패했습니다.' }, { status: 500 });
  }
}