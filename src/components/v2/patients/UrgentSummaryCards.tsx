// src/components/v2/patients/UrgentSummaryCards.tsx
'use client';

import React from 'react';
import { AlertTriangle, Clock, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';

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
  // 날짜 탐색 (today 필터 활성 시)
  selectedDate?: string;        // 'YYYY-MM-DD'
  onDateChange?: (date: string) => void;
}

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): string {
  const today = getTodayString();
  if (dateStr === today) return '오늘';

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date.getTime() - new Date(new Date().setHours(0, 0, 0, 0)).getTime()) / (1000 * 60 * 60 * 24));

  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

  if (diff === 1) return `내일 (${weekday})`;
  if (diff === -1) return `어제 (${weekday})`;

  return `${m}/${d} (${weekday})`;
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function UrgentSummaryCards({
  stats,
  activeFilter,
  onFilterChange,
  loading,
  selectedDate,
  onDateChange,
}: UrgentSummaryCardsProps) {
  const today = getTodayString();
  const isToday = !selectedDate || selectedDate === today;

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
      label: isToday ? '오늘 예정' : `${formatDateLabel(selectedDate || today)} 예정`,
      description: isToday ? 'D-Day' : formatDateLabel(selectedDate || today),
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

  const isTodayFilterActive = activeFilter === 'today';

  return (
    <div className="space-y-2">
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

      {/* 날짜 탐색 바 - today 필터 활성 시에만 */}
      {isTodayFilterActive && onDateChange && (
        <div className="flex items-center gap-2 pl-1">
          <button
            onClick={() => onDateChange(shiftDate(selectedDate || today, -1))}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
            {formatDateLabel(selectedDate || today)}
          </span>
          <button
            onClick={() => onDateChange(shiftDate(selectedDate || today, 1))}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            <ChevronRight size={16} />
          </button>
          {!isToday && (
            <button
              onClick={() => onDateChange(today)}
              className="px-2 py-0.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded font-medium"
            >
              오늘
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default UrgentSummaryCards;
