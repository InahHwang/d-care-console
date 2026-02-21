// src/app/v2/reports/components/MonthlyReport-KPIOverview.tsx
// V2 KPI 개요 - 총 문의수 + 3 KPI 카드 + 스파크라인 + 전월 대비
'use client';

import React, { useMemo } from 'react';
import { MessageSquare, Phone, PhoneCall, Users, TrendingUp, CreditCard } from 'lucide-react';
import type { MonthlyStatsV2, ChangeIndicator } from './MonthlyReport-Types';

const {
  AreaChart, Area, ResponsiveContainer,
} = require('recharts') as any;

// ============================================
// 전월 대비 변화 배지
// ============================================

function ChangeIndicatorBadge({ change, unit = '건', formatValue }: {
  change: ChangeIndicator;
  unit?: string;
  formatValue?: (v: number) => string;
}) {
  if (change.value === 0) return null;
  const isIncrease = change.type === 'increase';
  const displayValue = formatValue ? formatValue(change.value) : `${change.value}${unit}`;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      isIncrease ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {isIncrease ? '+' : '-'}{displayValue}
    </span>
  );
}

function ChangeIndicatorInline({ change, unit = '%p' }: {
  change: ChangeIndicator;
  unit?: string;
}) {
  if (change.value === 0) return null;
  const isIncrease = change.type === 'increase';
  return (
    <span className={`ml-1 text-xs font-medium ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
      ({isIncrease ? '+' : '-'}{change.value}{unit})
    </span>
  );
}

// ============================================
// 미니 스파크라인
// ============================================

function Sparkline({ data, color }: { data: Array<{ v: number }>; color: string }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="h-8 w-full mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// 금액 포맷
// ============================================

function formatAmount(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

// ============================================
// 메인 컴포넌트
// ============================================

interface MonthlyReportKPIOverviewProps {
  stats: MonthlyStatsV2;
}

const MonthlyReportKPIOverview: React.FC<MonthlyReportKPIOverviewProps> = ({ stats }) => {
  // 스파크라인 데이터 추출
  const sparklineData = useMemo(() => {
    const trends = stats.dailyTrends || [];
    return {
      reserved: trends.map((d) => ({ v: d.newPatients })),
      visited: trends.map((d) => ({ v: d.agreed })),
      revenue: trends.map((d) => ({ v: d.revenue })),
    };
  }, [stats.dailyTrends]);

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-5 border-b bg-blue-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          상담 실적 요약
        </h2>
      </div>
      <div className="p-5">
        {/* 신규 문의 헤드라인 */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900">
              이번달 총 신규문의 {stats.totalInquiries}건
            </h3>
            <ChangeIndicatorBadge change={stats.changes.totalInquiries} unit="건" />
          </div>
          <div className="flex gap-5 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-green-600" />
              인바운드 {stats.inquiryBreakdown.inbound}건
            </span>
            <span className="flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4 text-blue-600" />
              아웃바운드 {stats.inquiryBreakdown.outbound}건
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" />
              구신환 {stats.inquiryBreakdown.returning}건
            </span>
          </div>
        </div>

        {/* KPI 카드 3개 + 스파크라인 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 예약 환자수 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">예약 환자수</span>
            </div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="text-2xl font-bold text-green-900">{stats.reservedPatients}명</div>
              <ChangeIndicatorBadge change={stats.changes.reservedPatients} unit="명" />
            </div>
            <div className="text-xs text-green-700">
              전환율 {stats.reservedRate}%
              <ChangeIndicatorInline change={stats.changes.reservedRate} />
            </div>
            <Sparkline data={sparklineData.reserved} color="#16a34a" />
          </div>

          {/* 내원 환자수 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">내원 환자수</span>
            </div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="text-2xl font-bold text-blue-900">{stats.visitedPatients}명</div>
              <ChangeIndicatorBadge change={stats.changes.visitedPatients} unit="명" />
            </div>
            <div className="text-xs text-blue-700">
              전환율 {stats.visitedRate}%
              <ChangeIndicatorInline change={stats.changes.visitedRate} />
            </div>
            <Sparkline data={sparklineData.visited} color="#2563eb" />
          </div>

          {/* 총 결제금액 */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">총 결제금액</span>
            </div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="text-2xl font-bold text-purple-900">
                {formatAmount(stats.agreedRevenue)}
              </div>
              <ChangeIndicatorBadge
                change={stats.changes.agreedRevenue}
                formatValue={(v) => `${Math.round(v / 10000).toLocaleString()}만원`}
              />
            </div>
            <div className="text-xs text-purple-700 space-y-0.5">
              <div>
                결제환자 {stats.agreedPatients}명
                <ChangeIndicatorInline change={stats.changes.agreedPatients} unit="명" />
              </div>
              <div>
                전환율 {stats.agreedRate}%
                <ChangeIndicatorInline change={stats.changes.agreedRate} />
              </div>
            </div>
            <Sparkline data={sparklineData.revenue} color="#9333ea" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportKPIOverview;
