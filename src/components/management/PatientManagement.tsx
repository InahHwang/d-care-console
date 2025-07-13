// src/components/management/PatientManagement.tsx - 박스 형태 필터 적용

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
  HiOutlineRefresh
} from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import EventTargetList from './EventTargetList'
import DeleteConfirmModal from './DeleteConfirmModal'
import { selectPatientWithContext } from '@/store/slices/patientsSlice'

// 🔥 간소화된 날짜 필터 타입
type SimpleDateFilterType = 'all' | 'daily' | 'monthly';

// 🔥 박스 필터 타입 추가
type BoxFilterType = 'all' | 'unprocessed_callback' | 'post_reservation_unvisited' | 'visit_confirmed' | 'additional_callback_needed' | 'today_reservation';

export default function PatientManagement() {
  // 🔧 환자 선택 함수 수정 (기존 selectPatient 사용하는 모든 곳)
  const handleSelectPatient = (patientId: string) => {
    // 🔧 management 컨텍스트와 함께 환자 선택  
    dispatch(selectPatientWithContext(patientId, 'management'));
  };
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
  const [interestFilter, setInterestFilter] = useState('all')
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all')
  
  // 🔥 기존 statusFilter, visitStatusFilter 제거하고 박스 필터 추가
  const [selectedBoxFilter, setSelectedBoxFilter] = useState<BoxFilterType>('all')
  
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
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: isOptimisticEnabled ? 60 * 1000 : false,
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

  // 🔥 미처리 콜백 체크 헬퍼 함수
  const hasOverdueCallbacks = useCallback((patient: any): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return (patient.callbackHistory || []).some((callback: any) => 
      callback.status === '예정' &&
      callback.date < today
    );
  }, []);

  // 🔥 수정된 필터링 로직 - 박스 필터 적용
  const filteredPatients = useMemo(() => {
    if (!queryPatients || !Array.isArray(queryPatients) || queryPatients.length === 0) return [];
    
    return queryPatients.filter((patient: any) => {
      if (!patient) return false;
      
      // 🔥 날짜 필터링
      if (dateFilterType !== 'all') {
        const callInDate = patient.callInDate;
        if (!callInDate) return false;
        
        if (dateFilterType === 'daily') {
          if (dailyStartDate && dailyEndDate) {
            if (callInDate < dailyStartDate || callInDate > dailyEndDate) {
              return false;
            }
          }
        } else if (dateFilterType === 'monthly') {
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
      
      // 관심분야 필터 (기존)
      if (interestFilter !== 'all') {
        if (!patient.interestedServices?.includes(interestFilter)) return false;
      }
      
      // 상담타입 필터 (기존)
      if (consultationTypeFilter !== 'all' && patient.consultationType !== consultationTypeFilter) return false;
      
      // 🔥 박스 필터 적용
      if (selectedBoxFilter !== 'all') {
        switch (selectedBoxFilter) {
          case 'unprocessed_callback':
            return hasOverdueCallbacks(patient);
          case 'post_reservation_unvisited':
            return patient.hasBeenPostReservationPatient === true;
          case 'visit_confirmed':
            return patient.visitConfirmed === true;
          case 'additional_callback_needed':
            return patient.visitConfirmed === true && patient.postVisitStatus === '재콜백필요';
          case 'today_reservation':
            return patient.isTodayReservationPatient === true;
          default:
            return true;
        }
      }
      
      return true;
    });
  }, [queryPatients, searchTerm, interestFilter, consultationTypeFilter, selectedBoxFilter, dateFilterType, dailyStartDate, dailyEndDate, getMonthlyDateRange, hasOverdueCallbacks]);

  // 🔥 날짜 필터링 적용된 환자 목록 (박스 통계용)
  const dateFilteredPatients = useMemo(() => {
    if (!queryPatients || !Array.isArray(queryPatients)) return [];
    
    return queryPatients.filter((patient: any) => {
      if (!patient) return false;
      
      // 🔥 날짜 필터링만 적용
      if (dateFilterType !== 'all') {
        const callInDate = patient.callInDate;
        if (!callInDate) return false;
        
        if (dateFilterType === 'daily') {
          if (dailyStartDate && dailyEndDate) {
            if (callInDate < dailyStartDate || callInDate > dailyEndDate) {
              return false;
            }
          }
        } else if (dateFilterType === 'monthly') {
          const { startDate, endDate } = getMonthlyDateRange();
          if (callInDate < startDate || callInDate > endDate) {
            return false;
          }
        }
      }
      
      return true;
    });
  }, [queryPatients, dateFilterType, dailyStartDate, dailyEndDate, getMonthlyDateRange]);

  // 🔥 수정된 통계 계산 - 날짜 필터링 적용된 환자 기준
  const boxStats = useMemo(() => {
    if (!Array.isArray(dateFilteredPatients)) return {
      total: 0,
      unprocessedCallbacks: 0,
      postReservationUnvisited: 0,
      visitConfirmed: 0,
      additionalCallbackNeeded: 0,
      todayReservations: 0
    };
    
    const total = dateFilteredPatients.length;
    const unprocessedCallbacks = dateFilteredPatients.filter(p => hasOverdueCallbacks(p)).length;
    const postReservationUnvisited = dateFilteredPatients.filter(p => p.hasBeenPostReservationPatient === true).length;
    const visitConfirmed = dateFilteredPatients.filter(p => p.visitConfirmed === true).length;
    const additionalCallbackNeeded = dateFilteredPatients.filter(p => 
      p.visitConfirmed === true && p.postVisitStatus === '재콜백필요'
    ).length;
    const todayReservations = dateFilteredPatients.filter(p => p.isTodayReservationPatient === true).length;
    
    return {
      total,
      unprocessedCallbacks,
      postReservationUnvisited,
      visitConfirmed,
      additionalCallbackNeeded,
      todayReservations
    };
  }, [dateFilteredPatients, hasOverdueCallbacks]);

  // 🔥 기존 통계 계산 (헤더 표시용)
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

  // 🔥 수정된 필터 상태 동기화
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      dispatch(setFilters({
        searchTerm,
        status: 'all', // 기존 상태 필터 제거
        interestArea: interestFilter,
        consultationType: consultationTypeFilter,
        visitStatus: 'all' // 기존 내원상태 필터 제거
      }))
      dispatch(setPage(1))
    }, 1000)
      
    return () => clearTimeout(debounceTimer)
  }, [searchTerm, interestFilter, consultationTypeFilter, selectedBoxFilter, dateFilterType, dailyStartDate, dailyEndDate, selectedYear, selectedMonth, dispatch])

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

  const handleConsultationTypeFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setConsultationTypeFilter(e.target.value as 'all' | 'inbound' | 'outbound');
  }, []);

  const handleInterestFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setInterestFilter(e.target.value);
  }, []);

  // 🔥 박스 클릭 핸들러 추가
  const handleBoxClick = useCallback((boxType: BoxFilterType) => {
    setSelectedBoxFilter(boxType);
    // 다른 필터들도 초기화할 수 있음
    if (boxType !== 'all') {
      setSearchTerm('');
      setInterestFilter('all');
      setConsultationTypeFilter('all');
      setDateFilterType('all');
      setDailyStartDate('');
      setDailyEndDate('');
    }
  }, []);

  // 🔥 날짜 필터 핸들러들
  const handleDateFilterTypeChange = useCallback((filterType: SimpleDateFilterType) => {
    setDateFilterType(filterType);
    
    if (filterType === 'all') {
      setDailyStartDate('');
      setDailyEndDate('');
    } else if (filterType === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      setDailyStartDate(today);
      setDailyEndDate(today);
    }
  }, []);

  // 🔥 필터 초기화 핸들러
  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setInterestFilter('all');
    setConsultationTypeFilter('all');
    setSelectedBoxFilter('all');
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

  // 🔥 박스 데이터 정의
  const statusBoxes = [
    { 
      key: 'all' as BoxFilterType, 
      label: '전체 보기', 
      count: boxStats.total, 
      color: 'bg-white hover:bg-gray-50',
      textColor: 'text-gray-900'
    },
    { 
      key: 'unprocessed_callback' as BoxFilterType, 
      label: '미처리 콜백', 
      count: boxStats.unprocessedCallbacks, 
      color: 'bg-white hover:bg-red-50',
      textColor: 'text-red-600'
    },
    { 
      key: 'post_reservation_unvisited' as BoxFilterType, 
      label: '예약 후 미내원', 
      count: boxStats.postReservationUnvisited, 
      color: 'bg-white hover:bg-orange-50',
      textColor: 'text-orange-600'
    },
    { 
      key: 'visit_confirmed' as BoxFilterType, 
      label: '내원 확정', 
      count: boxStats.visitConfirmed, 
      color: 'bg-white hover:bg-green-50',
      textColor: 'text-green-600'
    },
    { 
      key: 'additional_callback_needed' as BoxFilterType, 
      label: '추가 콜백 필요', 
      count: boxStats.additionalCallbackNeeded, 
      color: 'bg-white hover:bg-yellow-50',
      textColor: 'text-yellow-600'
    },
    { 
      key: 'today_reservation' as BoxFilterType, 
      label: '오늘 예약', 
      count: boxStats.todayReservations, 
      color: 'bg-white hover:bg-blue-50',
      textColor: 'text-blue-600'
    }
  ];

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

      {/* 🔥 수정된 필터 영역 - 상태/내원상태 필터 제거 */}
      {activeTab === '환자 목록' && (
        <div className="card mb-6">
          <div className="flex flex-col gap-4">
            {/* 첫 번째 줄: 검색, 상담타입, 관심분야 */}
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

              <button
                className="px-6 py-2 bg-primary rounded-full text-sm font-medium text-white hover:bg-primary/90 transition-colors flex items-center gap-2"
                onClick={() => dispatch(openPatientForm())}
              >
                <Icon icon={HiOutlineUserAdd} size={16} />
                <span>+ 신규 환자</span>
              </button>
            </div>

            {/* 두 번째 줄: 간소화된 날짜 필터 */}
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

              {/* 일별 선택시 날짜 입력 필드 */}
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

              {/* 월별 선택시 연/월 선택 필드 */}
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
            </div>
          </div>

          {/* 🔥 수정된 필터 결과 요약 표시 */}
          {(consultationTypeFilter !== 'all' || interestFilter !== 'all' || dateFilterType !== 'all' || searchTerm || selectedBoxFilter !== 'all') && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-blue-800 flex-wrap">
                  <span>🔍 필터링 결과: <strong>{totalCount}명</strong></span>
                  
                  {/* 🔥 박스 필터 표시 */}
                  {selectedBoxFilter !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                      {statusBoxes.find(b => b.key === selectedBoxFilter)?.label}
                    </span>
                  )}
                  
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

      {/* 🔥 박스 형태 상태 카드 (검색창 섹션 아래로 이동) */}
      {activeTab === '환자 목록' && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          {statusBoxes.map((box) => (
            <div 
              key={box.key}
              className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                selectedBoxFilter === box.key 
                  ? 'ring-2 ring-blue-500 shadow-lg' 
                  : 'hover:shadow-lg'
              } ${box.color}`}
              onClick={() => handleBoxClick(box.key)}
            >
              <div className={`text-2xl font-bold ${box.textColor}`}>
                {box.count}
              </div>
              <div className="text-sm text-gray-600">{box.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 콘텐츠 영역 (기존 코드 유지) */}
      <div>
        {activeTab === '환자 목록' && (
          <PatientList 
            isLoading={queryLoading && (!queryPatients || queryPatients.length === 0)}
            filteredPatients={filteredPatients}
            onSelectPatient={handleSelectPatient} // 🆕 핸들러 전달
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