// src/app/v2/reports/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Phone,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/v2/layout/PageHeader';

interface DailyReportData {
  date: string;
  dayOfWeek: string;
  summary: {
    total: number;
    agreed: number;
    disagreed: number;
    pending: number;
    expectedRevenue: number;
    actualRevenue: number;
    totalDiscount: number;
    avgDiscountRate: number;
    callbackCount: number;
    newPatients: number;
    existingPatients: number;
  };
  patients: Array<{
    id: string;
    name: string;
    phone: string;
    status: 'agreed' | 'disagreed' | 'pending';
    treatment: string;
    originalAmount: number;
    finalAmount: number;
    discountRate: number;
    disagreeReasons: string[];
    correctionPlan?: string;
    consultantName: string;
    time: string;
    aiSummary?: string;
  }>;
}

interface MonthlyReportData {
  yearMonth: string;
  year: number;
  month: number;
  stats: {
    totalCalls: number;
    connectedCalls: number;
    missedCalls: number;
    avgCallDuration: number;
    newPatients: number;
    existingPatients: number;
    conversionRate: number;
    funnel: Record<string, number>;
    expectedRevenue: number;
    actualRevenue: number;
    avgDealSize: number;
    totalConsultations: number;
    agreed: number;
    disagreed: number;
    pending: number;
    agreementRate: number;
    dailyTrends: Array<{
      date: string;
      calls: number;
      newPatients: number;
      agreed: number;
      revenue: number;
    }>;
    interestBreakdown: Array<{
      interest: string;
      count: number;
      agreed: number;
      revenue: number;
    }>;
    disagreeReasons: Array<{
      reason: string;
      count: number;
      percentage: number;
    }>;
  };
}

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'agreed':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            동의
          </span>
        );
      case 'disagreed':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
            미동의
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
            보류
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="리포트" subtitle="일별/월별 상담 및 매출 현황" />

      {/* 탭 */}
      <div className="bg-white rounded-xl shadow-sm">
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

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4" />
          <p className="text-gray-500">로딩 중...</p>
        </div>
      ) : activeTab === 'daily' && dailyData ? (
        <DailyReportView data={dailyData} getStatusBadge={getStatusBadge} />
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

// 일별 리포트 뷰
function DailyReportView({
  data,
  getStatusBadge,
}: {
  data: DailyReportData;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  const { summary, patients } = data;

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Users size={18} />
            <span className="text-sm">총 상담</span>
          </div>
          <div className="text-2xl font-bold">{summary.total}건</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle size={18} />
            <span className="text-sm">동의</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{summary.agreed}건</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <XCircle size={18} />
            <span className="text-sm">미동의</span>
          </div>
          <div className="text-2xl font-bold text-red-700">{summary.disagreed}건</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Clock size={18} />
            <span className="text-sm">보류</span>
          </div>
          <div className="text-2xl font-bold text-gray-700">{summary.pending}건</div>
        </div>
      </div>

      {/* 매출 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">예상 매출</div>
          <div className="text-xl font-bold">{summary.expectedRevenue.toLocaleString()}만원</div>
        </div>
        <div className="bg-white rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">실제 매출</div>
          <div className="text-xl font-bold text-blue-600">
            {summary.actualRevenue.toLocaleString()}만원
          </div>
        </div>
        <div className="bg-white rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">할인액</div>
          <div className="text-xl font-bold text-orange-600">
            {summary.totalDiscount.toLocaleString()}만원 ({summary.avgDiscountRate}%)
          </div>
        </div>
      </div>

      {/* 상담 목록 */}
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-medium">상담 내역</h3>
        </div>
        <div className="divide-y">
          {patients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">상담 내역이 없습니다.</div>
          ) : (
            patients.map((patient) => (
              <div key={patient.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{patient.name}</span>
                    {getStatusBadge(patient.status)}
                    <span className="text-sm text-gray-500">{patient.time}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{patient.finalAmount.toLocaleString()}만원</div>
                    {patient.discountRate > 0 && (
                      <div className="text-xs text-orange-600">
                        할인 {patient.discountRate}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{patient.treatment}</span>
                  <span>·</span>
                  <span>{patient.consultantName}</span>
                </div>
                {patient.aiSummary && (
                  <div className="mt-2 p-2 bg-purple-50 rounded-lg flex items-start gap-2">
                    <Sparkles size={14} className="text-purple-500 mt-0.5" />
                    <span className="text-sm text-purple-700">{patient.aiSummary}</span>
                  </div>
                )}
                {patient.status === 'disagreed' && patient.disagreeReasons.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-red-600">미동의 사유: </span>
                    {patient.disagreeReasons.join(', ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 월별 리포트 뷰
function MonthlyReportView({ data }: { data: MonthlyReportData }) {
  const { stats } = data;

  return (
    <div className="space-y-4">
      {/* 주요 지표 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Phone size={18} />
            <span className="text-sm">총 통화</span>
          </div>
          <div className="text-2xl font-bold">{stats.totalCalls}건</div>
          <div className="text-xs text-gray-400 mt-1">
            연결 {stats.connectedCalls} / 부재 {stats.missedCalls}
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Users size={18} />
            <span className="text-sm">신규 환자</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.newPatients}명</div>
          <div className="text-xs text-blue-500 mt-1">
            전환율 {stats.conversionRate}%
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <DollarSign size={18} />
            <span className="text-sm">실제 매출</span>
          </div>
          <div className="text-2xl font-bold text-green-700">
            {stats.actualRevenue.toLocaleString()}만원
          </div>
          <div className="text-xs text-green-500 mt-1">
            평균 {stats.avgDealSize.toLocaleString()}만원
          </div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <TrendingUp size={18} />
            <span className="text-sm">동의율</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">{stats.agreementRate}%</div>
          <div className="text-xs text-purple-500 mt-1">
            {stats.agreed}/{stats.totalConsultations}건
          </div>
        </div>
      </div>

      {/* 퍼널 현황 */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="font-medium mb-4">퍼널 현황</h3>
        <div className="flex items-center gap-2">
          {Object.entries(stats.funnel).map(([stage, count], index, arr) => (
            <React.Fragment key={stage}>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-gray-700">{count}</div>
                <div className="text-xs text-gray-500">
                  {stage === 'consulting' && '전화상담'}
                  {stage === 'reserved' && '내원예약'}
                  {stage === 'visited' && '내원완료'}
                  {stage === 'treatment' && '치료중'}
                  {stage === 'completed' && '치료완료'}
                  {stage === 'followup' && '사후관리'}
                </div>
              </div>
              {index < arr.length - 1 && (
                <div className="text-gray-300">→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 관심분야별 & 미동의 사유 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 관심분야별 */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-medium mb-4">관심분야별 현황</h3>
          <div className="space-y-3">
            {stats.interestBreakdown.slice(0, 5).map((item) => (
              <div key={item.interest} className="flex items-center justify-between">
                <span className="text-gray-700">{item.interest}</span>
                <div className="text-right">
                  <span className="font-medium">{item.count}건</span>
                  <span className="text-sm text-gray-400 ml-2">
                    ({item.revenue.toLocaleString()}만원)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 미동의 사유 */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="font-medium mb-4">미동의 사유 분석</h3>
          <div className="space-y-3">
            {stats.disagreeReasons.slice(0, 5).map((item) => (
              <div key={item.reason} className="flex items-center justify-between">
                <span className="text-gray-700">{item.reason}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-12 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
            {stats.disagreeReasons.length === 0 && (
              <div className="text-gray-400 text-center py-4">데이터 없음</div>
            )}
          </div>
        </div>
      </div>

      {/* 일별 추이 (간단 차트) */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="font-medium mb-4">일별 추이</h3>
        <div className="h-48 flex items-end gap-1">
          {stats.dailyTrends.map((day) => {
            const maxCalls = Math.max(...stats.dailyTrends.map((d) => d.calls), 1);
            const height = (day.calls / maxCalls) * 100;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center"
                title={`${day.date}: ${day.calls}건`}
              >
                <div
                  className="w-full bg-blue-400 rounded-t hover:bg-blue-500 transition-colors"
                  style={{ height: `${height}%`, minHeight: day.calls > 0 ? '4px' : '0' }}
                />
                <span className="text-[10px] text-gray-400 mt-1">
                  {day.date.split('-')[2]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
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
