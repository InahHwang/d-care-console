// src/app/v2/reports/components/types.ts
// 일별/월별 리포트 공통 타입 정의

// 상담 상태별 설정
export const CONSULTATION_STATUS_CONFIG = {
  agreed: {
    icon: '✓',
    label: '동의',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    badgeColor: 'bg-emerald-500',
    lightBadge: 'bg-emerald-100 text-emerald-700',
  },
  disagreed: {
    icon: '✗',
    label: '미동의',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    badgeColor: 'bg-rose-500',
    lightBadge: 'bg-rose-100 text-rose-700',
  },
  pending: {
    icon: '◷',
    label: '보류',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-500',
    lightBadge: 'bg-amber-100 text-amber-700',
  },
  no_answer: {
    icon: '📵',
    label: '부재중',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    badgeColor: 'bg-slate-500',
    lightBadge: 'bg-slate-100 text-slate-700',
  },
  no_consultation: {
    icon: '—',
    label: '미입력',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    badgeColor: 'bg-gray-400',
    lightBadge: 'bg-gray-200 text-gray-600',
  },
  closed: {
    icon: '⊘',
    label: '종결',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    badgeColor: 'bg-gray-500',
    lightBadge: 'bg-gray-200 text-gray-700',
  },
} as const;

export type ConsultationStatus = keyof typeof CONSULTATION_STATUS_CONFIG;

// no_consultation 상태의 세분화된 설정
// aiSummary가 있으면: 상담은 했지만 결과 미입력 → "결과미입력" (파란색)
// aiSummary가 없으면: 상담 자체가 없음 → "상담미입력" (회색)
export function getNoConsultationConfig(aiSummary?: string) {
  if (aiSummary) {
    return {
      icon: '—',
      label: '결과미입력',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      badgeColor: 'bg-sky-400',
      lightBadge: 'bg-sky-100 text-sky-700',
    };
  }
  return {
    icon: '—',
    label: '상담미입력',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    badgeColor: 'bg-gray-400',
    lightBadge: 'bg-gray-200 text-gray-600',
  };
}

// 환자 데이터 기반으로 올바른 상태 설정을 반환
export function getPatientStatusConfig(patient: { status: string; aiSummary?: string }) {
  if (patient.status === 'no_consultation') {
    return getNoConsultationConfig(patient.aiSummary);
  }
  return CONSULTATION_STATUS_CONFIG[patient.status as ConsultationStatus];
}

// 미동의 사유 카테고리
export const DISAGREE_REASON_CATEGORIES = {
  price: {
    label: '가격/비용',
    emoji: '💰',
    reasons: ['예산 초과', '타 병원 대비 비쌈', '분납/할부 조건 안 맞음', '당장 여유가 안 됨'],
  },
  treatment: {
    label: '치료 계획',
    emoji: '🦷',
    reasons: ['치료 계획 이견', '제안 치료 거부', '치료 범위 과다', '치료 기간 부담'],
  },
  decision: {
    label: '결정 보류',
    emoji: '⏳',
    reasons: ['가족 상의 필요', '타 병원 비교 중', '추가 상담/정보 필요', '단순 정보 문의'],
  },
  other: {
    label: '기타',
    emoji: '📋',
    reasons: ['일정 조율 어려움', '치료 두려움/불안', '기타'],
  },
} as const;

// 개별 상담 기록 (환자별 여러 건 가능)
export interface ConsultationEntry {
  type: 'phone' | 'visit' | 'other';
  time: string;
  content?: string;
  consultantName?: string;
  duration?: number;
}

// 일별 리포트 환자 데이터
export interface DailyReportPatient {
  id: string;
  patientId: string;  // 환자 상세 페이지 링크용
  name: string;
  phone: string;
  status: ConsultationStatus;
  type: 'phone' | 'visit';
  treatment: string;
  originalAmount: number;
  discountRate: number;
  discountAmount: number;
  finalAmount: number;
  discountReason?: string;
  disagreeReasons: string[];
  correctionPlan?: string;
  appointmentDate?: string;
  callbackDate?: string;
  consultantName: string;
  time: string;
  duration?: number;  // 통화 시간 (초)
  aiSummary?: string;
  gender?: '남' | '여';
  age?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  region?: any;
  memo?: string;
  inquiry?: string;
  consultationNumber?: number;
  consultations?: ConsultationEntry[];  // 해당 날짜의 모든 상담 기록 (시간순)
}

// 일별 리포트 요약
export interface DailyReportSummary {
  total: number;
  agreed: number;
  disagreed: number;
  pending: number;
  noAnswer: number;
  noConsultation: number;
  closed?: number;
  expectedRevenue: number;
  actualRevenue: number;
  totalDiscount: number;
  avgDiscountRate: number;
  callbackCount?: number;
  newPatients?: number;
  existingPatients?: number;
  phoneConsultations?: number;
  visitConsultations?: number;
}

// 기존 환자 통화 기록 (치료중/치료완료/종결 등)
// 성과 지표(동의/미동의/보류)와 무관한 예약변경, 문의, 컴플레인 등
export interface ExistingPatientCall {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  patientStatus: string;  // 환자의 현재 상태 (treatment, completed 등)
  treatment?: string;     // 치료 항목
  time: string;           // 통화 시간
  duration?: number;      // 통화 시간 (초)
  aiSummary?: string;     // AI 요약
  gender?: '남' | '여';
  age?: number;
  memo?: string;
}

// 기존 환자 통화 요약
export interface ExistingPatientCallSummary {
  total: number;
  byStatus: Record<string, number>;  // 환자 상태별 통화 수
}

// 일별 리포트 데이터
export interface DailyReportData {
  date: string;
  dayOfWeek: string;
  summary: DailyReportSummary;
  patients: DailyReportPatient[];
  // 기존 환자 통화 (치료중/치료완료/종결 - 성과 지표 제외)
  existingPatientCalls?: ExistingPatientCall[];
  existingPatientCallSummary?: ExistingPatientCallSummary;
}

// 월별 리포트 데이터
export interface MonthlyReportData {
  yearMonth: string;
  year: number;
  month: number;
  stats: {
    totalCalls: number;
    connectedCalls: number;
    missedCalls: number;
    avgCallDuration: number;
    newPatients: number;
    existingPatients: number;
    conversionRate: number;
    funnel: Record<string, number>;
    expectedRevenue: number;
    actualRevenue: number;
    avgDealSize: number;
    totalConsultations: number;
    agreed: number;
    disagreed: number;
    pending: number;
    agreementRate: number;
    dailyTrends: Array<{
      date: string;
      calls: number;
      newPatients: number;
      agreed: number;
      revenue: number;
    }>;
    interestBreakdown: Array<{
      interest: string;
      count: number;
      agreed: number;
      revenue: number;
    }>;
    disagreeReasons: Array<{
      reason: string;
      count: number;
      percentage: number;
    }>;
  };
}
