// src/components/management/PatientManagement.tsx - 실시간 데이터 동기화 추가

'use client'

import { calculateCurrentProgress } from '@/store/slices/goalsSlice';
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RootState, AppDispatch } from '@/store'
import { fetchPatients, setFilters, setPage, initializeEventTargets, fetchPostVisitPatients } from '@/store/slices/patientsSlice'
import { setCurrentMenuItem, openPatientForm } from '@/store/slices/uiSlice'
// 🔥 데이터 동기화 유틸리티 import 추가
import { setupDataSyncListener, PatientDataSync } from '@/utils/dataSync'
import PatientList from './PatientList'
import CallHistory from './CallHistory'
import ScheduledCalls from './ScheduledCalls'
import OngoingConsultations from './OngoingConsultations'
import PatientFormModal from './PatientFormModal'
import PatientDetailModal from './PatientDetailModal'
import MessageLogModal from './MessageLogModal'
import { 
  HiOutlineSearch, 
  HiOutlineAdjustments, 
  HiOutlineUserAdd,
  HiOutlineDocumentText,
  HiOutlineCalendar,
  HiOutlineRefresh // 🔥 새로고침 아이콘 추가
} from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import EventTargetList from './EventTargetList'
import DeleteConfirmModal from './DeleteConfirmModal'

// 🔥 간소화된 날짜 필터 타입
type SimpleDateFilterType = 'all' | 'daily' | 'monthly';

export default function PatientManagement() {
  const dispatch = useDispatch<AppDispatch>()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  
  const isOptimisticEnabled = true
  
  const { currentMenuItem } = useSelector((state: RootState) => state.ui)
  
  const patientsState = useSelector((state: RootState) => state?.patients || {
    isLoading: true,
    selectedPatient: null,
    patients: [],
    filters: {
      searchTerm: '',
      status: 'all',
      interestArea: 'all',
      consultationType: 'all',
      referralSource: 'all',
      visitStatus: 'all'
    }
  })

  const { 
    isLoading = true, 
    selectedPatient = null, 
    patients = [], 
    filters = {
      searchTerm: '',
      status: 'all',
      interestArea: 'all',
      consultationType: 'all',
      referralSource: 'all',
      visitStatus: 'all'
    }
  } = patientsState
  
  const [activeTab, setActiveTab] = useState('환자 목록')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [interestFilter, setInterestFilter] = useState('all')
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all')
  const [visitStatusFilter, setVisitStatusFilter] = useState<'all' | 'visit_confirmed' | 'post_visit_needed'>('all')
  
  // 🔥 간소화된 날짜 필터 상태
  const [dateFilterType, setDateFilterType] = useState<SimpleDateFilterType>('all')
  
  // 일별 선택용 상태
  const [dailyStartDate, setDailyStartDate] = useState('')
  const [dailyEndDate, setDailyEndDate] = useState('')
  
  // 월별 선택용 상태
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  // 🔥 현재 연도와 월 목록 생성
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 5; year--) {
      years.push(year);
    }
    return years;
  }, []);

  const months = [
    { value: 1, label: '1월' },
    { value: 2, label: '2월' },
    { value: 3, label: '3월' },
    { value: 4, label: '4월' },
    { value: 5, label: '5월' },
    { value: 6, label: '6월' },
    { value: 7, label: '7월' },
    { value: 8, label: '8월' },
    { value: 9, label: '9월' },
    { value: 10, label: '10월' },
    { value: 11, label: '11월' },
    { value: 12, label: '12월' }
  ];

  // 🔥 월별 필터 날짜 범위 계산
  const getMonthlyDateRange = useCallback(() => {
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    
    // 해당 월의 마지막 일 계산
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    return { startDate, endDate };
  }, [selectedYear, selectedMonth]);

  // React Query로 환자 데이터 관리 + 실시간 동기화
  const {
    data: queryResult,
    isLoading: queryLoading,
    error: queryError,
    refetch: refetchPatients
  } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      console.log('🚀 React Query: 환자 데이터 로딩 시작');

      const response = await fetch('/api/patients', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('🚀 React Query: 환자 데이터 로딩 완료', result?.patients?.length || 0, '명');
      
      if (result.success && result.patients) {
        setTimeout(() => {
          dispatch(fetchPatients());
        }, 0);
      }
      
      return result;
    },
    staleTime: 30 * 1000, // 🔥 30초로 단축 (기존 2분에서)
    gcTime: 5 * 60 * 1000, // 🔥 5분으로 단축
    refetchOnWindowFocus: true, // 🔥 포커스시 새로고침 활성화
    refetchOnMount: true, // 🔥 마운트시 새로고침 활성화
    refetchInterval: isOptimisticEnabled ? 60 * 1000 : false, // 🔥 1분마다 자동 새로고침 (최적화 모드에서만)
    refetchIntervalInBackground: false,
    enabled: true,
    retry: 1,
    retryDelay: 1000,
  });

  // 🔥 데이터 동기화 리스너 설정
  useEffect(() => {
    console.log('📡 PatientManagement: 데이터 동기화 리스너 설정 시작');
    
    const cleanup = setupDataSyncListener(queryClient);
    
    return () => {
      console.log('📡 PatientManagement: 데이터 동기화 리스너 정리');
      cleanup();
    };
  }, [queryClient]);

  // 🔥 수동 데이터 새로고침 함수 추가
  const handleManualRefresh = useCallback(() => {
    console.log('🔄 수동 데이터 새로고침 시작');
    PatientDataSync.refreshAll('PatientManagement_manual');
    refetchPatients();
  }, [refetchPatients]);

  const queryPatients = queryResult?.patients || [];

  const backgroundRefresh = useCallback(() => {
    if (isOptimisticEnabled) {
      const lastRefresh = queryClient.getQueryState(['patients'])?.dataUpdatedAt;
      const now = Date.now();
      
      if (!lastRefresh || (now - lastRefresh) > 5 * 60 * 1000) {
        queryClient.invalidateQueries({ 
          queryKey: ['patients'],
          refetchType: 'none'
        });
      }
    }
  }, [queryClient, isOptimisticEnabled]);

  useEffect(() => {
    if (!isOptimisticEnabled) return;
    
    const interval = setInterval(backgroundRefresh, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [backgroundRefresh, isOptimisticEnabled]);

  // 🔥 간소화된 날짜 필터링 로직
  const filteredPatients = useMemo(() => {
    if (!queryPatients || !Array.isArray(queryPatients) || queryPatients.length === 0) return [];
    
    return queryPatients.filter((patient: any) => {
      if (!patient) return false;
      
      // 🔥 날짜 필터링
      if (dateFilterType !== 'all') {
        const callInDate = patient.callInDate;
        if (!callInDate) return false;
        
        if (dateFilterType === 'daily') {
          // 일별 선택: 사용자가 직접 선택한 기간
          if (dailyStartDate && dailyEndDate) {
            if (callInDate < dailyStartDate || callInDate > dailyEndDate) {
              return false;
            }
          }
        } else if (dateFilterType === 'monthly') {
          // 월별 선택: 선택한 연/월의 전체 기간
          const { startDate, endDate } = getMonthlyDateRange();
          if (callInDate < startDate || callInDate > endDate) {
            return false;
          }
        }
      }
      
      // 검색어 필터 (기존)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = patient.name?.toLowerCase()?.includes(searchLower) || false;
        const matchesPhone = patient.phoneNumber?.toLowerCase()?.includes(searchLower) || false;
        const matchesNotes = patient.notes?.toLowerCase()?.includes(searchLower) || false;
        if (!matchesName && !matchesPhone && !matchesNotes) return false;
      }
      
      // 상태 필터 (기존)
      if (statusFilter !== 'all' && patient.status !== statusFilter) return false;
      
      // 관심분야 필터 (기존)
      if (interestFilter !== 'all') {
        if (!patient.interestedServices?.includes(interestFilter)) return false;
      }
      
      // 상담타입 필터 (기존)
      if (consultationTypeFilter !== 'all' && patient.consultationType !== consultationTypeFilter) return false;
      
      // 내원상태 필터 (기존)
      if (visitStatusFilter !== 'all') {
        if (visitStatusFilter === 'visit_confirmed' && !patient.visitConfirmed) return false;
        if (visitStatusFilter === 'post_visit_needed' && (!patient.visitConfirmed || patient.postVisitStatus !== '재콜백필요')) return false;
      }
      
      return true;
    });
  }, [queryPatients, searchTerm, statusFilter, interestFilter, consultationTypeFilter, visitStatusFilter, dateFilterType, dailyStartDate, dailyEndDate, getMonthlyDateRange]);

  // 메모이제이션된 통계 계산 (기존 코드 유지)
  const filterStats = useMemo(() => {
    if (!Array.isArray(filteredPatients)) return { inboundCount: 0, outboundCount: 0, totalCount: 0, visitConfirmedCount: 0, postVisitNeededCount: 0 };
    
    const inboundCount = filteredPatients.filter((p: any) => p.consultationType === 'inbound').length;
    const outboundCount = filteredPatients.filter((p: any) => p.consultationType === 'outbound').length;
    const totalCount = filteredPatients.length;
    const visitConfirmedCount = filteredPatients.filter((p: any) => p.visitConfirmed).length;
    const postVisitNeededCount = filteredPatients.filter((p: any) => 
      p.visitConfirmed && p.postVisitStatus === '재콜백필요'
    ).length;
    
    return { inboundCount, outboundCount, totalCount, visitConfirmedCount, postVisitNeededCount };
  }, [filteredPatients]);

  if (!patientsState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">시스템을 초기화하는 중...</span>
      </div>
    )
  }

  // URL 파라미터에서 탭 정보 가져오기 (기존 코드 유지)
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      const tabMap: Record<string, string> = {
        'patients': '환자 목록',
        'calls': '콜 기록',
        'scheduled': '예정된 콜',
        'ongoing': '진행중 상담',
        'event-targets': '이벤트 타겟',
        'message-logs': '문자발송 내역',
      }
      const tab = tabMap[tabParam] || '환자 목록'
      dispatch(setCurrentMenuItem(tab))
      setActiveTab(tab)
    }
  }, [searchParams, dispatch])

  // 초기 데이터 로드 최적화 (기존 코드 유지)
  useEffect(() => {
    console.log('PatientManagement - 초기화 시작');
    
    if (!queryLoading && queryPatients && Array.isArray(queryPatients) && queryPatients.length > 0) {
      console.log('🚀 React Query 데이터 사용, Redux 동기화');
      setIsDataLoaded(true);
    }
    
    dispatch(initializeEventTargets());
    
  }, [dispatch, queryLoading, queryPatients.length]);

  // 목표 달성률 계산 최적화 (기존 코드 유지)
  useEffect(() => {
    if (filteredPatients && filteredPatients.length >= 0) {
      const timeoutId = setTimeout(() => {
        console.log('🎯 PatientManagement - 목표 달성률 재계산 시작, 환자 수:', filteredPatients.length);
        dispatch(calculateCurrentProgress({ patients: filteredPatients }));
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [dispatch, filteredPatients.length]);

  // 필터 상태 동기화 (기존 코드 유지)
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      dispatch(setFilters({
        searchTerm,
        status: statusFilter as any,
        interestArea: interestFilter,
        consultationType: consultationTypeFilter,
        visitStatus: visitStatusFilter
      }))
      dispatch(setPage(1))
    }, 1000)
      
    return () => clearTimeout(debounceTimer)
  }, [searchTerm, statusFilter, interestFilter, consultationTypeFilter, visitStatusFilter, dateFilterType, dailyStartDate, dailyEndDate, selectedYear, selectedMonth, dispatch])

  // 탭 변경 핸들러 최적화 (기존 코드 유지)
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    dispatch(setCurrentMenuItem(tab))
    
    if (tab === '환자 목록') {
      const queryState = queryClient.getQueryState(['patients']);
      const isStale = !queryState?.data || Date.now() - (queryState.dataUpdatedAt || 0) > 5 * 60 * 1000;
      
      if (isStale && (!queryPatients || queryPatients.length === 0)) {
        refetchPatients();
      }
      console.log('🎯 탭 변경: 환자 목록 - 캐시 상태 확인됨');
    } else if (tab === '이벤트 타겟') {
      dispatch(initializeEventTargets());
      console.log('🎯 탭 변경: 이벤트 타겟');
    }
  }, [dispatch, queryPatients?.length, refetchPatients, queryClient]);

  // 기존 핸들러들 (유지)
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleStatusFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  }, []);

  const handleConsultationTypeFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setConsultationTypeFilter(e.target.value as 'all' | 'inbound' | 'outbound');
  }, []);

  const handleVisitStatusFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setVisitStatusFilter(e.target.value as 'all' | 'visit_confirmed' | 'post_visit_needed');
  }, []);

  const handleInterestFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setInterestFilter(e.target.value);
  }, []);

  // 🔥 날짜 필터 핸들러들
  const handleDateFilterTypeChange = useCallback((filterType: SimpleDateFilterType) => {
    setDateFilterType(filterType);
    
    // 필터 타입 변경시 날짜 초기화
    if (filterType === 'all') {
      setDailyStartDate('');
      setDailyEndDate('');
    } else if (filterType === 'daily') {
      // 일별 선택시 오늘 날짜로 초기화
      const today = new Date().toISOString().split('T')[0];
      setDailyStartDate(today);
      setDailyEndDate(today);
    }
    // 월별은 이미 현재 연/월로 초기화되어 있음
  }, []);

  // 🔥 필터 초기화 핸들러
  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setInterestFilter('all');
    setConsultationTypeFilter('all');
    setVisitStatusFilter('all');
    setDateFilterType('all');
    setDailyStartDate('');
    setDailyEndDate('');
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth() + 1);
  }, []);

  // 🔥 현재 날짜 필터의 표시명 계산
  const getDateFilterDisplayText = () => {
    if (dateFilterType === 'all') return null;
    if (dateFilterType === 'daily' && dailyStartDate && dailyEndDate) {
      if (dailyStartDate === dailyEndDate) {
        return `📅 ${dailyStartDate}`;
      }
      return `📅 ${dailyStartDate} ~ ${dailyEndDate}`;
    }
    if (dateFilterType === 'monthly') {
      return `📅 ${selectedYear}년 ${selectedMonth}월`;
    }
    return null;
  };

  const { inboundCount, outboundCount, totalCount, visitConfirmedCount, postVisitNeededCount } = filterStats;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">상담 관리</h1>
          <div className="flex items-center space-x-4 mt-1">
            <span className="text-sm text-gray-600">
              전체: <strong>{totalCount}명</strong>
            </span>
            <span className="text-sm text-green-600">
              인바운드: <strong>{inboundCount}명</strong>
            </span>
            <span className="text-sm text-blue-600">
              아웃바운드: <strong>{outboundCount}명</strong>
            </span>
            <span className="text-sm text-indigo-600">
              내원확정: <strong>{visitConfirmedCount}명</strong>
            </span>
            <span className="text-sm text-yellow-600">
              추가콜백필요: <strong>{postVisitNeededCount}명</strong>
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* 🔥 수동 새로고침 버튼 추가 */}
          <button
            onClick={handleManualRefresh}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            title="데이터 새로고침"
          >
            <Icon icon={HiOutlineRefresh} size={16} />
            <span>새로고침</span>
          </button>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {isOptimisticEnabled ? '🚀 최적화 모드 + 실시간 동기화' : '🐌 일반 모드'} | 
              환자 수: {queryPatients?.length || 0} | 
              필터링: {totalCount} | 
              로딩: {queryLoading ? 'Y' : 'N'} |
              마지막 업데이트: {new Date().toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* 탭 메뉴 (기존 코드 유지) */}
      <div className="card p-0 mb-6">
        <div className="flex items-center overflow-x-auto">
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === '이벤트 타겟'
                ? 'text-primary bg-primary/10 rounded-t-lg'
                : 'text-text-secondary hover:bg-light-bg'
            }`}
            onClick={() => handleTabChange('이벤트 타겟')}
          >
            이벤트 타겟
            {activeTab === '이벤트 타겟' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === '환자 목록'
                ? 'text-primary bg-primary/10 rounded-t-lg'
                : 'text-text-secondary hover:bg-light-bg'
            }`}
            onClick={() => handleTabChange('환자 목록')}
          >
            환자 목록
            {activeTab === '환자 목록' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === '문자발송 내역'
                ? 'text-primary bg-primary/10 rounded-t-lg'
                : 'text-text-secondary hover:bg-light-bg'
            }`}
            onClick={() => handleTabChange('문자발송 내역')}
          >
            문자발송 내역
            {activeTab === '문자발송 내역' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
        </div>
      </div>

      {/* 🔥 최적화된 필터 영역 (날짜 필터 추가) */}
      {activeTab === '환자 목록' && (
        <div className="card mb-6">
          <div className="flex flex-col gap-4">
            {/* 첫 번째 줄: 검색, 상담타입, 내원상태, 환자상태, 관심분야 */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="환자명, 연락처 또는 메모 검색"
                  className="pl-10 pr-4 py-2 w-full bg-light-bg rounded-full text-sm focus:outline-none"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                <Icon 
                  icon={HiOutlineSearch} 
                  size={18} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" 
                />
              </div>

              <select
                className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary md:w-40"
                value={consultationTypeFilter}
                onChange={handleConsultationTypeFilterChange}
              >
                <option value="all">상담 타입 ▼</option>
                <option value="inbound">🟢 인바운드</option>
                <option value="outbound">🔵 아웃바운드</option>
              </select>

              <select
                className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary md:w-44"
                value={visitStatusFilter}
                onChange={handleVisitStatusFilterChange}
              >
                <option value="all">내원 상태 ▼</option>
                <option value="visit_confirmed">📋 내원확정</option>
                <option value="post_visit_needed">🔄 추가콜백필요</option>
              </select>

              <select
                className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary md:w-36"
                value={statusFilter}
                onChange={handleStatusFilterChange}
              >
                <option value="all">환자 상태 ▼</option>
                <option value="잠재고객">잠재고객</option>
                <option value="콜백필요">콜백필요</option>
                <option value="부재중">부재중</option>
                <option value="활성고객">활성고객</option>
                <option value="VIP">VIP</option>
                <option value="예약확정">예약 확정</option>
                <option value="종결">종결</option>
              </select>

              <select
                className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary md:w-36"
                value={interestFilter}
                onChange={handleInterestFilterChange}
              >
                <option value="all">관심 분야 ▼</option>
                <option value="단일 임플란트">단일 임플란트</option>
                <option value="다수 임플란트">다수 임플란트</option>
                <option value="무치악 임플란트">무치악 임플란트</option>
                <option value="틀니">틀니</option>
                <option value="라미네이트">라미네이트</option>
                <option value="충치치료">충치치료</option>
                <option value="기타">기타</option>
              </select>
            </div>

          {/* 🔥 두 번째 줄: 간소화된 날짜 필터 */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Icon icon={HiOutlineCalendar} size={18} className="text-text-muted" />
              <span className="text-sm text-text-secondary">콜 유입날짜:</span>
            </div>

            {/* 날짜 필터 타입 선택 버튼들 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDateFilterTypeChange('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  dateFilterType === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => handleDateFilterTypeChange('daily')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  dateFilterType === 'daily'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                일별 선택
              </button>
              <button
                onClick={() => handleDateFilterTypeChange('monthly')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  dateFilterType === 'monthly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                월별 선택
              </button>
            </div>

            {/* 🔥 일별 선택시 날짜 입력 필드 */}
            {dateFilterType === 'daily' && (
              <>
                <input
                  type="date"
                  value={dailyStartDate}
                  onChange={(e) => setDailyStartDate(e.target.value)}
                  className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
                />
                <span className="text-text-muted">~</span>
                <input
                  type="date"
                  value={dailyEndDate}
                  onChange={(e) => setDailyEndDate(e.target.value)}
                  className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
                />
              </>
            )}

            {/* 🔥 월별 선택시 연/월 선택 필드 */}
            {dateFilterType === 'monthly' && (
              <>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}년</option>
                  ))}
                </select>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
                >
                  {months.map(month => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </>
            )}

            <div className="flex-1"></div>

            <button
              className="px-6 py-2 bg-primary rounded-full text-sm font-medium text-white hover:bg-primary/90 transition-colors flex items-center gap-2"
              onClick={() => dispatch(openPatientForm())}
            >
              <Icon icon={HiOutlineUserAdd} size={16} />
              <span>+ 신규 환자</span>
            </button>
          </div>
          </div>

          {/* 🔥 필터 결과 요약 표시 */}
          {(consultationTypeFilter !== 'all' || statusFilter !== 'all' || interestFilter !== 'all' || visitStatusFilter !== 'all' || dateFilterType !== 'all' || searchTerm) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-blue-800 flex-wrap">
                  <span>🔍 필터링 결과: <strong>{totalCount}명</strong></span>
                  
                  {getDateFilterDisplayText() && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                      {getDateFilterDisplayText()}
                    </span>
                  )}
                  
                  {consultationTypeFilter !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                      {consultationTypeFilter === 'inbound' ? '🟢 인바운드' : '🔵 아웃바운드'}
                    </span>
                  )}
                  
                  {visitStatusFilter !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                      {visitStatusFilter === 'visit_confirmed' ? '📋 내원확정' : '🔄 추가콜백필요'}
                    </span>
                  )}
                  
                  {statusFilter !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                      {statusFilter}
                    </span>
                  )}
                  
                  {interestFilter !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                      {interestFilter}
                    </span>
                  )}
                  
                  {searchTerm && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                      "{searchTerm}"
                    </span>
                  )}
                </div>
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  전체 보기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 콘텐츠 영역 (기존 코드 유지) */}
      <div>
        {activeTab === '환자 목록' && (
          <PatientList 
            isLoading={queryLoading && (!queryPatients || queryPatients.length === 0)}
            filteredPatients={filteredPatients}
          />
        )}
        {activeTab === '이벤트 타겟' && <EventTargetList />}
        {activeTab === '문자발송 내역' && <MessageLogModal isOpen={true} onClose={() => {}} embedded={true} />}
        {activeTab === '콜 기록' && <CallHistory />}
        {activeTab === '예정된 콜' && <ScheduledCalls />}
        {activeTab === '진행중 상담' && <OngoingConsultations />}
      </div>

      <PatientFormModal />
      {selectedPatient && <PatientDetailModal />}
      <DeleteConfirmModal />
    </div>
  )
}