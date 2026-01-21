// src/app/v2/reports/components/DailyReport-SummaryCards.tsx
// 일별 리포트 요약 카드 컴포넌트
'use client';

import React from 'react';

interface DailyReportSummary {
  total: number;
  agreed: number;
  disagreed: number;
  pending: number;
  expectedRevenue: number;
  actualRevenue: number;
  totalDiscount: number;
  avgDiscountRate: number;
}

interface DailyReportSummaryCardsProps {
  summary: DailyReportSummary;
}

export function DailyReportSummaryCards({ summary }: DailyReportSummaryCardsProps) {
  const conversionRate = summary.total > 0
    ? Math.round((summary.agreed / summary.total) * 100)
    : 0;

  return (
    <div className="grid grid-cols-4 gap-4">
      {/* 총 상담 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-1">총 상담</div>
        <div className="text-3xl font-bold text-gray-900">{summary.total}건</div>
        <div className="text-sm text-gray-500 mt-1">전환율 {conversionRate}%</div>
      </div>

      {/* 상담 결과 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-2">상담 결과</div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            동의 {summary.agreed}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            미동의 {summary.disagreed}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            보류 {summary.pending}
          </span>
        </div>
        {/* 진행률 바 */}
        <div className="flex h-2 rounded-full overflow-hidden mt-3 bg-gray-100">
          {summary.total > 0 && (
            <>
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${(summary.agreed / summary.total) * 100}%` }}
              />
              <div
                className="bg-rose-500 transition-all"
                style={{ width: `${(summary.disagreed / summary.total) * 100}%` }}
              />
              <div
                className="bg-amber-500 transition-all"
                style={{ width: `${(summary.pending / summary.total) * 100}%` }}
              />
            </>
          )}
        </div>
      </div>

      {/* 예상 매출 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-1">예상 매출</div>
        <div className="text-3xl font-bold text-blue-600">
          {summary.actualRevenue.toLocaleString()}만원
        </div>
        <div className="text-sm text-gray-500 mt-1">
          정가 {summary.expectedRevenue.toLocaleString()}만원
        </div>
      </div>

      {/* 할인 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-1">할인</div>
        <div className="text-3xl font-bold text-rose-500">
          -{summary.totalDiscount.toLocaleString()}만원
        </div>
        <div className="text-sm text-gray-500 mt-1">
          평균 {summary.avgDiscountRate}% 할인
        </div>
      </div>
    </div>
  );
}
