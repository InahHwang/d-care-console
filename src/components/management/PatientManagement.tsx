// src/components/management/PatientManagement.tsx

'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'next/navigation'
import { RootState, AppDispatch } from '@/store'
import { fetchPatients, setFilters, setPage, initializeEventTargets } from '@/store/slices/patientsSlice'
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
import { Icon } from '../common/Icon'
import EventTargetList from './EventTargetList'

export default function PatientManagement() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()
  
  const { currentMenuItem } = useSelector((state: RootState) => state.ui)
const { isLoading, selectedPatient } = useSelector((state: RootState) => state.patients)
  
  // 현재 탭 상태를 별도로 관리
  const [activeTab, setActiveTab] = useState('환자 목록')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [interestFilter, setInterestFilter] = useState('all')
  
  // 데이터 로딩 상태 추가
  const [isDataLoaded, setIsDataLoaded] = useState(false)

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
        'message-logs': '문자발송 내역', // 새로운 탭 추가
      }
      const tab = tabMap[tabParam] || '환자 목록'
      dispatch(setCurrentMenuItem(tab))
      setActiveTab(tab)
    }
  }, [searchParams, dispatch])

  // 초기 데이터 로드
  useEffect(() => {
    console.log('PatientManagement - 초기 데이터 로드 시작');
    
    // 환자 데이터 로드
    dispatch(fetchPatients())
      .then(() => {
        console.log('환자 데이터 로드 완료');
        setIsDataLoaded(true);
      })
      .catch(error => {
        console.error('환자 데이터 로드 실패:', error);
        setIsDataLoaded(true); // 에러가 나도 로딩 상태는 완료로 처리
      });
    
    // 이벤트 타겟 데이터 로드
    dispatch(initializeEventTargets());
    
  }, [dispatch]);

  // 필터 적용
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      dispatch(setFilters({
        searchTerm,
        status: statusFilter as any,
        interestArea: interestFilter,
      }))
      dispatch(setPage(1)) // 필터 변경 시 첫 페이지로 이동
    }, 300)
    
    return () => clearTimeout(debounceTimer)
  }, [searchTerm, statusFilter, interestFilter, dispatch])

  // 탭 변경 핸들러
  const handleTabChange = (tab: string) => {
  setActiveTab(tab)
  dispatch(setCurrentMenuItem(tab))
  
  // 탭 변경 시 환자 목록 탭으로 이동할 경우 데이터 다시 불러오기
  if (tab === '환자 목록') {
    dispatch(fetchPatients());
  }
}

  return (
    <div>
      {/* 페이지 제목 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">상담 관리</h1>
      </div>

      {/* 탭 메뉴 - 문자발송 내역 탭 추가 */}
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
          {/* 필요에 따라 사용 가능한 추가 탭들 */}
          {false && (
            <>
              <button
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === '콜 기록'
                    ? 'text-primary bg-primary/10 rounded-t-lg'
                    : 'text-text-secondary hover:bg-light-bg'
                }`}
                onClick={() => handleTabChange('콜 기록')}
              >
                콜 기록
                {activeTab === '콜 기록' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
                )}
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === '예정된 콜'
                    ? 'text-primary bg-primary/10 rounded-t-lg'
                    : 'text-text-secondary hover:bg-light-bg'
                }`}
                onClick={() => handleTabChange('예정된 콜')}
              >
                예정된 콜
                {activeTab === '예정된 콜' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
                )}
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === '진행중 상담'
                    ? 'text-primary bg-primary/10 rounded-t-lg'
                    : 'text-text-secondary hover:bg-light-bg'
                }`}
                onClick={() => handleTabChange('진행중 상담')}
              >
                진행중 상담
                {activeTab === '진행중 상담' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 필터 영역 - 탭에 따라 다른 UI 표시 */}
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
              <option value="예약확정">예약 확정</option> {/* 추가 */}
              <option value="종결">종결</option> {/* 추가 */}
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
        </div>
      )}

      {/* 콘텐츠 영역 */}
      <div>
        {activeTab === '환자 목록' && <PatientList isLoading={isLoading && !isDataLoaded} />}
        {activeTab === '이벤트 타겟' && <EventTargetList />}
        {activeTab === '문자발송 내역' && <MessageLogModal isOpen={true} onClose={() => {}} embedded={true} />}
        {activeTab === '콜 기록' && <CallHistory />}
        {activeTab === '예정된 콜' && <ScheduledCalls />}
        {activeTab === '진행중 상담' && <OngoingConsultations />}
      </div>

      {/* 모달 영역 */}
      <PatientFormModal />
      {/* 환자 상세 모달 - 상태에 따라 표시 */}
      {selectedPatient && <PatientDetailModal />}
    </div>
  )
}