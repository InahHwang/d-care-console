// src/app/v2/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/v2/layout/PageHeader';
import {
  RevenueCard,
  TodayTasksCard,
  ConversionFunnelCard,
  TodayTasks,
} from '@/components/v2/dashboard';

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
}

interface DashboardData {
  conversionRates: ConversionRates;
  revenue?: RevenueData;
  todayTasks?: TodayTasks;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/dashboard');
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
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // 30초마다 자동 새로고침
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
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
      <PageHeader
        title="대시보드"
        subtitle="이번달 성과와 오늘 할 일을 확인하세요"
        onRefresh={handleRefresh}
      />

      {/* 이번달 성과 (전환율 퍼널) */}
      <ConversionFunnelCard
        data={data?.conversionRates ?? null}
        loading={loading}
      />

      {/* 2열 그리드: 오늘 할 일 + 매출 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 오늘 할 일 카드 */}
        <TodayTasksCard
          tasks={data?.todayTasks ?? null}
          loading={loading}
        />

        {/* 매출 통계 카드 */}
        <RevenueCard
          thisMonth={data?.revenue?.thisMonth ?? { confirmed: 0, missed: 0, missedCount: 0, patientCount: 0, paidCount: 0 }}
          lastMonth={data?.revenue?.lastMonth ?? { confirmed: 0 }}
          discountRate={data?.revenue?.discountRate ?? 0}
          avgRevenue={data?.revenue?.avgRevenue ?? 0}
          growthRate={data?.revenue?.growthRate ?? 0}
          monthlyTarget={data?.revenue?.monthlyTarget ?? 0}
          loading={loading}
        />
      </div>
    </div>
  );
}
