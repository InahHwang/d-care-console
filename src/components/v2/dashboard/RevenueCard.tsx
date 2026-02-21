// src/components/v2/dashboard/RevenueCard.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { Card } from '@/components/v2/ui/Card';

interface RevenueCardProps {
  thisMonth: {
    confirmed: number;
    missed: number;
    missedCount: number;
    patientCount: number;
    paidCount: number;
  };
  lastMonth: {
    confirmed: number;
  };
  discountRate: number;
  avgRevenue: number;
  growthRate: number;
  monthlyTarget: number;
  loading?: boolean;
  onViewDetail?: () => void;
}

function formatCurrency(amount: number): string {
  if (amount >= 100000000) {
    // 소수점 2자리까지 표시 후 불필요한 0 제거 (1.25억, 1.5억, 2억)
    const value = parseFloat((amount / 100000000).toFixed(2));
    return `${value}억`;
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
  monthlyTarget,
  loading,
  onViewDetail,
}: RevenueCardProps) {
  if (loading) {
    return <Skeleton />;
  }

  const router = useRouter();
  const isGrowthPositive = growthRate >= 0;
  const achievementRate = monthlyTarget > 0 ? Math.min(Math.round((thisMonth.confirmed / monthlyTarget) * 100), 999) : 0;

  // 영업일 기준 계산 (일요일 제외)
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  let remainingBusinessDays = 0;
  let elapsedBusinessDays = 0;
  let totalBusinessDays = 0;

  for (let day = 1; day <= lastDay; day++) {
    if (new Date(year, month, day).getDay() !== 0) { // 일요일 제외
      totalBusinessDays++;
      if (day < today.getDate()) elapsedBusinessDays++;
      if (day >= today.getDate()) remainingBusinessDays++;
    }
  }

  const remainingAmount = monthlyTarget - thisMonth.confirmed;
  const dailyRequired = remainingAmount > 0 && remainingBusinessDays > 0
    ? Math.round(remainingAmount / remainingBusinessDays) : 0;

  // 페이스 판단: 영업일 진행률 vs 매출 진행률
  const dayProgressRate = totalBusinessDays > 0 ? elapsedBusinessDays / totalBusinessDays : 0;
  const revenueProgressRate = monthlyTarget > 0 ? thisMonth.confirmed / monthlyTarget : 0;
  const paceRatio = dayProgressRate > 0 ? revenueProgressRate / dayProgressRate : 1;

  const paceStatus: 'ahead' | 'onTrack' | 'behind' =
    achievementRate >= 100 ? 'ahead' :
    paceRatio >= 1 ? 'ahead' :
    paceRatio >= 0.7 ? 'onTrack' : 'behind';

  const paceConfig = {
    ahead:   { label: '순항',     color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
    onTrack: { label: '주의',     color: 'text-amber-600',   bg: 'bg-amber-50',   dot: 'bg-amber-500' },
    behind:  { label: '분발필요', color: 'text-red-600',     bg: 'bg-red-50',     dot: 'bg-red-500' },
  };
  const pace = paceConfig[paceStatus];

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

      {/* 확정 매출 */}
      <div className="mb-4">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-gray-900">
            {formatCurrency(thisMonth.confirmed)}원
          </span>
          <div className={`flex items-center gap-1 text-sm pb-0.5 ${
            isGrowthPositive ? 'text-emerald-500' : 'text-red-500'
          }`}>
            {isGrowthPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{isGrowthPositive ? '+' : ''}{growthRate}%</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          전월 {formatCurrency(lastMonth.confirmed)}원
        </p>
      </div>

      {/* 놓친 매출 */}
      {thisMonth.missed > 0 && (
        <div
          onClick={() => router.push('/v2/patients?period=thisMonth&paymentStatus=none&hasEstimate=true')}
          className="mb-4 bg-red-50 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-red-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-red-600">
              놓친 매출 {formatCurrency(thisMonth.missed)}원
            </span>
            <span className="text-xs text-red-400 flex items-center gap-1">
              미결제 {thisMonth.missedCount}명 <ArrowRight size={12} />
            </span>
          </div>
        </div>
      )}

      {/* 목표 달성 */}
      {monthlyTarget > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">
              목표 {formatCurrency(monthlyTarget)}원 <span className={`font-medium ${
                achievementRate >= 100 ? 'text-emerald-600' :
                achievementRate >= 70 ? 'text-blue-600' :
                achievementRate >= 40 ? 'text-amber-600' : 'text-red-500'
              }`}>(달성률 {achievementRate}%)</span>
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${pace.bg} ${pace.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pace.dot}`} />
              {pace.label}
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                achievementRate >= 100 ? 'bg-emerald-500' :
                achievementRate >= 70 ? 'bg-blue-500' :
                achievementRate >= 40 ? 'bg-amber-500' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(achievementRate, 100)}%` }}
            />
          </div>
          {achievementRate < 100 && dailyRequired > 0 && (
            <p className={`text-xs mt-1.5 ${pace.color}`}>
              잔여 {remainingBusinessDays}일 · 일 <span className="font-bold">{formatCurrency(dailyRequired)}원</span> 필요
            </p>
          )}
        </div>
      )}

      {/* 하단 지표 */}
      <div className="flex items-center justify-around pt-3 border-t text-center">
        <div>
          <p className="text-xs text-gray-400">할인율</p>
          <p className={`text-sm font-semibold ${
            discountRate <= 10 ? 'text-emerald-600' :
            discountRate <= 30 ? 'text-amber-600' : 'text-red-500'
          }`}>
            {discountRate}%
          </p>
        </div>
        <div className="w-px h-6 bg-gray-200" />
        <div>
          <p className="text-xs text-gray-400">객단가</p>
          <p className="text-sm font-semibold text-gray-700">
            {formatCurrency(avgRevenue)}원
          </p>
        </div>
      </div>

    </Card>
  );
}

export default RevenueCard;
