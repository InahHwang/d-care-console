// src/app/v2/reports/components/MonthlyReport-Trends.tsx
// V2 일별/요일별 추이 - ComposedChart + 요일별 패턴
'use client';

import React, { useMemo } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import type { MonthlyStatsV2 } from './MonthlyReport-Types';

const {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, BarChart,
} = require('recharts') as any;

// ============================================
// Types
// ============================================

interface MonthlyReportTrendsProps {
  stats: MonthlyStatsV2;
}

interface DailyChartItem {
  day: number;
  통화건수: number;
  신규환자: number;
  동의: number;
  revenue: number;
}

// ============================================
// Helpers
// ============================================

function formatAmount(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}일</p>
      <p className="text-blue-600">통화건수: {data?.통화건수}건</p>
      <p className="text-orange-600">신규환자: {data?.신규환자}명</p>
      <p className="text-green-600">동의: {data?.동의}명</p>
      {data?.revenue > 0 && (
        <p className="text-purple-600">매출: {formatAmount(data.revenue)}</p>
      )}
    </div>
  );
}

function WeeklyTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      <p className="text-blue-600">평균 통화: {data?.평균통화}건</p>
      <p className="text-orange-600">평균 신규: {data?.평균신규}명</p>
      <p className="text-green-600">평균 동의: {data?.평균동의}명</p>
    </div>
  );
}

// ============================================
// Component
// ============================================

const MonthlyReportTrends: React.FC<MonthlyReportTrendsProps> = ({ stats }) => {
  const { dailyTrends, weeklyPattern } = stats;

  // 일별 차트 데이터: date → day number
  const dailyChartData: DailyChartItem[] = useMemo(() => {
    return dailyTrends.map((d) => {
      const parts = d.date.split('-');
      const dayNum = parseInt(parts[2] || parts[0], 10) || 0;
      return {
        day: dayNum,
        통화건수: d.calls,
        신규환자: d.newPatients,
        동의: d.agreed,
        revenue: d.revenue,
      };
    });
  }, [dailyTrends]);

  // 요일별 차트 데이터
  const weeklyChartData = useMemo(() => {
    if (!weeklyPattern || weeklyPattern.length === 0) return [];
    return weeklyPattern.map((w) => ({
      dayLabel: w.dayLabel,
      dayOfWeek: w.dayOfWeek,
      평균통화: w.avgCalls,
      평균신규: w.avgNewPatients,
      평균동의: w.avgAgreed,
    }));
  }, [weeklyPattern]);

  // 피크 요일 찾기
  const peakDay = useMemo(() => {
    if (!weeklyPattern || weeklyPattern.length === 0) return null;
    let max = -1;
    let peak = weeklyPattern[0];
    weeklyPattern.forEach((w) => {
      if (w.avgCalls > max) {
        max = w.avgCalls;
        peak = w;
      }
    });
    return peak;
  }, [weeklyPattern]);

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      {/* 헤더 */}
      <div className="p-6 border-b bg-indigo-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          일별/요일별 추이
        </h2>
      </div>

      <div className="p-6 space-y-8">
        {/* Part 1: 일별 추이 ComposedChart */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
            <Calendar className="w-4 h-4 text-gray-500" />
            일별 추이
          </h3>
          {dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart
                data={dailyChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}`}
                  label={{ value: '일', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<DailyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar
                  dataKey="통화건수"
                  fill="#3B82F6"
                  radius={[3, 3, 0, 0]}
                  barSize={14}
                  opacity={0.7}
                />
                <Line
                  type="monotone"
                  dataKey="신규환자"
                  stroke="#F97316"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#F97316' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="동의"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10B981' }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-gray-400">
              일별 데이터가 없습니다.
            </div>
          )}
        </div>

        {/* Part 2: 요일별 평균 패턴 */}
        {weeklyChartData.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-500" />
              요일별 평균 패턴
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={weeklyChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<WeeklyTooltip />} />
                <Bar
                  dataKey="평균통화"
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                >
                  {weeklyChartData.map((entry: any, index: number) => {
                    const isPeak = peakDay && entry.dayOfWeek === peakDay.dayOfWeek;
                    return (
                      <rect
                        key={index}
                        fill={isPeak ? '#F59E0B' : '#3B82F6'}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* 피크 요일 인사이트 */}
            {peakDay && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-amber-800">
                  피크 요일: <span className="font-bold">{peakDay.dayLabel}요일</span>
                  {' '}(평균 <span className="font-bold">{peakDay.avgCalls}</span>건)
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyReportTrends;
