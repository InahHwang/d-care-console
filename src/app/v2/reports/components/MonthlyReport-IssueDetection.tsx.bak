// src/app/v2/reports/components/MonthlyReport-IssueDetection.tsx
// V2 이슈 및 개선사항 - 전월 대비 자동 감지
'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { MonthlyStatsV2 } from './MonthlyReport-Types';

interface MonthlyReportIssueDetectionProps {
  stats: MonthlyStatsV2;
}

const MonthlyReportIssueDetection: React.FC<MonthlyReportIssueDetectionProps> = ({ stats }) => {
  const { changes } = stats;

  // 주요 이슈 (감소 항목)
  const issues: string[] = [];

  if (changes.totalInquiries.type === 'decrease') {
    let detail = `신규 문의 총 ${changes.totalInquiries.value}건 감소`;
    const parts: string[] = [];
    if (changes.inbound.type === 'decrease') parts.push(`인바운드 -${changes.inbound.value}건`);
    else if (changes.inbound.value > 0) parts.push(`인바운드 +${changes.inbound.value}건`);
    if (changes.outbound.type === 'decrease') parts.push(`아웃바운드 -${changes.outbound.value}건`);
    else if (changes.outbound.value > 0) parts.push(`아웃바운드 +${changes.outbound.value}건`);
    if (parts.length > 0) detail += ` (${parts.join(', ')})`;
    issues.push(detail);
  }

  if (changes.reservedPatients.type === 'decrease' || changes.reservedRate.type === 'decrease') {
    const parts: string[] = [];
    if (changes.reservedPatients.type === 'decrease') parts.push(`예약환자수 ${changes.reservedPatients.value}명 감소`);
    if (changes.reservedRate.type === 'decrease') parts.push(`예약전환율 ${changes.reservedRate.value}%p 하락`);
    issues.push(`예약 성과 저하: ${parts.join(', ')}`);
  }

  if (changes.visitedPatients.type === 'decrease' || changes.visitedRate.type === 'decrease') {
    const parts: string[] = [];
    if (changes.visitedPatients.type === 'decrease') parts.push(`내원환자수 ${changes.visitedPatients.value}명 감소`);
    if (changes.visitedRate.type === 'decrease') parts.push(`내원전환율 ${changes.visitedRate.value}%p 하락`);
    issues.push(`내원 성과 저하: ${parts.join(', ')}`);
  }

  if (changes.agreedPatients.type === 'decrease' || changes.agreedRate.type === 'decrease' || changes.agreedRevenue.type === 'decrease') {
    const parts: string[] = [];
    if (changes.agreedRevenue.type === 'decrease') parts.push(`총 결제금액 ${(changes.agreedRevenue.value / 10000).toFixed(0)}만원 감소`);
    if (changes.agreedPatients.type === 'decrease') parts.push(`결제환자수 ${changes.agreedPatients.value}명 감소`);
    if (changes.agreedRate.type === 'decrease') parts.push(`결제전환율 ${changes.agreedRate.value}%p 하락`);
    issues.push(`매출 성과 저하: ${parts.join(', ')}`);
  }

  // 긍정적 변화 (증가 항목)
  const positives: string[] = [];

  if (changes.totalInquiries.type === 'increase' && changes.totalInquiries.value >= 1) {
    let detail = `신규 문의 총 ${changes.totalInquiries.value}건 증가`;
    const parts: string[] = [];
    if (changes.inbound.type === 'increase' && changes.inbound.value > 0) parts.push(`인바운드 +${changes.inbound.value}건`);
    if (changes.outbound.type === 'increase' && changes.outbound.value > 0) parts.push(`아웃바운드 +${changes.outbound.value}건`);
    if (parts.length > 0) detail += ` (${parts.join(', ')})`;
    positives.push(detail);
  }

  if (
    (changes.reservedPatients.type === 'increase' && changes.reservedPatients.value > 0) ||
    (changes.reservedRate.type === 'increase' && changes.reservedRate.value > 0)
  ) {
    const parts: string[] = [];
    if (changes.reservedPatients.type === 'increase' && changes.reservedPatients.value > 0) parts.push(`예약환자수 ${changes.reservedPatients.value}명 증가`);
    if (changes.reservedRate.type === 'increase' && changes.reservedRate.value > 0) parts.push(`예약전환율 ${changes.reservedRate.value}%p 개선`);
    positives.push(`예약 성과 개선: ${parts.join(', ')}`);
  }

  if (
    (changes.visitedPatients.type === 'increase' && changes.visitedPatients.value > 0) ||
    (changes.visitedRate.type === 'increase' && changes.visitedRate.value > 0)
  ) {
    const parts: string[] = [];
    if (changes.visitedPatients.type === 'increase' && changes.visitedPatients.value > 0) parts.push(`내원환자수 ${changes.visitedPatients.value}명 증가`);
    if (changes.visitedRate.type === 'increase' && changes.visitedRate.value > 0) parts.push(`내원전환율 ${changes.visitedRate.value}%p 개선`);
    positives.push(`내원 성과 개선: ${parts.join(', ')}`);
  }

  if (
    (changes.agreedPatients.type === 'increase' && changes.agreedPatients.value > 0) ||
    (changes.agreedRate.type === 'increase' && changes.agreedRate.value > 0) ||
    (changes.agreedRevenue.type === 'increase' && changes.agreedRevenue.value > 0)
  ) {
    const parts: string[] = [];
    if (changes.agreedRevenue.type === 'increase' && changes.agreedRevenue.value > 0) parts.push(`총 결제금액 ${(changes.agreedRevenue.value / 10000).toFixed(0)}만원 증가`);
    if (changes.agreedPatients.type === 'increase' && changes.agreedPatients.value > 0) parts.push(`결제환자수 ${changes.agreedPatients.value}명 증가`);
    if (changes.agreedRate.type === 'increase' && changes.agreedRate.value > 0) parts.push(`결제전환율 ${changes.agreedRate.value}%p 개선`);
    positives.push(`매출 성과 개선: ${parts.join(', ')}`);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-6 border-b bg-yellow-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-yellow-600" />
          이슈 및 개선사항
        </h2>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {/* 주요 이슈 */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-medium text-red-800 mb-2 flex items-center gap-2">
              주요 이슈 <span className="text-xs bg-red-100 px-2 py-1 rounded">(자동 감지)</span>
            </h3>
            <ul className="text-sm text-red-700 space-y-1">
              {issues.length > 0 ? (
                issues.map((issue, i) => <li key={i}>· {issue}</li>)
              ) : (
                <li>· 전월 대비 감소한 주요 지표가 없습니다.</li>
              )}
            </ul>
          </div>

          {/* 긍정적 변화 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
              긍정적 변화 <span className="text-xs bg-green-100 px-2 py-1 rounded">(자동 감지)</span>
            </h3>
            <ul className="text-sm text-green-700 space-y-1">
              {positives.length > 0 ? (
                positives.map((p, i) => <li key={i}>· {p}</li>)
              ) : (
                <li>· 전월 대비 증가한 지표가 없습니다.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportIssueDetection;
