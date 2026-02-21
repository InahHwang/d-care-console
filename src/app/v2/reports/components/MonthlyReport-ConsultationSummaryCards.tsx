// src/app/v2/reports/components/MonthlyReport-ConsultationSummaryCards.tsx
// V2 상담 실적 요약 - 총 문의수 + 3 KPI 카드 + 전월 대비
'use client';

import React from 'react';
import { MessageSquare, Phone, PhoneCall, Users, TrendingUp, CreditCard } from 'lucide-react';
import type { MonthlyStatsV2, ChangeIndicator } from './MonthlyReport-Types';

interface MonthlyReportConsultationSummaryCardsProps {
  stats: MonthlyStatsV2;
}

function ChangeIndicatorBadge({ change, unit = '건', formatValue }: {
  change: ChangeIndicator;
  unit?: string;
  formatValue?: (v: number) => string;
}) {
  const isIncrease = change.type === 'increase';
  const displayValue = formatValue ? formatValue(change.value) : `${change.value}${unit}`;
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${
      isIncrease ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {isIncrease ? '+' : '-'}{displayValue}
    </span>
  );
}

function ChangeIndicatorInline({ change, unit = '%p' }: {
  change: ChangeIndicator;
  unit?: string;
}) {
  const isIncrease = change.type === 'increase';
  return (
    <span className={`ml-1 ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
      ({isIncrease ? '+' : '-'}{change.value}{unit})
    </span>
  );
}

const MonthlyReportConsultationSummaryCards: React.FC<MonthlyReportConsultationSummaryCardsProps> = ({
  stats,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-6 border-b bg-blue-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          상담 실적 요약
        </h2>
      </div>
      <div className="p-6">
        {/* 신규 문의 */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              이번달 총 신규문의 - {stats.totalInquiries}건
            </h3>
            <ChangeIndicatorBadge change={stats.changes.totalInquiries} unit="건" />
          </div>
          <div className="flex gap-6 text-sm text-gray-600 ml-4">
            <span className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-green-600" />
              인바운드 {stats.inquiryBreakdown.inbound}건
            </span>
            <span className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-blue-600" />
              아웃바운드 {stats.inquiryBreakdown.outbound}건
            </span>
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              구신환 {stats.inquiryBreakdown.returning}건
            </span>
          </div>
        </div>

        {/* KPI 카드 3개 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 예약 환자수 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">예약 환자수</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-2xl font-bold text-green-900">{stats.reservedPatients}명</div>
              <ChangeIndicatorBadge change={stats.changes.reservedPatients} unit="명" />
            </div>
            <div className="text-sm text-green-700">
              예약전환율 {stats.reservedRate}%
              <ChangeIndicatorInline change={stats.changes.reservedRate} />
            </div>
          </div>

          {/* 내원 환자수 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">내원 환자수</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-2xl font-bold text-blue-900">{stats.visitedPatients}명</div>
              <ChangeIndicatorBadge change={stats.changes.visitedPatients} unit="명" />
            </div>
            <div className="text-sm text-blue-700">
              내원전환율 {stats.visitedRate}%
              <ChangeIndicatorInline change={stats.changes.visitedRate} />
            </div>
          </div>

          {/* 총 결제금액 */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-800">총 결제금액</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-2xl font-bold text-purple-900">
                {stats.agreedRevenue.toLocaleString()}원
              </div>
              <ChangeIndicatorBadge
                change={stats.changes.agreedRevenue}
                formatValue={(v) => `${(v / 10000).toFixed(0)}만원`}
              />
            </div>
            <div className="text-sm text-purple-700 space-y-1">
              <div className="flex items-center gap-2">
                결제환자수 {stats.agreedPatients}명
                <span className={`text-xs px-1 py-0.5 rounded ${
                  stats.changes.agreedPatients.type === 'increase'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {stats.changes.agreedPatients.type === 'increase' ? '+' : '-'}{stats.changes.agreedPatients.value}명
                </span>
              </div>
              <div className="flex items-center gap-2">
                결제전환율 {stats.agreedRate}%
                <ChangeIndicatorInline change={stats.changes.agreedRate} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportConsultationSummaryCards;
