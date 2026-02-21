// src/app/v2/reports/components/MonthlyReport-Insights.tsx
// V2 인사이트 & 개선사항 - 자동감지 이슈/긍정변화 + 데이터 기반 실행 권고
'use client';

import React, { useMemo } from 'react';
import { Lightbulb, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import type { MonthlyStatsV2 } from './MonthlyReport-Types';

// ============================================
// Types
// ============================================

interface MonthlyReportInsightsProps {
  stats: MonthlyStatsV2;
}

// ============================================
// Helpers
// ============================================

function formatAmount(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

/** 전월 대비 감소 이슈 자동 감지 */
function detectIssues(stats: MonthlyStatsV2): string[] {
  const { changes } = stats;
  const issues: string[] = [];

  if (changes.totalInquiries.type === 'decrease') {
    let detail = `신규 문의 총 ${changes.totalInquiries.value}건 감소`;
    const parts: string[] = [];
    if (changes.inbound.type === 'decrease') parts.push(`인바운드 -${changes.inbound.value}건`);
    else if (changes.inbound.value > 0) parts.push(`인바운드 +${changes.inbound.value}건`);
    if (changes.outbound.type === 'decrease') parts.push(`아웃바운드 -${changes.outbound.value}건`);
    else if (changes.outbound.value > 0) parts.push(`아웃바운드 +${changes.outbound.value}건`);
    if (parts.length > 0) detail += ` (${parts.join(', ')})`;
    issues.push(detail);
  }

  if (changes.reservedPatients.type === 'decrease' || changes.reservedRate.type === 'decrease') {
    const parts: string[] = [];
    if (changes.reservedPatients.type === 'decrease') parts.push(`예약환자수 ${changes.reservedPatients.value}명 감소`);
    if (changes.reservedRate.type === 'decrease') parts.push(`예약전환율 ${changes.reservedRate.value}%p 하락`);
    issues.push(`예약 성과 저하: ${parts.join(', ')}`);
  }

  if (changes.visitedPatients.type === 'decrease' || changes.visitedRate.type === 'decrease') {
    const parts: string[] = [];
    if (changes.visitedPatients.type === 'decrease') parts.push(`내원환자수 ${changes.visitedPatients.value}명 감소`);
    if (changes.visitedRate.type === 'decrease') parts.push(`내원전환율 ${changes.visitedRate.value}%p 하락`);
    issues.push(`내원 성과 저하: ${parts.join(', ')}`);
  }

  if (
    changes.agreedPatients.type === 'decrease' ||
    changes.agreedRate.type === 'decrease' ||
    changes.agreedRevenue.type === 'decrease'
  ) {
    const parts: string[] = [];
    if (changes.agreedRevenue.type === 'decrease') parts.push(`총 결제금액 ${(changes.agreedRevenue.value / 10000).toFixed(0)}만원 감소`);
    if (changes.agreedPatients.type === 'decrease') parts.push(`결제환자수 ${changes.agreedPatients.value}명 감소`);
    if (changes.agreedRate.type === 'decrease') parts.push(`결제전환율 ${changes.agreedRate.value}%p 하락`);
    issues.push(`매출 성과 저하: ${parts.join(', ')}`);
  }

  return issues;
}

/** 전월 대비 증가 긍정변화 자동 감지 */
function detectPositives(stats: MonthlyStatsV2): string[] {
  const { changes } = stats;
  const positives: string[] = [];

  if (changes.totalInquiries.type === 'increase' && changes.totalInquiries.value >= 1) {
    let detail = `신규 문의 총 ${changes.totalInquiries.value}건 증가`;
    const parts: string[] = [];
    if (changes.inbound.type === 'increase' && changes.inbound.value > 0) parts.push(`인바운드 +${changes.inbound.value}건`);
    if (changes.outbound.type === 'increase' && changes.outbound.value > 0) parts.push(`아웃바운드 +${changes.outbound.value}건`);
    if (parts.length > 0) detail += ` (${parts.join(', ')})`;
    positives.push(detail);
  }

  if (
    (changes.reservedPatients.type === 'increase' && changes.reservedPatients.value > 0) ||
    (changes.reservedRate.type === 'increase' && changes.reservedRate.value > 0)
  ) {
    const parts: string[] = [];
    if (changes.reservedPatients.type === 'increase' && changes.reservedPatients.value > 0) parts.push(`예약환자수 ${changes.reservedPatients.value}명 증가`);
    if (changes.reservedRate.type === 'increase' && changes.reservedRate.value > 0) parts.push(`예약전환율 ${changes.reservedRate.value}%p 개선`);
    positives.push(`예약 성과 개선: ${parts.join(', ')}`);
  }

  if (
    (changes.visitedPatients.type === 'increase' && changes.visitedPatients.value > 0) ||
    (changes.visitedRate.type === 'increase' && changes.visitedRate.value > 0)
  ) {
    const parts: string[] = [];
    if (changes.visitedPatients.type === 'increase' && changes.visitedPatients.value > 0) parts.push(`내원환자수 ${changes.visitedPatients.value}명 증가`);
    if (changes.visitedRate.type === 'increase' && changes.visitedRate.value > 0) parts.push(`내원전환율 ${changes.visitedRate.value}%p 개선`);
    positives.push(`내원 성과 개선: ${parts.join(', ')}`);
  }

  if (
    (changes.agreedPatients.type === 'increase' && changes.agreedPatients.value > 0) ||
    (changes.agreedRate.type === 'increase' && changes.agreedRate.value > 0) ||
    (changes.agreedRevenue.type === 'increase' && changes.agreedRevenue.value > 0)
  ) {
    const parts: string[] = [];
    if (changes.agreedRevenue.type === 'increase' && changes.agreedRevenue.value > 0) parts.push(`총 결제금액 ${(changes.agreedRevenue.value / 10000).toFixed(0)}만원 증가`);
    if (changes.agreedPatients.type === 'increase' && changes.agreedPatients.value > 0) parts.push(`결제환자수 ${changes.agreedPatients.value}명 증가`);
    if (changes.agreedRate.type === 'increase' && changes.agreedRate.value > 0) parts.push(`결제전환율 ${changes.agreedRate.value}%p 개선`);
    positives.push(`매출 성과 개선: ${parts.join(', ')}`);
  }

  return positives;
}

/** 데이터 기반 실행 권고사항 생성 */
function generateRecommendations(stats: MonthlyStatsV2): string[] {
  const recommendations: string[] = [];

  // 1. 미동의 사유 1위가 가격 관련인지 확인
  if (stats.disagreeReasons.length > 0) {
    const topReason = stats.disagreeReasons[0].reason;
    const priceKeywords = ['가격', '비용', '비싸', '부담', '금액'];
    if (priceKeywords.some((kw) => topReason.includes(kw))) {
      recommendations.push('가격 부담 환자 대상 분할납부/할인 프로그램 검토');
    }
  }

  // 2. 채널 ROI에서 전환율 낮은 채널 확인
  if (stats.channelROI && stats.channelROI.length > 0) {
    const lowConversionChannels = stats.channelROI.filter(
      (ch) => ch.count >= 3 && ch.paidRate < 10
    );
    lowConversionChannels.forEach((ch) => {
      recommendations.push(`${ch.channel} 채널 콘텐츠/대응 개선 필요 (전환율 ${ch.paidRate}%)`);
    });
  }

  // 3. 요일별 패턴 피크 요일 확인
  if (stats.weeklyPattern && stats.weeklyPattern.length > 0) {
    let maxCalls = -1;
    let peakDay = stats.weeklyPattern[0];
    stats.weeklyPattern.forEach((w) => {
      if (w.avgCalls > maxCalls) {
        maxCalls = w.avgCalls;
        peakDay = w;
      }
    });
    if (peakDay && maxCalls > 0) {
      recommendations.push(`${peakDay.dayLabel}요일 상담 인력 보강 검토 (평균 ${peakDay.avgCalls}건)`);
    }
  }

  // 4. 종결 사유 1위가 "연락두절"인지 확인
  if (stats.closedReasonStats && stats.closedReasonStats.length > 0) {
    const topClosed = stats.closedReasonStats[0].reason;
    const noContactKeywords = ['연락두절', '연락불가', '부재', '미응답'];
    if (noContactKeywords.some((kw) => topClosed.includes(kw))) {
      recommendations.push('초기 상담 후 24시간 내 팔로업 콜 강화');
    }
  }

  // 5. 잠재 매출이 높은 경우
  const potentialPatients = stats.revenueAnalysis.potential.totalPatients;
  const potentialAmount = stats.revenueAnalysis.potential.totalAmount;
  if (potentialPatients > 0 && potentialAmount > 0) {
    recommendations.push(
      `잠재환자 ${potentialPatients}명 전환 집중 관리 필요 (${formatAmount(potentialAmount)})`
    );
  }

  return recommendations;
}

// ============================================
// Component
// ============================================

const MonthlyReportInsights: React.FC<MonthlyReportInsightsProps> = ({ stats }) => {
  const issues = useMemo(() => detectIssues(stats), [stats]);
  const positives = useMemo(() => detectPositives(stats), [stats]);
  const recommendations = useMemo(() => generateRecommendations(stats), [stats]);

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      {/* 헤더 */}
      <div className="p-6 border-b bg-yellow-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-600" />
          인사이트 &amp; 개선사항
        </h2>
      </div>

      <div className="p-6 space-y-4">
        {/* 1. 주요 이슈 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-medium text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            주요 이슈
            <span className="text-xs bg-red-100 px-2 py-0.5 rounded">자동 감지</span>
          </h3>
          <ul className="text-sm text-red-700 space-y-1">
            {issues.length > 0 ? (
              issues.map((issue, i) => <li key={i}>· {issue}</li>)
            ) : (
              <li className="text-red-400">· 전월 대비 감소한 주요 지표가 없습니다.</li>
            )}
          </ul>
        </div>

        {/* 2. 긍정적 변화 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            긍정적 변화
            <span className="text-xs bg-green-100 px-2 py-0.5 rounded">자동 감지</span>
          </h3>
          <ul className="text-sm text-green-700 space-y-1">
            {positives.length > 0 ? (
              positives.map((p, i) => <li key={i}>· {p}</li>)
            ) : (
              <li className="text-green-400">· 전월 대비 증가한 지표가 없습니다.</li>
            )}
          </ul>
        </div>

        {/* 3. 실행 권고사항 (NEW) */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            실행 권고사항
            <span className="text-xs bg-blue-100 px-2 py-0.5 rounded">데이터 기반</span>
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            {recommendations.length > 0 ? (
              recommendations.map((rec, i) => <li key={i}>· {rec}</li>)
            ) : (
              <li className="text-blue-400">· 현재 데이터로 도출된 권고사항이 없습니다.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportInsights;
