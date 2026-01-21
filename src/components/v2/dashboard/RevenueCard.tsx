// src/components/v2/dashboard/RevenueCard.tsx
'use client';

import React from 'react';
import { Wallet, TrendingUp, TrendingDown, Users, ArrowRight } from 'lucide-react';
import { Card } from '@/components/v2/ui/Card';

interface RevenueCardProps {
  thisMonth: {
    actual: number;
    estimated: number;
    patientCount: number;
    paidCount: number;
  };
  lastMonth: {
    actual: number;
  };
  discountRate: number;
  avgRevenue: number;
  growthRate: number;
  loading?: boolean;
  onViewDetail?: () => void;
}

function formatCurrency(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString()}만`;
  }
  return `${amount.toLocaleString()}`;
}

function Skeleton() {
  return (
    <Card className="p-5">
      <div className="animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-5 w-24 bg-gray-200 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-8 w-24 bg-gray-200 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-8 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function RevenueCard({
  thisMonth,
  lastMonth,
  discountRate,
  avgRevenue,
  growthRate,
  loading,
  onViewDetail,
}: RevenueCardProps) {
  if (loading) {
    return <Skeleton />;
  }

  const isGrowthPositive = growthRate >= 0;

  return (
    <Card className="p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet size={20} className="text-emerald-500" />
          <h3 className="font-bold text-gray-900">이번 달 매출</h3>
        </div>
        {onViewDetail && (
          <button
            onClick={onViewDetail}
            className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            상세보기 <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* 메인 매출 */}
      <div className="mb-4">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-gray-900">
            {formatCurrency(thisMonth.actual)}원
          </span>
          <div className={`flex items-center gap-1 text-sm ${
            isGrowthPositive ? 'text-emerald-500' : 'text-red-500'
          }`}>
            {isGrowthPositive ? (
              <TrendingUp size={16} />
            ) : (
              <TrendingDown size={16} />
            )}
            <span>{isGrowthPositive ? '+' : ''}{growthRate}%</span>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          지난 달: {formatCurrency(lastMonth.actual)}원
        </p>
      </div>

      {/* 상세 지표 */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t">
        {/* 예상 매출 */}
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">예상 매출</p>
          <p className="text-sm font-semibold text-gray-700">
            {formatCurrency(thisMonth.estimated)}원
          </p>
        </div>

        {/* 평균 할인율 */}
        <div className="text-center border-x">
          <p className="text-xs text-gray-400 mb-1">평균 할인율</p>
          <p className={`text-sm font-semibold ${
            discountRate <= 10 ? 'text-emerald-600' :
            discountRate <= 30 ? 'text-amber-600' : 'text-red-500'
          }`}>
            {discountRate}%
          </p>
        </div>

        {/* 평균 객단가 */}
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">평균 객단가</p>
          <p className="text-sm font-semibold text-gray-700">
            {formatCurrency(avgRevenue)}원
          </p>
        </div>
      </div>

      {/* 환자 수 */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t bg-gray-50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users size={16} className="text-gray-400" />
          <span>이번 달 환자 <strong className="text-gray-900">{thisMonth.patientCount}명</strong></span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="text-sm text-gray-600">
          결제 완료 <strong className="text-emerald-600">{thisMonth.paidCount}명</strong>
        </div>
      </div>
    </Card>
  );
}

export default RevenueCard;
