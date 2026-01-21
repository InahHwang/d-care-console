// src/app/v2/reports/page.tsx
// V2 리포트 페이지 (일별/월별)
'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/v2/layout/PageHeader';
import {
  DailyReportView,
  MonthlyReportView,
  DailyReportData,
  MonthlyReportData,
} from './components';

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'monthly' ? 'monthly' : 'daily';

  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>(initialTab);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedYearMonth, setSelectedYearMonth] = useState(
    `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
  );
  const [dailyData, setDailyData] = useState<DailyReportData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDailyReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v2/reports/daily/${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setDailyData(result.data);
    } catch (error) {
      console.error('Error fetching daily report:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchMonthlyReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v2/reports/monthly/${selectedYearMonth}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setMonthlyData(result.data);
    } catch (error) {
      console.error('Error fetching monthly report:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYearMonth]);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyReport();
    } else {
      fetchMonthlyReport();
    }
  }, [activeTab, fetchDailyReport, fetchMonthlyReport]);

  const handlePrevDate = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleNextDate = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handlePrevMonth = () => {
    const [year, month] = selectedYearMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2, 1);
    setSelectedYearMonth(
      `${newDate.getFullYear()}-${(newDate.getMonth() + 1).toString().padStart(2, '0')}`
    );
  };

  const handleNextMonth = () => {
    const [year, month] = selectedYearMonth.split('-').map(Number);
    const newDate = new Date(year, month, 1);
    setSelectedYearMonth(
      `${newDate.getFullYear()}-${(newDate.getMonth() + 1).toString().padStart(2, '0')}`
    );
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="리포트" subtitle="일별/월별 상담 및 매출 현황" />

      {/* 탭 + 날짜 선택 */}
      <div className="bg-white rounded-xl shadow-sm">
        {/* 탭 */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'daily'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <BarChart3 size={18} />
              일별 마감
            </div>
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'monthly'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Calendar size={18} />
              월별 리포트
            </div>
          </button>
        </div>

        {/* 날짜 선택 */}
        <div className="p-4 border-b">
          {activeTab === 'daily' ? (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePrevDate}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft size={20} />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border rounded-lg text-center"
              />
              <button
                onClick={handleNextDate}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft size={20} />
              </button>
              <input
                type="month"
                value={selectedYearMonth}
                onChange={(e) => setSelectedYearMonth(e.target.value)}
                className="px-4 py-2 border rounded-lg text-center"
              />
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4" />
          <p className="text-gray-500">로딩 중...</p>
        </div>
      ) : activeTab === 'daily' && dailyData ? (
        <DailyReportView data={dailyData} />
      ) : activeTab === 'monthly' && monthlyData ? (
        <MonthlyReportView data={monthlyData} />
      ) : (
        <div className="bg-white rounded-xl p-12 text-center text-gray-500">
          데이터가 없습니다.
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">로딩 중...</div>}>
      <ReportsPageContent />
    </Suspense>
  );
}
