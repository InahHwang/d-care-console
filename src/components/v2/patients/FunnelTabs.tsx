// src/components/v2/patients/FunnelTabs.tsx
'use client';

import React from 'react';
import { PatientStatus } from '@/types/v2';

// 필터 타입 = 상태 + all
export type PatientFilterType = 'all' | PatientStatus;

interface FilterStats {
  all: number;
  consulting: number;
  reserved: number;
  visited: number;
  treatmentBooked: number;
  treatment: number;
  completed: number;
  followup: number;
  closed: number;
}

interface FunnelTabsProps {
  activeFilter: PatientFilterType;
  onFilterChange: (filter: PatientFilterType) => void;
  stats?: FilterStats | null;
  loading?: boolean;
}

const filterTabs: Array<{ id: PatientFilterType; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'consulting', label: '전화상담' },
  { id: 'reserved', label: '내원예약' },
  { id: 'visited', label: '내원완료' },
  { id: 'treatmentBooked', label: '치료예약' },
  { id: 'treatment', label: '치료중' },
  { id: 'completed', label: '치료완료' },
  { id: 'followup', label: '사후관리' },
  { id: 'closed', label: '종결' },
];

const getStatusStyle = (statusId: PatientFilterType, isActive: boolean) => {
  if (!isActive) return 'bg-gray-100 text-gray-600 hover:bg-gray-200';

  switch (statusId) {
    case 'all': return 'bg-gray-900 text-white';
    case 'consulting': return 'bg-blue-100 text-blue-700';
    case 'reserved': return 'bg-purple-100 text-purple-700';
    case 'visited': return 'bg-amber-100 text-amber-700';
    case 'treatmentBooked': return 'bg-teal-100 text-teal-700';
    case 'treatment': return 'bg-emerald-100 text-emerald-700';
    case 'completed': return 'bg-green-100 text-green-700';
    case 'followup': return 'bg-slate-100 text-slate-700';
    case 'closed': return 'bg-gray-200 text-gray-600';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export function FunnelTabs({ activeFilter, onFilterChange, stats, loading }: FunnelTabsProps) {
  const getCount = (id: PatientFilterType) => {
    if (!stats) return null;
    return stats[id as keyof FilterStats] ?? 0;
  };

  return (
    <div className="flex items-center gap-2">
      {filterTabs.map((tab) => {
        const isActive = activeFilter === tab.id;
        const count = getCount(tab.id);

        return (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all
              ${getStatusStyle(tab.id, isActive)}
            `}
          >
            {tab.label}
            {loading ? (
              <span className={`ml-1.5 ${isActive && tab.id === 'all' ? 'text-gray-400' : 'text-gray-400'}`}>--</span>
            ) : count !== null ? (
              <span className={`ml-1.5 ${isActive && tab.id === 'all' ? 'text-gray-400' : 'text-gray-400'}`}>
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default FunnelTabs;
