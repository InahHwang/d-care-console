// src/app/v2/reports/components/MonthlyReport-ChannelROI.tsx
// V2 유입채널 ROI 분석 - 채널별 전환 퍼널 + 매출 분석
'use client';

import React, { useMemo } from 'react';
import { Megaphone, TrendingUp, Award, AlertCircle } from 'lucide-react';
import type { MonthlyStatsV2, ChannelROIItem } from './MonthlyReport-Types';
import { formatAmount } from './MonthlyReport-Utils';

const {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} = require('recharts') as any;

// ============================================
// Types
// ============================================

interface MonthlyReportChannelROIProps {
  stats: MonthlyStatsV2;
}

interface ChannelChartData {
  channel: string;
  문의: number;
  예약: number;
  내원: number;
  결제: number;
}

// ============================================
// Constants
// ============================================

const BAR_COLORS = {
  문의: '#9CA3AF',  // gray
  예약: '#F97316',  // orange
  내원: '#8B5CF6',  // purple
  결제: '#22C55E',  // green
};

function buildChartData(items: ChannelROIItem[]): ChannelChartData[] {
  return items.map((item) => ({
    channel: item.channel,
    문의: item.count,
    예약: item.reservedCount,
    내원: item.visitedCount,
    결제: item.paidCount,
  }));
}

/** 결제전환율 동률 시: 1차 매출, 2차 객단가로 tiebreak → 1등 1명만 반환 + 동률 목록 */
function findBestChannel(items: ChannelROIItem[]): {
  best: ChannelROIItem | null;
  tied: ChannelROIItem[];  // 동률 채널들 (best 포함)
} {
  const withPaid = items.filter((c) => c.paidCount > 0);
  if (withPaid.length === 0) return { best: null, tied: [] };

  const maxRate = Math.max(...withPaid.map((c) => c.paidRate));
  const tied = withPaid.filter((c) => c.paidRate === maxRate);

  if (tied.length === 1) return { best: tied[0], tied };

  // tiebreak: 매출 → 객단가
  const sorted = [...tied].sort((a, b) =>
    b.totalRevenue !== a.totalRevenue
      ? b.totalRevenue - a.totalRevenue
      : b.avgDealSize - a.avgDealSize
  );
  return { best: sorted[0], tied };
}

function findWorstChannels(items: ChannelROIItem[]): ChannelROIItem[] {
  const withInquiries = items.filter((c) => c.count > 0);
  if (withInquiries.length === 0) return [];
  const minRate = Math.min(...withInquiries.map((c) => c.paidRate));
  return withInquiries.filter((c) => c.paidRate === minRate);
}

// ============================================
// Sub-Components
// ============================================

function NoDataPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg">
      <Megaphone className="w-8 h-8 text-gray-300 mb-3" />
      <p className="text-sm text-gray-400">
        채널 ROI 데이터가 없습니다. 데이터 새로고침을 클릭하세요.
      </p>
    </div>
  );
}

/** 커스텀 툴팁 */
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

function ChannelGroupedChart({ data }: { data: ChannelChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
      >
        <XAxis
          dataKey="channel"
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
        <Bar dataKey="문의" fill={BAR_COLORS['문의']} radius={[2, 2, 0, 0]} maxBarSize={28} />
        <Bar dataKey="예약" fill={BAR_COLORS['예약']} radius={[2, 2, 0, 0]} maxBarSize={28} />
        <Bar dataKey="내원" fill={BAR_COLORS['내원']} radius={[2, 2, 0, 0]} maxBarSize={28} />
        <Bar dataKey="결제" fill={BAR_COLORS['결제']} radius={[2, 2, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChannelTable({
  items,
  bestChannelNames,
}: {
  items: ChannelROIItem[];
  bestChannelNames: Set<string>;
}) {
  // 문의수 내림차순 정렬
  const sorted = [...items].sort((a, b) => b.count - a.count);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left px-3 py-2.5 font-medium text-gray-600">
              채널
            </th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">
              문의수
            </th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">
              예약전환율
            </th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">
              내원전환율
            </th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">
              결제전환율
              <div className="text-[10px] text-gray-400 font-normal">내원 대비</div>
            </th>
            <th className="text-right px-3 py-2.5 font-medium text-gray-600">
              매출
            </th>
            <th className="text-right px-3 py-2.5 font-medium text-gray-600">
              객단가
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const isBest = bestChannelNames.has(item.channel);
            return (
              <tr
                key={item.channel}
                className={`border-b last:border-b-0 ${
                  isBest ? 'bg-green-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {item.channel}
                    </span>
                    {isBest && (
                      <Award className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </td>
                <td className="text-center px-3 py-2.5 text-gray-700">
                  {item.count}건
                </td>
                <td className="text-center px-3 py-2.5">
                  <span className={
                    item.reservedRate >= 50 ? 'text-green-600 font-medium' :
                    item.reservedRate >= 30 ? 'text-gray-700' :
                    'text-red-500'
                  }>
                    {item.reservedRate}%
                  </span>
                </td>
                <td className="text-center px-3 py-2.5">
                  <span className={
                    item.visitedRate >= 40 ? 'text-green-600 font-medium' :
                    item.visitedRate >= 20 ? 'text-gray-700' :
                    'text-red-500'
                  }>
                    {item.visitedRate}%
                  </span>
                </td>
                <td className="text-center px-3 py-2.5">
                  <span className={`font-medium ${
                    isBest ? 'text-green-700' :
                    item.paidRate >= 20 ? 'text-green-600' :
                    item.paidRate >= 10 ? 'text-gray-700' :
                    'text-red-500'
                  }`}>
                    {item.paidRate}%
                  </span>
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

function InsightCallout({
  bestResult,
  worstList,
}: {
  bestResult: { best: ChannelROIItem | null; tied: ChannelROIItem[] };
  worstList: ChannelROIItem[];
}) {
  const { best, tied } = bestResult;
  if (!best && worstList.length === 0) return null;

  // 최고/최저가 같은 채널이면 비교 의미 없음
  const bestName = best?.channel;
  const allSame = best && worstList.length === 1 && worstList[0].channel === bestName;
  if (allSame) return null;

  // worst에서 best/동률 채널 제외, 문의 3건 이상만
  const tiedNames = new Set(tied.map((c) => c.channel));
  const filteredWorst = worstList.filter(
    (c) => !tiedNames.has(c.channel) && c.count >= 3
  );

  // 동률에서 best 제외한 나머지
  const otherTied = tied.filter((c) => c.channel !== bestName);

  return (
    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
      <div className="flex items-start gap-2">
        <TrendingUp className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-orange-800 space-y-1">
          {best && (
            <p>
              <span className="font-bold text-green-700">{best.channel}</span>
              {' 채널이 결제전환율 '}
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
              {otherTied.length > 0 && (
                <span>
                  {' '}
                  {otherTied.map((ch, i) => (
                    <React.Fragment key={ch.channel}>
                      {i > 0 && ', '}
                      <span className="font-bold">{ch.channel}</span>
                    </React.Fragment>
                  ))}
                  {' 채널도 동일 전환율이나 매출 기준으로 차이가 있습니다.'}
                </span>
              )}
            </p>
          )}
          {filteredWorst.length > 0 && (
            <p>
              {filteredWorst.map((ch, i) => (
                <React.Fragment key={ch.channel}>
                  {i > 0 && ', '}
                  <span className="font-bold text-red-600">{ch.channel}</span>
                </React.Fragment>
              ))}
              {' 채널은 결제전환율 '}
              <span className="font-bold">{filteredWorst[0].paidRate}%</span>
              {'로 개선이 필요합니다.'}
              {best && (
                <span>
                  {' (최고 대비 '}
                  <span className="font-bold">
                    {best.paidRate - filteredWorst[0].paidRate}%p
                  </span>
                  {' 차이)'}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

const MonthlyReportChannelROI: React.FC<MonthlyReportChannelROIProps> = ({
  stats,
}) => {
  const channelROI = stats.channelROI;
  const hasData = channelROI && channelROI.length > 0;

  const chartData = useMemo(
    () => (hasData ? buildChartData(channelROI!) : []),
    [channelROI, hasData]
  );

  const bestResult = useMemo(
    () => (hasData ? findBestChannel(channelROI!) : { best: null, tied: [] }),
    [channelROI, hasData]
  );

  const worstChannels = useMemo(
    () => (hasData ? findWorstChannels(channelROI!) : []),
    [channelROI, hasData]
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      {/* 헤더 */}
      <div className="p-6 border-b bg-orange-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-orange-600" />
          유입채널 ROI 분석
        </h2>
      </div>

      <div className="p-6">
        {!hasData ? (
          <NoDataPlaceholder />
        ) : (
          <>
            {/* 그룹 바 차트 */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">
                채널별 전환 현황
              </h3>
              <ChannelGroupedChart data={chartData} />
            </div>

            {/* 상세 테이블 */}
            <div className="mb-2">
              <h3 className="text-sm font-medium text-gray-600 mb-3">
                채널별 상세 분석
              </h3>
              <ChannelTable
                items={channelROI!}
                bestChannelNames={new Set(bestResult.best ? [bestResult.best.channel] : [])}
              />
            </div>

            {/* 자동 생성 인사이트 */}
            <InsightCallout bestResult={bestResult} worstList={worstChannels} />
          </>
        )}
      </div>
    </div>
  );
};

export default MonthlyReportChannelROI;
