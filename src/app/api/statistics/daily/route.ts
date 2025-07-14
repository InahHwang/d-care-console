// src/app/api/statistics/daily/route.ts - 완전히 수정된 처리완료 로직

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

// JWT 토큰 검증
async function verifyToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new Error('인증 토큰이 필요합니다.');
  }

  const token = authorization.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    throw new Error('유효하지 않은 토큰입니다.');
  }
}

// 🔥 완전히 수정된 처리율 계산 함수 - 실제 업무 완료 상황을 정확히 반영
const calculateProcessingRate = (patients: any[], filterType: string, selectedDate: string) => {
  if (patients.length === 0) return { processed: 0, rate: 0 };
  
  const today = new Date(selectedDate);
  today.setHours(0, 0, 0, 0);
  const todayStr = selectedDate;
  
  const processedCount = patients.filter((patient: any) => {
    switch(filterType) {
      case 'overdueCallbacks': {
        // 🔥 미처리 콜백: 지연된 콜백이 실제로 처리되었는지 확인
        
        // 1. 환자가 최종 상태에 도달했는지 먼저 확인
        const isPatientResolved = () => {
          // 상담환자의 최종 상태
          if (!patient.visitConfirmed) {
            return ['예약확정', '재예약확정', '종결'].includes(patient.status) || patient.isCompleted;
          }
          
          // 내원환자의 최종 상태  
          if (patient.visitConfirmed) {
            return ['치료시작', '종결'].includes(patient.postVisitStatus) || patient.isCompleted;
          }
          
          return false;
        };
        
        if (isPatientResolved()) {
          return true; // 환자가 최종 상태에 도달했으면 처리완료로 간주
        }
        
        // 2. 지연된 콜백이 실제로 처리되었는지 확인
        if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
          return false;
        }
        
        // 🔥 핵심 수정: 상담환자와 내원환자 구분하여 처리
        if (!patient.visitConfirmed) {
          // 상담환자: 모든 콜백 고려
          const hasProcessedOverdueCallback = patient.callbackHistory.some((callback: any) => {
            if (callback.status !== '완료' && callback.status !== '예약확정') return false;
            
            const originalCallbackDate = new Date(callback.date);
            originalCallbackDate.setHours(0, 0, 0, 0);
            
            return originalCallbackDate < today;
          });
          
          return hasProcessedOverdueCallback;
        } else {
          // 🔥 내원환자: 내원관리 콜백만 고려
          const hasProcessedOverdueVisitCallback = patient.callbackHistory.some((callback: any) => {
            if (callback.status !== '완료' && callback.status !== '예약확정') return false;
            
            // 🔥 핵심: 내원관리 콜백만 체크
            if (!callback.isVisitManagementCallback) return false;
            
            const originalCallbackDate = new Date(callback.date);
            originalCallbackDate.setHours(0, 0, 0, 0);
            
            return originalCallbackDate < today;
          });
          
          return hasProcessedOverdueVisitCallback;
        }
      }
      
      case 'callbackUnregistered': {
        // 🔥 콜백 미등록: 콜백이 등록되었는지 확인
        
        // 1. 환자가 최종 상태에 도달했는지 먼저 확인
        if (patient.isCompleted || patient.status === '종결') {
          return true; // 종결된 환자는 처리완료로 간주
        }
        
        // 2. 콜백 등록 여부 확인
        const hasScheduledCallback = patient.callbackHistory?.some((callback: any) => 
          callback.status === '예정'
        );
        
        // 내원환자의 경우 내원관리 콜백 등록 여부 확인
        if (patient.visitConfirmed && !patient.postVisitStatus) {
          const hasVisitManagementCallback = patient.callbackHistory?.some((callback: any) => 
            callback.status === '예정' && 
            callback.isVisitManagementCallback === true
          );
          return hasVisitManagementCallback;
        }
        
        // 상담환자의 경우 일반 콜백 등록 여부 확인
        return hasScheduledCallback;
      }
      
      case 'absent': {
        // 🔥 부재중: 부재중 상태에서 벗어났는지 확인
        return patient.status !== '부재중' || patient.isCompleted;
      }
      
      case 'todayScheduled': {
        // 🔥 오늘 예정된 콜백: 오늘 콜백이 완료되었는지 확인
        
        // 1. 환자가 최종 상태에 도달했는지 먼저 확인
        const isPatientResolved = () => {
          if (!patient.visitConfirmed) {
            return ['예약확정', '재예약확정', '종결'].includes(patient.status) || patient.isCompleted;
          }
          
          if (patient.visitConfirmed) {
            return ['치료시작', '종결'].includes(patient.postVisitStatus) || patient.isCompleted;
          }
          
          return false;
        };
        
        if (isPatientResolved()) {
          return true; // 환자가 최종 상태에 도달했으면 처리완료로 간주
        }
        
        // 2. 오늘 예정된 콜백이 실제로 완료되었는지 확인
        if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
          return false;
        }
        
        // 🔥 핵심: 오늘 날짜에 완료된 콜백이 있는지 확인
        const hasTodayCompletedCallback = patient.callbackHistory.some((callback: any) => {
          if (callback.status !== '완료' && callback.status !== '예약확정') return false;
          
          // 1. 원래 예정일이 오늘이고 완료된 경우
          if (callback.date === todayStr) return true;
          
          // 2. 실제 완료일이 오늘인 경우 (completedAt 기준)
          if (callback.completedAt) {
            const completedDate = new Date(callback.completedAt).toISOString().split('T')[0];
            return completedDate === todayStr;
          }
          
          return false;
        });
        
        return hasTodayCompletedCallback;
      }
      
      default:
        // 🔥 기존 로직 (호환성 유지)
        const hasCompletedCallback = patient.callbackHistory?.some((callback: any) => 
          callback.status === '완료' || callback.status === '예약확정'
        );
        
        const isResolved = ['예약확정', '종결'].includes(patient.status) || patient.isCompleted;
        
        return hasCompletedCallback || isResolved;
    }
  }).length;
  
  return {
    processed: processedCount,
    rate: Math.round((processedCount / patients.length) * 100)
  };
};

// 일별 통계 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    await verifyToken(request);
    
    const { searchParams } = new URL(request.url);
    const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    console.log('📊 일별 통계 API 호출:', selectedDate);
    
    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');
    const activityLogsCollection = db.collection('activityLogs');
    
    // 환자 데이터 조회
    const patients = await patientsCollection.find({}).toArray();
    
    // 선택된 날짜의 활동 로그 조회 (콜백 생성 관련)
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const activityLogs = await activityLogsCollection.find({
      timestamp: {
        $gte: startOfDay.toISOString(),
        $lte: endOfDay.toISOString()
      },
      action: { $in: ['callback_create', 'callback_complete', 'callback_update'] }
    }).toArray();
    
    console.log('조회된 환자 수:', patients.length);
    console.log('조회된 활동 로그 수:', activityLogs.length);
    
    // 🔥 콜백 처리 현황 계산 - 대시보드 로직과 완전 동기화
    
    // 🔥 1. 미처리 콜백 (overdueCallbacks) - 완전 수정!
    const overdueCallbackPatients = patients.filter((patient: any) => {
      if (!patient.callbackHistory || patient.callbackHistory.length === 0) return false;
      
      const today = new Date(selectedDate);
      today.setHours(0, 0, 0, 0);
      
      // 🔥 대시보드와 동일한 로직: 상담환자와 내원환자 구분
      
      // 상담환자 (내원확정되지 않은 환자)
      if (patient.visitConfirmed !== true) {
        // 예약확정/재예약확정 상태인 환자는 제외
        if (patient.status === '예약확정' || patient.status === '재예약확정') {
          return false;
        }
        
        // 환자상태가 "콜백필요"이고 콜백 예정 날짜가 오늘 이전인 경우
        if (patient.status !== '콜백필요') {
          return false;
        }
        
        return patient.callbackHistory.some((callback: any) => {
          if (callback.status !== '예정') return false;
          const callbackDate = new Date(callback.date);
          callbackDate.setHours(0, 0, 0, 0);
          return callbackDate < today;
        });
      }
      
      // 내원환자 (내원확정된 환자)
      if (patient.visitConfirmed === true) {
        // 내원 후 상태가 "재콜백필요"인 경우만
        if (patient.postVisitStatus !== '재콜백필요') {
          return false;
        }
        
        return patient.callbackHistory.some((callback: any) => {
          if (callback.status !== '예정') return false;
          const callbackDate = new Date(callback.date);
          callbackDate.setHours(0, 0, 0, 0);
          return callbackDate < today;
        });
      }
      
      return false;
    });
    
    // 🔥 2. 콜백 미등록 (callbackUnregistered) - 이미 수정됨
    const callbackUnregisteredPatients = patients.filter((patient: any) => {
      // 기존 상담환자 로직 (변경 없음)
      if (patient.status === '잠재고객' && patient.isCompleted !== true) {
        return !patient.callbackHistory || patient.callbackHistory.length === 0;
      }
      
      // 🔥 내원환자 로직 (이미 수정됨)
      if (patient.visitConfirmed === true && !patient.postVisitStatus) {
        // 내원관리 콜백만 체크! 상담관리 콜백은 무시
        if (!patient.callbackHistory || patient.callbackHistory.length === 0) return true;
        
        const hasVisitManagementCallback = patient.callbackHistory.some((callback: any) => 
          callback.status === '예정' && 
          callback.isVisitManagementCallback === true  // 🔥 내원관리 콜백만 체크
        );
        
        return !hasVisitManagementCallback;
      }
      
      // 🔥 예약 후 미내원, 부재중 환자들 (기존 로직 유지)
      if (patient.status === '부재중' || patient.isPostReservationPatient === true) {
        if (!patient.callbackHistory || patient.callbackHistory.length === 0) return true;
        
        const hasScheduledCallback = patient.callbackHistory.some((callback: any) => 
          callback.status === '예정'
        );
        
        return !hasScheduledCallback;
      }
      
      return false;
    });
    
    // 3. 부재중 (absent)
    const absentPatients = patients.filter((patient: any) => {
      return patient.status === '부재중' && patient.isCompleted !== true;
    });
    
    // 🔥 4. 오늘 예정된 콜백 (todayScheduled) - 대시보드와 동일하게 수정
    const todayScheduledPatients = patients.filter((patient: any) => {
      // 상담관리 콜백
      const hasManagementCallback = (() => {
        if (patient.visitConfirmed === true && patient.postVisitStatus !== '재콜백필요') {
          return false;
        }
        
        // 🔥 예약확정/재예약확정 상태인 환자도 제외
        if (patient.status === '예약확정' || patient.status === '재예약확정') {
          return false;
        }
        
        return patient.callbackHistory?.some((callback: any) => 
          callback.status === '예정' && callback.date === selectedDate
        ) || patient.nextCallbackDate === selectedDate;
      })();

      // 내원관리 콜백
      const hasPostVisitCallback = (() => {
        if (patient.visitConfirmed !== true || patient.postVisitStatus !== '재콜백필요') {
          return false;
        }
        
        return patient.callbackHistory?.some((callback: any) => {
          return callback.status === '예정' && callback.date === selectedDate;
        });
      })();

      return hasManagementCallback || hasPostVisitCallback;
    });
    
    // 🔥 각 카테고리별 처리 현황 계산 (수정된 부분)
    const overdueResult = calculateProcessingRate(overdueCallbackPatients, 'overdueCallbacks', selectedDate);
    const unregisteredResult = calculateProcessingRate(callbackUnregisteredPatients, 'callbackUnregistered', selectedDate);
    const absentResult = calculateProcessingRate(absentPatients, 'absent', selectedDate);
    const todayScheduledResult = calculateProcessingRate(todayScheduledPatients, 'todayScheduled', selectedDate);
    
    // 🔥 디버깅을 위한 상세 로그 추가
    const overdueCallbacks_breakdown = {
      상담환자: overdueCallbackPatients.filter((p: any) => !p.visitConfirmed).length,
      내원환자: overdueCallbackPatients.filter((p: any) => p.visitConfirmed && p.postVisitStatus === '재콜백필요').length
    };
    
    const callbackUnregistered_breakdown = {
      상담환자: callbackUnregisteredPatients.filter((p: any) => !p.visitConfirmed).length,
      내원환자: callbackUnregisteredPatients.filter((p: any) => p.visitConfirmed && !p.postVisitStatus).length,
      예약후미내원: callbackUnregisteredPatients.filter((p: any) => p.isPostReservationPatient).length,
      부재중: callbackUnregisteredPatients.filter((p: any) => p.status === '부재중').length
    };
    
    console.log('=== 처리완료 로직 상세 분석 (상담관리/내원관리 분리 버전) ===');
    console.log('🔥 미처리 콜백:', {
      환자수: overdueCallbackPatients.length,
      처리완료: overdueResult.processed,
      처리율: overdueResult.rate + '%',
      기준: '상담환자: 모든 콜백 고려 | 내원환자: 내원관리 콜백만 고려',
      상세분석: overdueCallbacks_breakdown
    });
    console.log('📋 콜백 미등록:', {
      환자수: callbackUnregisteredPatients.length,
      처리완료: unregisteredResult.processed,
      처리율: unregisteredResult.rate + '%',
      기준: '환자 종결 OR 콜백 등록됨',
      상세분석: callbackUnregistered_breakdown
    });
    console.log('📞 부재중:', {
      환자수: absentPatients.length,
      처리완료: absentResult.processed,
      처리율: absentResult.rate + '%',
      기준: '부재중 상태에서 벗어남 OR 환자 종결'
    });
    console.log('📅 오늘 예정된 콜백:', {
      환자수: todayScheduledPatients.length,
      처리완료: todayScheduledResult.processed,
      처리율: todayScheduledResult.rate + '%',
      기준: '환자가 최종상태 도달 OR 오늘 날짜에 콜백 완료'
    });
    console.log('========================');
    
    const callbackSummary = {
      overdueCallbacks: {
        total: overdueCallbackPatients.length,
        processed: overdueResult.processed,
        processingRate: overdueResult.rate
      },
      callbackUnregistered: {
        total: callbackUnregisteredPatients.length,
        processed: unregisteredResult.processed,
        processingRate: unregisteredResult.rate
      },
      absent: {
        total: absentPatients.length,
        processed: absentResult.processed,
        processingRate: absentResult.rate
      },
      todayScheduled: {
        total: todayScheduledPatients.length,
        processed: todayScheduledResult.processed,
        processingRate: todayScheduledResult.rate
      }
    };
    
    // 🔥 견적금액 정보 계산 - 기존 로직 유지
    
    // 1. 유선 상담 환자들 (callInDate === selectedDate)
    const phoneConsultationPatients = patients.filter((patient: any) => 
      patient.callInDate === selectedDate
    );
    
    // 2. 내원 상담 환자들 (visitDate === selectedDate)
    const visitConsultationPatients = patients.filter((patient: any) => 
      patient.visitDate === selectedDate && patient.visitConfirmed
    );
    
    // 3. 치료 시작 처리된 환자들 (치료시작 처리 날짜 기준)
    const treatmentStartedPatients = patients.filter((patient: any) => {
      if (patient.postVisitStatus !== '치료시작') return false;
      
      // 치료시작 처리 날짜 기준
      const treatmentStartDate = patient.treatmentStartDate || patient.lastModifiedAt;
      if (treatmentStartDate) {
        const treatmentDate = new Date(treatmentStartDate).toISOString().split('T')[0];
        return treatmentDate === selectedDate;
      }
      
      return false;
    });
    
    console.log('=== 견적금액 계산 상세 ===');
    console.log('유선 상담 환자 수:', phoneConsultationPatients.length);
    console.log('내원 상담 환자 수:', visitConsultationPatients.length);
    console.log('치료 시작 처리 환자 수:', treatmentStartedPatients.length);
    
    let phoneConsultationEstimate = 0;
    let visitConsultationEstimate = 0;
    let treatmentStartedEstimate = 0;
    
    // 유선 상담 환자들의 견적
    phoneConsultationPatients.forEach((patient: any) => {
      let estimateAmount = 0;
      
      if (patient.consultation?.estimatedAmount) {
        estimateAmount = patient.consultation.estimatedAmount;
      }
      
      if (estimateAmount > 0) {
        phoneConsultationEstimate += estimateAmount;
        console.log(`유선 상담 환자 ${patient.name}: ${estimateAmount}원`);
      }
    });
    
    // 내원 상담 환자들의 견적
    visitConsultationPatients.forEach((patient: any) => {
      let estimateAmount = 0;
      
      if (patient.postVisitConsultation?.estimateInfo?.discountPrice) {
        estimateAmount = patient.postVisitConsultation.estimateInfo.discountPrice;
      } else if (patient.consultation?.estimatedAmount) {
        estimateAmount = patient.consultation.estimatedAmount;
      }
      
      if (estimateAmount > 0) {
        visitConsultationEstimate += estimateAmount;
        console.log(`내원 상담 환자 ${patient.name}: ${estimateAmount}원`);
      }
    });
    
    // 치료 시작 처리된 환자들의 견적
    treatmentStartedPatients.forEach((patient: any) => {
      let estimateAmount = 0;
      
      if (patient.postVisitConsultation?.estimateInfo?.discountPrice) {
        estimateAmount = patient.postVisitConsultation.estimateInfo.discountPrice;
      } else if (patient.consultation?.estimatedAmount) {
        estimateAmount = patient.consultation.estimatedAmount;
      }
      
      if (estimateAmount > 0) {
        treatmentStartedEstimate += estimateAmount;
        console.log(`치료시작 처리 환자 ${patient.name}: ${estimateAmount}원`);
      }
    });
    
    // 총 상담 견적 = 내원 상담 + 유선 상담
    const totalConsultationEstimate = visitConsultationEstimate + phoneConsultationEstimate;
    
    console.log('견적금액 계산 완료:', {
      총상담견적: totalConsultationEstimate,
      내원상담: visitConsultationEstimate,
      유선상담: phoneConsultationEstimate,
      치료시작: treatmentStartedEstimate
    });
    console.log('===================');
    
    const estimateSummary = {
      totalConsultationEstimate,
      visitConsultationEstimate,
      phoneConsultationEstimate,
      treatmentStartedEstimate
    };
    
    // 응답 데이터
    const dailyStats = {
      selectedDate,
      callbackSummary,
      estimateSummary,
      rawData: {
        totalPatients: patients.length,
        phoneConsultationPatientsCount: phoneConsultationPatients.length,
        visitConsultationPatientsCount: visitConsultationPatients.length,
        treatmentStartedPatientsCount: treatmentStartedPatients.length,
        activityLogsCount: activityLogs.length,
        // 🔥 추가: 상세 분석
        overdueCallbacks_breakdown,
        callbackUnregistered_breakdown
      }
    };
    
    console.log('🔥 일별 통계 계산 완료 (처리완료 로직 완전 수정):', dailyStats);
    
    return NextResponse.json({
      success: true,
      data: dailyStats
    });

  } catch (error) {
    console.error('일별 통계 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '일별 통계 조회에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('토큰') ? 401 : 500 }
    );
  }
}