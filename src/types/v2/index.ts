// src/types/v2/index.ts
// CatchAll v2 타입 정의

import { ObjectId } from 'mongodb';

// ============================================
// 환자 관련 타입
// ============================================

export type PatientStatus =
  | 'consulting'       // 전화상담
  | 'reserved'         // 내원예약
  | 'visited'          // 내원완료 (상담완료)
  | 'treatmentBooked'  // 치료예약
  | 'treatment'        // 치료중
  | 'completed'        // 치료완료
  | 'followup'         // 사후관리
  | 'closed';          // 종결

// 종결 사유 타입
export type ClosedReason =
  | '연락거부'
  | '타병원이동'
  | '관심없음'
  | '연락두절'
  | '기타';

export type Temperature = 'hot' | 'warm' | 'cold';

export interface StatusHistoryEntry {
  from: PatientStatus;
  to: PatientStatus;
  eventDate: Date | string;  // 예약일 또는 발생일
  changedAt: Date | string;  // 시스템 기록 시간
  changedBy?: string;        // 변경한 사용자 이름
  reason?: ClosedReason;     // 종결 사유 (to가 'closed'일 때만)
}

// 결제 상태 타입
export type PaymentStatus = 'none' | 'partial' | 'completed';

export interface PatientV2 {
  _id?: ObjectId | string;
  clinicId?: string;
  name: string;
  phone: string;
  gender?: '남' | '여';
  age?: number;
  region?: string;
  status: PatientStatus;
  statusChangedAt: Date | string;
  temperature: Temperature;
  interest?: string;
  interestDetail?: string;
  source: string;
  referrerId?: string;
  aiRegistered: boolean;
  aiConfidence?: number;
  nextAction?: string;
  nextActionDate?: Date | string;
  lastCallDirection?: 'inbound' | 'outbound';
  lastContactAt?: Date | string;
  callCount?: number;
  memo?: string;
  tags?: string[];
  statusHistory?: StatusHistoryEntry[];
  aiAnalysis?: {
    interest?: string;
    summary?: string;
    classification?: string;
    followUp?: string;
  };
  // 금액 관련 필드
  estimatedAmount?: number;      // 예상 치료금액 (원)
  actualAmount?: number;         // 실제 결제금액 (원)
  paymentStatus?: PaymentStatus; // 결제 상태
  treatmentNote?: string;        // 시술 내역 메모
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PatientV2WithDaysInStatus extends PatientV2 {
  daysInStatus: number;
}

// ============================================
// 통화 기록 관련 타입
// ============================================

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'connected' | 'missed' | 'busy';
export type AIStatus = 'pending' | 'processing' | 'completed' | 'failed';
// 신환: 완전 신규 환자
// 구신환: 기존환자 + 신규치료 (등록 대상)
// 구환: 기존환자 + 기존치료 진행 (등록 제외)
// 거래처/스팸/부재중/기타: 등록 제외
export type AIClassification = '신환' | '구신환' | '구환' | '거래처' | '스팸' | '부재중' | '기타';
export type FollowUpType = '콜백필요' | '예약확정' | '종결';

export interface AIAnalysis {
  classification: AIClassification;
  patientName?: string;
  interest?: string;
  interestDetail?: string;
  temperature: Temperature;
  summary: string;
  followUp: FollowUpType;
  recommendedCallback?: Date | string;
  concerns: string[];
  preferredTime?: string;
  confidence: number;
  transcript?: string;
}

export interface CallLogV2 {
  _id?: ObjectId | string;
  clinicId?: string;
  phone: string;
  patientId?: string;
  direction: CallDirection;
  status: CallStatus;
  duration: number;
  recordingUrl?: string;
  startedAt: Date | string;
  endedAt: Date | string;
  aiStatus: AIStatus;
  aiAnalysis?: AIAnalysis;
  aiCompletedAt?: Date | string;
  createdAt: Date | string;
}

// ============================================
// 콜백/리콜 관련 타입
// ============================================

export type CallbackType = 'callback' | 'recall' | 'thanks';
export type CallbackStatus = 'pending' | 'completed' | 'missed';

export interface CallbackV2 {
  _id?: ObjectId | string;
  clinicId?: string;
  patientId: string;
  type: CallbackType;
  scheduledAt: Date | string;
  status: CallbackStatus;
  note?: string;
  completedAt?: Date | string;
  createdAt: Date | string;
}

// ============================================
// 소개 관련 타입
// ============================================

export interface ReferralV2 {
  _id?: ObjectId | string;
  clinicId?: string;
  referrerId: string;
  referredId: string;
  thanksSent: boolean;
  thanksSentAt?: Date | string;
  createdAt: Date | string;
}

// ============================================
// 상담 기록 관련 타입 (일별 리포트용)
// ============================================

export type ConsultationStatus = 'agreed' | 'disagreed' | 'pending';

export interface ConsultationV2 {
  _id?: ObjectId | string;
  clinicId?: string;
  patientId: string;
  callLogId?: string;
  date: Date | string;
  treatment: string;
  originalAmount: number;
  discountRate: number;
  discountAmount: number;
  finalAmount: number;
  discountReason?: string;
  status: ConsultationStatus;
  disagreeReasons?: string[];
  correctionPlan?: string;
  appointmentDate?: Date | string;
  callbackDate?: Date | string;
  consultantId?: string;
  consultantName: string;
  inquiry?: string;
  memo?: string;
  aiSummary?: string;
  createdAt: Date | string;
}

// 미동의 사유 카테고리
export const DISAGREE_REASON_CATEGORIES = {
  price: {
    label: '💰 가격/비용',
    reasons: ['예산 초과', '타 병원 대비 비쌈', '분납/할부 조건 안 맞음', '당장 여유가 안 됨']
  },
  treatment: {
    label: '🦷 치료 계획',
    reasons: ['치료 계획 이견', '제안 치료 거부', '치료 범위 과다', '치료 기간 부담']
  },
  decision: {
    label: '⏳ 결정 보류',
    reasons: ['가족 상의 필요', '타 병원 비교 중', '추가 상담/정보 필요', '단순 정보 문의']
  },
  other: {
    label: '📋 기타',
    reasons: ['일정 조율 어려움', '치료 두려움/불안', '기타']
  }
} as const;

// ============================================
// 월간 피드백 관련 타입
// ============================================

export interface FeedbackComment {
  author: string;
  content: string;
  createdAt: Date | string;
}

export interface FeedbackV2 {
  _id?: ObjectId | string;
  clinicId?: string;
  yearMonth: string;
  questionId: number;
  question: string;
  managerAnswer?: string;
  managerName?: string;
  managerAnsweredAt?: Date | string;
  comments: FeedbackComment[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================
// 대시보드 통계 타입
// ============================================

export interface DashboardStats {
  totalCalls: number;
  analyzed: number;
  analyzing: number;
  newPatients: number;
  existingPatients: number;
  missed: number;
  other: number;
}

export interface AlertItem {
  id: string;
  type: 'visited_long' | 'consulting_long' | 'noshow_risk';
  label: string;
  count: number;
  patients: string[];
  color: 'amber' | 'red' | 'orange';
}

export interface AnalysisQueueItem {
  id: string;
  phone: string;
  time: string;
  progress: number;
}

// ============================================
// 리포트 관련 타입
// ============================================

export interface DailyReportSummary {
  date: string;
  dayOfWeek: string;
  total: number;
  agreed: number;
  disagreed: number;
  pending: number;
  expectedRevenue: number;
  actualRevenue: number;
  totalDiscount: number;
}

export interface MonthlyRevenueStats {
  target: number;
  actual: number;
  achievementRate: number;
  prevMonth: number;
  growth: number;
  breakdown: {
    category: string;
    target: number;
    actual: number;
    rate: number;
  }[];
}

export interface MonthlyConsultationStats {
  total: number;
  connected: number;
  newPatients: number;
  conversionRate: number;
  prevConversionRate: number;
  byType: {
    type: string;
    label: string;
    count: number;
    connected: number;
    newPatients: number;
    color: string;
  }[];
  funnel: {
    stage: string;
    count: number;
    rate: number;
  }[];
  dropoffAnalysis: {
    stage: string;
    lost: number;
    rate: number;
    reasons: string[];
  }[];
}

// ============================================
// API 응답 타입
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================
// 필터 및 검색 타입
// ============================================

export interface PatientFilter {
  status?: PatientStatus | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

export interface CallLogFilter {
  classification?: AIClassification | 'all';
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ============================================
// 유틸리티 타입
// ============================================

export type StatusConfig = {
  [key in PatientStatus]: {
    label: string;
    color: string;
    bgColor: string;
  };
};

export const PATIENT_STATUS_CONFIG: StatusConfig = {
  consulting: { label: '전화상담', color: 'blue', bgColor: 'bg-blue-100 text-blue-700' },
  reserved: { label: '내원예약', color: 'purple', bgColor: 'bg-purple-100 text-purple-700' },
  visited: { label: '내원완료', color: 'amber', bgColor: 'bg-amber-100 text-amber-700' },
  treatmentBooked: { label: '치료예약', color: 'teal', bgColor: 'bg-teal-100 text-teal-700' },
  treatment: { label: '치료중', color: 'emerald', bgColor: 'bg-emerald-100 text-emerald-700' },
  completed: { label: '치료완료', color: 'green', bgColor: 'bg-green-100 text-green-700' },
  followup: { label: '사후관리', color: 'slate', bgColor: 'bg-slate-100 text-slate-700' },
  closed: { label: '종결', color: 'gray', bgColor: 'bg-gray-100 text-gray-500' },
};

// 종결 사유 옵션
export const CLOSED_REASON_OPTIONS: { value: ClosedReason; label: string }[] = [
  { value: '연락거부', label: '연락 거부' },
  { value: '타병원이동', label: '타 병원 이동' },
  { value: '관심없음', label: '관심 없음' },
  { value: '연락두절', label: '연락 두절' },
  { value: '기타', label: '기타' },
];
