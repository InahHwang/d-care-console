// src/app/api/patients/[id]/reservation-complete/route.ts - isDirectVisitCompletion 플래그 추가

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
    console.log('✅ 예약완료 활동 로그 기록 완료:', activityData.action);
  } catch (error) {
    console.warn('⚠️ 예약완료 활동 로그 기록 실패:', error);
  }
}

// 요청 헤더에서 사용자 정보 추출 (임시)
function getCurrentUser(request: NextRequest) {
  return {
    id: 'temp-user-001',
    name: '임시 관리자'
  };
}

// 한국 시간 기준 오늘 날짜 반환 함수
function getKoreanToday() {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime.toISOString().split('T')[0];
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔥 내원완료 API 호출됨 - Patient ID:', params.id);
    
    const { db } = await connectToDatabase();
    const patientId = params.id;
    const data = await request.json();
    const { reservationDate, reservationTime, consultationContent } = data;
    const currentUser = getCurrentUser(request);

    console.log('📝 요청 데이터:', { reservationDate, reservationTime, consultationContent });

    // 유효성 검증
    if (!reservationDate || !reservationTime) {
      console.error('❌ 예약 날짜와 시간은 필수입니다.');
      return NextResponse.json({ error: '예약 날짜와 시간을 모두 입력해주세요.' }, { status: 400 });
    }

    // 상담내용 기본값 처리
    const finalConsultationContent = consultationContent || '예약완료';

    // 환자 검색
    let patient;
    
    if (ObjectId.isValid(patientId)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    }
    
    if (!patient) {
      patient = await db.collection('patients').findOne({ id: patientId });
    }
    
    if (!patient) {
      patient = await db.collection('patients').findOne({ patientId: patientId });
    }
    
    if (!patient) {
      console.error('❌ 환자를 찾을 수 없습니다:', patientId);
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }

    console.log('👤 환자 정보 확인:', patient.name);
    console.log('📋 기존 콜백 이력:', patient.callbackHistory);

    // 한국 시간 기준 오늘 날짜
    const todayKorean = getKoreanToday();
    const currentTime = new Date().toTimeString().slice(0, 5);
    
    // 콜백 이력 업데이트
    let callbackHistory = patient.callbackHistory || [];
    
    // 🔥 핵심 수정: 예정된(scheduled) 콜백 찾기
    const scheduledCallbackIndex = callbackHistory.findIndex((cb: any) => 
      cb.status === 'scheduled' || 
      cb.status === '예정' ||
      (cb.status !== '완료' && cb.status !== '취소' && !cb.isCompletionRecord)
    );

    console.log('🔍 예정된 콜백 인덱스:', scheduledCallbackIndex);

    if (scheduledCallbackIndex !== -1) {
      // 🔥 Case A: 예정된 콜백이 있는 경우 → 완료로 업데이트 (1개 박스)
      const scheduledCallback = callbackHistory[scheduledCallbackIndex];
      console.log('📅 예정된 콜백 발견:', scheduledCallback);

      // 예정된 콜백을 완료로 업데이트 (isDirectVisitCompletion 없음 - 정상 콜백)
      callbackHistory[scheduledCallbackIndex] = {
        ...scheduledCallback,
        status: '완료',
        notes: finalConsultationContent,
        // 실제 완료 정보 추가
        actualCompletedDate: todayKorean,
        actualCompletedTime: currentTime,
        customerResponse: 'positive',
        nextStep: '예약_확정',
        // result 객체 추가 (박스 표시용)
        ...(scheduledCallback.type === '1차' ? {
          firstConsultationResult: {
            status: '예약완료',
            reservationDate: reservationDate,
            reservationTime: reservationTime,
            consultationContent: finalConsultationContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        } : {
          callbackFollowupResult: {
            status: '예약완료',
            callbackType: scheduledCallback.type,
            reservationDate: reservationDate,
            reservationTime: reservationTime,
            consultationContent: finalConsultationContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }),
        updatedAt: new Date().toISOString()
      };

      console.log('✅ 예정된 콜백을 완료로 업데이트:', callbackHistory[scheduledCallbackIndex]);

    } else {
      // 🔥 Case B: 예정된 콜백이 없는 경우 → 새로운 완료 콜백 생성 (직접 내원완료)
      console.log('📝 예정된 콜백이 없어 새로운 완료 콜백 생성 (직접 내원완료)');

      // 콜백 타입 결정
      const completedCallbacks = callbackHistory.filter((cb: { status: string; isCompletionRecord: any; }) => 
        cb.status === '완료' && !cb.isCompletionRecord
      );
      
      let callbackType = '1차';
      if (completedCallbacks.length > 0) {
        const lastCompletedType = completedCallbacks[completedCallbacks.length - 1].type;
        if (lastCompletedType === '1차') callbackType = '2차';
        else if (lastCompletedType === '2차') callbackType = '3차';
        else if (lastCompletedType === '3차') callbackType = '4차';
        else if (lastCompletedType === '4차') callbackType = '5차';
      }

      const newCallbackRecord = {
        id: `callback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date: todayKorean,
        status: '완료',
        notes: finalConsultationContent,
        type: callbackType,
        time: undefined,
        customerResponse: 'positive',
        nextStep: '예약_확정',
        actualCompletedDate: todayKorean,
        actualCompletedTime: currentTime,
        
        // 🔥 핵심 추가: 직접 내원완료 플래그
        isDirectVisitCompletion: true,  // 콜백 없이 바로 내원완료 처리된 경우
        
        // result 객체 추가
        ...(callbackType === '1차' ? {
          firstConsultationResult: {
            status: '예약완료',
            reservationDate: reservationDate,
            reservationTime: reservationTime,
            consultationContent: finalConsultationContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        } : {
          callbackFollowupResult: {
            status: '예약완료',
            callbackType: callbackType,
            reservationDate: reservationDate,
            reservationTime: reservationTime,
            consultationContent: finalConsultationContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }),
        createdAt: new Date().toISOString()
      };
      
      callbackHistory.push(newCallbackRecord);
      console.log('✅ 새로운 직접 내원완료 콜백 추가:', newCallbackRecord);
    }

    // 🔥 환자 정보 업데이트 (visitConfirmed도 함께 설정하여 API 호출 1회로 최적화)
    const updateData = {
      status: '예약확정',
      callbackHistory: callbackHistory,
      updatedAt: new Date().toISOString(),
      reservationDate: reservationDate,
      reservationTime: reservationTime,
      reservationCompletedAt: todayKorean,
      // 🔥 내원확정도 함께 처리 (toggleVisitConfirmation API 호출 불필요)
      visitConfirmed: true,
      visitConfirmedAt: new Date().toISOString()
    };

    console.log('💾 업데이트할 데이터:', updateData);

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
      console.error('❌ 환자 정보 업데이트 실패');
      return NextResponse.json({ error: "환자 정보 업데이트에 실패했습니다." }, { status: 500 });
    }

    const updatedPatient = result;
    
    // ID 처리
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      (updatedPatient as any)._id = updatedPatient._id.toString();
    }
    
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }

    // 활동 로그 기록
    await logActivityToDatabase({
      action: 'patient_reservation_complete_unified',
      targetId: patient.id || patient._id,
      targetName: patient.name,
      userId: currentUser.id,
      userName: currentUser.name,
      details: {
        reservationDate: reservationDate,
        reservationTime: reservationTime,
        consultationContent: finalConsultationContent,
        completedAt: todayKorean,
        previousStatus: patient.status,
        newStatus: '예약확정',
        hadScheduledCallback: scheduledCallbackIndex !== -1,
        isDirectVisitCompletion: scheduledCallbackIndex === -1, // 예정된 콜백이 없으면 직접 내원완료
        unifiedRecord: true,
        apiEndpoint: '/api/patients/[id]/reservation-complete'
      }
    });

    console.log('✅ 환자 예약완료 처리 성공 (통합된 1개 박스) - 환자 ID:', patientId);

    return NextResponse.json({
      updatedPatient,
      callbackHistory: callbackHistory,
      reservationInfo: {
        reservationDate,
        reservationTime,
        consultationContent: finalConsultationContent,
        completedAt: todayKorean
      }
    }, { status: 200 });

  } catch (error) {
    console.error('❌ 환자 예약완료 처리 오류:', error);
    
    try {
      const currentUser = getCurrentUser(request);
      await logActivityToDatabase({
        action: 'patient_reservation_complete_api_exception',
        targetId: params.id,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
          apiEndpoint: '/api/patients/[id]/reservation-complete'
        }
      });
    } catch (logError) {
      console.warn('예외 로그 기록 실패:', logError);
    }
    
    return NextResponse.json({ error: "예약완료 처리에 실패했습니다." }, { status: 500 });
  }
}