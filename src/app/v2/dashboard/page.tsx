// src/app/v2/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/v2/layout/PageHeader';
import {
  StatsCards,
  AlertsCard,
  AIAnalysisCard,
  CallbacksCard,
  RecentPatientsCard,
  CallClassificationCard,
  RevenueCard,
} from '@/components/v2/dashboard';
import { Temperature } from '@/types/v2';

interface RevenueData {
  thisMonth: {
    actual: number;
    estimated: number;
    patientCount: number;
    paidCount: number;
  };
  lastMonth: {
    actual: number;
  };
  total: {
    actual: number;
    estimated: number;
    patientCount: number;
  };
  conversionRate: number;
  avgRevenue: number;
  growthRate: number;
}

interface DashboardData {
  today: {
    totalCalls: number;
    analyzed: number;
    analyzing: number;
    newPatients: number;
    existingPatients: number;
    missed: number;
    other: number;
  };
  alerts: Array<{
    id: string;
    type: string;
    label: string;
    count: number;
    patients: string[];
    color: 'amber' | 'red' | 'orange';
  }>;
  callbacks: Array<{
    id: string;
    name: string;
    phone: string;
    time: string;
    interest: string;
    temperature: Temperature;
  }>;
  recentPatients: Array<{
    id: string;
    name: string;
    time: string;
    interest: string;
    temperature: Temperature;
    status: 'new' | 'existing';
  }>;
  analysisQueue: Array<{
    id: string;
    phone: string;
    time: string;
    progress: number;
  }>;
  revenue?: RevenueData;
}

export default function DashboardPage() {
  const router = useRouter();
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

  const handleCallCallback = (callback: { id: string; phone: string }) => {
    window.dispatchEvent(new CustomEvent('cti-call', { detail: { phone: callback.phone } }));
  };

  const handlePatientClick = (patient: { id: string }) => {
    router.push(`/v2/patients/${patient.id}`);
  };

  const handleAlertClick = (type: string, item: { id: string }) => {
    router.push(`/v2/patients/${item.id}`);
  };

  if (error) {
    return (
      <div className="p-6">
        <PageHeader
          title="대시보드"
          subtitle="오늘의 상담 현황을 한눈에 확인하세요"
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
        subtitle="오늘의 상담 현황을 한눈에 확인하세요"
        onRefresh={handleRefresh}
      />

      {/* 오늘의 통계 카드 */}
      <StatsCards
        stats={{
          totalCalls: data?.today.totalCalls ?? 0,
          newPatients: data?.today.newPatients ?? 0,
          callbackCount: data?.callbacks?.length ?? 0,
          missed: data?.today.missed ?? 0,
        }}
        loading={loading}
      />

      {/* 매출 통계 카드 */}
      <RevenueCard
        thisMonth={data?.revenue?.thisMonth ?? { actual: 0, estimated: 0, patientCount: 0, paidCount: 0 }}
        lastMonth={data?.revenue?.lastMonth ?? { actual: 0 }}
        conversionRate={data?.revenue?.conversionRate ?? 0}
        avgRevenue={data?.revenue?.avgRevenue ?? 0}
        growthRate={data?.revenue?.growthRate ?? 0}
        loading={loading}
      />

      {/* 통화 분류 현황 */}
      <CallClassificationCard
        newPatients={data?.today.newPatients ?? 0}
        existingPatients={data?.today.existingPatients ?? 0}
        missed={data?.today.missed ?? 0}
        other={data?.today.other ?? 0}
        onViewCallLogs={() => router.push('/v2/call-logs')}
        loading={loading}
      />

      {/* 알림 및 주의 환자 */}
      <AlertsCard
        alerts={data?.alerts ?? []}
        loading={loading}
      />

      {/* 3열 그리드: 콜백, 최근 환자, AI 분석 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CallbacksCard
          callbacks={data?.callbacks ?? []}
          onCall={handleCallCallback}
          onViewAll={() => router.push('/v2/schedules?tab=callbacks')}
          loading={loading}
        />

        <RecentPatientsCard
          patients={data?.recentPatients ?? []}
          onPatientClick={handlePatientClick}
          onViewAll={() => router.push('/v2/patients')}
          loading={loading}
        />

        <AIAnalysisCard
          analyzed={data?.today.analyzed ?? 0}
          analyzing={data?.today.analyzing ?? 0}
          queue={data?.analysisQueue ?? []}
          loading={loading}
        />
      </div>
    </div>
  );
}
