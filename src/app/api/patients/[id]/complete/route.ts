// src/app/api/patients/[id]/complete/route.ts - 예정된 콜백을 완료로 업데이트

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

// 🔥 complete/route.ts에 추가할 헬퍼 함수들
function extractReservationDate(reason: string): string {
  const match = reason.match(/예약일시:\s*(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function extractReservationTime(reason: string): string {
  const match = reason.match(/예약일시:\s*\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

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
    const reason = data.reason || '종결 사유 없음';
    const currentUser = getCurrentUser(request);

    console.log(`환자 종결 처리 시도 - 환자 ID: ${patientId}, 사유: ${reason}`);

    // 🔥 프론트엔드 로깅 스킵 여부 확인
    const skipFrontendLog = request.headers.get('X-Skip-Activity-Log') === 'true';

    // 환자 검색 (기존 코드 유지)
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
    
    // 🔥 디버깅 로그 추가
    console.log('🔍 콜백 이력 디버깅:', {
      todayKorean,
      totalCallbacks: callbackHistory.length,
      callbackDates: callbackHistory.map((cb: { id: any; date: any; status: any; type: any; }) => ({ id: cb.id, date: cb.date, status: cb.status, type: cb.type }))
    });
    
    // 🔥 수정: 오늘 날짜의 예정된 콜백 찾기 (처리일 기준)
    const scheduledCallback = callbackHistory.find((cb: any) => 
      cb.date === todayKorean && 
      cb.status === '예정' && 
      !cb.isCompletionRecord &&
      !cb.isVisitManagementCallback
    );
    
    console.log('🔍 예정된 콜백 찾기 결과:', {
      found: !!scheduledCallback,
      scheduledCallback: scheduledCallback ? {
        id: scheduledCallback.id,
        date: scheduledCallback.date,
        status: scheduledCallback.status,
        type: scheduledCallback.type
      } : null
    });
    
    let updatedCallbackHistory = [...callbackHistory];
    let updatedExistingCallback = false;
    
    if (isReservationCompletion) {
      if (scheduledCallback) {
        // 🔥 케이스A: 예정된 콜백을 완료로 업데이트 + result 객체 추가
        const callbackIndex = updatedCallbackHistory.findIndex(cb => cb.id === scheduledCallback.id);
        
        if (callbackIndex !== -1) {
          const callbackType = scheduledCallback.type;
          const consultationContent = extractPureConsultationContent(reason);
          
          // 🔥 중요: 예정 → 완료로 상태 변경 + result 객체 추가
          updatedCallbackHistory[callbackIndex] = {
            ...scheduledCallback,
            status: '완료',
            notes: consultationContent || scheduledCallback.notes || '예약 완료 상담',
            actualCompletedDate: todayKorean,
            actualCompletedTime: new Date().toTimeString().slice(0, 5),
            completedAt: new Date().toISOString(),
            
            // 🔥 케이스B와 동일한 result 객체 추가 (통합 박스용)
            ...(callbackType === '1차' ? {
              firstConsultationResult: {
                status: '예약완료',
                reservationDate: extractReservationDate(reason),
                reservationTime: extractReservationTime(reason),
                consultationContent: consultationContent || '예약완료',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            } : {
              callbackFollowupResult: {
                status: '예약완료',
                callbackType: callbackType,
                reservationDate: extractReservationDate(reason),
                reservationTime: extractReservationTime(reason),
                consultationContent: consultationContent || '예약완료',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            }),
            updatedAt: new Date().toISOString()
          };
          
          updatedExistingCallback = true;
          console.log(`✅ 예정된 콜백을 완료로 업데이트 (${callbackType}):`, scheduledCallback.id);
        }
      } else {
        // 🔥 예정된 콜백이 없는 경우: 직접 내원완료 플래그 추가
        const callbackType = getCallbackTypeBasedOnHistory(callbackHistory);
        const consultationContent = extractPureConsultationContent(reason);
        
        const newCallbackRecord = {
          id: `callback-${Date.now()}-${generateUUID()}`,
          date: todayKorean,
          status: '완료',
          notes: consultationContent || '예약 완료 상담',
          type: callbackType,
          time: undefined,
          customerResponse: 'positive',
          nextStep: '예약_확정',
          actualCompletedDate: todayKorean,
          actualCompletedTime: new Date().toTimeString().slice(0, 5),
          
          // 🔥 핵심 수정: 직접 내원완료 플래그 추가
          isDirectVisitCompletion: true,  // 콜백 없이 바로 내원완료 처리된 경우
          
          // 🔥 케이스B와 동일한 result 객체 추가 (통합 박스용)
          ...(callbackType === '1차' ? {
            firstConsultationResult: {
              status: '예약완료',
              reservationDate: extractReservationDate(reason),
              reservationTime: extractReservationTime(reason),
              consultationContent: consultationContent || '예약완료',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          } : {
            callbackFollowupResult: {
              status: '예약완료',
              callbackType: callbackType,
              reservationDate: extractReservationDate(reason),
              reservationTime: extractReservationTime(reason),
              consultationContent: consultationContent || '예약완료',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }),
          createdAt: new Date().toISOString()
        };
        
        updatedCallbackHistory.push(newCallbackRecord);
        console.log(`✅ 새로운 직접 내원완료 콜백 생성 (${callbackType}):`, newCallbackRecord.id);
      }
    }
    
    // 🔥 일반 종결인 경우에만 종결 기록 추가
    if (!isReservationCompletion) {
      const completionRecord = {
        id: `completion-${Date.now()}-${generateUUID()}`,
        date: todayKorean,
        status: '종결',
        notes: reason,
        type: '종결',
        time: undefined,
        isCompletionRecord: true,
        createdAt: new Date().toISOString()
      };

      updatedCallbackHistory.push(completionRecord);
    }

    // 환자 정보 업데이트 (기존 코드 유지)
    const updateData = {
      ...(isReservationCompletion ? {
        status: '예약확정',
        reservationDate: extractReservationDate(reason),
        reservationTime: extractReservationTime(reason)
      } : {
        isCompleted: true,
        completedAt: todayKorean,
        completedReason: reason,
        status: '종결'
      }),
      callbackHistory: updatedCallbackHistory,
      updatedAt: new Date().toISOString()
    };

    // MongoDB에 저장 (기존 코드 유지)
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
      (updatedPatient as any)._id = updatedPatient._id.toString();
    }
    
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }

    // 🔥 백엔드 로그 - 환자 처리 성공 (프론트엔드 로깅이 없는 경우에만)
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
          updatedExistingCallback: updatedExistingCallback,
          hadScheduledCallback: !!scheduledCallback,
          processingMethod: scheduledCallback ? 'updated_scheduled_callback' : 'created_new_callback',
          callbackRecordsAdded: isReservationCompletion ? (updatedExistingCallback ? 0 : 1) : 1,
          apiEndpoint: '/api/patients/[id]/complete',
          userAgent: request.headers.get('user-agent')?.substring(0, 100)
        }
      });
    }

    console.log(`✅ 환자 처리 성공 (${isReservationCompletion ? '예약완료' : '종결'}) - 환자 ID: ${patientId}`);

    return NextResponse.json({
      updatedPatient,
      callbackHistory: updatedCallbackHistory,
      isReservationCompletion,
      updatedExistingCallback
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