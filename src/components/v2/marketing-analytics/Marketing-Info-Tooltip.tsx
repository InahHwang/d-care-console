// src/components/v2/marketing-analytics/Marketing-Info-Tooltip.tsx
// 마케팅 지표 설명 툴팁 — 라벨 옆 (?) 아이콘에 마우스 오버 시 표시

'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';

interface Props {
  text: string;
  className?: string;
  position?: 'top' | 'bottom' | 'right';
}

export function MarketingInfoTooltip({ text, className = '', position = 'top' }: Props) {
  const positionClass =
    position === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : position === 'bottom'
      ? 'top-full left-1/2 -translate-x-1/2 mt-2'
      : 'left-full top-1/2 -translate-y-1/2 ml-2';

  return (
    <span className={`relative inline-flex group ${className}`}>
      <HelpCircle
        size={12}
        className="text-gray-400 hover:text-gray-600 cursor-help"
      />
      <span
        role="tooltip"
        className={`absolute ${positionClass} z-50 hidden group-hover:block whitespace-pre-line w-56 bg-gray-900 text-white text-xs leading-relaxed rounded-lg px-3 py-2 shadow-lg pointer-events-none`}
      >
        {text}
      </span>
    </span>
  );
}

// 지표 설명 사전 (SSoT)
export const MARKETING_METRIC_DESCRIPTIONS = {
  totalCost: '이번 달 집행한 광고비 총합.\n채널별 비용을 모두 더한 값입니다.',
  totalRevenue:
    '수납 매출 = 환자가 실제로 결제한 금액의 합.\n신환 등록월 기준으로 집계됩니다.\n견적은 상담 시 합의된 치료비 합계입니다.',
  roas:
    'ROAS (Return on Ad Spend)\n= 매출 ÷ 광고비 × 100%\n\n광고비 1만원 쓸 때 매출이 얼마나 나오는지를\n나타내는 광고 효율 지표입니다.\n\n예: ROAS 500% = 광고비 1만원당 매출 5만원',
  newPatients:
    '이번 달 신규 등록된 환자 수.\n환자 등록 시점 기준으로 집계됩니다.',
  cac:
    'CAC (Customer Acquisition Cost)\n= 광고비 ÷ 신환 수\n\n환자 1명을 데려오는 데 든 광고비.\n낮을수록 좋습니다.\n\n예: 광고비 80만원, 신환 12명\n→ CAC 약 6.7만원/명',
  estimatedRevenue:
    '견적 매출 = 상담에서 합의된 치료비 총합.\n실제 수납이 일어나지 않아도 집계되어\n빠르게 ROAS를 판단할 수 있습니다.',
  actualRevenue:
    '수납 매출 = 환자가 실제로 결제한 금액.\n분할 결제 중인 경우 누적 금액 기준.',
  channel:
    '환자 등록 시 입력하는 "유입경로"와\n광고비 입력 시 "채널"이 동일하면\n자동으로 매칭되어 ROAS가 계산됩니다.',
  funnel:
    '유입(신환 수) → 상담(견적 발행) → 치료(수납 발생)\n각 단계의 환자 수와 비율을 보여줍니다.',
  avgDeal:
    '평균 객단가 = 수납 매출 ÷ 신환 수.\n환자 1명이 평균적으로 결제하는 금액.',
} as const;

export type MarketingMetricKey = keyof typeof MARKETING_METRIC_DESCRIPTIONS;
