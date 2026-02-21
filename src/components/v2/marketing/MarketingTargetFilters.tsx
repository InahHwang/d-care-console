// src/components/v2/marketing/MarketingTargetFilters.tsx
// 이벤트 타겟 목록 필터 컴포넌트

'use client';

import React from 'react';
import { Search, Filter, SortAsc, SortDesc, X } from 'lucide-react';
import { MarketingTargetReason, MARKETING_TARGET_REASON_OPTIONS } from '@/types/v2';

interface MarketingTargetFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedReasons: MarketingTargetReason[];
  onReasonsChange: (reasons: MarketingTargetReason[]) => void;
  sortBy: 'name' | 'scheduledDate' | 'createdAt';
  onSortByChange: (sortBy: 'name' | 'scheduledDate' | 'createdAt') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  stats?: {
    total: number;
    byReason: Record<string, number>;
  };
}

const SORT_OPTIONS = [
  { value: 'scheduledDate', label: '발송예정일순' },
  { value: 'createdAt', label: '지정일순' },
  { value: 'name', label: '이름순' },
] as const;

export function MarketingTargetFilters({
  search,
  onSearchChange,
  selectedReasons,
  onReasonsChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  stats,
}: MarketingTargetFiltersProps) {
  const handleReasonToggle = (reason: MarketingTargetReason) => {
    if (selectedReasons.includes(reason)) {
      onReasonsChange(selectedReasons.filter((r) => r !== reason));
    } else {
      onReasonsChange([...selectedReasons, reason]);
    }
  };

  const clearFilters = () => {
    onSearchChange('');
    onReasonsChange([]);
  };

  const hasActiveFilters = search || selectedReasons.length > 0;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-4">
      {/* 검색 + 정렬 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 검색 */}
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="이름, 전화번호, 메모 검색..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* 정렬 */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) =>
              onSortByChange(e.target.value as typeof sortBy)
            }
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border rounded-lg hover:bg-gray-50 transition-colors"
            title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
          >
            {sortOrder === 'asc' ? (
              <SortAsc size={18} className="text-gray-600" />
            ) : (
              <SortDesc size={18} className="text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* 사유 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-gray-500 mr-2">
          <Filter size={16} />
          <span>사유:</span>
        </div>
        {MARKETING_TARGET_REASON_OPTIONS.map((option) => {
          const isSelected = selectedReasons.includes(option.value);
          const count = stats?.byReason?.[option.value] || 0;
          return (
            <button
              key={option.value}
              onClick={() => handleReasonToggle(option.value)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {option.label}
              {count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-blue-200' : 'bg-gray-200'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 필터 초기화 */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-gray-500">
            {stats?.total || 0}명의 이벤트 타겟
          </span>
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}

export default MarketingTargetFilters;
