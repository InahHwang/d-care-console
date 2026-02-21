// src/app/v2/reports/components/MonthlyReport-TreatmentAnalysis.tsx
// V2 치료 관심분야 분석 - 전환율/매출/객단가
'use client';

import React, { useMemo } from 'react';
import { Stethoscope } from 'lucide-react';
import type { MonthlyStatsV2 } from './MonthlyReport-Types';

const {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell,
} = require('recharts') as any;

// ============================================
// Types
// ============================================

interface MonthlyReportTreatmentAnalysisProps {
  stats: MonthlyStatsV2;
}

interface ChartDataItem {
  name: string;
  전체문의: number;
  동의: number;
  conversionRate: number;
  revenue: number;
  avgDealSize: number;
}

// ============================================
// Constants
// ============================================

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// ============================================
// Helpers
// ============================================

function formatAmount(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      <p className="text-gray-600">전체 문의: {item?.전체문의}건</p>
      <p className="text-green-600">동의: {item?.동의}건</p>
      <p className="text-blue-600">전환율: {item?.conversionRate}%</p>
      {item?.revenue > 0 && (
        <p className="text-purple-600">매출: {formatAmount(item.revenue)}</p>
      )}
    </div>
  );
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900">{item.name}</p>
      <p className="text-gray-600">{formatAmount(item.value)}</p>
      <p className="text-gray-500">{(item.payload?.percentage ?? 0).toFixed(1)}%</p>
    </div>
  );
}

// ============================================
// Component
// ============================================

const MonthlyReportTreatmentAnalysis: React.FC<MonthlyReportTreatmentAnalysisProps> = ({ stats }) => {
  const { treatmentAnalysis, interestBreakdown } = stats;

  // treatmentAnalysis가 있으면 사용, 없으면 interestBreakdown 폴백
  const chartData: ChartDataItem[] = useMemo(() => {
    if (treatmentAnalysis && treatmentAnalysis.length > 0) {
      return treatmentAnalysis.map((t) => ({
        name: t.treatment,
        전체문의: t.totalCount,
        동의: t.agreedCount,
        conversionRate: t.conversionRate,
        revenue: t.totalRevenue,
        avgDealSize: t.avgDealSize,
      }));
    }
    // interestBreakdown 폴백
    return interestBreakdown.map((item) => ({
      name: item.interest,
      전체문의: item.count,
      동의: item.agreed,
      conversionRate: item.count > 0 ? Math.round((item.agreed / item.count) * 100) : 0,
      revenue: item.revenue,
      avgDealSize: item.agreed > 0 ? Math.round(item.revenue / item.agreed) : 0,
    }));
  }, [treatmentAnalysis, interestBreakdown]);

  // 매출 파이차트 데이터 (매출 > 0인 항목만)
  const revenueData = useMemo(() => {
    const filtered = chartData.filter((d) => d.revenue > 0);
    const totalRevenue = filtered.reduce((sum, d) => sum + d.revenue, 0);
    return filtered.map((d) => ({
      name: d.name,
      value: d.revenue,
      percentage: totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0,
    }));
  }, [chartData]);

  // 최고 전환율 행 인덱스
  const highestConversionIdx = useMemo(() => {
    if (chartData.length === 0) return -1;
    let maxRate = -1;
    let maxIdx = -1;
    chartData.forEach((d, i) => {
      if (d.conversionRate > maxRate) {
        maxRate = d.conversionRate;
        maxIdx = i;
      }
    });
    return maxIdx;
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-6 border-b bg-teal-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            치료 관심분야 분석
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-400 text-center">관심분야 데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      {/* 헤더 */}
      <div className="p-6 border-b bg-teal-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-teal-600" />
          치료 관심분야 분석
          <span className="text-sm bg-teal-100 text-teal-700 px-2 py-1 rounded-full">
            {chartData.length}개 분야
          </span>
        </h2>
      </div>

      <div className="p-6">
        {/* Row 1: 그룹 바차트 - 문의 vs 동의 */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">문의 / 동의 비교</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={chartData.length > 5 ? -30 : 0}
                textAnchor={chartData.length > 5 ? 'end' : 'middle'}
                height={chartData.length > 5 ? 60 : 30}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip content={<CustomBarTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="전체문의" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="동의"
                fill="#10B981"
                radius={[4, 4, 0, 0]}
                label={({ x, y, width, index }: any) => {
                  const rate = chartData[index]?.conversionRate ?? 0;
                  return (
                    <text
                      x={x + width / 2}
                      y={y - 8}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#059669"
                      fontWeight="bold"
                    >
                      {rate}%
                    </text>
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Row 2: 매출 파이차트 + 테이블 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 매출 파이차트 (도넛) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">치료별 매출 비중</h3>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={revenueData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percentage }: any) =>
                      `${name} ${percentage.toFixed(0)}%`
                    }
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {revenueData.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-sm text-gray-400">
                매출 데이터가 없습니다.
              </div>
            )}
          </div>

          {/* 오른쪽: 치료별 통계 테이블 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">치료별 상세 통계</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">치료</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">문의</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">동의</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">전환율</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">매출</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">객단가</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, idx) => {
                    const isHighest = idx === highestConversionIdx && row.conversionRate > 0;
                    return (
                      <tr
                        key={row.name}
                        className={`border-b ${isHighest ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="py-2 px-2 text-gray-900 font-medium">
                          {row.name}
                          {isHighest && (
                            <span className="ml-1 text-xs text-green-600 font-normal">최고</span>
                          )}
                        </td>
                        <td className="text-right py-2 px-2 text-gray-700">{row.전체문의}건</td>
                        <td className="text-right py-2 px-2 text-green-700">{row.동의}건</td>
                        <td className="text-right py-2 px-2 font-semibold text-green-700">
                          {row.conversionRate}%
                        </td>
                        <td className="text-right py-2 px-2 text-blue-700">
                          {row.revenue > 0 ? formatAmount(row.revenue) : '-'}
                        </td>
                        <td className="text-right py-2 px-2 text-gray-600">
                          {row.avgDealSize > 0 ? formatAmount(row.avgDealSize) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportTreatmentAnalysis;
