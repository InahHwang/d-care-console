// src/utils/monthlyReportV2Calculator.ts
// V2 월별 리포트 통계 계산 유틸리티
// patients_v2, consultations_v2, callLogs_v2 컬렉션 기반

import type { Db } from 'mongodb';
import type { PatientV2, ConsultationV2, CallLogV2, PatientStatus } from '@/types/v2';
import type {
  MonthlyStatsV2,
  ChangeIndicator,
  PatientSummaryV2,
  RevenueAnalysisV2,
  RegionStatV2,
  ChannelStatV2,
  AgeDistributionItem,
  GenderStats,
  DemographicCrossItem,
  ChannelROIItem,
  TreatmentAnalysisItem,
  WeeklyPatternItem,
  ClosedReasonStatItem,
} from '@/app/v2/reports/components/MonthlyReport-Types';
import {
  PROGRESS_STAGE_CONFIG,
  RESERVED_OR_ABOVE,
  VISITED_OR_ABOVE,
  TREATMENT_OR_ABOVE,
} from '@/app/v2/reports/components/MonthlyReport-Types';

// ============================================
// 메인 통계 계산 함수
// ============================================

export async function calculateMonthlyStatsV2(
  db: Db,
  year: number,
  month: number
): Promise<MonthlyStatsV2> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  const startDateStr = startDate.toISOString();
  const endDateStr = endDate.toISOString();

  // 이전 달 범위
  const prevStartDate = new Date(year, month - 2, 1);
  const prevEndDate = new Date(year, month - 1, 0, 23, 59, 59, 999);
  const prevStartDateStr = prevStartDate.toISOString();
  const prevEndDateStr = prevEndDate.toISOString();

  // 병렬 쿼리 (현재 달 + 이전 달)
  // Note: createdAt은 MongoDB에서 Date 객체로 저장되므로 Date 객체로 비교해야 함
  // 일부 레거시 문서가 ISO string으로 저장되어 있을 수 있으므로 $or로 양쪽 모두 매칭
  const dateOrQuery = (field: string, gte: Date, lte: Date, gteStr: string, lteStr: string) => ({
    $or: [
      { [field]: { $gte: gte, $lte: lte } },
      { [field]: { $gte: gteStr, $lte: lteStr } },
    ],
  });

  const [
    patients, consultations, callLogs,
    prevPatients, prevConsultations, prevCallLogs,
  ] = await Promise.all([
    // 현재 달
    db.collection<PatientV2>('patients_v2').find(
      dateOrQuery('createdAt', startDate, endDate, startDateStr, endDateStr)
    ).toArray(),
    db.collection<ConsultationV2>('consultations_v2').find(
      dateOrQuery('date', startDate, endDate, startDateStr, endDateStr)
    ).toArray(),
    db.collection<CallLogV2>('callLogs_v2').find(
      dateOrQuery('createdAt', startDate, endDate, startDateStr, endDateStr)
    ).toArray(),
    // 이전 달
    db.collection<PatientV2>('patients_v2').find(
      dateOrQuery('createdAt', prevStartDate, prevEndDate, prevStartDateStr, prevEndDateStr)
    ).toArray(),
    db.collection<ConsultationV2>('consultations_v2').find(
      dateOrQuery('date', prevStartDate, prevEndDate, prevStartDateStr, prevEndDateStr)
    ).toArray(),
    db.collection<CallLogV2>('callLogs_v2').find(
      dateOrQuery('createdAt', prevStartDate, prevEndDate, prevStartDateStr, prevEndDateStr)
    ).toArray(),
  ]);

  // 현재 달 통계 계산
  const currentStats = computeRawStats(patients, consultations, callLogs, year, month, endDate);
  // 이전 달 통계 계산
  const prevStats = computeRawStats(prevPatients, prevConsultations, prevCallLogs, prevStartDate.getFullYear(), prevStartDate.getMonth() + 1, prevEndDate);

  // 전월 대비 변화 계산
  const changes = calculateChanges(currentStats, prevStats);

  // 환자별 상담 내용 요약
  const patientSummaries = buildPatientSummaries(patients, consultations, callLogs);

  // 매출 현황 분석
  const revenueAnalysis = calculateRevenueAnalysis(patients, consultations);

  // 일별 추이
  const dailyTrends = buildDailyTrends(callLogs, consultations, year, month, endDate);

  // 관심분야별 통계
  const interestBreakdown = buildInterestBreakdown(consultations);

  // 미동의 사유 분석
  const disagreeReasons = buildDisagreeReasons(consultations);

  // ── 월보고서 재편 추가 계산 (2026-02) ──
  const ageDistribution = buildAgeDistribution(patients);
  const genderStats = buildGenderStatsData(patients);
  const demographicCrossAnalysis = buildDemographicCrossAnalysis(patients, consultations);
  const channelROI = buildChannelROIStats(patients);
  const treatmentAnalysis = buildTreatmentAnalysis(patients, consultations);
  const weeklyPattern = buildWeeklyPattern(dailyTrends);
  const closedReasonStats = buildClosedReasonStats(patients);

  const baseStats: MonthlyStatsV2 = {
    totalInquiries: currentStats.totalInquiries,
    inquiryBreakdown: currentStats.inquiryBreakdown,
    reservedPatients: currentStats.reservedPatients,
    reservedRate: currentStats.reservedRate,
    visitedPatients: currentStats.visitedPatients,
    visitedRate: currentStats.visitedRate,
    agreedRevenue: currentStats.agreedRevenue,
    agreedPatients: currentStats.agreedPatients,
    agreedRate: currentStats.agreedRate,
    changes,
    averageAge: currentStats.averageAge,
    regionStats: currentStats.regionStats,
    channelStats: currentStats.channelStats,
    patientSummaries,
    progressStats: currentStats.progressStats,
    revenueAnalysis,
    dailyTrends,
    interestBreakdown,
    disagreeReasons,
    ageDistribution,
    genderStats,
    demographicCrossAnalysis,
    channelROI,
    treatmentAnalysis,
    weeklyPattern,
    closedReasonStats,
  };

  // 인사이트는 다른 통계를 기반으로 생성
  baseStats.executiveInsights = generateExecutiveInsights(baseStats);

  return baseStats;
}

// ============================================
// 내부: 원시 통계 계산
// ============================================

interface RawStats {
  totalInquiries: number;
  inquiryBreakdown: { inbound: number; outbound: number; returning: number };
  reservedPatients: number;
  reservedRate: number;
  visitedPatients: number;
  visitedRate: number;
  agreedRevenue: number;
  agreedPatients: number;
  agreedRate: number;
  averageAge: number;
  regionStats: RegionStatV2[];
  channelStats: ChannelStatV2[];
  progressStats: Record<PatientStatus, number>;
}

function computeRawStats(
  patients: PatientV2[],
  consultations: ConsultationV2[],
  callLogs: CallLogV2[],
  _year: number,
  _month: number,
  _endDate: Date,
): RawStats {
  const totalInquiries = patients.length;

  // 인바운드/아웃바운드/구신환 (callLogs 기반)
  const newPatientCallLogs = callLogs.filter(
    (c) => c.aiAnalysis?.classification === '신환' || c.aiAnalysis?.classification === '구신환'
  );
  const inbound = newPatientCallLogs.filter((c) => c.direction === 'inbound').length;
  const outbound = newPatientCallLogs.filter((c) => c.direction === 'outbound').length;
  const returning = callLogs.filter((c) => c.aiAnalysis?.classification === '구신환').length;

  // 예약 환자 (reserved 이상 도달)
  const reservedPatients = patients.filter((p) =>
    RESERVED_OR_ABOVE.includes(p.status) || hasReachedStatus(p, RESERVED_OR_ABOVE)
  ).length;
  const reservedRate = totalInquiries > 0
    ? Math.round((reservedPatients / totalInquiries) * 1000) / 10
    : 0;

  // 내원 환자 (visited 이상 도달)
  const visitedPatients = patients.filter((p) =>
    VISITED_OR_ABOVE.includes(p.status) || hasReachedStatus(p, VISITED_OR_ABOVE)
  ).length;
  const visitedRate = totalInquiries > 0
    ? Math.round((visitedPatients / totalInquiries) * 1000) / 10
    : 0;

  // 결제 환자 (paymentStatus 기준 - 대시보드와 일치)
  const paidPatients = patients.filter((p) =>
    p.paymentStatus === 'partial' || p.paymentStatus === 'completed'
  );
  const agreedRevenue = paidPatients.reduce((sum, p) => sum + (p.actualAmount || 0), 0);
  const agreedPatients = paidPatients.length;
  const agreedRate = totalInquiries > 0
    ? Math.round((agreedPatients / totalInquiries) * 1000) / 10
    : 0;

  // 평균 연령
  const patientsWithAge = patients.filter((p) => p.age && p.age > 0);
  const averageAge = patientsWithAge.length > 0
    ? Math.round((patientsWithAge.reduce((sum, p) => sum + (p.age || 0), 0) / patientsWithAge.length) * 10) / 10
    : 0;

  // 지역 통계
  const regionStats = buildRegionStats(patients);

  // 유입경로 통계
  const channelStats = buildChannelStats(patients);

  // 진행상황별 통계
  const progressStats = buildProgressStats(patients);

  return {
    totalInquiries,
    inquiryBreakdown: { inbound, outbound, returning },
    reservedPatients,
    reservedRate,
    visitedPatients,
    visitedRate,
    agreedRevenue,
    agreedPatients,
    agreedRate,
    averageAge,
    regionStats,
    channelStats,
    progressStats,
  };
}

// ============================================
// statusHistory를 이용한 상태 도달 여부 확인
// ============================================

function hasReachedStatus(patient: PatientV2, targetStatuses: PatientStatus[]): boolean {
  if (!patient.statusHistory || patient.statusHistory.length === 0) return false;
  return patient.statusHistory.some((entry) => targetStatuses.includes(entry.to));
}

// ============================================
// 전월 대비 변화 계산
// ============================================

function calculateChanges(
  current: RawStats,
  previous: RawStats
): MonthlyStatsV2['changes'] {
  return {
    totalInquiries: calcChange(current.totalInquiries, previous.totalInquiries),
    inbound: calcChange(current.inquiryBreakdown.inbound, previous.inquiryBreakdown.inbound),
    outbound: calcChange(current.inquiryBreakdown.outbound, previous.inquiryBreakdown.outbound),
    returning: calcChange(current.inquiryBreakdown.returning, previous.inquiryBreakdown.returning),
    reservedPatients: calcChange(current.reservedPatients, previous.reservedPatients),
    reservedRate: calcChange(current.reservedRate, previous.reservedRate),
    visitedPatients: calcChange(current.visitedPatients, previous.visitedPatients),
    visitedRate: calcChange(current.visitedRate, previous.visitedRate),
    agreedRevenue: calcChange(current.agreedRevenue, previous.agreedRevenue),
    agreedPatients: calcChange(current.agreedPatients, previous.agreedPatients),
    agreedRate: calcChange(current.agreedRate, previous.agreedRate),
  };
}

function calcChange(current: number, previous: number): ChangeIndicator {
  const diff = current - previous;
  return {
    value: Math.round(Math.abs(diff) * 10) / 10,
    type: diff >= 0 ? 'increase' : 'decrease',
  };
}

// ============================================
// 환자별 상담 내용 요약 빌드
// ============================================

export function buildPatientSummaries(
  patients: PatientV2[],
  consultations: ConsultationV2[],
  callLogs: CallLogV2[],
): PatientSummaryV2[] {
  // patientId별 상담 그룹핑
  const consultByPatient = new Map<string, ConsultationV2[]>();
  for (const c of consultations) {
    const pid = c.patientId;
    if (!consultByPatient.has(pid)) consultByPatient.set(pid, []);
    consultByPatient.get(pid)!.push(c);
  }

  // patientId별 통화 기록 그룹핑
  const callsByPatient = new Map<string, CallLogV2[]>();
  for (const cl of callLogs) {
    const pid = cl.patientId;
    if (pid) {
      if (!callsByPatient.has(pid)) callsByPatient.set(pid, []);
      callsByPatient.get(pid)!.push(cl);
    }
  }

  return patients.map((patient) => {
    const pid = patient._id?.toString() || '';
    const patientConsults = consultByPatient.get(pid) || [];
    const patientCalls = callsByPatient.get(pid) || [];

    // 관심분야: journey > consultation > aiAnalysis
    const activeJourney = patient.journeys?.find((j) => j.isActive);
    const interest =
      activeJourney?.treatmentType ||
      patient.interest ||
      patientConsults[0]?.treatment ||
      patient.aiAnalysis?.interest ||
      '기타';

    // 상담 요약 빌드
    const summaryParts: string[] = [];
    const fullParts: string[] = [];

    // 전화 상담 내용
    const phoneConsults = patientConsults.filter((c) => c.type === 'phone');
    const visitConsults = patientConsults.filter((c) => c.type === 'visit');

    for (const pc of phoneConsults) {
      if (pc.aiSummary) summaryParts.push(pc.aiSummary);
      if (pc.memo) fullParts.push(`[전화상담 메모] ${pc.memo}`);
      if (pc.aiSummary) fullParts.push(`[AI 요약] ${pc.aiSummary}`);
    }

    for (const vc of visitConsults) {
      if (vc.aiSummary) summaryParts.push(vc.aiSummary);
      if (vc.memo) fullParts.push(`[내원상담 메모] ${vc.memo}`);
      if (vc.aiSummary) fullParts.push(`[AI 요약] ${vc.aiSummary}`);
    }

    // callLogs에서 AI 요약 보충 (상담 기록이 없는 경우)
    if (summaryParts.length === 0) {
      for (const cl of patientCalls) {
        if (cl.aiAnalysis?.summary) {
          summaryParts.push(cl.aiAnalysis.summary);
          fullParts.push(`[통화 AI 분석] ${cl.aiAnalysis.summary}`);
        }
      }
    }

    // 견적 금액: journey > consultation > patient level
    const estimatedAmount =
      activeJourney?.estimatedAmount ||
      patientConsults[0]?.originalAmount ||
      patient.estimatedAmount ||
      0;

    const finalAmount =
      activeJourney?.actualAmount ||
      patientConsults.find((c) => c.status === 'agreed')?.finalAmount ||
      patient.actualAmount ||
      0;

    // 최초 통화 방향 결정
    const firstCall = patientCalls.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
    let consultationType: PatientSummaryV2['consultationType'] = 'unknown';
    if (firstCall) {
      if (firstCall.aiAnalysis?.classification === '구신환') {
        consultationType = 'returning';
      } else {
        consultationType = firstCall.direction === 'inbound' ? 'inbound' : 'outbound';
      }
    }

    const statusLabel = PROGRESS_STAGE_CONFIG[patient.status]?.label || patient.status;

    // 콜백 상태 확인
    const nextActionDate = activeJourney?.nextActionDate || patient.nextActionDate;
    const hasActiveCallback = !!nextActionDate;
    let nextCallbackDate: string | undefined;
    let nextCallbackNote: string | undefined;
    if (nextActionDate) {
      nextCallbackDate = typeof nextActionDate === 'string'
        ? nextActionDate
        : (nextActionDate as Date).toISOString?.() || String(nextActionDate);
      nextCallbackNote = activeJourney?.nextActionNote || patient.nextActionNote || undefined;
    }

    return {
      patientId: pid,
      name: patient.name,
      phone: patient.phone,
      age: patient.age,
      gender: patient.gender,
      interest,
      status: patient.status,
      statusLabel,
      consultationSummary: summaryParts.join('\n') || '상담내용 없음',
      fullConsultation: fullParts.join('\n\n') || '기록된 내용이 없습니다.',
      estimatedAmount,
      finalAmount,
      hasPhoneConsultation: phoneConsults.length > 0,
      hasVisitConsultation: visitConsults.length > 0,
      consultationType,
      createdAt: typeof patient.createdAt === 'string'
        ? patient.createdAt
        : patient.createdAt.toISOString(),
      hasActiveCallback,
      nextCallbackDate,
      nextCallbackNote,
    };
  });
}

// ============================================
// 매출 현황 분석
// ============================================

export function calculateRevenueAnalysis(
  patients: PatientV2[],
  _consultations: ConsultationV2[]
): RevenueAnalysisV2 {
  const totalInquiries = patients.length;

  // 달성: paymentStatus 기준 (대시보드와 일치)
  const achievedPatients = patients.filter((p) =>
    p.paymentStatus === 'partial' || p.paymentStatus === 'completed'
  );
  const achievedAmount = achievedPatients.reduce((sum, p) => sum + (p.actualAmount || 0), 0);

  // 달성 환자의 견적 합계 (할인율 계산용)
  const achievedEstimated = achievedPatients.reduce((sum, p) => {
    const journey = p.journeys?.find((j) => j.isActive);
    return sum + (journey?.estimatedAmount || p.estimatedAmount || 0);
  }, 0);

  // 잠재: 미종결 + 미결제
  const unpaidActive = patients.filter((p) =>
    p.status !== 'closed' &&
    p.paymentStatus !== 'partial' &&
    p.paymentStatus !== 'completed'
  );

  // 잠재 - 상담단계: consulting, reserved (내원 전)
  const consultingOngoing = unpaidActive.filter((p) =>
    p.status === 'consulting' || p.status === 'reserved'
  );
  const consultingOngoingAmount = getEstimatedSum(consultingOngoing);

  // 잠재 - 내원 이후: visited, treatmentBooked, treatment, completed, followup (미결제)
  const visitManagement = unpaidActive.filter((p) =>
    p.status !== 'consulting' && p.status !== 'reserved'
  );
  const visitManagementAmount = getEstimatedSum(visitManagement);

  // 손실: closed 상태
  const closedPatients = patients.filter((p) => p.status === 'closed');

  // closed 중 내원 이력 확인
  const consultingLost = closedPatients.filter((p) => !hasReachedStatus(p, VISITED_OR_ABOVE));
  const visitLost = closedPatients.filter((p) => hasReachedStatus(p, VISITED_OR_ABOVE));

  const consultingLostAmount = getEstimatedSum(consultingLost);
  const visitLostAmount = getEstimatedSum(visitLost);

  const totalPotentialAmount = achievedAmount + consultingOngoingAmount + visitManagementAmount + consultingLostAmount + visitLostAmount;

  // 할인율: 결제 환자의 견적 대비 실결제
  const discountRate = achievedEstimated > 0
    ? Math.round((1 - achievedAmount / achievedEstimated) * 100)
    : 0;

  // 평균 객단가
  const avgDealSize = achievedPatients.length > 0
    ? Math.round(achievedAmount / achievedPatients.length)
    : 0;

  const achievedPercentage = totalInquiries > 0
    ? Math.round((achievedPatients.length / totalInquiries) * 100)
    : 0;
  const potentialPercentage = totalInquiries > 0
    ? Math.round((unpaidActive.length / totalInquiries) * 100)
    : 0;
  const lostPercentage = totalInquiries > 0
    ? Math.round((closedPatients.length / totalInquiries) * 100)
    : 0;

  return {
    achieved: {
      patients: achievedPatients.length,
      amount: achievedAmount,
      percentage: achievedPercentage,
    },
    potential: {
      consultingOngoing: { patients: consultingOngoing.length, amount: consultingOngoingAmount },
      visitManagement: { patients: visitManagement.length, amount: visitManagementAmount },
      totalPatients: unpaidActive.length,
      totalAmount: consultingOngoingAmount + visitManagementAmount,
      percentage: potentialPercentage,
    },
    lost: {
      consultingLost: { patients: consultingLost.length, amount: consultingLostAmount },
      visitLost: { patients: visitLost.length, amount: visitLostAmount },
      totalPatients: closedPatients.length,
      totalAmount: consultingLostAmount + visitLostAmount,
      percentage: lostPercentage,
    },
    summary: {
      totalInquiries,
      totalPotentialAmount,
      achievementRate: totalPotentialAmount > 0
        ? Math.round((achievedAmount / totalPotentialAmount) * 100)
        : 0,
      potentialGrowth: achievedAmount > 0
        ? Math.round(((consultingOngoingAmount + visitManagementAmount) / achievedAmount) * 100)
        : 0,
      discountRate,
      avgDealSize,
    },
  };
}

function getEstimatedSum(patients: PatientV2[]): number {
  return patients.reduce((sum, p) => {
    const journey = p.journeys?.find((j) => j.isActive);
    return sum + (journey?.estimatedAmount || p.estimatedAmount || 0);
  }, 0);
}

// ============================================
// 지역 통계 (전화번호 기반 추정)
// ============================================

function buildRegionStats(patients: PatientV2[]): RegionStatV2[] {
  const regionCounts: Record<string, number> = {};
  const total = patients.length;

  for (const p of patients) {
    // 환자에 region 필드가 있으면 우선 사용
    const region = p.region || estimateRegionFromPhone(p.phone);
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  }

  return Object.entries(regionCounts)
    .map(([region, count]) => ({
      region,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function estimateRegionFromPhone(phoneNumber: string): string {
  if (!phoneNumber) return '기타 지역';
  const digits = phoneNumber.replace(/[^0-9]/g, '');

  // 3자리 지역번호 먼저 체크
  const area3 = digits.slice(0, 3);
  const regionMap3: Record<string, string> = {
    '031': '경기도',
    '032': '인천광역시',
    '033': '강원도',
    '041': '충청남도',
    '042': '대전광역시',
    '043': '충청북도',
    '044': '세종특별자치시',
    '051': '부산광역시',
    '052': '울산광역시',
    '053': '대구광역시',
    '054': '경상북도',
    '055': '경상남도',
    '061': '전라남도',
    '062': '광주광역시',
    '063': '전라북도',
    '064': '제주특별자치도',
  };
  if (regionMap3[area3]) return regionMap3[area3];

  // 2자리 지역번호
  const area2 = digits.slice(0, 2);
  if (area2 === '02') return '서울특별시';

  // 010 등 휴대폰은 지역 불명
  return '기타 지역';
}

// ============================================
// 유입경로 통계
// ============================================

function buildChannelStats(patients: PatientV2[]): ChannelStatV2[] {
  const channelCounts: Record<string, number> = {};
  const total = patients.length;

  for (const p of patients) {
    const channel = p.source || '기타';
    channelCounts[channel] = (channelCounts[channel] || 0) + 1;
  }

  return Object.entries(channelCounts)
    .map(([channel, count]) => ({
      channel,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================
// 진행상황별 통계 (퍼널)
// ============================================

/**
 * 누적 퍼널 통계: 각 단계에 "그 단계를 거쳐간 환자 수"를 카운팅.
 * - 비-closed 환자: 현재 상태 order 이하의 모든 단계에 +1
 *   (예: treatment(5) → consulting(1), reserved(2), visited(3), treatmentBooked(4), treatment(5) 모두 +1)
 * - closed 환자: statusHistory에서 도달한 최고 단계까지 누적 + closed도 +1
 */
function buildProgressStats(patients: PatientV2[]): Record<PatientStatus, number> {
  const stats: Record<PatientStatus, number> = {
    consulting: 0,
    reserved: 0,
    visited: 0,
    treatmentBooked: 0,
    treatment: 0,
    completed: 0,
    followup: 0,
    closed: 0,
  };

  // 퍼널 단계 순서 (closed 제외)
  const funnelOrder: PatientStatus[] = [
    'consulting', 'reserved', 'visited', 'treatmentBooked',
    'treatment', 'completed', 'followup',
  ];
  const orderMap = new Map<PatientStatus, number>();
  funnelOrder.forEach((s, i) => orderMap.set(s, i));

  for (const p of patients) {
    if (p.status === 'closed') {
      // closed 환자: statusHistory에서 도달한 최고 단계를 찾음
      stats.closed++;
      let maxOrder = 0; // 최소 consulting(0)은 거침
      if (p.statusHistory && p.statusHistory.length > 0) {
        for (const entry of p.statusHistory) {
          const toOrder = orderMap.get(entry.to as PatientStatus);
          if (toOrder !== undefined && toOrder > maxOrder) {
            maxOrder = toOrder;
          }
          const fromOrder = orderMap.get(entry.from as PatientStatus);
          if (fromOrder !== undefined && fromOrder > maxOrder) {
            maxOrder = fromOrder;
          }
        }
      }
      // 최고 도달 단계까지 누적 카운팅
      for (let i = 0; i <= maxOrder; i++) {
        stats[funnelOrder[i]]++;
      }
    } else {
      // 비-closed 환자: 현재 상태 order 이하 모든 단계에 +1
      const currentOrder = orderMap.get(p.status);
      if (currentOrder !== undefined) {
        for (let i = 0; i <= currentOrder; i++) {
          stats[funnelOrder[i]]++;
        }
      } else {
        // 알 수 없는 상태 - 안전하게 consulting만 카운팅
        stats.consulting++;
      }
    }
  }

  return stats;
}

// ============================================
// 일별 추이
// ============================================

function buildDailyTrends(
  callLogs: CallLogV2[],
  consultations: ConsultationV2[],
  year: number,
  month: number,
  endDate: Date,
): MonthlyStatsV2['dailyTrends'] {
  const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
  const dailyMap = new Map<string, { calls: number; newPatients: number; agreed: number; revenue: number }>();

  // 해당 월의 모든 날짜 초기화
  for (let d = 1; d <= endDate.getDate(); d++) {
    const dateStr = `${yearMonth}-${d.toString().padStart(2, '0')}`;
    dailyMap.set(dateStr, { calls: 0, newPatients: 0, agreed: 0, revenue: 0 });
  }

  // 통화 집계
  for (const call of callLogs) {
    const createdAt = typeof call.createdAt === 'string' ? call.createdAt : call.createdAt.toISOString();
    const dateStr = createdAt.split('T')[0];
    const daily = dailyMap.get(dateStr);
    if (daily) {
      daily.calls++;
      if (call.aiAnalysis?.classification === '신환' || call.aiAnalysis?.classification === '구신환') {
        daily.newPatients++;
      }
    }
  }

  // 상담 집계
  for (const consult of consultations) {
    const dateStr = new Date(consult.date).toISOString().split('T')[0];
    const daily = dailyMap.get(dateStr);
    if (daily && consult.status === 'agreed') {
      daily.agreed++;
      daily.revenue += consult.finalAmount || 0;
    }
  }

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================
// 관심분야별 통계
// ============================================

function buildInterestBreakdown(
  consultations: ConsultationV2[]
): MonthlyStatsV2['interestBreakdown'] {
  const map = new Map<string, { count: number; agreed: number; revenue: number }>();

  for (const c of consultations) {
    const interest = c.treatment || '기타';
    const existing = map.get(interest) || { count: 0, agreed: 0, revenue: 0 };
    existing.count++;
    if (c.status === 'agreed') {
      existing.agreed++;
      existing.revenue += c.finalAmount || 0;
    }
    map.set(interest, existing);
  }

  return Array.from(map.entries())
    .map(([interest, data]) => ({ interest, ...data }))
    .sort((a, b) => b.count - a.count);
}

// ============================================
// 미동의 사유 분석
// ============================================

function buildDisagreeReasons(
  consultations: ConsultationV2[]
): MonthlyStatsV2['disagreeReasons'] {
  const disagreed = consultations.filter((c) => c.status === 'disagreed');
  const reasonCounts = new Map<string, number>();

  for (const c of disagreed) {
    if (c.disagreeReasons) {
      for (const reason of c.disagreeReasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      }
    }
  }

  const totalReasons = Array.from(reasonCounts.values()).reduce((a, b) => a + b, 0);

  return Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: totalReasons > 0 ? Math.round((count / totalReasons) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================
// 연령 분포 (10년 단위)
// ============================================

function buildAgeDistribution(patients: PatientV2[]): AgeDistributionItem[] {
  const brackets: Record<string, number> = {
    '10대': 0, '20대': 0, '30대': 0, '40대': 0,
    '50대': 0, '60대+': 0,
  };

  const patientsWithAge = patients.filter((p) => p.age && p.age > 0);

  for (const p of patientsWithAge) {
    const age = p.age!;
    if (age < 20) brackets['10대']++;
    else if (age < 30) brackets['20대']++;
    else if (age < 40) brackets['30대']++;
    else if (age < 50) brackets['40대']++;
    else if (age < 60) brackets['50대']++;
    else brackets['60대+']++;
  }

  const total = patientsWithAge.length;
  return Object.entries(brackets)
    .map(([bracket, count]) => ({
      bracket,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));
}

// ============================================
// 성별 통계
// ============================================

function buildGenderStatsData(patients: PatientV2[]): GenderStats {
  let male = 0, female = 0, unknown = 0;
  for (const p of patients) {
    if (p.gender === '남') male++;
    else if (p.gender === '여') female++;
    else unknown++;
  }
  return { male, female, unknown };
}

// ============================================
// 인구통계 교차분석 (연령대 x 치료관심)
// ============================================

function buildDemographicCrossAnalysis(
  patients: PatientV2[],
  consultations: ConsultationV2[],
): DemographicCrossItem[] {
  const consultByPatient = new Map<string, ConsultationV2[]>();
  for (const c of consultations) {
    if (!consultByPatient.has(c.patientId)) consultByPatient.set(c.patientId, []);
    consultByPatient.get(c.patientId)!.push(c);
  }

  const map = new Map<string, number>(); // key: "30대|임플란트"

  for (const p of patients) {
    if (!p.age || p.age <= 0) continue;
    const bracket = getAgeBracket(p.age);
    const pid = p._id?.toString() || '';
    const pConsults = consultByPatient.get(pid) || [];

    const interest =
      p.journeys?.find((j) => j.isActive)?.treatmentType ||
      p.interest ||
      pConsults[0]?.treatment ||
      '기타';

    const key = `${bracket}|${interest}`;
    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([key, count]) => {
      const [ageBracket, treatmentType] = key.split('|');
      return { ageBracket, treatmentType, count };
    })
    .sort((a, b) => b.count - a.count);
}

function getAgeBracket(age: number): string {
  if (age < 20) return '10대';
  if (age < 30) return '20대';
  if (age < 40) return '30대';
  if (age < 50) return '40대';
  if (age < 60) return '50대';
  return '60대+';
}

// ============================================
// 채널 ROI 분석
// ============================================

function buildChannelROIStats(patients: PatientV2[]): ChannelROIItem[] {
  const channelMap = new Map<string, {
    count: number;
    reservedCount: number;
    visitedCount: number;
    paidCount: number;
    totalRevenue: number;
  }>();

  for (const p of patients) {
    const channel = p.source || '기타';
    if (!channelMap.has(channel)) {
      channelMap.set(channel, { count: 0, reservedCount: 0, visitedCount: 0, paidCount: 0, totalRevenue: 0 });
    }
    const ch = channelMap.get(channel)!;
    ch.count++;

    if (RESERVED_OR_ABOVE.includes(p.status) || hasReachedStatus(p, RESERVED_OR_ABOVE)) {
      ch.reservedCount++;
    }
    if (VISITED_OR_ABOVE.includes(p.status) || hasReachedStatus(p, VISITED_OR_ABOVE)) {
      ch.visitedCount++;
    }
    if (p.paymentStatus === 'partial' || p.paymentStatus === 'completed') {
      ch.paidCount++;
      ch.totalRevenue += p.actualAmount || 0;
    }
  }

  return Array.from(channelMap.entries())
    .map(([channel, data]) => ({
      channel,
      count: data.count,
      reservedCount: data.reservedCount,
      visitedCount: data.visitedCount,
      paidCount: data.paidCount,
      reservedRate: data.count > 0 ? Math.round((data.reservedCount / data.count) * 1000) / 10 : 0,
      visitedRate: data.count > 0 ? Math.round((data.visitedCount / data.count) * 1000) / 10 : 0,
      paidRate: data.count > 0 ? Math.round((data.paidCount / data.count) * 1000) / 10 : 0,
      totalRevenue: data.totalRevenue,
      avgDealSize: data.paidCount > 0 ? Math.round(data.totalRevenue / data.paidCount) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================
// 치료별 분석
// ============================================

function buildTreatmentAnalysis(
  patients: PatientV2[],
  consultations: ConsultationV2[],
): TreatmentAnalysisItem[] {
  // 환자별 치료관심 매핑
  const patientInterest = new Map<string, string>();
  for (const p of patients) {
    const pid = p._id?.toString() || '';
    const interest =
      p.journeys?.find((j) => j.isActive)?.treatmentType ||
      p.interest ||
      '기타';
    patientInterest.set(pid, interest);
  }

  // 치료별 집계
  const treatmentMap = new Map<string, {
    totalCount: number;
    agreedCount: number;
    totalRevenue: number;
    disagreeReasonsMap: Map<string, number>;
  }>();

  for (const c of consultations) {
    const treatment = c.treatment || patientInterest.get(c.patientId) || '기타';
    if (!treatmentMap.has(treatment)) {
      treatmentMap.set(treatment, {
        totalCount: 0, agreedCount: 0, totalRevenue: 0,
        disagreeReasonsMap: new Map(),
      });
    }
    const t = treatmentMap.get(treatment)!;
    t.totalCount++;

    if (c.status === 'agreed') {
      t.agreedCount++;
      t.totalRevenue += c.finalAmount || 0;
    }
    if (c.status === 'disagreed' && c.disagreeReasons) {
      for (const reason of c.disagreeReasons) {
        t.disagreeReasonsMap.set(reason, (t.disagreeReasonsMap.get(reason) || 0) + 1);
      }
    }
  }

  return Array.from(treatmentMap.entries())
    .map(([treatment, data]) => ({
      treatment,
      totalCount: data.totalCount,
      agreedCount: data.agreedCount,
      conversionRate: data.totalCount > 0
        ? Math.round((data.agreedCount / data.totalCount) * 1000) / 10 : 0,
      totalRevenue: data.totalRevenue,
      avgDealSize: data.agreedCount > 0 ? Math.round(data.totalRevenue / data.agreedCount) : 0,
      disagreeReasons: Array.from(data.disagreeReasonsMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.totalCount - a.totalCount);
}

// ============================================
// 요일별 패턴
// ============================================

function buildWeeklyPattern(
  dailyTrends: MonthlyStatsV2['dailyTrends'],
): WeeklyPatternItem[] {
  const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
  const dayData: Record<number, { calls: number[]; newPatients: number[]; agreed: number[] }> = {};

  for (let i = 0; i < 7; i++) {
    dayData[i] = { calls: [], newPatients: [], agreed: [] };
  }

  for (const day of dailyTrends) {
    const dow = new Date(day.date).getDay();
    dayData[dow].calls.push(day.calls);
    dayData[dow].newPatients.push(day.newPatients);
    dayData[dow].agreed.push(day.agreed);
  }

  return [1, 2, 3, 4, 5, 6, 0].map((dow) => { // 월~일 순서
    const d = dayData[dow];
    const avg = (arr: number[]) => arr.length > 0
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
    return {
      dayOfWeek: dow,
      dayLabel: DAY_LABELS[dow],
      avgCalls: avg(d.calls),
      avgNewPatients: avg(d.newPatients),
      avgAgreed: avg(d.agreed),
    };
  });
}

// ============================================
// 종결 사유 통계
// ============================================

function buildClosedReasonStats(patients: PatientV2[]): ClosedReasonStatItem[] {
  const closed = patients.filter((p) => p.status === 'closed');
  const reasonMap = new Map<string, number>();

  for (const p of closed) {
    // statusHistory에서 closed 전환 기록의 reason 추출
    const closedEntry = p.statusHistory?.find((h) => h.to === 'closed');
    const reason = closedEntry?.reason || '미분류';
    const label = reason === '기타' && closedEntry?.customReason ? closedEntry.customReason : reason;
    reasonMap.set(label, (reasonMap.get(label) || 0) + 1);
  }

  const total = closed.length;
  return Array.from(reasonMap.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================
// 자동 핵심 인사이트 생성
// ============================================

function generateExecutiveInsights(stats: MonthlyStatsV2): string[] {
  const insights: string[] = [];
  const { changes, channelROI, treatmentAnalysis, closedReasonStats } = stats;

  // 1. 전월 대비 문의 변화
  if (changes.totalInquiries.value > 0) {
    const dir = changes.totalInquiries.type === 'increase' ? '증가' : '감소';
    const parts: string[] = [];
    if (changes.inbound.value > 0) {
      parts.push(`인바운드 ${changes.inbound.type === 'increase' ? '+' : '-'}${changes.inbound.value}건`);
    }
    if (changes.outbound.value > 0) {
      parts.push(`아웃바운드 ${changes.outbound.type === 'increase' ? '+' : '-'}${changes.outbound.value}건`);
    }
    let msg = `신규 문의 전월 대비 ${changes.totalInquiries.value}건 ${dir}`;
    if (parts.length > 0) msg += ` (${parts.join(', ')})`;
    insights.push(msg);
  }

  // 2. 전환율 변화 요약
  const conversionParts: string[] = [];
  if (changes.reservedRate.value > 0) {
    conversionParts.push(
      `예약전환율 ${changes.reservedRate.type === 'increase' ? '개선' : '하락'} (${changes.reservedRate.type === 'increase' ? '+' : '-'}${changes.reservedRate.value}%p)`
    );
  }
  if (changes.agreedRate.value > 0) {
    conversionParts.push(
      `결제전환율 ${changes.agreedRate.type === 'increase' ? '개선' : '하락'} (${changes.agreedRate.type === 'increase' ? '+' : '-'}${changes.agreedRate.value}%p)`
    );
  }
  if (conversionParts.length > 0) {
    insights.push(conversionParts.join(', '));
  }

  // 3. 최고 ROI 채널
  if (channelROI && channelROI.length > 0) {
    const bestChannel = channelROI.reduce((best, ch) =>
      ch.paidRate > best.paidRate ? ch : best, channelROI[0]);
    if (bestChannel.paidRate > 0) {
      const avgDeal = bestChannel.avgDealSize > 0
        ? ` (평균 객단가 ${Math.round(bestChannel.avgDealSize / 10000)}만원)`
        : '';
      insights.push(
        `최고 ROI 채널: ${bestChannel.channel} - 결제전환율 ${bestChannel.paidRate}%${avgDeal}`
      );
    }
  }

  // 4. 주요 치료 관심분야 전환율
  if (treatmentAnalysis && treatmentAnalysis.length > 0) {
    const top = treatmentAnalysis[0];
    if (top.totalCount > 0) {
      insights.push(
        `가장 많은 관심분야: ${top.treatment} (${top.totalCount}건, 전환율 ${top.conversionRate}%)`
      );
    }
  }

  // 5. 잠재매출 기회
  const { revenueAnalysis } = stats;
  if (revenueAnalysis.potential.totalAmount > 0) {
    const potentialM = Math.round(revenueAnalysis.potential.totalAmount / 10000);
    insights.push(
      `잠재환자 ${revenueAnalysis.potential.totalPatients}명 전환 시 ${potentialM.toLocaleString()}만원 추가 가능`
    );
  }

  // 6. 주요 이탈 사유
  if (closedReasonStats && closedReasonStats.length > 0) {
    const topReason = closedReasonStats[0];
    if (topReason.count > 0) {
      insights.push(
        `종결 주요 사유: ${topReason.reason} (${topReason.count}건, ${topReason.percentage}%)`
      );
    }
  }

  return insights.slice(0, 5);
}
