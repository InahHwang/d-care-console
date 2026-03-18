// src/app/v2/reports/components/MonthlyReport-DisagreeAnalysis.tsx
// V2 미동의 & 이탈 분석 - 미동의 사유 + 종결 사유 + 치료별 교차분석
'use client';

import React, { useMemo } from 'react';
import { XCircle, AlertTriangle } from 'lucide-react';
import type { MonthlyStatsV2 } from './MonthlyReport-Types';

const {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} = require('recharts') as any;

// ============================================
// Types
// ============================================

interface MonthlyReportDisagreeAnalysisProps {
  stats: MonthlyStatsV2;
}

// ============================================
// Constants
// ============================================

const BAR_COLORS = ['#EF4444', '#F97316', '#FB923C', '#FDBA74', '#FED7AA'];
const CLOSED_BAR_COLORS = ['#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6'];

// ============================================
// Helpers
// ============================================

function DisagreeBarTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900">{data?.reason}</p>
      <p className="text-red-600">{data?.count}건 ({data?.percentage}%)</p>
    </div>
  );
}

function ClosedBarTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900">{data?.reason}</p>
      <p className="text-gray-600">{data?.count}건 ({data?.percentage}%)</p>
    </div>
  );
}

/** 긴 사유명을 최대 길이로 자르기 */
function truncateReason(reason: string, maxLen: number = 12): string {
  return reason.length > maxLen ? reason.slice(0, maxLen) + '…' : reason;
}

// ============================================
// Component
// ============================================

const MonthlyReportDisagreeAnalysis: React.FC<MonthlyReportDisagreeAnalysisProps> = ({ stats }) => {
  const { disagreeReasons, closedReasonStats, treatmentAnalysis } = stats;

  // 미동의 사유 가로 바차트 데이터
  const disagreeChartData = useMemo(() => {
    return disagreeReasons.map((r) => ({
      reason: r.reason,
      count: r.count,
      percentage: Math.round(r.percentage),
    }));
  }, [disagreeReasons]);

  // 총 미동의 건수
  const totalDisagreeCount = useMemo(() => {
    return disagreeReasons.reduce((sum, r) => sum + r.count, 0);
  }, [disagreeReasons]);

  // 종결 사유 바차트 데이터 (상위 8개 + 나머지 기타로 묶기)
  const closedChartData = useMemo(() => {
    if (!closedReasonStats || closedReasonStats.length === 0) return [];

    const MAX_ITEMS = 8;
    if (closedReasonStats.length <= MAX_ITEMS) {
      return closedReasonStats.map((c) => ({
        reason: c.reason,
        count: c.count,
        percentage: c.percentage,
      }));
    }

    const top = closedReasonStats.slice(0, MAX_ITEMS);
    const rest = closedReasonStats.slice(MAX_ITEMS);
    const restCount = rest.reduce((sum, c) => sum + c.count, 0);
    const totalClosed = closedReasonStats.reduce((sum, c) => sum + c.count, 0);

    return [
      ...top.map((c) => ({ reason: c.reason, count: c.count, percentage: c.percentage })),
      { reason: '기타', count: restCount, percentage: totalClosed > 0 ? Math.round((restCount / totalClosed) * 1000) / 10 : 0 },
    ];
  }, [closedReasonStats]);

  const totalClosedCount = useMemo(() => {
    if (!closedReasonStats) return 0;
    return closedReasonStats.reduce((sum, c) => sum + c.count, 0);
  }, [closedReasonStats]);

  // 치료별 미동의 사유 교차분석 (상위 3개 치료)
  const treatmentDisagreeData = useMemo(() => {
    if (!treatmentAnalysis || treatmentAnalysis.length === 0) return [];
    return treatmentAnalysis
      .filter((t) => t.disagreeReasons && t.disagreeReasons.length > 0)
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 3)
      .map((t) => ({
        treatment: t.treatment,
        reasons: t.disagreeReasons.slice(0, 3),
      }));
  }, [treatmentAnalysis]);

  // 미동의 + 종결 데이터 모두 없으면
  const hasNoData = disagreeReasons.length === 0 &&
    (!closedReasonStats || closedReasonStats.length === 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      {/* 헤더 */}
      <div className="p-6 border-b bg-red-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-600" />
          미동의 &amp; 이탈 분석
          {totalDisagreeCount > 0 && (
            <span className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded-full">
              미동의 {totalDisagreeCount}건
            </span>
          )}
        </h2>
      </div>

      <div className="p-6">
        {hasNoData ? (
          <p className="text-sm text-gray-400 text-center py-8">분석 데이터가 없습니다.</p>
        ) : (
          <>
            {/* Row: 미동의 사유 + 종결 사유 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 왼쪽: 미동의 사유 가로 바차트 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  미동의 사유
                </h3>
                {disagreeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(disagreeChartData.length * 40 + 20, 150)}>
                    <BarChart
                      data={disagreeChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="reason"
                        tick={{ fontSize: 12 }}
                        width={100}
                      />
                      <Tooltip content={<DisagreeBarTooltip />} />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                        label={({ x, y, width, height, index }: any) => {
                          const pct = disagreeChartData[index]?.percentage ?? 0;
                          return (
                            <text
                              x={x + width + 5}
                              y={y + height / 2 + 4}
                              fontSize={11}
                              fill="#6B7280"
                            >
                              {pct}%
                            </text>
                          );
                        }}
                      >
                        {disagreeChartData.map((_: any, i: number) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[150px] text-sm text-gray-400">
                    미동의 사유 데이터가 없습니다.
                  </div>
                )}
              </div>

              {/* 오른쪽: 종결 사유 가로 바차트 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-gray-500" />
                  종결 사유
                  {totalClosedCount > 0 && (
                    <span className="text-xs text-gray-400 ml-1">({totalClosedCount}건)</span>
                  )}
                </h3>
                {closedChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(closedChartData.length * 40 + 20, 150)}>
                    <BarChart
                      data={closedChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="reason"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: string) => truncateReason(v)}
                        width={100}
                      />
                      <Tooltip content={<ClosedBarTooltip />} />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                        label={({ x, y, width, height, index }: any) => {
                          const pct = closedChartData[index]?.percentage ?? 0;
                          return (
                            <text
                              x={x + width + 5}
                              y={y + height / 2 + 4}
                              fontSize={11}
                              fill="#6B7280"
                            >
                              {pct}%
                            </text>
                          );
                        }}
                      >
                        {closedChartData.map((_: any, i: number) => (
                          <Cell key={i} fill={CLOSED_BAR_COLORS[i % CLOSED_BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[150px] bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-sm text-gray-400">데이터 새로고침 필요</p>
                  </div>
                )}
              </div>
            </div>

            {/* 치료별 미동의 사유 교차분석 */}
            {treatmentDisagreeData.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  치료별 미동의 사유 (상위 3개 치료)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {treatmentDisagreeData.map((item) => (
                    <div
                      key={item.treatment}
                      className="bg-orange-50 border border-orange-200 rounded-lg p-4"
                    >
                      <h4 className="text-sm font-semibold text-orange-900 mb-2">
                        {item.treatment}
                      </h4>
                      <ul className="space-y-1">
                        {item.reasons.map((r, idx) => (
                          <li
                            key={idx}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-orange-800">{r.reason}</span>
                            <span className="text-orange-600 font-medium">{r.count}건</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MonthlyReportDisagreeAnalysis;
