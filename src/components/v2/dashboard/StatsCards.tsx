// src/components/v2/dashboard/StatsCards.tsx
'use client';

import React from 'react';
import { Phone, Users, Bell, PhoneIncoming, TrendingUp, AlertCircle } from 'lucide-react';
import { StatsCard } from '../ui/Card';

interface TodayStats {
  totalCalls: number;
  newPatients: number;
  callbackCount: number;
  missed: number;
}

interface StatsCardsProps {
  stats: TodayStats;
  loading?: boolean;
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-5 w-5 bg-gray-200 rounded" />
            </div>
            <div className="h-8 w-12 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatsCard
        title="총 통화"
        value={stats.totalCalls}
        icon={<Phone size={20} />}
        iconBgColor="text-gray-400"
        trend={{
          value: 5,
          isPositive: true,
          label: '어제보다 5건 증가',
        }}
      />

      <StatsCard
        title="신규 환자"
        value={stats.newPatients}
        icon={<Users size={20} />}
        iconBgColor="text-blue-400"
        subtext="AI 자동 등록"
        subtextColor="gray"
      />

      <StatsCard
        title="오늘 콜백"
        value={stats.callbackCount}
        icon={<Bell size={20} />}
        iconBgColor="text-amber-400"
        subtext="예정된 콜백"
        subtextColor="gray"
      />

      <StatsCard
        title="부재중"
        value={stats.missed}
        icon={<PhoneIncoming size={20} />}
        iconBgColor="text-gray-400"
        subtext={stats.missed > 0 ? '재시도 필요' : ''}
        subtextColor={stats.missed > 0 ? 'amber' : 'gray'}
      />
    </div>
  );
}

export default StatsCards;
