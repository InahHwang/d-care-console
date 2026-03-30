// src/components/management/UnifiedPatientManagement.tsx
// 통합 환자관리 컴포넌트 (퍼널 기반)

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RootState, AppDispatch } from '@/store'
import { setFilters, setPage, selectPatientWithContext } from '@/store/slices/patientsSlice'
import { openPatientForm } from '@/store/slices/uiSlice'
import { setupDataSyncListener, PatientDataSync } from '@/utils/dataSync'
import PatientList from './PatientList'
import PatientFormModal from './PatientFormModal'
import PatientDetailModal from './PatientDetailModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import {
  HiOutlineSearch,
  HiOutlineUserAdd,
  HiOutlineRefresh,
  HiOutlineFilter,
  HiOutlineExclamationCircle,
  HiOutlineChevronDown
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import {
  FunnelStage,
  UrgentActionType,
  FUNNEL_STAGES,
  URGENT_ACTIONS,
  getPatientFunnelStage,
  getPatientUrgentActions,
  calculateFunnelStats,
  calculateUrgentStats,
  FunnelStats,
  UrgentStats
} from '@/types/funnel'
import { Patient } from '@/types/patient'

export default function UnifiedPatientManagement() {
  const dispatch = useDispatch<AppDispatch>()
  const queryClient = useQueryClient()

  const patientsState = useSelector((state: RootState) => state?.patients || {
    isLoading: true,
    selectedPatient: null,
    patients: [],
    filters: {}
  })

  const { selectedPatient = null } = patientsState

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFunnel, setSelectedFunnel] = useState<FunnelStage | 'all'>('all')
  const [selectedUrgent, setSelectedUrgent] = useState<UrgentActionType | 'all'>('all')
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // React Query로 환자 데이터 로드
  const {
    data: queryResult,
    isLoading: queryLoading,
    refetch: refetchPatients
  } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      console.log('🚀 UnifiedPatientManagement: 환자 데이터 로딩')
      const response = await fetch('/api/patients', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) throw new Error(`API 호출 실패: ${response.status}`)

      const result = await response.json()
      console.log('✅ 환자 데이터 로딩 완료:', result?.patients?.length || 0, '명')
      return result
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1
  })

  const queryPatients: Patient[] = queryResult?.patients || []

  // 데이터 동기화 리스너 설정
  useEffect(() => {
    const cleanup = setupDataSyncListener(queryClient)
    return () => cleanup()
  }, [queryClient])

  // 수동 새로고침
  const handleManualRefresh = useCallback(() => {
    console.log('🔄 수동 데이터 새로고침')
    PatientDataSync.refreshAll('UnifiedPatientManagement_manual')
    refetchPatients()
  }, [refetchPatients])

  // 환자 선택 핸들러
  const handleSelectPatient = useCallback((patientId: string) => {
    dispatch(selectPatientWithContext(patientId, 'unified'))
  }, [dispatch])

  // 퍼널 통계 계산
  const funnelStats: FunnelStats = useMemo(() => {
    return calculateFunnelStats(queryPatients)
  }, [queryPatients])

  // 긴급 액션 통계 계산
  const urgentStats: UrgentStats = useMemo(() => {
    return calculateUrgentStats(queryPatients)
  }, [queryPatients])

  // 필터링된 환자 목록
  const filteredPatients = useMemo(() => {
    if (!queryPatients || !Array.isArray(queryPatients)) return []

    return queryPatients.filter((patient: Patient) => {
      if (!patient) return false

      // 1. 검색어 필터
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesName = patient.name?.toLowerCase()?.includes(searchLower) || false
        const matchesPhone = patient.phoneNumber?.toLowerCase()?.includes(searchLower) || false
        const matchesNotes = patient.notes?.toLowerCase()?.includes(searchLower) || false
        if (!matchesName && !matchesPhone && !matchesNotes) return false
      }

      // 2. 상담타입 필터
      if (consultationTypeFilter !== 'all' && patient.consultationType !== consultationTypeFilter) {
        return false
      }

      // 3. 퍼널 단계 필터
      if (selectedFunnel !== 'all') {
        const patientStage = getPatientFunnelStage(patient)
        if (patientStage !== selectedFunnel) return false
      }

      // 4. 긴급 액션 필터
      if (selectedUrgent !== 'all') {
        const patientActions = getPatientUrgentActions(patient)
        if (!patientActions.includes(selectedUrgent)) return false
      }

      return true
    })
  }, [queryPatients, searchTerm, consultationTypeFilter, selectedFunnel, selectedUrgent])

  // 필터 초기화
  const handleResetFilters = useCallback(() => {
    setSearchTerm('')
    setSelectedFunnel('all')
    setSelectedUrgent('all')
    setConsultationTypeFilter('all')
  }, [])

  // 총 긴급 액션 수
  const totalUrgentCount = useMemo(() => {
    return Object.values(urgentStats).reduce((sum, count) => sum + count, 0)
  }, [urgentStats])

  // 활성 필터 여부
  const hasActiveFilters = searchTerm || selectedFunnel !== 'all' || selectedUrgent !== 'all' || consultationTypeFilter !== 'all'

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">통합 환자관리</h1>
          <p className="text-sm text-text-muted mt-1">
            퍼널 기반 환자 관리 (테스트 버전)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            title="데이터 새로고침"
          >
            <Icon icon={HiOutlineRefresh} size={16} />
            <span>새로고침</span>
          </button>

          <button
            className="flex items-center gap-2 px-6 py-2 bg-primary rounded-lg text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            onClick={() => dispatch(openPatientForm())}
          >
            <Icon icon={HiOutlineUserAdd} size={16} />
            <span>신규 환자</span>
          </button>
        </div>
      </div>

      {/* 긴급 액션 배너 */}
      {totalUrgentCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon icon={HiOutlineExclamationCircle} size={20} className="text-red-600" />
            <span className="font-semibold text-red-800">
              긴급 처리 필요 ({totalUrgentCount}건)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(URGENT_ACTIONS).map(([key, info]) => {
              const count = urgentStats[key as UrgentActionType]
              if (count === 0) return null
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedUrgent(selectedUrgent === key ? 'all' : key as UrgentActionType)
                    setSelectedFunnel('all')
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedUrgent === key
                      ? 'ring-2 ring-offset-1 ring-red-400 ' + info.bgColor + ' ' + info.color
                      : info.bgColor + ' ' + info.color + ' hover:opacity-80'
                  }`}
                >
                  {info.label}: {count}명
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 퍼널 단계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {/* 전체 보기 */}
        <div
          onClick={() => {
            setSelectedFunnel('all')
            setSelectedUrgent('all')
          }}
          className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
            selectedFunnel === 'all' && selectedUrgent === 'all'
              ? 'ring-2 ring-orange-500 shadow-lg bg-white'
              : 'bg-white hover:shadow-lg hover:bg-gray-50'
          }`}
        >
          <div className="text-2xl font-bold text-gray-900">{funnelStats.total}</div>
          <div className="text-sm text-gray-600">전체</div>
        </div>

        {/* 퍼널 단계별 카드 */}
        {Object.entries(FUNNEL_STAGES).map(([key, info]) => {
          const count = funnelStats[key as FunnelStage]
          return (
            <div
              key={key}
              onClick={() => {
                setSelectedFunnel(selectedFunnel === key ? 'all' : key as FunnelStage)
                setSelectedUrgent('all')
              }}
              className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                selectedFunnel === key
                  ? 'ring-2 ring-orange-500 shadow-lg ' + info.bgColor
                  : 'bg-white ' + info.hoverColor + ' hover:shadow-lg'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{info.icon}</span>
                <span className={`text-2xl font-bold ${info.color}`}>{count}</span>
              </div>
              <div className="text-sm text-gray-600">{info.label}</div>
            </div>
          )
        })}
      </div>

      {/* 검색 및 필터 */}
      <div className="card">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {/* 검색창 */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="환자명, 연락처 또는 메모 검색"
              className="pl-10 pr-4 py-2 w-full bg-light-bg rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Icon
              icon={HiOutlineSearch}
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted"
            />
          </div>

          {/* 상담타입 필터 */}
          <select
            className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
            value={consultationTypeFilter}
            onChange={(e) => setConsultationTypeFilter(e.target.value as 'all' | 'inbound' | 'outbound')}
          >
            <option value="all">상담 타입</option>
            <option value="inbound">인바운드</option>
            <option value="outbound">아웃바운드</option>
          </select>

          {/* 추가 필터 토글 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
              showFilters ? 'bg-orange-100 text-orange-700' : 'bg-light-bg text-text-secondary hover:bg-gray-200'
            }`}
          >
            <Icon icon={HiOutlineFilter} size={16} />
            <span>추가 필터</span>
            <Icon icon={HiOutlineChevronDown} size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 추가 필터 패널 */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-4">
              {/* 퍼널 단계 선택 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">퍼널 단계</label>
                <select
                  value={selectedFunnel}
                  onChange={(e) => setSelectedFunnel(e.target.value as FunnelStage | 'all')}
                  className="px-3 py-1.5 bg-light-bg rounded text-sm focus:outline-none"
                >
                  <option value="all">전체</option>
                  {Object.entries(FUNNEL_STAGES).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.icon} {info.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 긴급 상태 선택 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">긴급 상태</label>
                <select
                  value={selectedUrgent}
                  onChange={(e) => setSelectedUrgent(e.target.value as UrgentActionType | 'all')}
                  className="px-3 py-1.5 bg-light-bg rounded text-sm focus:outline-none"
                >
                  <option value="all">전체</option>
                  {Object.entries(URGENT_ACTIONS).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 필터 결과 요약 */}
        {hasActiveFilters && (
          <div className="mt-4 p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-orange-800 flex-wrap">
                <span>필터링 결과: <strong>{filteredPatients.length}명</strong></span>

                {selectedFunnel !== 'all' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-200 text-orange-800">
                    {FUNNEL_STAGES[selectedFunnel].icon} {FUNNEL_STAGES[selectedFunnel].label}
                  </span>
                )}

                {selectedUrgent !== 'all' && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${URGENT_ACTIONS[selectedUrgent].bgColor} ${URGENT_ACTIONS[selectedUrgent].color}`}>
                    {URGENT_ACTIONS[selectedUrgent].label}
                  </span>
                )}

                {consultationTypeFilter !== 'all' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-200 text-orange-800">
                    {consultationTypeFilter === 'inbound' ? '인바운드' : '아웃바운드'}
                  </span>
                )}

                {searchTerm && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-200 text-orange-800">
                    "{searchTerm}"
                  </span>
                )}
              </div>
              <button
                onClick={handleResetFilters}
                className="text-xs text-orange-600 hover:text-orange-800 underline"
              >
                필터 초기화
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 환자 목록 */}
      <div className="card">
        <PatientList
          isLoading={queryLoading && queryPatients.length === 0}
          filteredPatients={filteredPatients}
          onSelectPatient={handleSelectPatient}
        />
      </div>

      {/* 모달들 */}
      <PatientFormModal />
      {selectedPatient && <PatientDetailModal />}
      <DeleteConfirmModal />
    </div>
  )
}
