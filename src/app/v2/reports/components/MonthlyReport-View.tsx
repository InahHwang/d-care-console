// src/app/v2/reports/components/MonthlyReport-View.tsx
// 월별 리포트 뷰 컴포넌트
'use client';

import React from 'react';
import { Phone, Users, DollarSign, TrendingUp } from 'lucide-react';
import { MonthlyReportData } from './types';

interface MonthlyReportViewProps {
  data: MonthlyReportData;
}

export function MonthlyReportView({ data }: MonthlyReportViewProps) {
  const { stats } = data;

  return (
    <div className="space-y-4">
      {/* 주요 지표 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Phone size={18} />
            <span className="text-sm">총 통화</span>
          </div>
          <div className="text-2xl font-bold">{stats.totalCalls}건</div>
          <div className="text-xs text-gray-400 mt-1">
            연결 {stats.connectedCalls} / 부재 {stats.missedCalls}
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Users size={18} />
            <span className="text-sm">신규 환자</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.newPatients}명</div>
          <div className="text-xs text-blue-500 mt-1">
            전환율 {stats.conversionRate}%
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <DollarSign size={18} />
            <span className="text-sm">실제 매출</span>
          </div>
          <div className="text-2xl font-bold text-green-700">
            {stats.actualRevenue.toLocaleString()}만원
          </div>
          <div className="text-xs text-green-500 mt-1">
            평균 {stats.avgDealSize.toLocaleString()}만원
          </div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <TrendingUp size={18} />
            <span className="text-sm">동의율</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">{stats.agreementRate}%</div>
          <div className="text-xs text-purple-500 mt-1">
            {stats.agreed}/{stats.totalConsultations}건
          </div>
        </div>
      </div>

      {/* 퍼널 현황 */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="font-medium mb-4">퍼널 현황</h3>
        <div className="flex items-center gap-2">
          {Object.entries(stats.funnel).map(([stage, count], index, arr) => (
            <React.Fragment key={stage}>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-gray-700">{count}</div>
                <div className="text-xs text-gray-500">
                  {stage === 'consulting' && '전화상담'}
                  {stage === 'reserved' && '내원예약'}
                  {stage === 'visited' && '내원완료'}
                  {stage === 'treatment' && '치료중'}
                  {stage === 'completed' && '치료완료'}
                  {stage === 'followup' && '사후관리'}
                </div>
              </div>
              {index < arr.length - 1 && <div className="text-gray-300">→</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 관심분야별 & 미동의 사유 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 관심분야별 */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-medium mb-4">관심분야별 현황</h3>
          <div className="space-y-3">
            {stats.interestBreakdown.slice(0, 5).map((item) => (
              <div key={item.interest} className="flex items-center justify-between">
                <span className="text-gray-700">{item.interest}</span>
                <div className="text-right">
                  <span className="font-medium">{item.count}건</span>
                  <span className="text-sm text-gray-400 ml-2">
                    ({item.revenue.toLocaleString()}만원)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 미동의 사유 */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-medium mb-4">미동의 사유 분석</h3>
          <div className="space-y-3">
            {stats.disagreeReasons.slice(0, 5).map((item) => (
              <div key={item.reason} className="flex items-center justify-between">
                <span className="text-gray-700">{item.reason}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-12 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
            {stats.disagreeReasons.length === 0 && (
              <div className="text-gray-400 text-center py-4">데이터 없음</div>
            )}
          </div>
        </div>
      </div>

      {/* 일별 추이 (간단 차트) */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="font-medium mb-4">일별 추이</h3>
        <div className="h-48 flex items-end gap-1">
          {stats.dailyTrends.map((day) => {
            const maxCalls = Math.max(...stats.dailyTrends.map((d) => d.calls), 1);
            const height = (day.calls / maxCalls) * 100;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center"
                title={`${day.date}: ${day.calls}건`}
              >
                <div
                  className="w-full bg-blue-400 rounded-t hover:bg-blue-500 transition-colors"
                  style={{ height: `${height}%`, minHeight: day.calls > 0 ? '4px' : '0' }}
                />
                <span className="text-[10px] text-gray-400 mt-1">
                  {day.date.split('-')[2]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
