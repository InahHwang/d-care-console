// src/app/v2/reports/components/MonthlyReport-Demographics.tsx
// V2 환자 인구통계 분석 - 연령/지역/교차분석
'use client';

import React, { useMemo } from 'react';
import { Users, MapPin } from 'lucide-react';
import type { MonthlyStatsV2, AgeDistributionItem, DemographicCrossItem } from './MonthlyReport-Types';

const {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} = require('recharts') as any;

// ============================================
// Types & Constants
// ============================================

interface MonthlyReportDemographicsProps { stats: MonthlyStatsV2; }
interface CrossAnalysisRow { ageBracket: string; treatments: Record<string, number>; }

const CHART_COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#EFF6FF'];

// ============================================
// Helper Functions
// ============================================

function buildCrossAnalysisTable(
  items: DemographicCrossItem[]
): { rows: CrossAnalysisRow[]; topTreatments: string[] } {
  // 치료별 총 카운트 → 상위 3개 추출
  const treatmentCounts: Record<string, number> = {};
  for (const item of items) {
    treatmentCounts[item.treatmentType] =
      (treatmentCounts[item.treatmentType] || 0) + item.count;
  }
  const topTreatments = Object.entries(treatmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([treatment]) => treatment);

  // 연령대별 행 구성
  const rowMap: Record<string, Record<string, number>> = {};
  for (const item of items) {
    if (!topTreatments.includes(item.treatmentType)) continue;
    if (!rowMap[item.ageBracket]) rowMap[item.ageBracket] = {};
    rowMap[item.ageBracket][item.treatmentType] = item.count;
  }

  // 연령대 순서 정렬
  const bracketOrder = ['10대', '20대', '30대', '40대', '50대', '60대+', '미입력'];
  const rows = Object.keys(rowMap)
    .sort((a, b) => bracketOrder.indexOf(a) - bracketOrder.indexOf(b))
    .map((ageBracket) => ({
      ageBracket,
      treatments: rowMap[ageBracket],
    }));

  return { rows, topTreatments };
}

/** 테이블에서 최대 카운트 셀 하이라이트 판단 */
function getMaxCount(rows: CrossAnalysisRow[], treatments: string[]): number {
  let max = 0;
  for (const row of rows) {
    for (const t of treatments) {
      const val = row.treatments[t] || 0;
      if (val > max) max = val;
    }
  }
  return max;
}

// ============================================
// Sub-Components
// ============================================

function NoDataPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

/** 커스텀 툴팁 - 연령 분포 바차트용 */
function AgeTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0];
  return (
    <div className="bg-white border shadow-lg rounded-lg px-3 py-2 text-sm">
      <div className="font-medium text-gray-900">{label}</div>
      <div className="text-orange-600">
        {data.value}명 ({data.payload.percentage}%)
      </div>
    </div>
  );
}

function AgeDistributionChart({ data }: { data: AgeDistributionItem[] }) {
  if (!data || data.length === 0) {
    return <NoDataPlaceholder message="데이터 새로고침 필요" />;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <XAxis
          dataKey="bracket"
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<AgeTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((_entry: AgeDistributionItem, index: number) => (
            <Cell
              key={`age-cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function RegionDistribution({ stats }: { stats: MonthlyStatsV2 }) {
  const topRegions = stats.regionStats.slice(0, 5);

  if (topRegions.length === 0) {
    return <NoDataPlaceholder message="지역 데이터 없음" />;
  }

  const maxPercentage = Math.max(...topRegions.map((r) => r.percentage), 1);

  return (
    <div className="space-y-3">
      {topRegions.map((region, index) => (
        <div key={region.region} className="flex items-center gap-3">
          <span className="w-6 h-6 bg-orange-100 text-orange-800 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
            {index + 1}
          </span>
          <span className="text-sm text-gray-700 w-24 flex-shrink-0">
            {region.region}
          </span>
          <div className="flex-1">
            <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className="bg-orange-500 h-5 rounded-full flex items-center px-2 transition-all duration-500"
                style={{
                  width: `${Math.max((region.percentage / maxPercentage) * 100, 12)}%`,
                }}
              >
                <span className="text-xs font-medium text-white whitespace-nowrap">
                  {region.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0">
            {region.count}명
          </span>
        </div>
      ))}
    </div>
  );
}

function CrossAnalysisTable({
  crossData,
}: {
  crossData: DemographicCrossItem[];
}) {
  const { rows, topTreatments } = useMemo(
    () => buildCrossAnalysisTable(crossData),
    [crossData]
  );

  const maxCount = useMemo(
    () => getMaxCount(rows, topTreatments),
    [rows, topTreatments]
  );

  if (rows.length === 0 || topTreatments.length === 0) {
    return <NoDataPlaceholder message="데이터 새로고침 필요" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left px-3 py-2 font-medium text-gray-600">
              연령대
            </th>
            {topTreatments.map((treatment) => (
              <th
                key={treatment}
                className="text-center px-3 py-2 font-medium text-gray-600"
              >
                {treatment}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ageBracket} className="border-b last:border-b-0">
              <td className="px-3 py-2 font-medium text-gray-700">
                {row.ageBracket}
              </td>
              {topTreatments.map((treatment) => {
                const count = row.treatments[treatment] || 0;
                const isMax = count > 0 && count === maxCount;
                return (
                  <td
                    key={treatment}
                    className={`text-center px-3 py-2 ${
                      isMax
                        ? 'bg-orange-100 text-orange-800 font-bold'
                        : count > 0
                          ? 'text-gray-700'
                          : 'text-gray-300'
                    }`}
                  >
                    {count > 0 ? count : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

const MonthlyReportDemographics: React.FC<MonthlyReportDemographicsProps> = ({
  stats,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      {/* 헤더 */}
      <div className="p-6 border-b bg-cyan-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-600" />
          환자 인구통계 분석
        </h2>
      </div>

      <div className="p-6 space-y-8">
        {/* Row 1: 연령 분포 */}
        <div>
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-500 rounded-full" />
            연령 분포
            {(stats.ageUnknownCount ?? 0) > 0 && (
              <span className="text-xs font-normal text-gray-400">
                (미입력 {stats.ageUnknownCount}명 제외)
              </span>
            )}
          </h3>
          <AgeDistributionChart data={stats.ageDistribution || []} />
        </div>

        {/* Row 2: 지역 분포 + 교차분석 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 지역 분포 */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              지역 분포 (Top 5)
            </h3>
            <RegionDistribution stats={stats} />
          </div>

          {/* 연령대별 관심 치료 교차분석 */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full" />
              연령대별 관심 치료
              {(stats.ageUnknownCount ?? 0) > 0 && (
                <span className="text-xs font-normal text-gray-400">
                  (미입력 {stats.ageUnknownCount}명 제외)
                </span>
              )}
            </h3>
            {stats.demographicCrossAnalysis &&
            stats.demographicCrossAnalysis.length > 0 ? (
              <CrossAnalysisTable
                crossData={stats.demographicCrossAnalysis}
              />
            ) : (
              <NoDataPlaceholder message="데이터 새로고침 필요" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportDemographics;
