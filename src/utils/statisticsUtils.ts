// src/utils/statisticsUtils.ts - 일별 통계 계산 전용 유틸리티

import { Patient, CallbackItem } from '@/types/patient';
import { ActivityLog } from '@/types/activityLog';

// 🔥 콜백 처리 현황을 위한 인터페이스 수정
export interface CallbackProcessingSummary {
  overdueCallbacks: {
    total: number;
    processed: number;
    processingRate: number;
  };
  callbackUnregistered: {
    total: number;
    processed: number;
    processingRate: number;
  };
  absent: {
    total: number;
    processed: number;
    processingRate: number;
  };
  todayScheduled: {
    total: number;
    processed: number;
    processingRate: number;
  };
}

// 🔥 견적금액 정보를 위한 인터페이스 수정
export interface EstimateSummary {
  totalConsultationEstimate: number;        // 오늘 총 상담 견적 (내원+유선)
  visitConsultationEstimate: number;        // 내원 상담 환자 견적
  phoneConsultationEstimate: number;        // 유선 상담 환자 견적
  treatmentStartedEstimate: number;         // 치료 시작한 견적 (처리 날짜 기준)
}

// 🔥 종합 일별 업무 현황
export interface DailyWorkSummary {
  selectedDate: string;
  callbackSummary: CallbackProcessingSummary;
  estimateSummary: EstimateSummary;
}

/**
 * 특정 날짜의 콜백 처리 현황을 계산합니다
 */
export function calculateCallbackProcessing(
  patients: Patient[], 
  activityLogs: ActivityLog[], 
  selectedDate: string
): CallbackProcessingSummary {
  console.log('🔍 콜백 처리 현황 계산 시작:', selectedDate);
  
  // 🔥 실제 대시보드 로직과 동일하게 각 상태별 환자 목록 계산
  
  // 1. 미처리 콜백 (overdueCallbacks)
  const overdueCallbackPatients = patients.filter(patient => {
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) return false;
    
    const today = new Date(selectedDate);
    today.setHours(0, 0, 0, 0);
    
    return patient.callbackHistory.some(callback => {
      if (callback.status !== '예정') return false;
      
      const callbackDate = new Date(callback.date);
      callbackDate.setHours(0, 0, 0, 0);
      
      return callbackDate < today; // 선택된 날짜보다 이전 날짜
    });
  });
  
  // 2. 콜백 미등록 (callbackUnregistered)
  const callbackUnregisteredPatients = patients.filter(patient => {
    if (patient.status !== '잠재고객') return false;
    if (patient.isCompleted === true) return false;
    
    return !patient.callbackHistory || patient.callbackHistory.length === 0;
  });
  
  // 3. 부재중 (absent)
  const absentPatients = patients.filter(patient => {
    return patient.status === '부재중' && patient.isCompleted !== true;
  });
  
  // 4. 오늘 예정된 콜백 (todayScheduled)
  const todayScheduledPatients = patients.filter(patient => {
    // 상담관리 콜백
    const hasManagementCallback = (() => {
      if (patient.visitConfirmed === true && patient.postVisitStatus !== '재콜백필요') {
        return false;
      }
      
      return patient.callbackHistory?.some(callback => 
        callback.status === '예정' && callback.date === selectedDate
      ) || patient.nextCallbackDate === selectedDate;
    })();

    // 내원관리 콜백
    const hasPostVisitCallback = (() => {
      if (patient.visitConfirmed !== true || patient.postVisitStatus !== '재콜백필요') {
        return false;
      }
      
      return patient.callbackHistory?.some(callback => {
        return callback.status === '예정' && callback.date === selectedDate;
      });
    })();

    return hasManagementCallback || hasPostVisitCallback;
  });
  
  // 🔥 처리율 계산 함수
  const calculateProcessingRate = (patients: Patient[]): { processed: number; rate: number } => {
    if (patients.length === 0) return { processed: 0, rate: 100 };
    
    const processedCount = patients.filter(patient => {
      // 완료된 콜백이 있거나, 예약확정/종결 상태인 경우 처리된 것으로 간주
      const hasCompletedCallback = patient.callbackHistory?.some(callback => 
        callback.status === '완료' || callback.status === '예약확정'
      );
      
      const isResolved = ['예약확정', '종결'].includes(patient.status);
      
      return hasCompletedCallback || isResolved;
    }).length;
    
    return {
      processed: processedCount,
      rate: Math.round((processedCount / patients.length) * 100)
    };
  };
  
  // 각 카테고리별 처리 현황 계산
  const overdueResult = calculateProcessingRate(overdueCallbackPatients);
  const unregisteredResult = calculateProcessingRate(callbackUnregisteredPatients);
  const absentResult = calculateProcessingRate(absentPatients);
  const todayScheduledResult = calculateProcessingRate(todayScheduledPatients);
  
  const summary = {
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
  
  console.log('콜백 처리 현황 계산 완료:', summary);
  return summary;
}

/**
 * 특정 날짜의 견적금액 정보를 계산합니다
 */
export function calculateEstimateSummary(
  patients: Patient[], 
  selectedDate: string
): EstimateSummary {
  console.log('💰 견적금액 정보 계산 시작:', selectedDate);
  
  // 1. 유선 상담 환자들 (callInDate === selectedDate)
  const phoneConsultationPatients = patients.filter(patient => 
    patient.callInDate === selectedDate
  );
  
  // 2. 내원 상담 환자들 (visitDate === selectedDate)
  const visitConsultationPatients = patients.filter(patient => 
    patient.visitDate === selectedDate && patient.visitConfirmed
  );
  
  // 3. 치료 시작 처리된 환자들 (치료시작 처리 날짜 기준)
  const treatmentStartedPatients = patients.filter(patient => {
    // 🔥 치료시작 처리 날짜 기준으로 필터링
    // postVisitConsultation이 업데이트된 날짜나 활동 로그를 기준으로 해야 하지만
    // 일단 간단하게 postVisitStatus가 '치료시작'이고 오늘 업데이트된 환자들로 구현
    if (patient.postVisitStatus !== '치료시작') return false;
    
    // 🔥 실제로는 치료시작 처리된 날짜를 별도로 추적해야 하지만
    // 현재 구조에서는 lastModifiedAt이나 treatmentStartDate를 활용
    const treatmentStartDate = patient.treatmentStartDate || patient.lastModifiedAt;
    if (treatmentStartDate) {
      const treatmentDate = new Date(treatmentStartDate).toISOString().split('T')[0];
      return treatmentDate === selectedDate;
    }
    
    return false;
  });
  
  console.log('유선 상담 환자 수:', phoneConsultationPatients.length);
  console.log('내원 상담 환자 수:', visitConsultationPatients.length);
  console.log('치료 시작 처리된 환자 수:', treatmentStartedPatients.length);
  
  let phoneConsultationEstimate = 0;
  let visitConsultationEstimate = 0;
  let treatmentStartedEstimate = 0;
  
  // 유선 상담 환자들의 견적
  phoneConsultationPatients.forEach(patient => {
    let estimateAmount = 0;
    
    // 상담 정보에서 견적 금액 추출
    if (patient.consultation?.estimatedAmount) {
      estimateAmount = patient.consultation.estimatedAmount;
    }
    
    if (estimateAmount > 0) {
      phoneConsultationEstimate += estimateAmount;
      console.log(`유선 상담 환자 ${patient.name}: ${estimateAmount}원`);
    }
  });
  
  // 내원 상담 환자들의 견적
  visitConsultationPatients.forEach(patient => {
    let estimateAmount = 0;
    
    // 내원 후 상담 정보에서 견적 금액 추출 (우선)
    if (patient.postVisitConsultation?.estimateInfo?.discountPrice) {
      estimateAmount = patient.postVisitConsultation.estimateInfo.discountPrice;
    }
    // 없으면 일반 상담 정보에서
    else if (patient.consultation?.estimatedAmount) {
      estimateAmount = patient.consultation.estimatedAmount;
    }
    
    if (estimateAmount > 0) {
      visitConsultationEstimate += estimateAmount;
      console.log(`내원 상담 환자 ${patient.name}: ${estimateAmount}원 (상태: ${patient.postVisitStatus})`);
    }
  });
  
  // 치료 시작 처리된 환자들의 견적 (처리 날짜 기준)
  treatmentStartedPatients.forEach(patient => {
    let estimateAmount = 0;
    
    // 내원 후 상담 정보에서 견적 금액 추출 (우선)
    if (patient.postVisitConsultation?.estimateInfo?.discountPrice) {
      estimateAmount = patient.postVisitConsultation.estimateInfo.discountPrice;
    }
    // 없으면 일반 상담 정보에서
    else if (patient.consultation?.estimatedAmount) {
      estimateAmount = patient.consultation.estimatedAmount;
    }
    
    if (estimateAmount > 0) {
      treatmentStartedEstimate += estimateAmount;
      console.log(`치료시작 처리 환자 ${patient.name}: ${estimateAmount}원 (처리일: ${selectedDate})`);
    }
  });
  
  // 총 상담 견적 = 내원 상담 + 유선 상담
  const totalConsultationEstimate = visitConsultationEstimate + phoneConsultationEstimate;
  
  const summary = {
    totalConsultationEstimate,
    visitConsultationEstimate,
    phoneConsultationEstimate,
    treatmentStartedEstimate
  };
  
  console.log('견적금액 정보 계산 완료:', {
    총상담견적: totalConsultationEstimate,
    내원상담: visitConsultationEstimate,
    유선상담: phoneConsultationEstimate,
    치료시작: treatmentStartedEstimate
  });
  
  return summary;
}

/**
 * 종합 일별 업무 현황을 계산합니다
 */
export function calculateDailyWorkSummary(
  patients: Patient[], 
  activityLogs: ActivityLog[], 
  selectedDate: string
): DailyWorkSummary {
  console.log('📊 일별 업무 현황 종합 계산 시작:', selectedDate);
  
  const callbackSummary = calculateCallbackProcessing(patients, activityLogs, selectedDate);
  const estimateSummary = calculateEstimateSummary(patients, selectedDate);
  
  const summary = {
    selectedDate,
    callbackSummary,
    estimateSummary
  };
  
  console.log('일별 업무 현황 종합 계산 완료:', summary);
  return summary;
}

/**
 * 금액을 사람이 읽기 쉬운 형태로 포맷팅
 */
export function formatCurrency(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}