// src/app/v2/reports/page.tsx
// V2 리포트 페이지 (일별/월별)
'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, BarChart3, ChevronLeft, ChevronRight, Plus, Trash2, FileText } from 'lucide-react';
import { PageHeader } from '@/components/v2/layout/PageHeader';
import { useAppSelector } from '@/hooks/reduxHooks';
import {
  DailyReportView,
  DailyReportData,
  MonthlyReportFullView,
} from './components';
import type { MonthlyReportV2, MonthlyReportListItem } from './components/MonthlyReport-Types';

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'monthly' ? 'monthly' : 'daily';
  const { user } = useAppSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>(initialTab);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedYearMonth, setSelectedYearMonth] = useState(
    `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
  );
  const [dailyData, setDailyData] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // 월별 보고서 관련 상태
  const [reportList, setReportList] = useState<MonthlyReportListItem[]>([]);
  const [currentReport, setCurrentReport] = useState<MonthlyReportV2 | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  // === 일별 리포트 fetch ===
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

  // === 월별 보고서 목록 fetch ===
  const fetchReportList = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/reports');
      if (!response.ok) throw new Error('Failed to fetch report list');
      const result = await response.json();
      if (result.success) {
        setReportList(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching report list:', error);
    }
  }, []);

  // === 선택된 월의 보고서 로드 ===
  const loadReportForMonth = useCallback(async (yearMonth: string) => {
    setLoading(true);
    setCurrentReport(null);
    try {
      // 보고서 목록에서 해당 월 보고서 찾기
      const match = reportList.find(r => r.yearMonth === yearMonth);
      if (match) {
        const response = await fetch(`/api/v2/reports/${match._id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setCurrentReport(result.data);
          }
        }
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  }, [reportList]);

  // === 보고서 생성 ===
  const handleCreateReport = async () => {
    const [year, month] = selectedYearMonth.split('-').map(Number);
    setIsCreating(true);
    try {
      const response = await fetch('/api/v2/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ year, month }),
      });
      const result = await response.json();
      if (result.success) {
        setCurrentReport(result.data);
        await fetchReportList();
      } else {
        alert(result.error || '보고서 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating report:', error);
      alert('보고서 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // === 보고서 삭제 ===
  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('이 보고서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const response = await fetch(`/api/v2/reports/${reportId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json();
      if (result.success) {
        setCurrentReport(null);
        await fetchReportList();
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  // === 보고서 업데이트 콜백 ===
  const handleReportUpdate = useCallback((updatedReport: MonthlyReportV2) => {
    setCurrentReport(updatedReport);
  }, []);

  // === 탭 변경 시 데이터 로드 ===
  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyReport();
    } else {
      fetchReportList();
    }
  }, [activeTab, fetchDailyReport, fetchReportList]);

  // === 월 변경 또는 목록 변경 시 보고서 로드 ===
  useEffect(() => {
    if (activeTab === 'monthly' && reportList.length >= 0) {
      loadReportForMonth(selectedYearMonth);
    }
  }, [activeTab, selectedYearMonth, reportList, loadReportForMonth]);

  // === 날짜 네비게이션 ===
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

  // 해당 월 보고서 존재 여부
  const hasReportForMonth = reportList.some(r => r.yearMonth === selectedYearMonth);

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
              <button onClick={handlePrevDate} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border rounded-lg text-center"
              />
              <button onClick={handleNextDate} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} />
              </button>
              <input
                type="month"
                value={selectedYearMonth}
                onChange={(e) => setSelectedYearMonth(e.target.value)}
                className="px-4 py-2 border rounded-lg text-center"
              />
              <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
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
      ) : activeTab === 'monthly' ? (
        currentReport ? (
          /* 저장된 보고서가 있으면 전체 뷰 표시 */
          <div>
            {/* 보고서 삭제 버튼 */}
            <div className="flex justify-end mb-2">
              <button
                onClick={() => currentReport._id && handleDeleteReport(currentReport._id)}
                className="flex items-center gap-1 px-3 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3" />
                보고서 삭제
              </button>
            </div>
            <MonthlyReportFullView
              report={currentReport}
              userRole={user?.role}
              currentUserId={user?.id || user?._id}
              authToken={authToken}
              onReportUpdate={handleReportUpdate}
            />
          </div>
        ) : (
          /* 보고서가 없으면 생성 안내 */
          <div className="bg-white rounded-xl p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              {selectedYearMonth.split('-')[0]}년 {parseInt(selectedYearMonth.split('-')[1])}월 보고서
            </h3>
            {hasReportForMonth ? (
              <p className="text-gray-500 mb-6">보고서를 불러오는 중입니다...</p>
            ) : (
              <>
                <p className="text-gray-500 mb-6">
                  아직 생성된 보고서가 없습니다.<br />
                  보고서를 생성하면 해당 월의 환자/상담 데이터를 기반으로 통계가 자동 계산됩니다.
                </p>
                <button
                  onClick={handleCreateReport}
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  {isCreating ? '생성 중...' : '보고서 생성'}
                </button>
              </>
            )}

            {/* 기존 보고서 목록 (다른 월) */}
            {reportList.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h4 className="text-sm font-medium text-gray-600 mb-3">기존 보고서 목록</h4>
                <div className="space-y-2 max-w-md mx-auto">
                  {reportList.map((r) => (
                    <div
                      key={r._id}
                      onClick={() => setSelectedYearMonth(r.yearMonth)}
                      className={`flex items-center justify-between px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                        r.yearMonth === selectedYearMonth
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">
                          {r.year}년 {r.month}월
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          r.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                          r.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {r.status === 'draft' ? '임시저장' :
                           r.status === 'submitted' ? '최종제출' : '승인완료'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {r.createdByName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
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
