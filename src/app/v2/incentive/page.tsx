// src/app/v2/incentive/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';
import {
  IncentiveSettlementTable,
  type IncentiveSettlementData,
} from '@/components/v2/dashboard/IncentiveSettlementTable';

export default function IncentivePage() {
  const [data, setData] = useState<IncentiveSettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth() + 1;
  }, [selectedMonth]);

  const monthQueryString = useMemo(
    () => `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`,
    [selectedMonth]
  );

  const fetchData = useCallback(async () => {
    try {
      const response = await authFetch(`/api/v2/dashboard/incentive-settlement?month=${monthQueryString}`);
      if (!response.ok) throw new Error('Failed to fetch incentive settlement');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to fetch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [monthQueryString]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  const goToPrevMonth = () => {
    setSelectedMonth((prev) =>
      prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 }
    );
  };

  const goToNextMonth = () => {
    if (isCurrentMonth) return;
    setSelectedMonth((prev) =>
      prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 }
    );
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
  };

  return (
    <div className="p-6 space-y-6">
      {/* 월 선택 네비게이션 */}
      <div className="bg-white rounded-xl shadow-sm px-6 py-4 flex items-center justify-center gap-4 relative">
        <button onClick={goToPrevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="이전 달">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-3xl font-bold text-gray-900 tabular-nums min-w-[180px] text-center">
          {selectedMonth.year}년 {selectedMonth.month}월
        </h2>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title="다음 달"
        >
          <ChevronRight size={22} />
        </button>
        {!isCurrentMonth && (
          <button
            onClick={goToCurrentMonth}
            className="ml-2 px-3 py-1.5 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
          >
            이번 달로
          </button>
        )}
        <button
          onClick={handleRefresh}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="새로고침"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">데이터를 불러오는 중 오류가 발생했습니다</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
          <button onClick={handleRefresh} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            다시 시도
          </button>
        </div>
      ) : (
        <IncentiveSettlementTable data={data} loading={loading} />
      )}
    </div>
  );
}
