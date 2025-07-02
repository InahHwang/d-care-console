// src/utils/lossAnalysisUtils.ts - 🔥 완전 수정 버전

import { Patient } from '@/types/patient';
import { LossPatientAnalysis, LossPatientDetail } from '@/types/report';

/**
 * 🔥 미예약/미내원 환자의 손실 매출을 분석하는 유틸리티 함수
 */
export function calculateLossAnalysis(patients: Patient[]): LossPatientAnalysis {
  console.log(`🔍 손실 분석 시작 - 총 환자 수: ${patients.length}명`);
  
  // 🔥 1. 상담 관리 손실군 분석 - "예약확정" 외의 모든 환자
  const consultationLossPatients = patients.filter(p => 
    p.status !== '예약확정' && p.status !== 'VIP'  // 예약확정과 VIP 제외
  );
  
  // 상담 손실군을 세부 상태별로 분류
  const consultationTerminated = consultationLossPatients.filter(p => p.status === '종결').length;
  const consultationMissed = consultationLossPatients.filter(p => p.status === '부재중').length;
  const consultationPotential = consultationLossPatients.filter(p => p.status === '잠재고객').length;
  const consultationCallback = consultationLossPatients.filter(p => p.status === '콜백필요').length;
  
  // 상담 손실 견적 금액 계산
  const consultationLossAmount = consultationLossPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  console.log(`📞 상담 손실 상세:`);
  console.log(`   • 종결: ${consultationTerminated}명`);
  console.log(`   • 부재중: ${consultationMissed}명`);
  console.log(`   • 잠재고객: ${consultationPotential}명`);
  console.log(`   • 콜백필요: ${consultationCallback}명`);
  console.log(`   • 총 상담 손실: ${consultationLossPatients.length}명, 손실금액: ${consultationLossAmount.toLocaleString()}원`);
  
  // 🔥 2. 내원 관리 손실군 분석 - 수정된 4개 상태 적용
  const visitLossPatients = patients.filter(p => 
    p.visitConfirmed === true && 
    p.postVisitStatus !== '치료시작'  // 치료시작이 아닌 모든 상태
  );

  // 각 상태별 카운트 - 수정된 상태명 적용
  const visitTerminated = visitLossPatients.filter(p => p.postVisitStatus === '종결').length;
  const visitCallbackNeeded = visitLossPatients.filter(p => p.postVisitStatus === '재콜백필요').length;
  const visitAgreedButNotStarted = visitLossPatients.filter(p => p.postVisitStatus === '치료동의').length;
  
  // 내원 손실 견적 금액 계산
  const visitLossAmount = visitLossPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  // 🔥 수정된 로그 출력
  console.log(`🏥 내원 손실: 종결 ${visitTerminated}명, 재콜백필요 ${visitCallbackNeeded}명, 치료동의 ${visitAgreedButNotStarted}명, 손실금액 ${visitLossAmount.toLocaleString()}원`);
  
  // 3. 전체 손실 분석
  const totalLossPatients = consultationLossPatients.length + visitLossPatients.length;
  const totalLossAmount = consultationLossAmount + visitLossAmount;
  const lossRate = patients.length > 0 ? (totalLossPatients / patients.length) * 100 : 0;
  
  console.log(`💸 총 손실: ${totalLossPatients}명, 총 손실금액 ${totalLossAmount.toLocaleString()}원, 손실률 ${lossRate.toFixed(1)}%`);
  
  return {
    consultationLoss: {
      terminated: consultationTerminated,
      missed: consultationMissed,
      potential: consultationPotential,
      callback: consultationCallback,
      totalCount: consultationLossPatients.length,
      estimatedAmount: consultationLossAmount
    },
    visitLoss: {
      terminated: visitTerminated,
      callbackNeeded: visitCallbackNeeded,
      agreedButNotStarted: visitAgreedButNotStarted,
      totalCount: visitLossPatients.length,
      estimatedAmount: visitLossAmount
    },
    totalLoss: {
      totalPatients: totalLossPatients,
      totalAmount: totalLossAmount,
      lossRate: Math.round(lossRate * 10) / 10
    }
  };
}

/**
 * 🔥 손실 환자 상세 리스트 생성 - 완전 수정된 버전
 */
export function getLossPatientDetails(patients: Patient[]): LossPatientDetail[] {
  const lossPatients: LossPatientDetail[] = [];
  
  // 🔥 상담 관리 손실군 - "예약확정" 외의 모든 환자
  const consultationLoss = patients.filter(p => 
    p.status !== '예약확정' && p.status !== 'VIP'
  );
  
  consultationLoss.forEach(p => {
    lossPatients.push({
      _id: p._id,
      name: p.name,
      phoneNumber: p.phoneNumber,
      callInDate: p.callInDate,
      status: p.status,
      estimatedAmount: getPatientEstimatedAmount(p),
      lossType: 'consultation',
      lossReason: p.status
    });
  });
  
  // 🔥 내원 관리 손실군 - 완전히 수정된 버전 (37번째 줄 수정)
  const visitLoss = patients.filter(p => 
    p.visitConfirmed === true && 
    p.postVisitStatus !== '치료시작' && 
    p.postVisitStatus !== '' && 
    p.postVisitStatus !== undefined
  );
  
  visitLoss.forEach(p => {
    lossPatients.push({
      _id: p._id,
      name: p.name,
      phoneNumber: p.phoneNumber,
      callInDate: p.callInDate,
      status: p.status,
      postVisitStatus: p.postVisitStatus,
      estimatedAmount: getPatientEstimatedAmount(p),
      lossType: 'visit',
      lossReason: p.postVisitStatus || '알 수 없음'
    });
  });
  
  // 손실 금액 기준으로 내림차순 정렬
  return lossPatients.sort((a, b) => b.estimatedAmount - a.estimatedAmount);
}

/**
 * 🔥 환자의 예상 견적 금액 계산
 * 기존 치료금액 계산 로직과 동일하게 적용
 */
function getPatientEstimatedAmount(patient: Patient): number {
  let estimatedAmount = 0;
  
  // 1. 내원 후 상담 정보의 견적이 있는 경우 (우선순위 1)
  if (patient.postVisitConsultation?.estimateInfo) {
    const estimate = patient.postVisitConsultation.estimateInfo;
    
    // 할인가 > 정가 순서로 적용
    if (estimate.discountPrice && estimate.discountPrice > 0) {
      estimatedAmount = estimate.discountPrice;
    } else if (estimate.regularPrice && estimate.regularPrice > 0) {
      estimatedAmount = estimate.regularPrice;
    }
  }
  
  // 2. 기존 상담 정보의 견적이 있는 경우 (우선순위 2, 호환성 유지)
  else if (patient.consultation?.estimatedAmount) {
    estimatedAmount = patient.consultation.estimatedAmount;
  }
  
  // 3. 직접 입력된 치료금액이 있는 경우 (우선순위 3, 호환성 유지)
  else if (patient.treatmentCost && patient.treatmentCost > 0) {
    estimatedAmount = patient.treatmentCost;
  }
  
  // 4. 🔥 견적이 없는 경우 평균 치료비로 추정 (선택적)
  else {
    // 견적 정보가 없는 환자는 0원으로 처리하거나
    // 평균 치료비(예: 150만원)로 추정할 수 있음
    estimatedAmount = 0; // 또는 1500000 (평균 치료비)
  }
  
  console.log(`💰 ${patient.name} (${patient.status}) 견적금액: ${estimatedAmount.toLocaleString()}원`);
  
  return estimatedAmount;
}

/**
 * 🔥 손실률 백분율을 컬러 클래스로 변환
 */
export function getLossRateColorClass(lossRate: number): string {
  if (lossRate <= 20) return 'text-green-600 bg-green-50 border-green-200';
  if (lossRate <= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  if (lossRate <= 60) return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

/**
 * 🔥 손실 금액을 읽기 쉬운 형태로 포맷팅
 */
export function formatLossAmount(amount: number): string {
  if (amount >= 100000000) { // 1억 이상
    return `${(amount / 100000000).toFixed(1)}억원`;
  } else if (amount >= 10000) { // 1만 이상
    return `${(amount / 10000).toFixed(0)}만원`;
  } else {
    return `${amount.toLocaleString()}원`;
  }
}