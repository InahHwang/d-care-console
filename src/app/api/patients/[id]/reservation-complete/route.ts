// src/app/api/patients/[id]/reservation-complete/route.ts - 상담내용 선택사항 변경

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

// 🔥 순수 상담내용 추출 함수
function extractPureConsultationContent(text: string): string {
  if (!text) return '';
  
  // 1. [차수 콜백 등록] 패턴 제거
  let content = text.replace(/\[.*?차 콜백 등록\]/g, '').trim();
  
  // 2. [차수 콜백 - 설명] 패턴 제거  
  content = content.replace(/\[.*?차 콜백 - .*?\]/g, '').trim();
  
  // 3. "사유:" 접두어 제거
  content = content.replace(/^사유:\s*/g, '').trim();
  
  // 4. [예약완료] 관련 정보 제거
  content = content.replace(/\[예약완료\].*?예약일시:\s*[\d-]+\s+[\d:]+/g, '').trim();
  content = content.replace(/예약일시:\s*[\d-]+\s+[\d:]+/g, '').trim();
  content = content.replace(/처리일:\s*[\d-]+/g, '').trim();
  content = content.replace(/상담내용:\s*/g, '').trim();
  
  // 5. 빈 줄 정리
  content = content.replace(/\n+/g, '\n').trim();
  
  return content;
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
    const { reservationDate, reservationTime, consultationContent } = data;
    const currentUser = getCurrentUser(request);

    console.log(`환자 예약완료 처리 시도 - 환자 ID: ${patientId}`);
    console.log('예약 정보:', { reservationDate, reservationTime, consultationContent });

    // 🔥 수정된 유효성 검증 - 상담내용 선택사항으로 변경
    if (!reservationDate || !reservationTime) {
      console.error('예약 날짜와 시간은 필수입니다.');
      return NextResponse.json({ error: '예약 날짜와 시간을 모두 입력해주세요.' }, { status: 400 });
    }

    // 🔥 상담내용 필수 검증 제거 (선택사항으로 변경)
    // if (!consultationContent) {
    //   console.error('상담내용은 필수입니다.');
    //   return NextResponse.json({ error: '상담내용을 입력해주세요.' }, { status: 400 });
    // }

    // 🔥 상담내용 기본값 처리
    const finalConsultationContent = consultationContent || '예약완료';

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
        action: 'patient_reservation_complete_api_error',
        targetId: patientId,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자를 찾을 수 없음',
          reservationDate,
          reservationTime,
          consultationContent: finalConsultationContent,
          apiEndpoint: '/api/patients/[id]/reservation-complete'
        }
      });
      
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 한국 시간 기준 오늘 날짜
    const todayKorean = getKoreanToday();
    
    // 콜백 이력 업데이트
    const callbackHistory = patient.callbackHistory || [];
    
    // 🔥 오늘 날짜에 이미 완료된 콜백이 있는지 확인 (재예약 기록 제외)
    const todayCompletedCallback = callbackHistory.find((cb: any) => 
      cb.date === todayKorean && 
      cb.status === '완료' && 
      !cb.isCompletionRecord &&
      !cb.isReservationRecord
    );
    
    let updatedCallbackHistory = [...callbackHistory];
    
    if (!todayCompletedCallback) {
      // 🔥 새로운 콜백 완료 기록 생성 - result 객체 포함으로 박스 형태 표시
      const callbackType = getCallbackTypeBasedOnHistory(callbackHistory);
      const actualCallbackRecord = {
        id: `callback-${Date.now()}-${generateUUID()}`,
        date: todayKorean,
        status: '완료',
        // 🔥 상담내용 기본값 처리
        notes: finalConsultationContent || `${callbackType} 상담 완료`,
        type: callbackType,
        time: undefined,
        customerResponse: 'positive',
        nextStep: '예약_확정',
        // 🔥 실제 처리 시간 추가
        actualCompletedDate: todayKorean,
        actualCompletedTime: new Date().toTimeString().slice(0, 5),
        // 🔥 케이스B와 동일한 result 객체 추가 (박스 표시용)
        ...(callbackType === '1차' ? {
          firstConsultationResult: {
            status: '예약완료',
            reservationDate: reservationDate,
            reservationTime: reservationTime,
            consultationContent: finalConsultationContent, // 🔥 기본값 적용
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        } : {
          callbackFollowupResult: {
            status: '예약완료',
            callbackType: callbackType,
            reservationDate: reservationDate,
            reservationTime: reservationTime,
            consultationContent: finalConsultationContent, // 🔥 기본값 적용
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }),
        createdAt: new Date().toISOString()
      };
      
      updatedCallbackHistory.push(actualCallbackRecord);
      console.log(`✅ 통합된 콜백 완료 기록 추가 (${callbackType}):`, actualCallbackRecord.id);
    } else {
      // 🔥 기존 완료된 콜백에 result 객체 추가
      const callbackIndex = updatedCallbackHistory.findIndex(cb => cb.id === todayCompletedCallback.id);
      if (callbackIndex !== -1) {
        const callbackType = todayCompletedCallback.type;
        updatedCallbackHistory[callbackIndex] = {
          ...todayCompletedCallback,
          // 🔥 실제 처리 시간 추가
          actualCompletedDate: todayKorean,
          actualCompletedTime: new Date().toTimeString().slice(0, 5),
          // 🔥 result 객체 추가 - 기본값 적용
          ...(callbackType === '1차' ? {
            firstConsultationResult: {
              status: '예약완료',
              reservationDate: reservationDate,
              reservationTime: reservationTime,
              consultationContent: finalConsultationContent, // 🔥 기본값 적용
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          } : {
            callbackFollowupResult: {
              status: '예약완료',
              callbackType: callbackType,
              reservationDate: reservationDate,
              reservationTime: reservationTime,
              consultationContent: finalConsultationContent, // 🔥 기본값 적용
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }),
          updatedAt: new Date().toISOString()
        };
        console.log(`✅ 기존 콜백에 예약완료 result 추가 (${callbackType}):`, todayCompletedCallback.id);
      }
    }

    // 🔥 중요: 별도의 "예약완료" 타입 콜백 기록은 생성하지 않음!
    // (기존 코드의 reservationCompletionRecord 제거)

    // 🔥 환자 정보 업데이트 - 예약확정 상태로 변경
    const updateData = {
      status: '예약확정',
      callbackHistory: updatedCallbackHistory,
      updatedAt: new Date().toISOString(),
      // 🔥 예약 정보 추가
      reservationDate: reservationDate,
      reservationTime: reservationTime,
      reservationCompletedAt: todayKorean // 예약완료 처리 날짜
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
        action: 'patient_reservation_complete_api_error',
        targetId: patientId,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '환자 정보 업데이트 실패',
          reservationDate,
          reservationTime,
          consultationContent: finalConsultationContent,
          apiEndpoint: '/api/patients/[id]/reservation-complete'
        }
      });
      
      return NextResponse.json({ error: "환자 정보 업데이트에 실패했습니다." }, { status: 500 });
    }

    const updatedPatient = result;
    
    // ID를 문자열로 변환
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      (updatedPatient as any)._id = updatedPatient._id.toString();
    }
    
    // 호환성을 위해 id 필드가 없다면 _id로 설정
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }

    // 🔥 백엔드 로그 - 예약완료 성공
    await logActivityToDatabase({
      action: 'patient_reservation_complete_api',
      targetId: patient.id || patient._id,
      targetName: patient.name,
      userId: currentUser.id,
      userName: currentUser.name,
      details: {
        reservationDate: reservationDate,
        reservationTime: reservationTime,
        consultationContent: finalConsultationContent, // 🔥 기본값 적용
        completedAt: todayKorean,
        previousStatus: patient.status,
        newStatus: '예약확정',
        hadTodayCallback: !!todayCompletedCallback,
        unifiedCallbackRecord: true, // 🔥 통합된 기록임을 표시
        apiEndpoint: '/api/patients/[id]/reservation-complete',
        userAgent: request.headers.get('user-agent')?.substring(0, 100)
      }
    });

    console.log(`✅ 환자 예약완료 처리 성공 (통합 형태) - 환자 ID: ${patientId}`);

    return NextResponse.json({
      updatedPatient,
      callbackHistory: updatedCallbackHistory,
      reservationInfo: {
        reservationDate,
        reservationTime,
        consultationContent: finalConsultationContent, // 🔥 기본값 적용
        completedAt: todayKorean
      }
    }, { status: 200 });
  } catch (error) {
    console.error('환자 예약완료 처리 오류:', error);
    
    // 🔥 백엔드 로그 - 예외 발생
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