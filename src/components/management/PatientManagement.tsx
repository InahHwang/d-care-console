// src/components/management/PatientManagement.tsx - 내원 관리 탭 제거 버전
'use client'
// 🔥 기존 imports에 추가
import { calculateCurrentProgress } from '@/store/slices/goalsSlice';
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'next/navigation'
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
// 🔥 VisitManagement import 제거 (사이드바에서 접근)
import { 
  HiOutlineSearch, 
  HiOutlineAdjustments, 
  HiOutlineUserAdd,
  HiOutlineDocumentText
  // 🔥 HiOutlineClipboardCheck import 제거
} from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import EventTargetList from './EventTargetList'
import DeleteConfirmModal from './DeleteConfirmModal'

export default function PatientManagement() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()
  
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
  // 🔥 내원 상태 필터 유지 (환자 목록에서 사용)
  const [visitStatusFilter, setVisitStatusFilter] = useState<'all' | 'visit_confirmed' | 'post_visit_needed'>('all')
  
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  if (!patientsState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">환자 데이터를 불러오는 중...</span>
      </div>
    )
  }

  // URL 파라미터에서 탭 정보 가져오기 - 내원 관리 제거
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
        // 🔥 'visit-management': '내원 관리' 제거
      }
      const tab = tabMap[tabParam] || '환자 목록'
      dispatch(setCurrentMenuItem(tab))
      setActiveTab(tab)
    }
  }, [searchParams, dispatch])

  // 초기 데이터 로드
  useEffect(() => {
    console.log('PatientManagement - 초기 데이터 로드 시작');
    
    dispatch(fetchPatients())
      .then(() => {
        console.log('환자 데이터 로드 완료');
        setIsDataLoaded(true);
      })
      .catch(error => {
        console.error('환자 데이터 로드 실패:', error);
        setIsDataLoaded(true);
      });
    
    // 🔥 이벤트 타겟 초기화 복원
    dispatch(initializeEventTargets());
    
    // 🔥 내원 후 관리 환자 데이터는 사이드바 메뉴에서만 로드
    // dispatch(fetchPostVisitPatients()); 제거
    
  }, [dispatch]);

  useEffect(() => {
    if (patients && patients.length >= 0) {
      console.log('🎯 PatientManagement - 목표 달성률 재계산 시작, 환자 수:', patients.length);
      dispatch(calculateCurrentProgress({ patients }));
    }
  }, [dispatch, patients]);

  // 🔥 필터 적용 - visitStatusFilter 유지 (환자 목록용)
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
    }, 300)
    
    return () => clearTimeout(debounceTimer)
  }, [searchTerm, statusFilter, interestFilter, consultationTypeFilter, visitStatusFilter, dispatch])

  // 탭 변경 핸들러 - 내원 관리 케이스 제거
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    dispatch(setCurrentMenuItem(tab))
    
    if (tab === '환자 목록') {
      dispatch(fetchPatients()).then(() => {
        console.log('🎯 탭 변경으로 인한 데이터 재로드 후 목표 재계산');
      });
    } else if (tab === '이벤트 타겟') {
      // 🔥 이벤트 타겟 탭으로 이동할 때 데이터 새로고침
      dispatch(fetchPatients()).then(() => {
        dispatch(initializeEventTargets());
      });
    }
    // 🔥 내원 관리 탭 처리 로직 제거
  }

  const getFilterStats = () => {
    const inboundCount = patients.filter(p => p.consultationType === 'inbound').length;
    const outboundCount = patients.filter(p => p.consultationType === 'outbound').length;
    const totalCount = patients.length;
    // 🔥 내원 관련 통계는 유지 (환자 목록에서 표시용)
    const visitConfirmedCount = patients.filter(p => p.visitConfirmed).length;
    const postVisitNeededCount = patients.filter(p => 
      p.visitConfirmed && p.postVisitStatus === '재콜백필요'
    ).length;
    
    return { inboundCount, outboundCount, totalCount, visitConfirmedCount, postVisitNeededCount };
  };

  const { inboundCount, outboundCount, totalCount, visitConfirmedCount, postVisitNeededCount } = getFilterStats();

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
            {/* 🔥 내원 관련 통계 유지 (정보 제공용) */}
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
            환자 수: {patients?.length || 0} | 로딩: {isLoading ? 'Y' : 'N'}
          </div>
        )}
      </div>

      {/* 🔥 탭 메뉴 - 내원 관리 탭 제거 */}
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
          {/* 🔥 내원 관리 탭 완전 제거 */}
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

      {/* 🔥 필터 영역 - 내원 관리 탭 조건 제거 */}
      {activeTab === '환자 목록' && (
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="환자명, 연락처 또는 메모 검색"
                className="pl-10 pr-4 py-2 w-full bg-light-bg rounded-full text-sm focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              onChange={(e) => setConsultationTypeFilter(e.target.value as 'all' | 'inbound' | 'outbound')}
            >
              <option value="all">상담 타입 ▼</option>
              <option value="inbound">🟢 인바운드</option>
              <option value="outbound">🔵 아웃바운드</option>
            </select>

            {/* 🔥 내원 상태 필터 유지 (환자 목록에서 유용) */}
            <select
              className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary md:w-44"
              value={visitStatusFilter}
              onChange={(e) => setVisitStatusFilter(e.target.value as 'all' | 'visit_confirmed' | 'post_visit_needed')}
            >
              <option value="all">내원 상태 ▼</option>
              <option value="visit_confirmed">📋 내원확정</option>
              <option value="post_visit_needed">🔄 추가콜백필요</option>
            </select>

            <select
              className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary md:w-36"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              onChange={(e) => setInterestFilter(e.target.value)}
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

          {/* 🔥 필터 결과 요약 표시 - visitStatusFilter 유지 */}
          {(consultationTypeFilter !== 'all' || statusFilter !== 'all' || interestFilter !== 'all' || visitStatusFilter !== 'all' || searchTerm) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-blue-800">
                  <span>🔍 필터링 결과:</span>
                  {consultationTypeFilter !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                      {consultationTypeFilter === 'inbound' ? '🟢 인바운드' : '🔵 아웃바운드'}
                    </span>
                  )}
                  {/* 🔥 내원 상태 필터 표시 유지 */}
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
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setInterestFilter('all');
                    setConsultationTypeFilter('all');
                    setVisitStatusFilter('all');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  전체 보기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 콘텐츠 영역 - 내원 관리 케이스 제거 */}
      <div>
        {activeTab === '환자 목록' && <PatientList isLoading={isLoading && !isDataLoaded} />}
        {activeTab === '이벤트 타겟' && <EventTargetList />}
        {/* 🔥 내원 관리 케이스 제거 */}
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