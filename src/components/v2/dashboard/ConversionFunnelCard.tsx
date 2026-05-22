// src/components/v2/dashboard/ConversionFunnelCard.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, CalendarCheck, Building2, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { JourneyPatientsModal } from './JourneyPatientsModal';

interface BreakdownItem {
  count: number;
  reserved: number;
  visited: number;
  paid: number;
  revenue: number;
}

interface ConversionRates {
  newInquiries: {
    count: number;
    trend: number;
  };
  reservationRate: {
    value: number;
    trend: number;
    count: number;
  };
  visitRate: {
    value: number;
    trend: number;
    count: number;
  };
  paymentRate: {
    value: number;
    trend: number;
    count: number;
  };
  breakdown?: {
    newPatient: BreakdownItem;
    returningPatient: BreakdownItem;
  };
}

interface ConversionFunnelCardProps {
  data: ConversionRates | null;
  loading?: boolean;
  year?: number;
  month?: number; // 1-12
}

function TrendBadge({ value, type }: { value: number; type: 'count' | 'percent' }) {
  const isPositive = value >= 0;
  const absValue = Math.abs(value);

  if (absValue === 0) {
    return (
      <span className="text-xs text-gray-400">
        전월 동일
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 text-xs font-medium ${
      isPositive ? 'text-emerald-600' : 'text-red-500'
    }`}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span>
        {isPositive ? '+' : ''}{absValue}{type === 'percent' ? '%p' : '건'}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="animate-pulse">
        <div className="h-5 w-32 bg-gray-200 rounded mb-6" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-8 w-20 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ConversionFunnelCard({ data, loading, year, month }: ConversionFunnelCardProps) {
  if (loading) {
    return <LoadingSkeleton />;
  }

  const today = new Date();
  const displayYear = year ?? today.getFullYear();
  const displayMonth = month ?? today.getMonth() + 1;
  const monthStr = `${displayYear}년 ${displayMonth}월`;

  const router = useRouter();
  const [modalType, setModalType] = useState<'new' | 'returning' | null>(null);

  const cards = [
    {
      id: 'new',
      label: '신규 문의',
      icon: Users,
      value: data?.newInquiries.count ?? 0,
      unit: '명',
      subLabel: `전월 대비`,
      trend: data?.newInquiries.trend ?? 0,
      trendType: 'count' as const,
      bgColor: 'bg-orange-50',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      valueColor: 'text-orange-700',
      href: '/v2/patients?period=thisMonth',
    },
    {
      id: 'reservation',
      label: '예약 전환율',
      icon: CalendarCheck,
      value: data?.reservationRate.value ?? 0,
      unit: '%',
      subLabel: `${data?.reservationRate.count ?? 0}명 전환`,
      trend: data?.reservationRate.trend ?? 0,
      trendType: 'percent' as const,
      bgColor: 'bg-purple-50',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      valueColor: 'text-purple-700',
      href: '/v2/patients?period=thisMonth&status=reserved,visited,treatmentBooked,treatment,completed,followup',
    },
    {
      id: 'visit',
      label: '내원 전환율',
      icon: Building2,
      value: data?.visitRate.value ?? 0,
      unit: '%',
      subLabel: `${data?.visitRate.count ?? 0}명 내원`,
      trend: data?.visitRate.trend ?? 0,
      trendType: 'percent' as const,
      bgColor: 'bg-amber-50',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700',
      href: '/v2/patients?period=thisMonth&status=visited,treatmentBooked,treatment,completed,followup',
    },
    {
      id: 'payment',
      label: '결제 전환율',
      note: '내원 대비',
      icon: CreditCard,
      value: data?.paymentRate.value ?? 0,
      unit: '%',
      subLabel: `${data?.paymentRate.count ?? 0}명 결제`,
      trend: data?.paymentRate.trend ?? 0,
      trendType: 'percent' as const,
      bgColor: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-700',
      href: '/v2/patients?period=thisMonth&paymentStatus=partial,completed',
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-gray-900 text-lg">이번달 성과</h3>
        <span className="text-sm text-gray-500">{monthStr}</span>
      </div>

      {/* 4열 그리드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={() => router.push(card.href)}
              className={`${card.bgColor} rounded-xl p-4 relative cursor-pointer hover:brightness-95 transition-all`}
            >
              {/* 연결선 (모바일에서는 숨김) */}
              {index < cards.length - 1 && (
                <div className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 items-center justify-center w-6 h-6 bg-white rounded-full shadow-sm ring-1 ring-gray-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-gray-400">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              )}

              {/* 아이콘 */}
              <div className={`inline-flex p-2 rounded-lg ${card.iconBg} mb-3`}>
                <Icon size={18} className={card.iconColor} />
              </div>

              {/* 라벨 */}
              <p className="text-xs text-gray-500 mb-1">
                {card.label}
                {'note' in card && card.note && (
                  <span className="ml-1 text-[10px] text-gray-400">({card.note})</span>
                )}
              </p>

              {/* 값 */}
              <div className="flex items-baseline gap-1 mb-2">
                <span className={`text-2xl font-bold ${card.valueColor}`}>
                  {card.value.toLocaleString()}
                </span>
                <span className="text-sm text-gray-500">{card.unit}</span>
              </div>

              {/* 트렌드 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{card.subLabel}</span>
                <TrendBadge value={card.trend} type={card.trendType} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 신환/구신환 breakdown 보조 라인 */}
      {data?.breakdown && (
        <div className="mt-2 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* 신환 */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setModalType('new')}
                disabled={data.breakdown.newPatient.count === 0}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-medium hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-100"
                title="명단 보기"
              >
                신환 {data.breakdown.newPatient.count}건
              </button>
              <span className="text-gray-500">
                예약 {data.breakdown.newPatient.reserved} · 내원 {data.breakdown.newPatient.visited} · 결제 {data.breakdown.newPatient.paid}
              </span>
            </div>
            {/* 구신환 재유치 */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setModalType('returning')}
                disabled={data.breakdown.returningPatient.count === 0}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 font-medium hover:bg-sky-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-sky-100"
                title="명단 보기"
              >
                구신환 재유치 {data.breakdown.returningPatient.count}건
              </button>
              <span className="text-gray-500">
                예약 {data.breakdown.returningPatient.reserved} · 내원 {data.breakdown.returningPatient.visited} · 결제 {data.breakdown.returningPatient.paid}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 명단 모달 */}
      <JourneyPatientsModal
        open={modalType !== null}
        onClose={() => setModalType(null)}
        year={displayYear}
        month={displayMonth}
        type={modalType ?? 'new'}
      />
    </div>
  );
}

export default ConversionFunnelCard;
