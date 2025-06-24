// src/types/report.ts
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
  
  // 매니저 입력 데이터
  managerComment?: string;
  improvementSuggestions?: string;
  managerAnswers: {
    question1?: string; // 미내원 원인
    question2?: string; // 치료 거부 원인
    question3?: string; // 개선 방안
    question4?: string; // 🔥 추가: 기타 의견
  };
  
  // 메타데이터
  createdAt: string;
  updatedAt: string;
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
    question4?: string; // 🔥 추가: 기타 의견
  };
}

// 🔥 새로 추가: 보고서 업데이트 타입 (새로고침 포함)
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
  refreshStats?: boolean; // 🔥 통계 새로고침 플래그
}

// 월별 통계 계산용 타입
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
}