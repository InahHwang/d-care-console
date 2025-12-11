// src/hooks/useDashboardStats.ts
// 대시보드 전용 통계 훅 - 서버사이드 집계 API 사용

import { useState, useEffect, useCallback } from 'react';

interface StatusCardData {
  consultation: number;
  visit: number;
}

interface ReminderCardData {
  registrationNeeded: number;
}

interface DashboardStatusCounts {
  overdueCallbacks: StatusCardData;
  todayScheduled: StatusCardData;
  callbackUnregistered: StatusCardData;
  reminderCallbacks: ReminderCardData;
}

interface TodayCall {
  _id: string;
  id: string;
  patientId: string;
  name: string;
  phoneNumber: string;
  status: string;
  visitConfirmed?: boolean;
  postVisitStatus?: string;
  interestedServices?: string[];
  callbackHistory?: any[];
}

interface DashboardStatsResponse {
  statusCounts: DashboardStatusCounts;
  todayCalls: TodayCall[];
  totalPatients: number;
  timestamp: string;
}

interface UseDashboardStatsResult {
  statusCounts: DashboardStatusCounts;
  todayCalls: TodayCall[];
  totalPatients: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useDashboardStats = (): UseDashboardStatsResult => {
  const [statusCounts, setStatusCounts] = useState<DashboardStatusCounts>({
    overdueCallbacks: { consultation: 0, visit: 0 },
    todayScheduled: { consultation: 0, visit: 0 },
    callbackUnregistered: { consultation: 0, visit: 0 },
    reminderCallbacks: { registrationNeeded: 0 }
  });
  const [todayCalls, setTodayCalls] = useState<TodayCall[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/dashboard/stats');

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data: DashboardStatsResponse = await response.json();

      setStatusCounts(data.statusCounts);
      setTodayCalls(data.todayCalls);
      setTotalPatients(data.totalPatients);
    } catch (err) {
      console.error('Dashboard stats fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // 5분마다 자동 새로고침 (기존 1분보다 길게)
    const interval = setInterval(fetchStats, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchStats]);

  return {
    statusCounts,
    todayCalls,
    totalPatients,
    isLoading,
    error,
    refetch: fetchStats
  };
};

export default useDashboardStats;
