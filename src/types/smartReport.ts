// /src/types/smartReport.ts - 타입 에러 수정
export interface SmartReportMetrics {
  totalPatients: number;
  conversions: number;
  conversionRate: number;
  avgEstimate: number;
  avgCallbacks: number;
  eventTargets: number;
}

export interface TrendData {
  month: string;
  patients: number;
  conversions: number;
  rate: number;
  revenue: number;
}

export interface PatientSegment {
  segment: string;
  count: number;
  rate: number;
  avgAmount: number;
  avgCallbacks: number; // 🔥 number로 통일
}

export interface RegionData {
  region: string;
  count: number;
  rate: number;
  revenue?: number;
}

export interface AgeGroupData {
  ageGroup: string;
  count: number;
  rate: number;
  avgEstimate: number;
}

export interface AIInsight {
  type: 'success' | 'warning' | 'opportunity' | 'risk';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  action: string;
  details: string[];
  confidence?: number;
}

export interface ActionPlan {
  title: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  timeline?: string;
  source?: string;
}

export interface ActionPlans {
  immediate: ActionPlan[];
  shortTerm: ActionPlan[];
  longTerm: ActionPlan[];
}

export interface PerformanceTargets {
  conversionRate: number;
  totalPatients: number;
  avgCallbacks: number;
  highValueRate: number;
  customerSatisfaction?: number;
}

export interface ConsultationPatterns {
  avgCallbacks: number; // 🔥 string → number로 변경
  quickSuccessRate: number;
  persistentFailureRate: number;
  competitorMentionRate: number;
  priceHesitationRate: number;
  familyConsultationRate: number;
}

export interface SmartReportAnalysis {
  patientSegments: PatientSegment[];
  regionData: RegionData[];
  ageGroups?: AgeGroupData[];
  aiInsights: AIInsight[];
  consultationPatterns?: ConsultationPatterns;
}

export interface SmartReportRecommendations {
  actionPlans: ActionPlans;
  targets: PerformanceTargets;
}

export interface SmartReportData {
  period: {
    current: string;
    previous: string;
  };
  metrics: {
    current: SmartReportMetrics;
    previous: SmartReportMetrics;
    trend: TrendData[];
  };
  analysis: SmartReportAnalysis;
  recommendations: SmartReportRecommendations;
  metadata: {
    generatedAt: string;
    dataSource: string;
    totalRecords: number;
    aiVersion?: string;
    confidence?: number;
  };
}

// API 응답 타입
export interface SmartReportResponse {
  success: boolean;
  data?: SmartReportData;
  error?: string;
  timestamp: string;
}

// 보고서 설정 타입
export interface ReportSettings {
  timeRange: '1month' | '3months' | '6months' | '1year';
  includeAI: boolean;
  includeDetails: boolean;
  autoRefresh: boolean;
  exportFormat: 'pdf' | 'excel' | 'json';
}

// 인사이트 필터 타입
export interface InsightFilter {
  types: Array<'success' | 'warning' | 'opportunity' | 'risk'>;
  impact: Array<'high' | 'medium' | 'low'>;
  confidence: number; // 최소 확신도
}

// 대시보드 상태 타입
export interface SmartReportState {
  data: SmartReportData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  expandedSections: Record<string, boolean>;
  selectedFilters: InsightFilter;
  settings: ReportSettings;
}