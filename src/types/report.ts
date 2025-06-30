// src/types/report.ts

// 🔥 새로 추가: 손실 환자 분석 타입
export interface LossPatientAnalysis {
  consultationLoss: {
    terminated: number; // 상담 "종결" 환자수
    missed: number;     // 상담 "부재중" 환자수
    totalCount: number; // 상담 손실 총 환자수
    estimatedAmount: number; // 예상 손실 금액 (견적 합계)
  };
  visitLoss: {
    terminated: number;      // 내원 "종결" 환자수
    onHold: number;         // 내원 "보류" 환자수
    callbackNeeded: number; // 내원 "재콜백필요" 환자수
    totalCount: number;     // 내원 손실 총 환자수
    estimatedAmount: number; // 예상 손실 금액 (견적 합계)
  };
  totalLoss: {
    totalPatients: number;   // 총 손실 환자수
    totalAmount: number;     // 총 예상 손실 금액
    lossRate: number;       // 손실률 (손실환자수/전체문의수 * 100)
  };
}

// 🔥 새로 추가: 손실 환자 상세 정보
export interface LossPatientDetail {
  _id: string;
  name: string;
  phoneNumber: string;
  callInDate: string;
  status: string;
  postVisitStatus?: string;
  estimatedAmount: number; // 견적 금액
  lossType: 'consultation' | 'visit'; // 손실 단계
  lossReason: string; // 손실 사유 (상태값)
}

export interface ChangeIndicator {
  value: number;
  type: 'increase' | 'decrease';
}

export interface RegionStat {
  region: string;
  percentage: number;
  count: number;
}

export interface ChannelStat {
  channel: string;
  percentage: number;
  count: number;
}

// 월별 통계 계산용 타입 - 🔥 손실 분석 추가
export interface MonthlyStats {
  totalInquiries: number;
  inboundCalls: number;
  outboundCalls: number;
  appointmentPatients: number;
  appointmentRate: number;
  visitedPatients: number;
  visitRate: number;
  totalPayment: number;
  paymentPatients: number;
  paymentRate: number;
  averageAge: number;
  regionStats: RegionStat[];
  channelStats: ChannelStat[];
  // 🔥 새로 추가: 손실 분석 데이터
  lossAnalysis: LossPatientAnalysis;
}

export interface MonthlyReportData {
  _id?: string;
  month: number;
  year: number;
  generatedDate: string;
  createdBy: string; // 사용자 ID
  createdByName: string; // 사용자 이름
  status: 'draft' | 'submitted' | 'approved';
  
  // 통계 데이터 (자동 계산)
  totalInquiries: number;
  inboundCalls: number;
  outboundCalls: number;
  appointmentPatients: number;
  appointmentRate: number;
  visitedPatients: number;
  visitRate: number;
  totalPayment: number;
  paymentPatients: number;
  paymentRate: number;
  averageAge: number;
  
  // 지난달 대비 변화
  changes: {
    outboundCalls: any;
    inboundCalls: any;
    paymentPatients: any;
    visitedPatients: any;
    appointmentPatients: any;
    totalInquiries: ChangeIndicator;
    appointmentRate: ChangeIndicator;
    visitRate: ChangeIndicator;
    paymentRate: ChangeIndicator;
    totalPayment: ChangeIndicator;
  };
  
  // 통계 세부 데이터
  regionStats: RegionStat[];
  channelStats: ChannelStat[];
  
  // 🔥 새로 추가: 손실 분석 데이터
  lossAnalysis: LossPatientAnalysis;
  
  // 🔥 새로 추가: 손실 환자 상세 리스트 (선택적)
  lossPatientDetails?: LossPatientDetail[];
  
  // 매니저 입력 데이터
  managerComment?: string;
  improvementSuggestions?: string;
  managerAnswers: {
    question1?: string; // 미내원 원인
    question2?: string; // 치료 거부 원인
    question3?: string; // 개선 방안
    question4?: string; // 기타 의견
  };
  
  // 메타데이터
  createdAt: string;
  updatedAt: string;
}

// 보고서 목록용 타입
export interface ReportListItem {
  _id: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted' | 'approved';
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

// 보고서 생성/수정용 타입
export interface ReportFormData {
  month: number;
  year: number;
  managerComment?: string;
  improvementSuggestions?: string;
  managerAnswers: {
    question1?: string;
    question2?: string;
    question3?: string;
    question4?: string;
  };
}

// 보고서 업데이트 타입 (새로고침 포함)
export interface ReportUpdateData {
  managerComment?: string;
  improvementSuggestions?: string;
  managerAnswers?: {
    question1?: string;
    question2?: string;
    question3?: string;
    question4?: string;
  };
  status?: 'draft' | 'submitted' | 'approved';
  refreshStats?: boolean; // 통계 새로고침 플래그
}