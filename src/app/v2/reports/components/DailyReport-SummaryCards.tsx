// src/app/v2/reports/components/DailyReport-SummaryCards.tsx
// 일별 리포트 요약 카드 컴포넌트
'use client';

import React from 'react';

interface DailyReportSummary {
  total: number;
  agreed: number;
  disagreed: number;
  pending: number;
  noAnswer?: number;
  noConsultation?: number;
  closed?: number;
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
          {(summary.noAnswer ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-slate-500"></span>
              부재중 {summary.noAnswer}
            </span>
          )}
          {(summary.noConsultation ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-400"></span>
              미입력 {summary.noConsultation}
            </span>
          )}
          {(summary.closed ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-500"></span>
              종결 {summary.closed}
            </span>
          )}
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
              <div
                className="bg-slate-500 transition-all"
                style={{ width: `${((summary.noAnswer ?? 0) / summary.total) * 100}%` }}
              />
              <div
                className="bg-gray-400 transition-all"
                style={{ width: `${((summary.noConsultation ?? 0) / summary.total) * 100}%` }}
              />
              <div
                className="bg-gray-500 transition-all"
                style={{ width: `${((summary.closed ?? 0) / summary.total) * 100}%` }}
              />
            </>
          )}
        </div>
      </div>

      {/* 확정 매출 (동의 환자 - 강조) */}
      <div className="bg-blue-50 rounded-xl border-2 border-blue-300 p-4">
        <div className="text-sm text-blue-600 font-medium mb-1">확정 매출</div>
        <div className="text-3xl font-bold text-blue-700">
          {summary.actualRevenue.toLocaleString()}만원
        </div>
        <div className="text-sm text-blue-500 mt-1">
          동의 {summary.agreed}건 기준
        </div>
      </div>

      {/* 전체 매출 현황 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-2">전체 매출 현황</div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">정가 합계</span>
            <span className="font-medium text-gray-900">{summary.expectedRevenue.toLocaleString()}만원</span>
          </div>
          {summary.totalDiscount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">할인</span>
              <span className="font-medium text-rose-500">
                -{summary.totalDiscount.toLocaleString()}만원
                {summary.avgDiscountRate > 0 && ` (${summary.avgDiscountRate}%)`}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-1.5">
            <span className="text-gray-700 font-medium">할인가 합계</span>
            <span className="font-bold text-gray-900">
              {(summary.expectedRevenue - summary.totalDiscount).toLocaleString()}만원
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
