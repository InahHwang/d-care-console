// src/components/v2/ui/FilterTabs.tsx
'use client';

import React from 'react';

interface FilterTab {
  id: string;
  label: string;
  count?: number;
  color?: string;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
}

export function FilterTabs({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  size = 'md',
}: FilterTabsProps) {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const getActiveStyle = (tab: FilterTab, isActive: boolean) => {
    if (variant === 'pills') {
      if (isActive) {
        if (tab.id === 'all') {
          return 'bg-gray-900 text-white';
        }
        // 컬러별 스타일
        const colorStyles: Record<string, string> = {
          blue: 'bg-blue-100 text-blue-700',
          purple: 'bg-purple-100 text-purple-700',
          amber: 'bg-amber-100 text-amber-700',
          emerald: 'bg-emerald-100 text-emerald-700',
          green: 'bg-green-100 text-green-700',
          slate: 'bg-slate-100 text-slate-700',
          gray: 'bg-gray-100 text-gray-700',
        };
        return colorStyles[tab.color || 'gray'] || colorStyles.gray;
      }
      return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
    }

    if (variant === 'underline') {
      return isActive
        ? 'text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-500 hover:text-gray-700';
    }

    return isActive
      ? 'bg-blue-500 text-white'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  };

  return (
    <div className={`flex items-center gap-2 ${variant === 'underline' ? 'border-b' : ''}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`${sizeStyles[size]} font-medium transition-all ${
              variant === 'pills' ? 'rounded-full' : variant === 'underline' ? 'pb-3 -mb-px' : 'rounded-lg'
            } ${getActiveStyle(tab, isActive)}`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1.5 ${isActive && tab.id === 'all' ? 'text-gray-400' : ''}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// 상태 필터 버튼 (환자 관리용)
interface StatusFilterProps {
  statuses: { id: string; label: string; count: number; color: string }[];
  activeStatus: string;
  onChange: (status: string) => void;
}

export function StatusFilter({ statuses, activeStatus, onChange }: StatusFilterProps) {
  return (
    <FilterTabs
      tabs={[{ id: 'all', label: '전체', count: statuses.reduce((acc, s) => acc + s.count, 0) }, ...statuses]}
      activeTab={activeStatus}
      onChange={onChange}
      variant="pills"
      size="md"
    />
  );
}

export default FilterTabs;
