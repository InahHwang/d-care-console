// src/app/v2/patients/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Pagination } from '@/components/v2/ui/Pagination';
import { PatientList } from '@/components/v2/patients';
import { FunnelTabs, PatientFilterType } from '@/components/v2/patients/FunnelTabs';
import { UrgentSummaryCards, UrgencyFilter, UrgentStats } from '@/components/v2/patients/UrgentSummaryCards';
import { PeriodFilter, PeriodType, DateRange } from '@/components/v2/patients/PeriodFilter';
import { PatientStatus, Temperature } from '@/types/v2';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

type PaymentStatus = 'none' | 'partial' | 'completed';

interface Patient {
  id: string;
  name: string;
  phone: string;
  status: PatientStatus;
  temperature: Temperature;
  consultationType?: string;
  interest: string;
  source?: string;
  createdAt: string;
  lastContactAt: string;
  lastCallDirection?: 'inbound' | 'outbound';
  nextAction?: string;
  nextActionDate?: string | null;
  daysInStatus?: number;
  urgency?: 'noshow' | 'today' | 'overdue' | 'normal';
  // 금액 관련 필드
  estimatedAmount?: number;
  actualAmount?: number;
  paymentStatus?: PaymentStatus;
}

interface FilterStats {
  all: number;
  consulting: number;
  reserved: number;
  visited: number;
  treatmentBooked: number;
  treatment: number;
  completed: number;
  followup: number;
  closed: number;
}

interface PatientResponse {
  patients: Patient[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  filterStats: FilterStats | null;
  urgentStats: UrgentStats | null;
}

function PatientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilter = (searchParams.get('status') as PatientFilterType) || 'all';
  const initialPage = parseInt(searchParams.get('page') || '1');
  const initialSearch = searchParams.get('search') || '';
  const initialUrgency = (searchParams.get('urgency') as UrgencyFilter) || 'all';
  const initialPeriod = (searchParams.get('period') as PeriodType) || '3months';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PatientFilterType>(initialFilter);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>(initialUrgency);
  const [period, setPeriod] = useState<PeriodType>(initialPeriod);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: initialStartDate,
    endDate: initialEndDate,
  });
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1 });
  const [filterStats, setFilterStats] = useState<FilterStats | null>(null);
  const [urgentStats, setUrgentStats] = useState<UrgentStats | null>(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '20');

      // 기간 필터: custom이면 startDate/endDate 사용, 아니면 period 사용
      if (period === 'custom' && dateRange.startDate && dateRange.endDate) {
        params.set('startDate', dateRange.startDate);
        params.set('endDate', dateRange.endDate);
      } else if (period !== 'custom') {
        params.set('period', period);
      }

      if (activeFilter !== 'all') {
        params.set('status', activeFilter);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      if (urgencyFilter !== 'all') {
        params.set('urgency', urgencyFilter);
      }

      const response = await fetchWithAuth(`/api/v2/patients?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data: PatientResponse = await response.json();
      setPatients(data.patients);
      setPagination({
        totalCount: data.pagination.totalCount,
        totalPages: data.pagination.totalPages,
      });
      if (data.filterStats) {
        setFilterStats(data.filterStats);
      }
      if (data.urgentStats) {
        setUrgentStats(data.urgentStats);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, activeFilter, searchQuery, urgencyFilter, period, dateRange]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeFilter !== 'all') params.set('status', activeFilter);
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (searchQuery) params.set('search', searchQuery);
    if (urgencyFilter !== 'all') params.set('urgency', urgencyFilter);
    if (period === 'custom') {
      params.set('period', 'custom');
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);
    } else if (period !== '3months') {
      params.set('period', period);
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '/v2/patients';
    window.history.replaceState(null, '', newUrl);
  }, [activeFilter, currentPage, searchQuery, urgencyFilter, period, dateRange]);

  const handleFilterChange = (filter: PatientFilterType) => {
    setActiveFilter(filter);
    setUrgencyFilter('all'); // 상태 필터 변경 시 긴급 필터 초기화
    setCurrentPage(1);
  };

  const handleUrgencyFilterChange = (filter: UrgencyFilter) => {
    setUrgencyFilter(filter);
    setActiveFilter('all'); // 긴급 필터 변경 시 상태 필터 초기화
    setCurrentPage(1);
  };

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    if (newPeriod !== 'custom') {
      setDateRange({ startDate: '', endDate: '' }); // 프리셋 선택 시 커스텀 범위 초기화
    }
    setCurrentPage(1);
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    setPeriod('custom');
    setCurrentPage(1);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handlePatientClick = (patient: Patient) => {
    router.push(`/v2/patients/${patient.id}`);
  };

  const handleCallClick = (patient: Patient) => {
    window.dispatchEvent(new CustomEvent('cti-call', { detail: { phone: patient.phone } }));
  };

  const handleAddPatient = () => {
    router.push('/v2/patients/new');
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">환자 관리</h2>
              <p className="text-sm text-gray-500 mt-1">총 {pagination.totalCount}명</p>
            </div>
            <PeriodFilter
              value={period}
              onChange={handlePeriodChange}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          </div>
          <button
            onClick={handleAddPatient}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <Plus size={18} />
            환자 등록
          </button>
        </div>
      </div>

      {/* 긴급 요약 카드 */}
      <div className="bg-white border-b px-6 py-4">
        <UrgentSummaryCards
          stats={urgentStats}
          activeFilter={urgencyFilter}
          onFilterChange={handleUrgencyFilterChange}
          loading={loading && !urgentStats}
        />
      </div>

      {/* 상태 필터 */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <FunnelTabs
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            stats={filterStats}
            loading={loading && !filterStats}
          />

          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 전화번호 검색"
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 환자 목록 */}
      <div className="flex-1 overflow-auto p-6">
        <PatientList
          patients={patients}
          onPatientClick={handlePatientClick}
          onCallClick={handleCallClick}
          loading={loading}
        />

        {/* 페이지네이션 */}
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-gray-500">{pagination.totalCount}명</p>
          {pagination.totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">로딩 중...</div>}>
      <PatientsPageContent />
    </Suspense>
  );
}
