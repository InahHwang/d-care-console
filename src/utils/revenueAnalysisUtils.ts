// src/utils/revenueAnalysisUtils.ts - 🔥 매출 현황 분석 유틸리티

import { Patient } from '@/types/patient';
import { RevenueAnalysis, RevenuePatientDetail } from '@/types/report';

/**
 * 🔥 환자들을 3그룹으로 분류하여 매출 현황을 분석하는 유틸리티 함수
 */
export function calculateRevenueAnalysis(patients: Patient[]): RevenueAnalysis {
  console.log(`🔍 매출 현황 분석 시작 - 총 환자 수: ${patients.length}명`);
  
  // 🔥 1. 달성매출군 - 치료시작한 환자들
  const achievedPatients = patients.filter(p => 
    p.visitConfirmed === true && p.postVisitStatus === '치료시작'
  );
  
  const achievedAmount = achievedPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  console.log(`✅ 달성매출: ${achievedPatients.length}명, ${achievedAmount.toLocaleString()}원`);
  
  // 🔥 2. 잠재매출군 - 아직 진행 중인 환자들 (치료시작 제외)
  // 2-1. 상담진행중: 콜백필요, 잠재고객, 예약확정 (치료시작 제외)
  const consultationOngoingPatients = patients.filter(p => 
    ['콜백필요', '잠재고객', '예약확정', '재예약확정'].includes(p.status) && 
    !p.isCompleted &&
    !(p.visitConfirmed === true && p.postVisitStatus === '치료시작') // 🔥 치료시작 제외
  );
  
  const consultationOngoingAmount = consultationOngoingPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  // 2-2. 내원관리중: 치료동의, 재콜백필요, 상태미설정 (내원확정된 환자 중 치료시작 제외)
  const visitManagementPatients = patients.filter(p => 
    p.visitConfirmed === true && 
    p.postVisitStatus !== '치료시작' && // 🔥 치료시작 제외 (이미 있지만 명확히)
    p.postVisitStatus !== '종결' &&
    !p.isCompleted
  );
  
  const visitManagementAmount = visitManagementPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  const totalPotentialPatients = consultationOngoingPatients.length + visitManagementPatients.length;
  const totalPotentialAmount = consultationOngoingAmount + visitManagementAmount;
  
  console.log(`⏳ 잠재매출: ${totalPotentialPatients}명 (상담진행중 ${consultationOngoingPatients.length}명 + 내원관리중 ${visitManagementPatients.length}명), ${totalPotentialAmount.toLocaleString()}원`);
  
  // 🔥 3. 손실매출군 - 확실히 놓친 환자들 (치료시작 제외)
  // 3-1. 상담단계 손실: 종결, 부재중 (치료시작 제외)
  const consultationLostPatients = patients.filter(p => 
    (p.status === '종결' || p.status === '부재중') || 
    (p.isCompleted === true && !p.visitConfirmed)
  );
  
  const consultationLostAmount = consultationLostPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  // 3-2. 내원후 손실: 내원후 종결 (치료시작 제외)
  const visitLostPatients = patients.filter(p => 
    p.visitConfirmed === true && 
    p.postVisitStatus === '종결'
  );
  
  const visitLostAmount = visitLostPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  const totalLostPatients = consultationLostPatients.length + visitLostPatients.length;
  const totalLostAmount = consultationLostAmount + visitLostAmount;
  
  console.log(`❌ 손실매출: ${totalLostPatients}명 (상담손실 ${consultationLostPatients.length}명 + 내원후손실 ${visitLostPatients.length}명), ${totalLostAmount.toLocaleString()}원`);

  // 🔥 4. 전체 요약 계산
  const totalInquiries = patients.length;
  const totalPotentialAmountAll = achievedAmount + totalPotentialAmount + totalLostAmount;
  
  const achievedPercentage = totalInquiries > 0 ? Math.round((achievedPatients.length / totalInquiries) * 100) : 0;
  const potentialPercentage = totalInquiries > 0 ? Math.round((totalPotentialPatients / totalInquiries) * 100) : 0;
  const lostPercentage = totalInquiries > 0 ? Math.round((totalLostPatients / totalInquiries) * 100) : 0;
  
  const achievementRate = totalPotentialAmountAll > 0 ? Math.round((achievedAmount / totalPotentialAmountAll) * 100) : 0;
  const potentialGrowth = achievedAmount > 0 ? Math.round((totalPotentialAmount / achievedAmount) * 100) : 0;
  
  console.log(`💰 총 잠재매출: ${totalPotentialAmountAll.toLocaleString()}원, 달성률: ${achievementRate}%, 잠재성장률: ${potentialGrowth}%`);
  
  return {
    achievedRevenue: {
      patients: achievedPatients.length,
      amount: achievedAmount,
      percentage: achievedPercentage
    },
    potentialRevenue: {
      consultation: {
        patients: consultationOngoingPatients.length,
        amount: consultationOngoingAmount
      },
      visitManagement: {
        patients: visitManagementPatients.length,
        amount: visitManagementAmount
      },
      totalPatients: totalPotentialPatients,
      totalAmount: totalPotentialAmount,
      percentage: potentialPercentage
    },
    lostRevenue: {
      consultation: {
        patients: consultationLostPatients.length,
        amount: consultationLostAmount
      },
      visitManagement: {
        patients: visitLostPatients.length,
        amount: visitLostAmount
      },
      totalPatients: totalLostPatients,
      totalAmount: totalLostAmount,
      percentage: lostPercentage
    },
    summary: {
      totalInquiries,
      totalPotentialAmount: totalPotentialAmountAll,
      achievementRate,
      potentialGrowth
    }
  };
}

/**
 * 🔥 매출 현황 환자 상세 리스트 생성
 */
export function getRevenuePatientDetails(patients: Patient[]): RevenuePatientDetail[] {
  const revenuePatients: RevenuePatientDetail[] = [];
  
  patients.forEach(p => {
    const estimatedAmount = getPatientEstimatedAmount(p);
    
    // 🔥 1. 달성매출 (치료시작)
    if (p.visitConfirmed === true && p.postVisitStatus === '치료시작') {
      revenuePatients.push({
        _id: p._id,
        name: p.name,
        phoneNumber: p.phoneNumber,
        callInDate: p.callInDate,
        status: p.status,
        postVisitStatus: p.postVisitStatus,
        estimatedAmount,
        revenueType: 'achieved',
        revenueSubType: 'treatment_started',
        category: '치료시작'
      });
    }
    // 🔥 2. 잠재매출 - 상담진행중
    else if (['콜백필요', '잠재고객', '예약확정', '재예약확정'].includes(p.status) && 
         !p.isCompleted &&
         p.postVisitStatus !== '치료시작') { // 🔥 치료시작 제외 추가
    revenuePatients.push({
      _id: p._id,
      name: p.name,
      phoneNumber: p.phoneNumber,
      callInDate: p.callInDate,
      status: p.status,
      postVisitStatus: p.postVisitStatus,
      estimatedAmount,
      revenueType: 'potential',
      revenueSubType: 'consultation_ongoing',
      category: '상담진행중'
    });
  }
    // 🔥 3. 잠재매출 - 내원관리중
    else if (p.visitConfirmed === true && 
             p.postVisitStatus !== '치료시작' && 
             p.postVisitStatus !== '종결' && 
             !p.isCompleted) {
      revenuePatients.push({
        _id: p._id,
        name: p.name,
        phoneNumber: p.phoneNumber,
        callInDate: p.callInDate,
        status: p.status,
        postVisitStatus: p.postVisitStatus,
        estimatedAmount,
        revenueType: 'potential',
        revenueSubType: 'visit_management',
        category: '내원관리중'
      });
    }
    // 🔥 4. 손실매출 - 상담단계 손실
    else if ((p.status === '종결' || p.status === '부재중') || 
             (p.isCompleted === true && !p.visitConfirmed)) {
      revenuePatients.push({
        _id: p._id,
        name: p.name,
        phoneNumber: p.phoneNumber,
        callInDate: p.callInDate,
        status: p.status,
        postVisitStatus: p.postVisitStatus,
        estimatedAmount,
        revenueType: 'lost',
        revenueSubType: 'consultation_lost',
        category: '상담단계 손실'
      });
    }
    // 🔥 5. 손실매출 - 내원후 손실
    else if (p.visitConfirmed === true && 
             (p.postVisitStatus === '종결' || (p.isCompleted === true && p.visitConfirmed))) {
      revenuePatients.push({
        _id: p._id,
        name: p.name,
        phoneNumber: p.phoneNumber,
        callInDate: p.callInDate,
        status: p.status,
        postVisitStatus: p.postVisitStatus,
        estimatedAmount,
        revenueType: 'lost',
        revenueSubType: 'visit_lost',
        category: '내원후 손실'
      });
    }
  });
  
  // 매출 금액 기준으로 내림차순 정렬
  return revenuePatients.sort((a, b) => b.estimatedAmount - a.estimatedAmount);
}

/**
 * 🔥 매출 타입별 환자 필터링
 */
export function filterPatientsByRevenueType(
  patients: Patient[], 
  revenueType: 'achieved' | 'potential' | 'lost',
  subType?: 'consultation_ongoing' | 'visit_management' | 'consultation_lost' | 'visit_lost'
): Patient[] {
  switch (revenueType) {
    case 'achieved':
      return patients.filter(p => 
        p.visitConfirmed === true && p.postVisitStatus === '치료시작'
      );
      
    case 'potential':
      if (subType === 'consultation_ongoing') {
        return patients.filter(p => 
          ['콜백필요', '잠재고객', '예약확정', '재예약확정'].includes(p.status) && 
          !p.isCompleted
          // 치료시작 제외 조건 불필요 (이미 다른 status임)
        );
      } else if (subType === 'visit_management') {
        return patients.filter(p => 
          p.visitConfirmed === true && 
          p.postVisitStatus !== '치료시작' && 
          p.postVisitStatus !== '종결' &&
          !p.isCompleted
        );
      } else {
        // 전체 잠재매출
        return patients.filter(p => 
          (['콜백필요', '잠재고객', '예약확정', '재예약확정'].includes(p.status) && !p.isCompleted) ||
          (p.visitConfirmed === true && 
           p.postVisitStatus !== '치료시작' && 
           p.postVisitStatus !== '종결' &&
           !p.isCompleted)
        );
      }
      
    case 'lost':
      if (subType === 'consultation_lost') {
        return patients.filter(p => 
          (p.status === '종결' || p.status === '부재중') || 
          (p.isCompleted === true && !p.visitConfirmed)
          // 치료시작 제외 조건 불필요
        );
      } else if (subType === 'visit_lost') {
        return patients.filter(p => 
          p.visitConfirmed === true && 
          p.postVisitStatus === '종결'
          // 치료시작 제외 조건 불필요 (이미 '종결'로 필터링됨)
        );
      } else {
        // 전체 손실매출
        return patients.filter(p => 
          ((p.status === '종결' || p.status === '부재중') || 
           (p.isCompleted === true && !p.visitConfirmed)) ||
          (p.visitConfirmed === true && p.postVisitStatus === '종결')
        );
      }
      
    default:
      return [];
  }
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
  
  // 4. 🔥 견적이 없는 경우 0원으로 처리
  else {
    estimatedAmount = 0;
  }
  
  return estimatedAmount;
}

/**
 * 🔥 매출 금액을 읽기 쉬운 형태로 포맷팅
 */
export function formatRevenueAmount(amount: number): string {
  if (amount >= 100000000) { // 1억 이상
    return `${(amount / 100000000).toFixed(1)}억원`;
  } else if (amount >= 10000) { // 1만 이상
    return `${(amount / 10000).toFixed(0)}만원`;
  } else {
    return `${amount.toLocaleString()}원`;
  }
}

/**
 * 🔥 매출 타입에 따른 컬러 클래스 반환
 */
export function getRevenueTypeColorClass(revenueType: 'achieved' | 'potential' | 'lost'): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  switch (revenueType) {
    case 'achieved':
      return {
        bg: 'bg-green-50',
        text: 'text-green-800',
        border: 'border-green-200',
        icon: 'text-green-600'
      };
    case 'potential':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
        icon: 'text-blue-600'
      };
    case 'lost':
      return {
        bg: 'bg-red-50',
        text: 'text-red-800',
        border: 'border-red-200',
        icon: 'text-red-600'
      };
    default:
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-800',
        border: 'border-gray-200',
        icon: 'text-gray-600'
      };
  }
}

/**
 * 🔥 진행 상황별 환자 수 요약
 */
export function getRevenueProgressSummary(revenueAnalysis: RevenueAnalysis): {
  stage: string;
  patients: number;
  amount: number;
  percentage: number;
  color: string;
}[] {
  return [
    {
      stage: '치료시작',
      patients: revenueAnalysis.achievedRevenue.patients,
      amount: revenueAnalysis.achievedRevenue.amount,
      percentage: revenueAnalysis.achievedRevenue.percentage,
      color: 'green'
    },
    {
      stage: '상담진행중',
      patients: revenueAnalysis.potentialRevenue.consultation.patients,
      amount: revenueAnalysis.potentialRevenue.consultation.amount,
      percentage: Math.round((revenueAnalysis.potentialRevenue.consultation.patients / revenueAnalysis.summary.totalInquiries) * 100),
      color: 'blue'
    },
    {
      stage: '내원관리중',
      patients: revenueAnalysis.potentialRevenue.visitManagement.patients,
      amount: revenueAnalysis.potentialRevenue.visitManagement.amount,
      percentage: Math.round((revenueAnalysis.potentialRevenue.visitManagement.patients / revenueAnalysis.summary.totalInquiries) * 100),
      color: 'purple'
    },
    {
      stage: '손실',
      patients: revenueAnalysis.lostRevenue.totalPatients,
      amount: revenueAnalysis.lostRevenue.totalAmount,
      percentage: revenueAnalysis.lostRevenue.percentage,
      color: 'red'
    }
  ];
}