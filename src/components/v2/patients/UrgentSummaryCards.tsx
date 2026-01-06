// src/components/v2/patients/UrgentSummaryCards.tsx
'use client';

import React from 'react';
import { AlertTriangle, Clock, CalendarClock } from 'lucide-react';

export type UrgencyFilter = 'all' | 'noshow' | 'today' | 'overdue';

export interface UrgentStats {
  noshow: number;    // +N일 (노쇼/지연)
  today: number;     // D-Day (오늘)
  overdue: number;   // N일째 (임계값 초과)
}

interface UrgentSummaryCardsProps {
  stats: UrgentStats | null;
  activeFilter: UrgencyFilter;
  onFilterChange: (filter: UrgencyFilter) => void;
  loading?: boolean;
}

export function UrgentSummaryCards({
  stats,
  activeFilter,
  onFilterChange,
  loading
}: UrgentSummaryCardsProps) {
  const cards = [
    {
      id: 'noshow' as UrgencyFilter,
      label: '노쇼/지연',
      description: '예정일 경과',
      icon: AlertTriangle,
      count: stats?.noshow ?? 0,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      activeBorderColor: 'border-red-500',
      iconColor: 'text-red-500',
      countColor: 'text-red-600',
    },
    {
      id: 'today' as UrgencyFilter,
      label: '오늘 예정',
      description: 'D-Day',
      icon: Clock,
      count: stats?.today ?? 0,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      activeBorderColor: 'border-blue-500',
      iconColor: 'text-blue-500',
      countColor: 'text-blue-600',
    },
    {
      id: 'overdue' as UrgencyFilter,
      label: '장기 방치',
      description: '임계값 초과',
      icon: CalendarClock,
      count: stats?.overdue ?? 0,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      activeBorderColor: 'border-amber-500',
      iconColor: 'text-amber-500',
      countColor: 'text-amber-600',
    },
  ];

  return (
    <div className="flex gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.id;
        const hasItems = card.count > 0;

        return (
          <button
            key={card.id}
            onClick={() => onFilterChange(isActive ? 'all' : card.id)}
            disabled={!hasItems && !isActive}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all
              ${card.bgColor}
              ${isActive ? card.activeBorderColor : card.borderColor}
              ${hasItems ? 'cursor-pointer hover:shadow-md' : 'opacity-50 cursor-not-allowed'}
              ${isActive ? 'ring-2 ring-offset-1 ring-opacity-50' : ''}
              ${isActive && card.id === 'noshow' ? 'ring-red-300' : ''}
              ${isActive && card.id === 'today' ? 'ring-blue-300' : ''}
              ${isActive && card.id === 'overdue' ? 'ring-amber-300' : ''}
            `}
          >
            <div className={`p-2 rounded-lg bg-white ${card.iconColor}`}>
              <Icon size={20} />
            </div>
            <div className="text-left">
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${card.countColor}`}>
                  {loading ? '--' : card.count}
                </span>
                <span className="text-sm text-gray-500">명</span>
              </div>
              <div className="text-xs text-gray-500">{card.label}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default UrgentSummaryCards;
