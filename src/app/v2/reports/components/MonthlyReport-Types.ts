// src/app/v2/reports/components/MonthlyReport-Types.ts
// V2 월별 리포트 전용 타입 정의

import type { PatientStatus } from '@/types/v2';

// ============================================
// 전월 대비 변화 지표
// ============================================

export interface ChangeIndicator {
  value: number;
  type: 'increase' | 'decrease';
}

// ============================================
// 피드백 타입
// ============================================

export interface DirectorFeedbackV2 {
  feedbackId: string;
  content: string;
  targetSection: string; // 'managerAnswers.question1' 등
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// 환자별 상담 내용 요약
// ============================================

export interface PatientSummaryV2 {
  patientId: string;
  name: string;
  phone: string;
  age?: number;
  gender?: '남' | '여';
  interest: string;             // 관심분야 (journey.treatmentType 또는 consultation.treatment)
  status: PatientStatus;        // 현재 V2 상태
  statusLabel: string;          // 한글 라벨
  consultationSummary: string;  // 요약 (AI 요약 또는 메모)
  fullConsultation: string;     // 전체 내용
  estimatedAmount: number;      // 예상 금액
  finalAmount: number;          // 최종 금액
  hasPhoneConsultation: boolean;
  hasVisitConsultation: boolean;
  consultationType: 'inbound' | 'outbound' | 'returning' | 'unknown'; // 최초 통화 방향
  createdAt: string;
  // 콜백 상태 (고액환자 추적용)
  hasActiveCallback?: boolean;       // 콜백 등록 여부
  nextCallbackDate?: string;         // 다음 콜백 예정일
  nextCallbackNote?: string;         // 콜백 메모
}

// ============================================
// 매출 현황 분석
// ============================================

export interface RevenueAnalysisV2 {
  achieved: {
    patients: number;
    amount: number;
    percentage: number;
  };
  potential: {
    consultingOngoing: { patients: number; amount: number };  // 상담진행중 (consulting, reserved)
    visitManagement: { patients: number; amount: number };    // 내원관리중 (visited, treatmentBooked)
    totalPatients: number;
    totalAmount: number;
    percentage: number;
  };
  lost: {
    consultingLost: { patients: number; amount: number };     // 상담단계 손실 (closed, 미내원)
    visitLost: { patients: number; amount: number };          // 내원후 손실 (closed, 내원 이력 있음)
    totalPatients: number;
    totalAmount: number;
    percentage: number;
  };
  summary: {
    totalInquiries: number;
    totalPotentialAmount: number;
    achievementRate: number;
    potentialGrowth: number;
    discountRate: number;      // 평균 할인율 (%)
    avgDealSize: number;       // 평균 객단가 (원)
  };
}

// ============================================
// 지역/유입경로 통계
// ============================================

export interface RegionStatV2 {
  region: string;
  count: number;
  percentage: number;
}

export interface ChannelStatV2 {
  channel: string;
  count: number;
  percentage: number;
}

// ============================================
// 연령 분포
// ============================================

export interface AgeDistributionItem {
  bracket: string;      // '20대', '30대', '40대', '50대', '60대+'
  count: number;
  percentage: number;
}

// ============================================
// 성별 통계
// ============================================

export interface GenderStats {
  male: number;
  female: number;
  unknown: number;
}

// ============================================
// 인구통계 교차분석 (연령대 x 치료관심)
// ============================================

export interface DemographicCrossItem {
  ageBracket: string;
  treatmentType: string;
  count: number;
}

// ============================================
// 채널 ROI 분석
// ============================================

export interface ChannelROIItem {
  channel: string;
  count: number;
  reservedCount: number;
  visitedCount: number;
  paidCount: number;
  reservedRate: number;
  visitedRate: number;
  paidRate: number;
  totalRevenue: number;
  avgDealSize: number;
}

// ============================================
// 치료별 분석
// ============================================

export interface TreatmentAnalysisItem {
  treatment: string;
  totalCount: number;
  agreedCount: number;
  conversionRate: number;
  totalRevenue: number;
  avgDealSize: number;
  disagreeReasons: Array<{ reason: string; count: number }>;
}

// ============================================
// 요일별 패턴
// ============================================

export interface WeeklyPatternItem {
  dayOfWeek: number;     // 0=일, 1=월, ...
  dayLabel: string;      // '월', '화', ...
  avgCalls: number;
  avgNewPatients: number;
  avgAgreed: number;
}

// ============================================
// 종결 사유 통계
// ============================================

export interface ClosedReasonStatItem {
  reason: string;
  count: number;
  percentage: number;
}

// ============================================
// 월별 통계 데이터 (스냅샷)
// ============================================

export interface MonthlyStatsV2 {
  // 상담 실적 요약
  totalInquiries: number;
  inquiryBreakdown: {
    inbound: number;
    outbound: number;
    returning: number;
  };

  // KPI 카드
  reservedPatients: number;    // 예약 환자수 (reserved 이상 도달)
  reservedRate: number;        // 예약 전환율
  visitedPatients: number;     // 내원 환자수 (visited 이상 도달)
  visitedRate: number;         // 내원 전환율
  agreedRevenue: number;       // 총 결제금액 (agreed 상담 finalAmount 합)
  agreedPatients: number;      // 결제 환자수 (treatment/completed)
  agreedRate: number;          // 결제 전환율

  // 전월 대비 변화
  changes: {
    totalInquiries: ChangeIndicator;
    inbound: ChangeIndicator;
    outbound: ChangeIndicator;
    returning: ChangeIndicator;
    reservedPatients: ChangeIndicator;
    reservedRate: ChangeIndicator;
    visitedPatients: ChangeIndicator;
    visitedRate: ChangeIndicator;
    agreedRevenue: ChangeIndicator;
    agreedPatients: ChangeIndicator;
    agreedRate: ChangeIndicator;
  };

  // 환자 통계
  averageAge: number;
  regionStats: RegionStatV2[];
  channelStats: ChannelStatV2[];

  // 환자별 상담 내용 요약
  patientSummaries: PatientSummaryV2[];

  // 진행상황별 통계 (퍼널)
  progressStats: Record<PatientStatus, number>;

  // 매출 현황 분석
  revenueAnalysis: RevenueAnalysisV2;

  // 일별 추이
  dailyTrends: Array<{
    date: string;
    calls: number;
    newPatients: number;
    agreed: number;
    revenue: number;
  }>;

  // 관심분야별 통계
  interestBreakdown: Array<{
    interest: string;
    count: number;
    agreed: number;
    revenue: number;
  }>;

  // 미동의 사유 분석
  disagreeReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;

  // ── 월보고서 재편 추가 필드 (2026-02) ──

  // 연령 분포
  ageDistribution?: AgeDistributionItem[];

  // 성별 통계
  genderStats?: GenderStats;

  // 인구통계 교차분석 (연령대 x 치료관심)
  demographicCrossAnalysis?: DemographicCrossItem[];

  // 채널 ROI 분석
  channelROI?: ChannelROIItem[];

  // 치료별 분석
  treatmentAnalysis?: TreatmentAnalysisItem[];

  // 요일별 패턴
  weeklyPattern?: WeeklyPatternItem[];

  // 종결 사유 통계
  closedReasonStats?: ClosedReasonStatItem[];

  // 자동 생성 핵심 인사이트 (규칙 기반)
  executiveInsights?: string[];

  // AI 생성 인사이트 (OpenAI, on-demand)
  aiInsights?: {
    insights: string[];
    generatedAt: string;
    model: string;
  };
}

// ============================================
// 월별 보고서 문서 (reports_v2 컬렉션)
// ============================================

export interface MonthlyReportV2 {
  _id?: string;
  yearMonth: string;    // "2025-07"
  year: number;
  month: number;
  status: 'draft' | 'submitted' | 'approved';

  // 자동 계산 통계 스냅샷
  stats: MonthlyStatsV2;

  // 매니저 입력
  managerAnswers: {
    question1: string;  // 미내원 환자 원인 분석
    question2: string;  // 치료 미동의 환자 원인 분석
    question3: string;  // 개선 방안
    question4: string;  // 기타 의견
  };

  // 양방향 피드백
  directorFeedbacks: DirectorFeedbackV2[];

  // 메타데이터
  createdBy: string;
  createdByName: string;
  generatedDate: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 보고서 목록 아이템
// ============================================

export interface MonthlyReportListItem {
  _id: string;
  yearMonth: string;
  year: number;
  month: number;
  status: 'draft' | 'submitted' | 'approved';
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// V2 진행상황 매핑 (V1의 6단계 → V2의 8단계)
// ============================================

export const PROGRESS_STAGE_CONFIG: Record<PatientStatus, {
  label: string;
  color: string;
  bgColor: string;
  order: number;
}> = {
  consulting: { label: '전화상담', color: 'text-yellow-800', bgColor: 'bg-yellow-100', order: 1 },
  reserved: { label: '예약완료', color: 'text-orange-800', bgColor: 'bg-orange-100', order: 2 },
  visited: { label: '내원완료', color: 'text-purple-800', bgColor: 'bg-purple-100', order: 3 },
  treatmentBooked: { label: '치료예약', color: 'text-indigo-800', bgColor: 'bg-indigo-100', order: 4 },
  treatment: { label: '치료중', color: 'text-blue-800', bgColor: 'bg-blue-100', order: 5 },
  completed: { label: '치료완료', color: 'text-green-800', bgColor: 'bg-green-100', order: 6 },
  followup: { label: '사후관리', color: 'text-teal-800', bgColor: 'bg-teal-100', order: 7 },
  closed: { label: '종결', color: 'text-gray-800', bgColor: 'bg-gray-100', order: 8 },
};

// reserved 이상 도달 판단용 상태 목록
export const RESERVED_OR_ABOVE: PatientStatus[] = [
  'reserved', 'visited', 'treatmentBooked', 'treatment', 'completed', 'followup',
];

// visited 이상 도달 판단용 상태 목록
export const VISITED_OR_ABOVE: PatientStatus[] = [
  'visited', 'treatmentBooked', 'treatment', 'completed', 'followup',
];

// 결제(치료) 환자 판단용 상태 목록
export const TREATMENT_OR_ABOVE: PatientStatus[] = [
  'treatment', 'completed',
];
