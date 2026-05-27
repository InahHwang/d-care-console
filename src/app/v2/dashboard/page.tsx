// src/app/v2/dashboard/page.tsx
'use client';

import { authFetch } from '@/utils/authFetch';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/v2/layout/PageHeader';
import {
  RevenueCard,
  TodayTasksCard,
  ConversionFunnelCard,
  ConsultantPerformanceTable,
  DirectorCommentsCard,
  type ConsultantStat,
  TodayTasks,
} from '@/components/v2/dashboard';
import OnboardingChecklistWidget from '@/components/v2/dashboard/Onboarding-ChecklistWidget';

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

interface RevenueData {
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
  returningContribution?: number;
}

interface DashboardData {
  conversionRates: ConversionRates;
  consultantStats?: ConsultantStat[];
  revenue?: RevenueData;
  todayTasks?: TodayTasks;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 선택된 월 (기본: 현재 월)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 }; // month: 1-12
  });

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth() + 1;
  }, [selectedMonth]);

  const monthQueryString = useMemo(
    () => `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`,
    [selectedMonth]
  );

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await authFetch(`/api/v2/dashboard?month=${monthQueryString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch');
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [monthQueryString]);

  useEffect(() => {
    setLoading(true);
    fetchDashboardData();

    // 현재 월일 때만 30초 자동 새로고침 (과거 월 데이터는 변하지 않음)
    if (!isCurrentMonth) return;
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData, isCurrentMonth]);

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
  };

  const goToPrevMonth = () => {
    setSelectedMonth(prev =>
      prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 }
    );
  };

  const goToNextMonth = () => {
    if (isCurrentMonth) return; // 미래 월 차단
    setSelectedMonth(prev =>
      prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 }
    );
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
  };

  if (error) {
    return (
      <div className="p-6">
        <PageHeader
          title="대시보드"
          subtitle="이번달 성과와 오늘 할 일을 확인하세요"
          onRefresh={handleRefresh}
        />
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">데이터를 불러오는 중 오류가 발생했습니다</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 월 선택 네비게이션 (페이지 헤더 역할 겸함) */}
      <div className="bg-white rounded-xl shadow-sm px-6 py-4 flex items-center justify-center gap-4 relative">
        <button
          onClick={goToPrevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          title="이전 달"
        >
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

        {/* 새로고침 버튼 (우측 끝) */}
        <button
          onClick={handleRefresh}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="새로고침"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* 매출 통계 카드 (전체 폭) */}
      <RevenueCard
        thisMonth={data?.revenue?.thisMonth ?? { confirmed: 0, missed: 0, missedCount: 0, patientCount: 0, paidCount: 0 }}
        lastMonth={data?.revenue?.lastMonth ?? { confirmed: 0 }}
        discountRate={data?.revenue?.discountRate ?? 0}
        avgRevenue={data?.revenue?.avgRevenue ?? 0}
        growthRate={data?.revenue?.growthRate ?? 0}
        monthlyTarget={data?.revenue?.monthlyTarget ?? 0}
        returningContribution={data?.revenue?.returningContribution ?? 0}
        loading={loading}
      />

      {/* 2열 그리드: 이번달 성과 + 상담사별 실적 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 이번달 성과 (전환율 퍼널) */}
        <ConversionFunnelCard
          data={data?.conversionRates ?? null}
          loading={loading}
          year={selectedMonth.year}
          month={selectedMonth.month}
        />

        {/* 상담사별 실적 테이블 */}
        <ConsultantPerformanceTable
          data={data?.consultantStats ?? null}
          loading={loading}
        />
      </div>

      {/* 2열 그리드: 오늘 할 일 + 원장 코멘트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 오늘 할 일 카드 */}
        <TodayTasksCard
          tasks={data?.todayTasks ?? null}
          loading={loading}
        />

        {/* 원장 코멘트 카드 */}
        <DirectorCommentsCard />
      </div>

      {/* 온보딩 체크리스트 (설정 미완료 시 표시) */}
      <OnboardingChecklistWidget />
    </div>
  );
}
