// src/app/v2/reports/components/MonthlyReport-ConversionFunnel.tsx
// V2 환자 전환 퍼널 - 누적 도달 기반 4단계 + 현재 상태 분포
'use client';

import React, { useMemo } from 'react';
import { Filter, ArrowDown, AlertTriangle } from 'lucide-react';
import type { MonthlyStatsV2 } from './MonthlyReport-Types';
import { PROGRESS_STAGE_CONFIG } from './MonthlyReport-Types';
import type { PatientStatus } from '@/types/v2';

// ============================================
// Types
// ============================================

interface MonthlyReportConversionFunnelProps {
  stats: MonthlyStatsV2;
}

interface FunnelStep {
  label: string;
  count: number;
  rate: number;        // totalInquiries 대비 비율
  barColor: string;
}

interface DropoffInfo {
  fromLabel: string;
  toLabel: string;
  fromCount: number;
  toCount: number;
  dropCount: number;
  dropRate: number;    // from 대비 이탈률
}

// ============================================
// Constants
// ============================================

const STATUS_DISPLAY_ORDER: PatientStatus[] = [
  'consulting', 'reserved', 'visited', 'treatmentBooked',
  'treatment', 'completed', 'followup', 'closed',
];

// ============================================
// Helper Functions
// ============================================

function buildFunnelSteps(stats: MonthlyStatsV2): FunnelStep[] {
  const total = stats.totalInquiries;
  return [
    {
      label: '총 문의',
      count: total,
      rate: 100,
      barColor: 'bg-gray-500',
    },
    {
      label: '예약 도달',
      count: stats.reservedPatients,
      rate: total > 0 ? Math.round((stats.reservedPatients / total) * 100) : 0,
      barColor: 'bg-orange-500',
    },
    {
      label: '내원 도달',
      count: stats.visitedPatients,
      rate: total > 0 ? Math.round((stats.visitedPatients / total) * 100) : 0,
      barColor: 'bg-purple-500',
    },
    {
      label: '결제 도달',
      count: stats.agreedPatients,
      rate: total > 0 ? Math.round((stats.agreedPatients / total) * 100) : 0,
      barColor: 'bg-green-500',
    },
  ];
}

function calculateDropoffs(steps: FunnelStep[]): DropoffInfo[] {
  const dropoffs: DropoffInfo[] = [];

  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i];
    const to = steps[i + 1];
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
  step,
  maxCount,
  index,
}: {
  step: FunnelStep;
  maxCount: number;
  index: number;
}) {
  const widthPercent = maxCount > 0
    ? Math.max((step.count / maxCount) * 100, 8)
    : 8;

  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500 flex-shrink-0">
        {index + 1}
      </div>
      <div className="w-20 text-sm font-medium text-gray-700 flex-shrink-0 text-right">
        {step.label}
      </div>
      <div className="flex-1 relative">
        <div
          className={`h-10 rounded-md ${step.barColor} transition-all duration-500 flex items-center px-3`}
          style={{ width: `${widthPercent}%`, minWidth: '70px' }}
        >
          <span className="text-sm font-bold text-white whitespace-nowrap">
            {step.count}명
          </span>
        </div>
      </div>
      <div className="w-14 text-sm font-semibold text-gray-600 text-right flex-shrink-0">
        {step.rate}%
      </div>
    </div>
  );
}

function DropoffArrow({ dropoff }: { dropoff: DropoffInfo }) {
  if (dropoff.dropCount === 0) return null;

  return (
    <div className="flex items-center gap-3 pl-9 ml-20">
      <div className="flex items-center gap-1 text-xs text-red-500">
        <ArrowDown className="w-3 h-3" />
        <span>-{dropoff.dropCount}명 ({dropoff.dropRate}% 이탈)</span>
      </div>
    </div>
  );
}

function StatusDistribution({ stats }: { stats: MonthlyStatsV2 }) {
  const total = stats.totalInquiries;
  if (total === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">현재 상태 분포</h3>
      <div className="flex flex-wrap gap-2">
        {STATUS_DISPLAY_ORDER.map((status) => {
          const count = stats.progressStats[status] || 0;
          if (count === 0) return null;
          const config = PROGRESS_STAGE_CONFIG[status];
          return (
            <div
              key={status}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}
            >
              <span>{config.label}</span>
              <span className="font-bold">{count}명</span>
            </div>
          );
        })}
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
  const funnelSteps = useMemo(
    () => buildFunnelSteps(stats),
    [stats]
  );

  const dropoffs = useMemo(
    () => calculateDropoffs(funnelSteps),
    [funnelSteps]
  );

  const maxDropoff = useMemo(
    () => findMaxDropoff(dropoffs),
    [dropoffs]
  );

  const maxCount = Math.max(...funnelSteps.map((s) => s.count), 1);
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
        <p className="text-xs text-gray-500 mt-1">
          이번 달 신규 문의 환자가 각 단계까지 도달한 누적 수
        </p>
      </div>

      <div className="p-6">
        {/* 퍼널 시각화 (누적 도달 기준) */}
        {stats.totalInquiries > 0 ? (
          <div className="space-y-1 mb-6">
            {funnelSteps.map((step, index) => (
              <React.Fragment key={step.label}>
                <FunnelBar
                  step={step}
                  maxCount={maxCount}
                  index={index}
                />
                {index < funnelSteps.length - 1 && (
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
        {closedCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg mb-6">
            <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0" />
            <span className="text-sm font-medium text-gray-600">종결</span>
            <span className="text-sm font-bold text-gray-700">{closedCount}명</span>
            <span className="text-xs text-gray-400">
              ({stats.totalInquiries > 0
                ? Math.round((closedCount / stats.totalInquiries) * 100)
                : 0}%)
            </span>
          </div>
        )}

        {/* 최대 이탈 구간 하이라이트 */}
        {maxDropoff && maxDropoff.dropCount > 0 && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
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
                <span className="font-bold">{maxDropoff.dropCount}명</span>
                {' ('}
                <span className="font-bold">{maxDropoff.dropRate}%</span>
                {') 이탈이 발생했습니다.'}
              </div>
              <div className="text-xs text-red-600 mt-1">
                {maxDropoff.fromLabel} {maxDropoff.fromCount}명 → {maxDropoff.toLabel} {maxDropoff.toCount}명
              </div>
            </div>
          </div>
        )}

        {/* 현재 상태 분포 (참고용) */}
        <StatusDistribution stats={stats} />
      </div>
    </div>
  );
};

export default MonthlyReportConversionFunnel;
