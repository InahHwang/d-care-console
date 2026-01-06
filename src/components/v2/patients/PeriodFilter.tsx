// src/components/v2/patients/PeriodFilter.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type PeriodType = '1month' | '3months' | '6months' | '1year' | 'all' | 'custom';

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface PeriodFilterProps {
  value: PeriodType;
  onChange: (period: PeriodType) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

const periodOptions: Array<{ id: PeriodType; label: string }> = [
  { id: '1month', label: '최근 1개월' },
  { id: '3months', label: '최근 3개월' },
  { id: '6months', label: '최근 6개월' },
  { id: '1year', label: '최근 1년' },
  { id: 'all', label: '전체' },
  { id: 'custom', label: '직접 선택' },
];

export function PeriodFilter({ value, onChange, dateRange, onDateRangeChange }: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>({
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // dateRange 변경 시 tempRange 동기화
  useEffect(() => {
    if (dateRange) {
      setTempRange(dateRange);
    }
  }, [dateRange]);

  const handleOptionClick = (period: PeriodType) => {
    if (period === 'custom') {
      // 직접 선택은 드롭다운을 열어둠
      onChange(period);
    } else {
      onChange(period);
      setIsOpen(false);
    }
  };

  const handleApplyCustomRange = () => {
    if (tempRange.startDate && tempRange.endDate && onDateRangeChange) {
      onDateRangeChange(tempRange);
      setIsOpen(false);
    }
  };

  const getDisplayLabel = () => {
    if (value === 'custom' && dateRange?.startDate && dateRange?.endDate) {
      return `${dateRange.startDate} ~ ${dateRange.endDate}`;
    }
    return periodOptions.find(o => o.id === value)?.label || '최근 3개월';
  };

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 pl-3 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Calendar size={16} className="text-gray-400" />
        <span className="text-gray-700">{getDisplayLabel()}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px]">
          {/* 프리셋 옵션 */}
          <div className="p-2 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-1">
              {periodOptions.filter(o => o.id !== 'custom').map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleOptionClick(option.id)}
                  className={`px-3 py-2 text-sm rounded-md text-left transition-colors ${
                    value === option.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 직접 선택 */}
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-2">직접 선택</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={tempRange.startDate}
                onChange={(e) => setTempRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={tempRange.endDate}
                onChange={(e) => setTempRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleApplyCustomRange}
              disabled={!tempRange.startDate || !tempRange.endDate}
              className="w-full mt-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 기간을 날짜로 변환하는 헬퍼
export function getPeriodStartDate(period: PeriodType): string | null {
  if (period === 'all') return null;

  const now = new Date();
  let monthsBack = 3; // 기본값

  switch (period) {
    case '1month': monthsBack = 1; break;
    case '3months': monthsBack = 3; break;
    case '6months': monthsBack = 6; break;
    case '1year': monthsBack = 12; break;
  }

  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - monthsBack);
  return startDate.toISOString().split('T')[0];
}

export default PeriodFilter;
