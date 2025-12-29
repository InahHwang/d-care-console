// src/components/management/EventTargetList.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { RootState } from '@/store'
import { 
  Patient,
  EventTargetReason,
  selectPatient,
  initializeEventTargets,
  fetchPatients
} from '@/store/slices/patientsSlice'
import { EventCategory } from '@/types/messageLog'
import { fetchTemplates } from '@/store/slices/templatesSlice'
import { fetchCategories } from '@/store/slices/categoriesSlice' // 추가
import { getEventCategoryOptions, getCategoryDisplayName } from '@/utils/categoryUtils' // 추가
import { 
  HiOutlineSearch, 
  HiOutlineTag, 
  HiOutlineCalendar, 
  HiOutlineArrowUp,
  HiOutlineVolumeUp,
  HiOutlineCheck,
  HiOutlineDocumentText,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineAdjustments,
  HiOutlinePaperAirplane,
  HiOutlineExclamation,
  HiOutlineRefresh
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { formatDistance } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import PatientDetailModal from './PatientDetailModal'
import MessageSendModal from './MessageSendModal'

// 이벤트 타겟 사유 옵션
const targetReasonOptions = [
  { value: 'price_hesitation', label: '가격 문의 후 망설임' },
  { value: 'treatment_consideration', label: '치료 방법 고민 중' },
  { value: 'scheduling_issue', label: '시간 조율 필요' },
  { value: 'competitor_comparison', label: '경쟁업체 비교 중' },
  { value: 'other', label: '기타' },
]

export default function EventTargetList() {
  const dispatch = useAppDispatch()
  const { patients, selectedPatient, isLoading, eventTargetPatients } = useAppSelector((state: RootState) => state.patients)
  const { templates, isLoading: templatesLoading } = useAppSelector((state: RootState) => state.templates)
  const { categories } = useAppSelector((state: RootState) => state.categories) // 추가
  
  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReasons, setSelectedReasons] = useState<EventTargetReason[]>([])
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date')
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // 환자 선택 상태
  const [selectedPatients, setSelectedPatients] = useState<Patient[]>([])
  const [selectAll, setSelectAll] = useState(false)
  
  // 메시지 발송 모달 상태
  const [messageSendModalOpen, setMessageSendModalOpen] = useState(false)

  // 새로고침 상태
  const [refreshing, setRefreshing] = useState(false)

  // 템플릿과 카테고리에서 고유한 카테고리 목록 추출 - 수정된 부분
  const eventCategoryOptions = useMemo(() => {
    return getEventCategoryOptions(templates, categories)
  }, [templates, categories])

  // 컴포넌트 마운트 시 데이터 로드 - 수정된 부분
  useEffect(() => {
    console.log('EventTargetList 컴포넌트 마운트됨')

    // 초기 데이터 로드
    const initializeData = async () => {
      try {
        setRefreshing(true)

        // 🔥 성능 최적화: 환자 데이터가 없을 때만 로드
        if (patients.length === 0) {
          await dispatch(fetchPatients()).unwrap()
        }

        // 이벤트 타겟, 템플릿, 카테고리 데이터는 항상 로드 (이 페이지 전용 데이터)
        await dispatch(initializeEventTargets()).unwrap()
        await dispatch(fetchTemplates()).unwrap()
        await dispatch(fetchCategories()).unwrap()

        console.log('초기 데이터 로드 완료')
      } catch (error) {
        console.error('초기 데이터 로드 실패:', error)
      } finally {
        setRefreshing(false)
      }
    }

    initializeData()
  }, [dispatch, patients.length])

  // 이벤트 타겟 환자 데이터 변경 감지
  useEffect(() => {
    console.log('이벤트 타겟 환자 리스트 업데이트:', {
      eventTargetPatientsCount: eventTargetPatients?.length || 0,
      totalPatientsCount: patients?.length || 0,
      eventTargetPatients: eventTargetPatients?.map(p => ({
        id: p.id,
        name: p.name,
        isEventTarget: p.eventTargetInfo?.isEventTarget
      })) || []
    })
  }, [eventTargetPatients, patients])

  // 수동 새로고침 함수 - 수정된 부분
  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      console.log('수동 새로고침 시작')
      
      // 순차적으로 데이터 새로고침
      await dispatch(fetchPatients()).unwrap()
      await dispatch(initializeEventTargets()).unwrap()
      await dispatch(fetchTemplates()).unwrap()
      await dispatch(fetchCategories()).unwrap() // 추가
      
      console.log('수동 새로고침 완료')
    } catch (error) {
      console.error('새로고침 실패:', error)
      alert('데이터 새로고침 중 오류가 발생했습니다.')
    } finally {
      setRefreshing(false)
    }
  }
  
  // 필터링 및 정렬된 환자 목록 계산 (useMemo로 최적화)
  const filteredPatients = useMemo(() => {
    console.log('필터링 시작:', {
      eventTargetPatientsLength: eventTargetPatients?.length || 0,
      searchTerm,
      selectedReasons,
      selectedCategories
    })
    
    // 이벤트 타겟으로 지정된 환자만 필터링
    let filtered = (eventTargetPatients || []).filter(patient => {
      const isEventTarget = patient.eventTargetInfo?.isEventTarget === true
      console.log(`환자 ${patient.name} 이벤트 타겟 여부:`, {
        isEventTarget,
        eventTargetInfo: patient.eventTargetInfo
      })
      return isEventTarget
    })
    
    console.log('이벤트 타겟 필터링 후:', filtered.length)
    
    // 검색어로 필터링
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(patient => 
        patient.name.toLowerCase().includes(term) ||
        patient.phoneNumber.includes(term) ||
        patient.eventTargetInfo?.notes?.toLowerCase().includes(term) ||
        (patient.eventTargetInfo?.targetReason === 'other' && 
         patient.eventTargetInfo?.customTargetReason?.toLowerCase().includes(term))
      )
    }
    
    // 선택된 사유로 필터링
    if (selectedReasons.length > 0) {
      filtered = filtered.filter(patient => 
        selectedReasons.includes(patient.eventTargetInfo?.targetReason || '')
      )
    }
    
    // 선택된 카테고리로 필터링
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(patient => 
        patient.eventTargetInfo?.categories?.some(cat => 
          selectedCategories.includes(cat)
        )
      )
    }
    
    // 정렬
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      // 날짜순 정렬 (기본값: 발송 예정일 오름차순)
      filtered.sort((a, b) => {
        const dateA = a.eventTargetInfo?.scheduledDate || ''
        const dateB = b.eventTargetInfo?.scheduledDate || ''
        return dateA.localeCompare(dateB)
      })
    }
    
    console.log('최종 필터링 결과:', {
      count: filtered.length,
      patients: filtered.map(p => ({ name: p.name, id: p.id }))
    })
    
    return filtered
  }, [eventTargetPatients, searchTerm, selectedReasons, selectedCategories, sortBy])
  
  // 현재 페이지의 항목들
  const currentItems = useMemo(() => {
    return filteredPatients.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [filteredPatients, currentPage, itemsPerPage])
  
  // 총 페이지 수 계산
  const totalPages = useMemo(() => {
    return Math.ceil(filteredPatients.length / itemsPerPage)
  }, [filteredPatients.length, itemsPerPage])
  
  // 페이지 변경 시 페이지 번호가 범위를 벗어나면 조정
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])
  
  // 사유 필터 토글
  const handleReasonToggle = (reason: EventTargetReason) => {
    setSelectedReasons(prev => {
      if (prev.includes(reason)) {
        return prev.filter(r => r !== reason)
      } else {
        return [...prev, reason]
      }
    })
  }
  
  // 카테고리 필터 토글
  const handleCategoryToggle = (category: EventCategory) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }
  
  // 필터 초기화
  const handleResetFilters = () => {
    setSearchTerm('')
    setSelectedReasons([])
    setSelectedCategories([])
    setSortBy('date')
  }
  
  // 환자 상세 정보 보기
  const handleViewDetails = (patientId: string) => {
    dispatch(selectPatient(patientId))
  }
  
  // 타겟 사유 표시
  const getReasonLabel = (patient: Patient) => {
    const reason = patient.eventTargetInfo?.targetReason || ''
    if (reason === 'other' && patient.eventTargetInfo?.customTargetReason) {
      return patient.eventTargetInfo.customTargetReason
    }
    
    const option = targetReasonOptions.find(opt => opt.value === reason)
    return option ? option.label : '-'
  }
  
  // 카테고리 라벨 가져오기 - 수정된 부분
  const getCategoryLabel = (categoryValue: string) => {
    return getCategoryDisplayName(categoryValue, categories)
  }
  
  // 경과 시간 계산
  const getTimeAgo = (date: string) => {
    if (!date) return '-'
    
    try {
      return formatDistance(
        new Date(date),
        new Date(),
        { addSuffix: true, locale: ko }
      )
    } catch (e) {
      return '-'
    }
  }

  // 환자 선택 여부 확인
  const isPatientSelected = (patientId: string) => {
    return selectedPatients.some(p => p.id === patientId)
  }

  // 환자 선택 핸들러
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatients(prev => {
      const isSelected = prev.some(p => p.id === patient.id)
      
      if (isSelected) {
        // 이미 선택된 환자면 제거
        return prev.filter(p => p.id !== patient.id)
      } else {
        // 선택되지 않았으면 추가
        return [...prev, patient]
      }
    })
  }

  // 전체 선택/해제 업데이트
  useEffect(() => {
    // 현재 페이지의 모든 환자가 선택되었는지 확인
    if (currentItems.length > 0) {
      const allSelected = currentItems.every(item => 
        selectedPatients.some(p => p.id === item.id)
      )
      setSelectAll(allSelected)
    } else {
      setSelectAll(false)
    }
  }, [currentItems, selectedPatients])

  // 전체 선택 핸들러
  const handleSelectAll = () => {
    if (selectAll) {
      // 현재 페이지의 환자들을 선택 해제
      setSelectedPatients(prev => 
        prev.filter(p => !currentItems.some(item => item.id === p.id))
      )
    } else {
      // 현재 페이지의 환자들을 모두 선택
      const currentItemsToAdd = currentItems.filter(
        item => !selectedPatients.some(p => p.id === item.id)
      )
      
      setSelectedPatients(prev => [...prev, ...currentItemsToAdd])
    }
  }

  // 메시지 발송 모달 열기
  const handleOpenMessageSendModal = () => {
    if (selectedPatients.length === 0) {
      alert('문자를 발송할 환자를 선택해주세요.')
      return
    }
    
    setMessageSendModalOpen(true)
  }

  // 메시지 발송 완료 후 처리
  const handleMessageSendComplete = () => {
    // 발송 완료 후 환자 선택 상태 초기화
    setSelectedPatients([])
  }
  
  return (
    <div>
      {/* 페이지 제목 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">이벤트 타겟 관리</h1>
        
        <div className="flex items-center gap-3">
          {/* 새로고침 버튼 */}
          <button
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              refreshing 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <Icon 
              icon={HiOutlineRefresh} 
              size={16} 
              className={refreshing ? 'animate-spin' : ''} 
            />
            <span>{refreshing ? '새로고침 중...' : '새로고침'}</span>
          </button>
          
          {/* 메시지 발송 버튼 */}
          <button
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              selectedPatients.length > 0 
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            onClick={handleOpenMessageSendModal}
            disabled={selectedPatients.length === 0}
          >
            <Icon icon={HiOutlinePaperAirplane} size={16} />
            <span>메시지 발송 ({selectedPatients.length})</span>
          </button>
        </div>
      </div>
      
      {/* 상태 표시 영역 */}
      {eventTargetPatients && (
        <div className="card mb-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-700">
              총 <span className="font-medium">{eventTargetPatients.length}</span>명의 이벤트 타겟 환자가 등록되어 있습니다.
              {filteredPatients.length !== eventTargetPatients.length && (
                <span className="ml-2">
                  (필터링된 결과: <span className="font-medium">{filteredPatients.length}</span>명)
                </span>
              )}
            </div>
            <div className="text-xs text-blue-600">
              {refreshing ? '데이터 업데이트 중...' : `마지막 업데이트: ${new Date().toLocaleTimeString()}`}
            </div>
          </div>
        </div>
      )}
      
      {/* 검색 및 필터 영역 */}
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
          
          {/* 정렬 옵션 */}
          <select
            className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary md:w-36"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'date')}
          >
            <option value="date">발송일 순 ▼</option>
            <option value="name">이름 순 ▼</option>
          </select>
          
          {/* 필터 토글 버튼 */}
          <button
            className="px-4 py-2 bg-light-bg rounded-full text-sm font-medium text-text-secondary hover:bg-gray-200 transition-colors flex items-center gap-2"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Icon icon={HiOutlineAdjustments} size={16} />
            <span>필터 {filterOpen ? '닫기' : '열기'}</span>
            {(selectedReasons.length > 0 || selectedCategories.length > 0) && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium bg-primary text-white">
                {selectedReasons.length + selectedCategories.length}
              </span>
            )}
          </button>
        </div>
        
        {/* 확장된 필터 영역 */}
        {filterOpen && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 타겟 사유 필터 */}
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-2">타겟 사유 필터</h3>
                <div className="flex flex-wrap gap-2">
                  {targetReasonOptions.map(reason => (
                    <button
                      key={reason.value}
                      onClick={() => handleReasonToggle(reason.value as EventTargetReason)}
                      className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-colors ${
                        selectedReasons.includes(reason.value as EventTargetReason)
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-light-bg text-text-primary border border-border hover:bg-gray-200'
                      }`}
                    >
                      {selectedReasons.includes(reason.value as EventTargetReason) && (
                        <Icon icon={HiOutlineCheck} size={14} />
                      )}
                      {reason.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 이벤트 카테고리 필터 - 동적으로 변경 */}
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-2">카테고리 필터</h3>
                <div className="flex flex-wrap gap-2">
                  {eventCategoryOptions.map(category => (
                    <button
                      key={category.value}
                      onClick={() => handleCategoryToggle(category.value as EventCategory)}
                      className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-colors ${
                        selectedCategories.includes(category.value as EventCategory)
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-light-bg text-text-primary border border-border hover:bg-gray-200'
                      }`}
                    >
                      {selectedCategories.includes(category.value as EventCategory) && (
                        <Icon icon={HiOutlineCheck} size={14} />
                      )}
                      {category.label}
                    </button>
                  ))}
                </div>
                {eventCategoryOptions.length === 0 && (
                  <p className="text-sm text-text-secondary mt-2">
                    아직 카테고리가 설정되지 않았습니다. 설정 메뉴에서 카테고리를 먼저 생성하거나 메시지 템플릿을 추가해주세요.
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                모든 필터 초기화
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* 선택된 환자 정보 표시 영역 */}
      {selectedPatients.length > 0 && (
        <div className="card mb-4 bg-blue-50 border-blue-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Icon icon={HiOutlineCheck} size={16} />
              </div>
              <div>
                <p className="text-blue-800 font-medium">
                  {selectedPatients.length}명의 환자 선택됨
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedPatients.slice(0, 3).map(patient => (
                    <span 
                      key={patient.id}
                      className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700"
                    >
                      {patient.name}
                    </span>
                  ))}
                  {selectedPatients.length > 3 && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                      +{selectedPatients.length - 3}명
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded-md text-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                onClick={handleOpenMessageSendModal}
              >
                <Icon icon={HiOutlinePaperAirplane} size={14} className="mr-1 inline-block" />
                메시지 발송
              </button>
              <button
                className="px-3 py-1.5 rounded-md text-sm bg-white text-blue-700 hover:bg-blue-50 transition-colors border border-blue-300"
                onClick={() => {
                  setSelectedPatients([])
                }}
              >
                선택 해제
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 내용 영역 */}
      <div className="card p-0 w-full">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] table-auto">
            {/* 테이블 헤더 */}
            <thead>
              <tr className="bg-light-bg">
                {/* 체크박스 열 */}
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary rounded focus:ring-primary border-gray-300"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">환자명</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">연락처</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">타겟 사유</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">이벤트 카테고리</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">발송 예정일</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">타겟 지정일</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">액션</th>
              </tr>
            </thead>
            
            {/* 테이블 바디 */}
            <tbody>
              {isLoading || refreshing ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    {refreshing ? '데이터를 새로고침하는 중...' : '불러오는 중...'}
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    {searchTerm || selectedReasons.length > 0 || selectedCategories.length > 0 ? (
                      <>
                        검색 결과가 없습니다. 다른 검색어나 필터를 사용해보세요.
                        <div className="mt-2 text-xs text-gray-500">
                          또는 <button onClick={handleRefresh} className="text-blue-600 hover:underline">새로고침</button>을 눌러주세요.
                        </div>
                      </>
                    ) : (
                      <>
                        등록된 이벤트 타겟 환자가 없습니다.
                        <div className="mt-2 text-xs text-gray-500">
                          환자 상세 정보에서 이벤트 타겟을 설정할 수 있습니다.
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                currentItems.map((patient) => {
                  const isCompleted = patient.isCompleted === true
                  const rowColor = isCompleted ? 'bg-gray-50/50' : ''
                  const isSelected = isPatientSelected(patient.id)
                  
                  return (
                    <tr 
                      key={patient.id} 
                      className={`border-b border-border last:border-0 ${rowColor} ${
                        isSelected ? 'bg-blue-50/50' : ''
                      } hover:bg-light-bg/50 transition-colors duration-150`}
                    >
                      {/* 체크박스 셀 */}
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-primary rounded focus:ring-primary border-gray-300"
                            checked={isSelected}
                            onChange={() => handleSelectPatient(patient)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-text-primary">
                        <button 
                          onClick={() => handleViewDetails(patient.id)}
                          className="hover:underline flex items-center gap-2"
                        >
                          {patient.name}
                          {isCompleted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              종결
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.phoneNumber}
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        <div className="flex items-center gap-2">
                          <Icon 
                            icon={HiOutlineTag} 
                            size={16} 
                            className="text-blue-600" 
                          />
                          {getReasonLabel(patient)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {patient.eventTargetInfo?.categories?.map((category, idx) => (
                            <span 
                              key={idx}
                              className="inline-block px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                            >
                              {getCategoryLabel(category)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        <div className="flex items-center gap-2">
                          <Icon 
                            icon={HiOutlineCalendar} 
                            size={16} 
                            className="text-blue-600" 
                          />
                          {patient.eventTargetInfo?.scheduledDate || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.eventTargetInfo?.createdAt ? (
                          <span title={patient.eventTargetInfo.createdAt.split('T')[0]}>
                            {getTimeAgo(patient.eventTargetInfo.createdAt)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* 개별 환자 메시지 발송 버튼 */}
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors duration-150"
                            onClick={() => {
                              setSelectedPatients([patient])
                              handleOpenMessageSendModal()
                            }}
                            title="메시지 발송"
                          >
                            <Icon 
                              icon={HiOutlinePaperAirplane} 
                              size={16} 
                            />
                          </button>
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors duration-150"
                            onClick={() => handleViewDetails(patient.id)}
                            title="상세 정보"
                          >
                            <Icon 
                              icon={HiOutlineArrowUp} 
                              size={16} 
                              className="transform rotate-45" 
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* 페이지네이션 */}
        {totalPages > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border">
            <div className="text-sm text-text-secondary mb-4 sm:mb-0">
              총 {filteredPatients.length}개 항목 중 {Math.min((currentPage - 1) * itemsPerPage + 1, filteredPatients.length)}-{Math.min(currentPage * itemsPerPage, filteredPatients.length)} 표시
              {selectedPatients.length > 0 && (
                <span className="ml-2 text-blue-600">
                  ({selectedPatients.length}명 선택됨)
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 bg-light-bg px-4 py-1.5 rounded-full">
              <button
                className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <Icon 
                  icon={HiOutlineChevronLeft} 
                  size={20} 
                  className="text-current" 
                />
              </button>
              
              {totalPages <= 5 ? (
                // 5페이지 이하일 때는 모든 페이지 표시
                Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                      currentPage === i + 1 ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                    }`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))
              ) : (
                // 5페이지 초과일 때는 1, 2, 3, ..., 마지막 페이지 형태로 표시
                <>
                  {[1, 2, 3].map((page) => (
                    <button
                      key={page}
                      className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                        currentPage === page ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <span className="text-text-secondary">...</span>
                  
                  <button
                    className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                      currentPage === totalPages ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                    }`}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              
              <button
                className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                <Icon 
                  icon={HiOutlineChevronRight} 
                  size={20} 
                  className="text-current" 
                />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* 환자 상세 모달 */}
      {selectedPatient && <PatientDetailModal />}
      
      {/* 메시지 발송 모달 */}
      <MessageSendModal 
        isOpen={messageSendModalOpen}
        onClose={() => setMessageSendModalOpen(false)}
        selectedPatients={selectedPatients}
        onSendComplete={handleMessageSendComplete}
      />
    </div>
  )
}