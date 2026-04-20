// src/app/v2/reports/components/MonthlyReport-ConsultationTypeROI.tsx
// V2 상담타입 ROI 분석 - 상담타입별 전환 퍼널 + 매출 분석
'use client';

import React, { useMemo } from 'react';
import { PhoneCall, Award, TrendingUp } from 'lucide-react';
import type { MonthlyStatsV2, ConsultationTypeROIItem } from './MonthlyReport-Types';
import { formatAmount } from './MonthlyReport-Utils';

const {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} = require('recharts') as any;

// ============================================
// Types
// ============================================

interface MonthlyReportConsultationTypeROIProps {
  stats: MonthlyStatsV2;
}

// ============================================
// Constants
// ============================================

const BAR_COLORS = {
  문의: '#9CA3AF',
  예약: '#F97316',
  내원: '#8B5CF6',
  결제: '#22C55E',
};

// ============================================
// Helpers
// ============================================

function findBestType(items: ConsultationTypeROIItem[]): ConsultationTypeROIItem | null {
  const withPaid = items.filter((c) => c.paidCount > 0);
  if (withPaid.length === 0) return null;
  return withPaid.sort((a, b) =>
    b.paidRate !== a.paidRate
      ? b.paidRate - a.paidRate
      : b.totalRevenue - a.totalRevenue
  )[0];
}

// ============================================
// Sub-Components
// ============================================

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border shadow-lg rounded-lg px-3 py-2 text-sm">
      <div className="font-medium text-gray-900 mb-1">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.fill }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-900">{entry.value}건</span>
        </div>
      ))}
    </div>
  );
}

function TypeTable({
  items,
  bestType,
}: {
  items: ConsultationTypeROIItem[];
  bestType: string | null;
}) {
  const sorted = [...items].sort((a, b) => b.count - a.count);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left px-3 py-2.5 font-medium text-gray-600">상담타입</th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">문의수</th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">예약전환율</th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">내원전환율</th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">
              결제전환율
              <div className="text-[10px] text-gray-400 font-normal">내원 대비</div>
            </th>
            <th className="text-right px-3 py-2.5 font-medium text-gray-600">매출</th>
            <th className="text-right px-3 py-2.5 font-medium text-gray-600">객단가</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const isBest = item.type === bestType;
            return (
              <tr
                key={item.type}
                className={`border-b last:border-b-0 ${
                  isBest ? 'bg-green-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{item.type}</span>
                    {isBest && <Award className="w-4 h-4 text-green-500" />}
                  </div>
                </td>
                <td className="text-center px-3 py-2.5 text-gray-700">{item.count}건</td>
                <td className="text-center px-3 py-2.5">
                  <span className={
                    item.reservedRate >= 50 ? 'text-green-600 font-medium' :
                    item.reservedRate >= 30 ? 'text-gray-700' : 'text-red-500'
                  }>{item.reservedRate}%</span>
                </td>
                <td className="text-center px-3 py-2.5">
                  <span className={
                    item.visitedRate >= 40 ? 'text-green-600 font-medium' :
                    item.visitedRate >= 20 ? 'text-gray-700' : 'text-red-500'
                  }>{item.visitedRate}%</span>
                </td>
                <td className="text-center px-3 py-2.5">
                  <span className={`font-medium ${
                    isBest ? 'text-green-700' :
                    item.paidRate >= 20 ? 'text-green-600' :
                    item.paidRate >= 10 ? 'text-gray-700' : 'text-red-500'
                  }`}>{item.paidRate}%</span>
                </td>
                <td className="text-right px-3 py-2.5 font-medium text-gray-900">
                  {item.totalRevenue > 0 ? formatAmount(item.totalRevenue) : '-'}
                </td>
                <td className="text-right px-3 py-2.5 text-gray-600">
                  {item.avgDealSize > 0 ? formatAmount(item.avgDealSize) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

const MonthlyReportConsultationTypeROI: React.FC<MonthlyReportConsultationTypeROIProps> = ({
  stats,
}) => {
  const data = stats.consultationTypeROI;
  const hasData = data && data.length > 0;

  const chartData = useMemo(() => {
    if (!hasData) return [];
    return data!.map((item) => ({
      type: item.type,
      문의: item.count,
      예약: item.reservedCount,
      내원: item.visitedCount,
      결제: item.paidCount,
    }));
  }, [data, hasData]);

  const best = useMemo(
    () => (hasData ? findBestType(data!) : null),
    [data, hasData]
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-6 border-b bg-violet-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-violet-600" />
          상담타입 ROI 분석
        </h2>
      </div>

      <div className="p-6">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg">
            <PhoneCall className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">
              상담타입 ROI 데이터가 없습니다. 데이터 새로고침을 클릭하세요.
            </p>
          </div>
        ) : (
          <>
            {/* 그룹 바 차트 */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">상담타입별 전환 현황</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <XAxis
                    dataKey="type"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-sm text-gray-600">{value}</span>
                    )}
                  />
                  <Bar dataKey="문의" fill={BAR_COLORS['문의']} radius={[2, 2, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="예약" fill={BAR_COLORS['예약']} radius={[2, 2, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="내원" fill={BAR_COLORS['내원']} radius={[2, 2, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="결제" fill={BAR_COLORS['결제']} radius={[2, 2, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 상세 테이블 */}
            <div className="mb-2">
              <h3 className="text-sm font-medium text-gray-600 mb-3">상담타입별 상세 분석</h3>
              <TypeTable items={data!} bestType={best?.type || null} />
            </div>

            {/* 인사이트 */}
            {best && (
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-800">
                    <span className="font-bold text-green-700">{best.type}</span>
                    {' 상담타입이 결제전환율 '}
                    <span className="font-bold">{best.paidRate}%</span>
                    {'로 가장 높은 성과를 보이고 있습니다.'}
                    {best.totalRevenue > 0 && (
                      <span>
                        {' (매출 '}
                        <span className="font-bold">{formatAmount(best.totalRevenue)}</span>
                        {best.avgDealSize > 0 && (
                          <span>, 객단가 <span className="font-bold">{formatAmount(best.avgDealSize)}</span></span>
                        )}
                        {')'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MonthlyReportConsultationTypeROI;
