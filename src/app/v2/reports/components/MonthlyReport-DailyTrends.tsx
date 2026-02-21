// src/app/v2/reports/components/MonthlyReport-DailyTrends.tsx
// V2 일별 추이 - 바 차트 + 관심분야별 + 미동의 사유
'use client';

import React from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import type { MonthlyStatsV2 } from './MonthlyReport-Types';

interface MonthlyReportDailyTrendsProps {
  stats: MonthlyStatsV2;
}

const MonthlyReportDailyTrends: React.FC<MonthlyReportDailyTrendsProps> = ({ stats }) => {
  const { dailyTrends, interestBreakdown, disagreeReasons } = stats;

  // 일별 추이 최대값 (스케일링용)
  const maxCalls = Math.max(...dailyTrends.map(d => d.calls), 1);

  return (
    <div className="space-y-6">
      {/* 일별 추이 */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-6 border-b bg-slate-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-600" />
            일별 추이
          </h2>
        </div>
        <div className="p-6">
          {dailyTrends.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 min-w-[600px]" style={{ height: 200 }}>
                {dailyTrends.map((day) => {
                  const height = Math.max((day.calls / maxCalls) * 160, 4);
                  const dayNum = day.date.split('-')[2] || day.date;
                  return (
                    <div key={day.date} className="flex flex-col items-center flex-1 min-w-[20px]">
                      <div className="text-xs text-gray-500 mb-1">{day.calls}</div>
                      <div
                        className="w-full bg-blue-400 rounded-t hover:bg-blue-600 transition-colors"
                        style={{ height }}
                        title={`${day.date}: 통화 ${day.calls}건, 신규 ${day.newPatients}명, 동의 ${day.agreed}명`}
                      />
                      <div className="text-xs text-gray-400 mt-1">{dayNum}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-blue-400 rounded" /> 일별 통화 건수
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center">일별 데이터 없음</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 관심분야별 통계 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-slate-600" />
              관심분야별 통계
            </h3>
          </div>
          <div className="p-4">
            {interestBreakdown.length > 0 ? (
              <div className="space-y-3">
                {interestBreakdown.map((item) => (
                  <div key={item.interest} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{item.interest}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{item.count}건</span>
                      <span className="text-green-600 font-medium">동의 {item.agreed}건</span>
                      <span className="text-blue-600 font-medium">
                        {item.revenue > 0 ? `${(item.revenue / 10000).toFixed(0)}만원` : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center">데이터 없음</p>
            )}
          </div>
        </div>

        {/* 미동의 사유 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-600" />
              미동의 사유 분석
            </h3>
          </div>
          <div className="p-4">
            {disagreeReasons.length > 0 ? (
              <div className="space-y-3">
                {disagreeReasons.map((reason) => (
                  <div key={reason.reason} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{reason.reason}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-400 h-2 rounded-full"
                          style={{ width: `${Math.min(reason.percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-12 text-right">
                        {reason.percentage.toFixed(0)}%
                      </span>
                      <span className="text-xs text-gray-500 w-8">({reason.count}건)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center">데이터 없음</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportDailyTrends;
