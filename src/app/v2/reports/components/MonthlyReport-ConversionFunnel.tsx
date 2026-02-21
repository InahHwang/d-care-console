// src/app/v2/reports/components/MonthlyReport-ConversionFunnel.tsx
// V2 환자 전환 퍼널 - 8단계 여정 시각화 + 이탈 구간 분석
'use client';

import React, { useMemo } from 'react';
import { Filter, ArrowRight, AlertTriangle } from 'lucide-react';
import type { MonthlyStatsV2 } from './MonthlyReport-Types';
import { PROGRESS_STAGE_CONFIG } from './MonthlyReport-Types';
import type { PatientStatus } from '@/types/v2';

// ============================================
// Types
// ============================================

interface MonthlyReportConversionFunnelProps {
  stats: MonthlyStatsV2;
}

interface FunnelStage {
  status: PatientStatus;
  label: string;
  count: number;
  percentage: number;
  bgColor: string;
  barColor: string;
}

interface DropoffInfo {
  fromLabel: string;
  toLabel: string;
  fromCount: number;
  toCount: number;
  dropCount: number;
  dropRate: number;
}

// ============================================
// Constants
// ============================================

/** 퍼널에 표시할 단계 순서 (closed 제외) */
const FUNNEL_ORDER: PatientStatus[] = [
  'consulting',
  'reserved',
  'visited',
  'treatmentBooked',
  'treatment',
  'completed',
  'followup',
];

/** 퍼널 바 색상 (Tailwind bg 클래스) */
const FUNNEL_BAR_COLORS: Record<PatientStatus, string> = {
  consulting: 'bg-yellow-400',
  reserved: 'bg-orange-400',
  visited: 'bg-purple-400',
  treatmentBooked: 'bg-indigo-400',
  treatment: 'bg-blue-400',
  completed: 'bg-green-400',
  followup: 'bg-teal-400',
  closed: 'bg-gray-400',
};

// ============================================
// Helper Functions
// ============================================

function buildFunnelStages(
  progressStats: Record<PatientStatus, number>,
  totalInquiries: number
): FunnelStage[] {
  return FUNNEL_ORDER.map((status) => {
    const config = PROGRESS_STAGE_CONFIG[status];
    const count = progressStats[status] || 0;
    const percentage = totalInquiries > 0
      ? Math.round((count / totalInquiries) * 100)
      : 0;

    return {
      status,
      label: config.label,
      count,
      percentage,
      bgColor: config.bgColor,
      barColor: FUNNEL_BAR_COLORS[status],
    };
  });
}

function calculateDropoffs(stages: FunnelStage[]): DropoffInfo[] {
  const dropoffs: DropoffInfo[] = [];

  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];
    // 누적 카운팅 기반: 이전 단계 도달 수 - 다음 단계 도달 수 = 이탈 수
    const dropCount = Math.max(from.count - to.count, 0);
    const dropRate = from.count > 0
      ? Math.round((dropCount / from.count) * 100)
      : 0;

    dropoffs.push({
      fromLabel: from.label,
      toLabel: to.label,
      fromCount: from.count,
      toCount: to.count,
      dropCount,
      dropRate,
    });
  }

  return dropoffs;
}

function findMaxDropoff(dropoffs: DropoffInfo[]): DropoffInfo | null {
  if (dropoffs.length === 0) return null;

  return dropoffs.reduce((max, curr) =>
    curr.dropCount > max.dropCount ? curr : max
  );
}

// ============================================
// Sub-Components
// ============================================

function FunnelBar({
  stage,
  maxCount,
  index,
}: {
  stage: FunnelStage;
  maxCount: number;
  index: number;
}) {
  const widthPercent = maxCount > 0
    ? Math.max((stage.count / maxCount) * 100, 8)
    : 8;

  return (
    <div className="flex items-center gap-3">
      {/* 순서 번호 */}
      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500 flex-shrink-0">
        {index + 1}
      </div>

      {/* 라벨 */}
      <div className="w-20 text-sm font-medium text-gray-700 flex-shrink-0 text-right">
        {stage.label}
      </div>

      {/* 바 */}
      <div className="flex-1 relative">
        <div
          className={`h-9 rounded-md ${stage.barColor} transition-all duration-500 flex items-center px-3`}
          style={{ width: `${widthPercent}%`, minWidth: '60px' }}
        >
          <span className="text-sm font-bold text-white whitespace-nowrap">
            {stage.count}건
          </span>
        </div>
      </div>

      {/* 비율 */}
      <div className="w-14 text-sm text-gray-500 text-right flex-shrink-0">
        {stage.percentage}%
      </div>
    </div>
  );
}

function DropoffArrow({ dropoff }: { dropoff: DropoffInfo }) {
  if (dropoff.dropCount === 0) return null;

  return (
    <div className="flex items-center gap-3 pl-9 ml-20">
      <div className="flex items-center gap-1 text-xs text-red-500">
        <ArrowRight className="w-3 h-3 rotate-90" />
        <span>-{dropoff.dropCount}건 ({dropoff.dropRate}% 이탈)</span>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

const MonthlyReportConversionFunnel: React.FC<MonthlyReportConversionFunnelProps> = ({
  stats,
}) => {
  const funnelStages = useMemo(
    () => buildFunnelStages(stats.progressStats, stats.totalInquiries),
    [stats.progressStats, stats.totalInquiries]
  );

  const dropoffs = useMemo(
    () => calculateDropoffs(funnelStages),
    [funnelStages]
  );

  const maxDropoff = useMemo(
    () => findMaxDropoff(dropoffs),
    [dropoffs]
  );

  const maxCount = Math.max(...funnelStages.map((s) => s.count), 1);
  const closedCount = stats.progressStats.closed || 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      {/* 헤더 */}
      <div className="p-6 border-b bg-indigo-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Filter className="w-5 h-5 text-indigo-600" />
          환자 전환 퍼널
          <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
            총 {stats.totalInquiries}건
          </span>
        </h2>
      </div>

      <div className="p-6">
        {/* 퍼널 시각화 */}
        {funnelStages.length > 0 ? (
          <div className="space-y-1 mb-6">
            {funnelStages.map((stage, index) => (
              <React.Fragment key={stage.status}>
                <FunnelBar
                  stage={stage}
                  maxCount={maxCount}
                  index={index}
                />
                {index < funnelStages.length - 1 && (
                  <DropoffArrow dropoff={dropoffs[index]} />
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            퍼널 데이터가 없습니다.
          </p>
        )}

        {/* 종결 환자 별도 표시 */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg mb-6">
          <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0" />
          <span className="text-sm font-medium text-gray-600">종결</span>
          <span className="text-sm font-bold text-gray-700">{closedCount}건</span>
          <span className="text-xs text-gray-400">
            ({stats.totalInquiries > 0
              ? Math.round((closedCount / stats.totalInquiries) * 100)
              : 0}%)
          </span>
        </div>

        {/* 최대 이탈 구간 하이라이트 */}
        {maxDropoff && maxDropoff.dropCount > 0 && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-red-800 mb-1">
                최대 이탈 구간
              </div>
              <div className="text-sm text-red-700">
                <span className="font-medium">{maxDropoff.fromLabel}</span>
                {' → '}
                <span className="font-medium">{maxDropoff.toLabel}</span>
                {' 단계에서 '}
                <span className="font-bold">{maxDropoff.dropCount}건</span>
                {' ('}
                <span className="font-bold">{maxDropoff.dropRate}%</span>
                {') 이탈이 발생했습니다.'}
              </div>
              <div className="text-xs text-red-600 mt-1">
                {maxDropoff.fromLabel} {maxDropoff.fromCount}건 → {maxDropoff.toLabel} {maxDropoff.toCount}건
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyReportConversionFunnel;
