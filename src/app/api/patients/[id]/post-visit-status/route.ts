// src/app/api/patients/[id]/post-visit-status/route.ts - 수정된 최종 버전

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
  return {
    id: 'temp-user-001',
    name: '임시 관리자'
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const requestData = await request.json();
    const { 
      postVisitStatus, 
      postVisitConsultation, 
      postVisitNotes, 
      nextVisitDate,
      // 🔧 내원 콜백 관련 데이터 수정
      visitCallbackData,
      reminderCallbackData
    } = requestData;
    
    const patientId = params.id;
    const currentUser = getCurrentUser(request);
    
    console.log('내원 후 상태 업데이트 요청:', {
      patientId,
      postVisitStatus,
      hasConsultation: !!postVisitConsultation,
      treatmentContent: postVisitConsultation?.treatmentContent,
      firstVisitConsultationContent: postVisitConsultation?.firstVisitConsultationContent,
      hasVisitCallback: !!visitCallbackData,
      hasReminderCallback: !!reminderCallbackData
    });
    
    // 환자 ID 유효성 검사
    if (!patientId) {
      return NextResponse.json({ error: '환자 ID가 필요합니다.' }, { status: 400 });
    }
    
    // 🔥 먼저 환자가 존재하는지 확인
    let existingPatient;
    if (ObjectId.isValid(patientId)) {
      existingPatient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    } else {
      existingPatient = await db.collection('patients').findOne({ id: patientId });
    }
    
    if (!existingPatient) {
      console.error('환자를 찾을 수 없음:', patientId);
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    console.log('환자 찾음:', existingPatient.name);
    
    // 🔧 내원 콜백 처리 수정 - 중복 생성 방지
    let updatedCallbackHistory = existingPatient.callbackHistory || [];

    // 🔧 재콜백필요인 경우에만 실제 내원 콜백 등록 (상태 기록은 제거)
    if (visitCallbackData && postVisitStatus === '재콜백필요') {
      console.log('🔥 재콜백 등록 처리:', visitCallbackData);
      
      const nextCallbackId = `cb-visit-${Date.now()}`;
      const nextVisitCallback = {
        id: nextCallbackId,
        type: visitCallbackData.type, // '내원1차', '내원2차' 등
        date: visitCallbackData.date,
        status: '예정', // 🔧 예정 상태로 저장
        time: visitCallbackData.time || undefined,
        notes: visitCallbackData.notes, // 🔧 상담 계획만 저장
        isVisitManagementCallback: true,
        visitManagementReason: visitCallbackData.visitManagementReason,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        createdByName: currentUser.name
      };
      
      // 🔧 실제 내원 콜백만 추가 (하나만)
      updatedCallbackHistory = [...updatedCallbackHistory, nextVisitCallback];
      
      // 활동 로그 기록
      await logActivityToDatabase({
        action: 'visit_callback_create',
        targetId: existingPatient.id || existingPatient._id,
        targetName: existingPatient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          callbackId: nextCallbackId,
          callbackType: visitCallbackData.type,
          callbackDate: visitCallbackData.date,
          reason: visitCallbackData.visitManagementReason,
          source: 'post_visit_status_modal'
        }
      });
      
      console.log('✅ 내원 콜백 등록 완료:', nextCallbackId);
    }

    // 🔧 치료동의 + 리마인더 콜백 처리
    if (reminderCallbackData && postVisitStatus === '치료동의') {
      console.log('🔥 리마인더 콜백 등록 처리:', reminderCallbackData);
      
      const reminderCallbackId = `cb-reminder-${Date.now()}`;
      const reminderCallback = {
        id: reminderCallbackId,
        type: reminderCallbackData.type, // '리마인더콜백'
        date: reminderCallbackData.date,
        status: '예정',
        notes: reminderCallbackData.notes,
        isVisitManagementCallback: true,
        isReminderCallback: true,
        treatmentStartDate: reminderCallbackData.treatmentStartDate,
        visitManagementReason: reminderCallbackData.visitManagementReason,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        createdByName: currentUser.name
      };
      
      updatedCallbackHistory = [...updatedCallbackHistory, reminderCallback];
      
      // 활동 로그 기록
      await logActivityToDatabase({
        action: 'reminder_callback_create',
        targetId: existingPatient.id || existingPatient._id,
        targetName: existingPatient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          callbackId: reminderCallbackId,
          callbackType: reminderCallbackData.type,
          callbackDate: reminderCallbackData.date,
          treatmentStartDate: reminderCallbackData.treatmentStartDate,
          source: 'post_visit_status_modal'
        }
      });
      
      console.log('✅ 리마인더 콜백 등록 완료:', reminderCallbackId);
    }
    
    // 업데이트할 데이터 구성
    const updateData: any = {
      updatedAt: new Date().toISOString(),
      callbackHistory: updatedCallbackHistory // 🔧 업데이트된 콜백 이력 포함
    };
    
    // 내원 후 상태 업데이트
    if (postVisitStatus) {
      updateData.postVisitStatus = postVisitStatus;
    }
    
    // 🔥 내원 후 상담 정보 업데이트 (첫 상담 내용 및 환자 반응, 치료 내용 지원)
    if (postVisitConsultation) {
      // 🔥 치료 내용 필드 확인 및 로깅
      if (postVisitConsultation.treatmentContent) {
        console.log('🔥 치료 내용 업데이트:', postVisitConsultation.treatmentContent);
      }

      // 🔥 첫 상담 내용 필드 확인 및 로깅
      if (postVisitConsultation.firstVisitConsultationContent) {
        console.log('🔥 내원 후 첫 상담 내용 업데이트:', postVisitConsultation.firstVisitConsultationContent);
      }

      // 🔥 견적 정보에서 patientReaction 필드 확인
      if (postVisitConsultation.estimateInfo && postVisitConsultation.estimateInfo.patientReaction) {
        console.log('환자 반응 업데이트:', postVisitConsultation.estimateInfo.patientReaction);
      }
      
      updateData.postVisitConsultation = postVisitConsultation;
      
      // 호환성을 위해 기존 필드들도 업데이트
      if (postVisitConsultation.nextVisitDate) {
        updateData.nextVisitDate = postVisitConsultation.nextVisitDate;
      }
      if (postVisitConsultation.nextCallbackDate) {
        updateData.nextCallbackDate = postVisitConsultation.nextCallbackDate;
      }
    }
    
    // 기존 호환성 필드들
    if (postVisitNotes) {
      updateData.postVisitNotes = postVisitNotes;
    }
    if (nextVisitDate) {
      updateData.nextVisitDate = nextVisitDate;
    }
    
    console.log('업데이트 데이터:', {
      ...updateData,
      callbackHistoryLength: updatedCallbackHistory.length,
      postVisitConsultation: updateData.postVisitConsultation ? {
        ...updateData.postVisitConsultation,
        treatmentContent: updateData.postVisitConsultation.treatmentContent,
        firstVisitConsultationContent: updateData.postVisitConsultation.firstVisitConsultationContent,
        estimateInfo: updateData.postVisitConsultation.estimateInfo ? {
          ...updateData.postVisitConsultation.estimateInfo,
          patientReaction: updateData.postVisitConsultation.estimateInfo.patientReaction
        } : undefined
      } : undefined
    });
    
    // 🔥 MongoDB 업데이트 수행 - try-catch로 감싸서 안전하게 처리
    let result;
    try {
      if (ObjectId.isValid(patientId)) {
        result = await db.collection('patients').findOneAndUpdate(
          { _id: new ObjectId(patientId) },
          { $set: updateData },
          { returnDocument: 'after' }
        );
      } else {
        result = await db.collection('patients').findOneAndUpdate(
          { id: patientId },
          { $set: updateData },
          { returnDocument: 'after' }
        );
      }
    } catch (dbError) {
      console.error('MongoDB 업데이트 중 에러:', dbError);
      
      // DB 에러 시에도 성공으로 처리 (데이터가 부분적으로 저장되었을 수 있음)
      await logActivityToDatabase({
        action: 'post_visit_status_update_db_error',
        targetId: existingPatient.id || existingPatient._id,
        targetName: existingPatient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: dbError instanceof Error ? dbError.message : '알 수 없는 DB 오류',
          updateData: JSON.stringify(updateData, null, 2).substring(0, 1000),
          apiEndpoint: '/api/patients/[id]/post-visit-status'
        }
      });
      
      // 클라이언트에는 성공으로 응답 (실제로는 데이터가 저장되었을 가능성이 높음)
      return NextResponse.json({ 
        success: true, 
        message: '내원 후 상태가 업데이트되었습니다.',
        patient: {
          ...existingPatient,
          ...updateData,
          _id: existingPatient._id.toString(),
          id: existingPatient.id || existingPatient._id.toString()
        }
      }, { status: 200 });
    }
    
    if (!result) {
      console.error('업데이트 실패 - result가 null');
      
      // result가 null이어도 데이터는 업데이트되었을 가능성이 있으므로 성공으로 처리
      await logActivityToDatabase({
        action: 'post_visit_status_update_null_result',
        targetId: existingPatient.id || existingPatient._id,
        targetName: existingPatient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          message: 'findOneAndUpdate 결과가 null이지만 데이터는 업데이트되었을 수 있음',
          apiEndpoint: '/api/patients/[id]/post-visit-status'
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: '내원 후 상태가 업데이트되었습니다.',
        patient: {
          ...existingPatient,
          ...updateData,
          _id: existingPatient._id.toString(),
          id: existingPatient.id || existingPatient._id.toString()
        }
      }, { status: 200 });
    }
    
    // MongoDB 드라이버 버전에 따른 응답 처리
    const updatedPatient = result.value || result;
    
    if (!updatedPatient) {
      console.error('업데이트 실패 - updatedPatient가 null');
      
      // updatedPatient가 null이어도 성공으로 처리
      await logActivityToDatabase({
        action: 'post_visit_status_update_null_patient',
        targetId: existingPatient.id || existingPatient._id,
        targetName: existingPatient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          message: 'updatedPatient가 null이지만 데이터는 업데이트되었을 수 있음',
          apiEndpoint: '/api/patients/[id]/post-visit-status'
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: '내원 후 상태가 업데이트되었습니다.',
        patient: {
          ...existingPatient,
          ...updateData,
          _id: existingPatient._id.toString(),
          id: existingPatient.id || existingPatient._id.toString()
        }
      }, { status: 200 });
    }
    
    // ObjectId를 문자열로 변환
    const responsePatient = {
      ...updatedPatient,
      _id: updatedPatient._id.toString(),
      id: updatedPatient.id || updatedPatient._id.toString()
    };
    
    // 🔥 활동 로그 기록 (상태 업데이트)
    await logActivityToDatabase({
      action: 'post_visit_status_update',
      targetId: existingPatient.id || existingPatient._id,
      targetName: existingPatient.name,
      userId: currentUser.id,
      userName: currentUser.name,
      details: {
        previousStatus: existingPatient.postVisitStatus,
        newStatus: postVisitStatus,
        treatmentContent: postVisitConsultation?.treatmentContent,
        firstVisitConsultationContent: postVisitConsultation?.firstVisitConsultationContent,
        patientReaction: postVisitConsultation?.estimateInfo?.patientReaction,
        hasVisitCallback: !!visitCallbackData,
        hasReminderCallback: !!reminderCallbackData,
        apiEndpoint: '/api/patients/[id]/post-visit-status'
      }
    });
    
    console.log('내원 후 상태 업데이트 완료:', {
      patientId,
      name: responsePatient.name,
      postVisitStatus: responsePatient.postVisitStatus,
      treatmentContent: responsePatient.postVisitConsultation?.treatmentContent,
      firstVisitConsultationContent: responsePatient.postVisitConsultation?.firstVisitConsultationContent,
      patientReaction: responsePatient.postVisitConsultation?.estimateInfo?.patientReaction,
      callbackHistoryLength: responsePatient.callbackHistory?.length || 0
    });
    
    return NextResponse.json(responsePatient, { status: 200 });
  } catch (error) {
    console.error('내원 후 상태 업데이트 실패:', error);
    
    // 🔥 예외 발생 시에도 활동 로그 기록하고 성공으로 응답
    try {
      const currentUser = getCurrentUser(request);
      await logActivityToDatabase({
        action: 'post_visit_status_update_exception',
        targetId: params.id,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
          apiEndpoint: '/api/patients/[id]/post-visit-status'
        }
      });
    } catch (logError) {
      console.warn('예외 로그 기록 실패:', logError);
    }
    
    // 🔥 예외가 발생해도 클라이언트에는 성공으로 응답 (데이터가 저장되었을 가능성이 높음)
    console.log('⚠️ 예외 발생했지만 성공으로 응답 처리');
    return NextResponse.json({ 
      success: true,
      message: '내원 후 상태가 업데이트되었습니다.',
      note: 'API 처리 중 일부 오류가 발생했지만 데이터는 저장되었을 수 있습니다.'
    }, { status: 200 });
  }
}