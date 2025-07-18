// src/types/report.ts - 🔥 기존 구조 유지하면서 새 기능 추가

// 🔥 새로 추가: 원장님 피드백 타입
export interface DirectorFeedback {
  updatedAt: any;
  feedbackId: string;
  content: string;
  createdAt: string;
  createdBy: string; // 원장님 ID
  createdByName: string; // 원장님 이름
  targetSection: 'managerComment' | 'improvementSuggestions' | 'managerAnswers.question1' | 'managerAnswers.question2' | 'managerAnswers.question3' | 'managerAnswers.question4'; // 어느 섹션에 대한 피드백인지
}

// 🔥 수정된 손실 환자 분석 타입
export interface LossPatientAnalysis {
  consultationLoss: {
    terminated: number;   // 상담 "종결" 환자수
    missed: number;       // 상담 "부재중" 환자수
    potential: number;    // 🔥 새로 추가: "잠재고객" 환자수
    callback: number;     // 🔥 새로 추가: "콜백필요" 환자수
    totalCount: number;   // 상담 손실 총 환자수 (예약확정 외 모든 환자)
    estimatedAmount: number; // 예상 손실 금액 (견적 합계)
  };
  visitLoss: {
    terminated: number;      // 내원 "종결" 환자수
    callbackNeeded: number; // 내원 "재콜백필요" 환자수
    agreedButNotStarted: number;  // 🔥 새로 추가: "치료동의" 환자수 (동의했지만 시작 안함)
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

// 🔥 기존 구조 유지하면서 확장
export interface PatientConsultationSummary {
  visitConfirmed: boolean;
  status: string;
  isCompleted: boolean;
  visitConsultation: any;
  phoneConsultation: any;
  _id: string;
  name: string;
  age?: number;
  interestedServices?: string[];
  discomfort: string;        // 불편한 부분 (treatmentPlan 필드)
  consultationSummary: string; // 상담 메모 요약 (consultationNotes 필드)
  fullDiscomfort?: string;     // 전체 불편한 부분 내용 (모달용)
  fullConsultation?: string;   // 전체 상담 내용 (모달용)
  estimatedAmount: number;
  estimateAgreed: boolean;
  
  // 🔥 새로 추가된 선택적 필드들
  callInDate?: string;         // 신규 등록일
  hasPhoneConsultation?: boolean;  // 전화상담 내용 존재 여부
  hasVisitConsultation?: boolean;  // 내원상담 내용 존재 여부
  visitAmount?: number;        // 내원 후 견적금액
  phoneAmount?: number;        // 전화상담 견적금액
  postVisitStatus?: string;    // 내원 후 상태
  
  // 🔥 상담 단계 정보 (상세 정보용)
  consultationStages?: {
    phone: {
      hasContent: boolean;
      discomfort?: string;
      notes?: string;
      amount?: number;
      agreed?: boolean;
    };
    visit: {
      hasContent: boolean;
      firstVisitContent?: string;
      amount?: number;
      status?: string;
    };
  };
}

// 월별 통계 계산용 타입 - 🔥 손실 분석 추가
export interface MonthlyStats {
  totalInquiries: number;
  inboundCalls: number;
  outboundCalls: number;
  returningCalls: number;
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
  // 🔥 환자별 상담 내용
  patientConsultations: PatientConsultationSummary[];
}

// 🔥 기존 MonthlyReportData 타입에 피드백 필드 추가
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
  returningCalls: number;
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
    returningCalls: any;
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
  
  // 손실 분석 데이터
  lossAnalysis: LossPatientAnalysis;
  
  // 손실 환자 상세 리스트 (선택적)
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
  
  // 🔥 새로 추가: 원장님 피드백 배열
  directorFeedbacks?: DirectorFeedback[];
  
  // 메타데이터  
  createdAt: string;
  updatedAt: string;

  // 환자별 상담 내용 요약
  patientConsultations?: PatientConsultationSummary[];
}

// 🔥 새로 추가: 피드백 생성/수정용 타입
export interface FeedbackFormData {
  content: string;
  targetSection: string;
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

// 기존 ReportUpdateData 타입에 피드백 관련 필드 추가
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
  
  // 🔥 새로 추가: 피드백 관련 필드
  feedbackAction?: 'add' | 'update' | 'delete';
  feedbackData?: FeedbackFormData;
  feedbackId?: string; // 수정/삭제시 필요
}