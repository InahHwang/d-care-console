// src/components/management/PatientManagement.tsx - 성능 최적화 버전
'use client'

// 🚀 기존 imports에 React Query 추가
import { calculateCurrentProgress } from '@/store/slices/goalsSlice';
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RootState, AppDispatch } from '@/store'
import { fetchPatients, setFilters, setPage, initializeEventTargets, fetchPostVisitPatients } from '@/store/slices/patientsSlice'
import { setCurrentMenuItem, openPatientForm } from '@/store/slices/uiSlice'
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
  HiOutlineDocumentText
} from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import EventTargetList from './EventTargetList'
import DeleteConfirmModal from './DeleteConfirmModal'

export default function PatientManagement() {
  const dispatch = useDispatch<AppDispatch>()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  
  // 🚀 Optimistic Update 활성화
  const isOptimisticEnabled = true
  
  const { currentMenuItem } = useSelector((state: RootState) => state.ui)
  
  const patientsState = useSelector((state: RootState) => state.patients)
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
  } = patientsState || {}
  
  const [activeTab, setActiveTab] = useState('환자 목록')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [interestFilter, setInterestFilter] = useState('all')
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all')
  const [visitStatusFilter, setVisitStatusFilter] = useState<'all' | 'visit_confirmed' | 'post_visit_needed'>('all')
  
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  // 🚀 React Query로 환자 데이터 관리
  const {
    data: queryResult,
    isLoading: queryLoading,
    error: queryError,
    refetch: refetchPatients
  } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      console.log('🚀 React Query: 환자 데이터 로딩 시작');
      const result = await dispatch(fetchPatients()).unwrap();
      console.log('🚀 React Query: 환자 데이터 로딩 완료', result?.patients?.length || 0, '명');
      return result;
    },
    staleTime: 30 * 1000, // 30초간 fresh
    gcTime: 5 * 60 * 1000, // 5분간 캐시 유지
    refetchOnWindowFocus: false,
    refetchOnMount: false, // 마운트시 자동 refetch 방지
    enabled: true,
  });

  // 환자 배열 추출
  const queryPatients = queryResult?.patients || [];

  // 🚀 백그라운드 데이터 갱신 (사용자 모르게)
  const backgroundRefresh = useCallback(() => {
    if (isOptimisticEnabled) {
      queryClient.invalidateQueries({ 
        queryKey: ['patients'],
        refetchType: 'none' // UI 로딩 없이 백그라운드에서만 갱신
      });
    }
  }, [queryClient, isOptimisticEnabled]);

  // 🚀 주기적 백그라운드 갱신 (5분마다)
  useEffect(() => {
    if (!isOptimisticEnabled) return;
    
    const interval = setInterval(backgroundRefresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [backgroundRefresh, isOptimisticEnabled]);

  // 🚀 메모이제이션된 필터링 (서버 요청 없이 클라이언트에서)
  const filteredPatients = useMemo(() => {
    if (!queryPatients || !Array.isArray(queryPatients) || queryPatients.length === 0) return [];
    
    return queryPatients.filter((patient: any) => {
      // 검색어 필터
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = patient.name?.toLowerCase().includes(searchLower);
        const matchesPhone = patient.phoneNumber?.toLowerCase().includes(searchLower);
        const matchesNotes = patient.notes?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesPhone && !matchesNotes) return false;
      }
      
      // 상태 필터
      if (statusFilter !== 'all' && patient.status !== statusFilter) return false;
      
      // 관심분야 필터
      if (interestFilter !== 'all') {
        if (!patient.interestedServices?.includes(interestFilter)) return false;
      }
      
      // 상담타입 필터
      if (consultationTypeFilter !== 'all' && patient.consultationType !== consultationTypeFilter) return false;
      
      // 내원상태 필터
      if (visitStatusFilter !== 'all') {
        if (visitStatusFilter === 'visit_confirmed' && !patient.visitConfirmed) return false;
        if (visitStatusFilter === 'post_visit_needed' && (!patient.visitConfirmed || patient.postVisitStatus !== '재콜백필요')) return false;
      }
      
      return true;
    });
  }, [queryPatients, searchTerm, statusFilter, interestFilter, consultationTypeFilter, visitStatusFilter]);

  // 🚀 메모이제이션된 통계 계산
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
        <span className="ml-2 text-gray-600">환자 데이터를 불러오는 중...</span>
      </div>
    )
  }

  // URL 파라미터에서 탭 정보 가져오기
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

  // 🚀 초기 데이터 로드 최적화
  useEffect(() => {
    console.log('PatientManagement - 초기화 시작');
    
    // React Query가 자동으로 데이터 로드하므로 중복 방지
    if (!queryLoading && queryPatients && Array.isArray(queryPatients) && queryPatients.length > 0) {
      console.log('🚀 React Query 데이터 사용, Redux 동기화');
      setIsDataLoaded(true);
    }
    
    // 이벤트 타겟 초기화
    dispatch(initializeEventTargets());
    
  }, [dispatch, queryLoading, queryPatients.length]);

  // 🚀 목표 달성률 계산 최적화 (debounced)
  useEffect(() => {
    if (filteredPatients && filteredPatients.length >= 0) {
      const timeoutId = setTimeout(() => {
        console.log('🎯 PatientManagement - 목표 달성률 재계산 시작, 환자 수:', filteredPatients.length);
        dispatch(calculateCurrentProgress({ patients: filteredPatients }));
      }, 500); // 0.5초 debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [dispatch, filteredPatients]);

  // 🚀 필터 상태 동기화 (Redux와 로컬 상태)
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      // Redux 필터 상태도 업데이트 (다른 컴포넌트와 동기화용)
      dispatch(setFilters({
        searchTerm,
        status: statusFilter as any,
        interestArea: interestFilter,
        consultationType: consultationTypeFilter,
        visitStatus: visitStatusFilter
      }))
      dispatch(setPage(1))
    }, 300)
    
    return () => clearTimeout(debounceTimer)
  }, [searchTerm, statusFilter, interestFilter, consultationTypeFilter, visitStatusFilter, dispatch])

  // 🚀 탭 변경 핸들러 최적화
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    dispatch(setCurrentMenuItem(tab))
    
    if (tab === '환자 목록') {
      // React Query 캐시 사용으로 즉시 표시
      if (!queryPatients || queryPatients.length === 0) {
        refetchPatients(); // 캐시가 없을 때만 새로 로드
      }
      console.log('🎯 탭 변경: 환자 목록 - 캐시된 데이터 사용');
    } else if (tab === '이벤트 타겟') {
      // 이벤트 타겟 데이터 갱신
      dispatch(initializeEventTargets());
      console.log('🎯 탭 변경: 이벤트 타겟');
    }
  }, [dispatch, queryPatients?.length, refetchPatients]);

  // 🚀 검색 핸들러 최적화
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

  // 🚀 필터 초기화 핸들러
  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setInterestFilter('all');
    setConsultationTypeFilter('all');
    setVisitStatusFilter('all');
  }, []);

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
        
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {isOptimisticEnabled ? '🚀 최적화 모드' : '🐌 일반 모드'} | 
            환자 수: {queryPatients?.length || 0} | 
            필터링: {totalCount} | 
            로딩: {queryLoading ? 'Y' : 'N'}
          </div>
        )}
      </div>

      {/* 탭 메뉴 */}
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

      {/* 🚀 최적화된 필터 영역 */}
      {activeTab === '환자 목록' && (
        <div className="card mb-6">
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
              <option value="임플란트">임플란트</option>
              <option value="교정">교정</option>
              <option value="미백">미백</option>
              <option value="신경치료">신경치료</option>
              <option value="충치치료">충치치료</option>
            </select>

            <button
              className="px-6 py-2 bg-primary rounded-full text-sm font-medium text-white hover:bg-primary/90 transition-colors flex items-center gap-2"
              onClick={() => dispatch(openPatientForm())}
            >
              <Icon icon={HiOutlineUserAdd} size={16} />
              <span>+ 신규 환자</span>
            </button>
          </div>

          {/* 🚀 필터 결과 요약 표시 */}
          {(consultationTypeFilter !== 'all' || statusFilter !== 'all' || interestFilter !== 'all' || visitStatusFilter !== 'all' || searchTerm) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-blue-800">
                  <span>🔍 필터링 결과: <strong>{totalCount}명</strong></span>
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

      {/* 🚀 최적화된 콘텐츠 영역 */}
      <div>
        {activeTab === '환자 목록' && (
          <PatientList 
            isLoading={queryLoading && (!queryPatients || queryPatients.length === 0)} 
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