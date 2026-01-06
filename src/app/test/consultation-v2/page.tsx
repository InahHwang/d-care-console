// src/app/test/consultation-v2/page.tsx
// 상담관리 테스트 페이지 (v2 구조)

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { PatientV2, CallbackRecord } from '@/types/patientV2'
import CallbackHistoryV2 from '@/components/test/CallbackHistoryV2'
import ToothSelector from '@/components/common/ToothSelector'

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export default function ConsultationV2TestPage() {
  const [patients, setPatients] = useState<PatientV2[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  // 페이지네이션 상태
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })

  // 검색/필터 상태
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 새 환자 폼
  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    gender: '' as '' | '남' | '여',
    age: '',
    source: '',
    interestedServices: [] as string[],
    selectedTeeth: [] as number[],
    teethUnknown: false,
    consultationNotes: ''
  })

  const fetchPatients = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'consultation',
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder
      })

      if (search) params.append('search', search)
      if (phaseFilter) params.append('phase', phaseFilter)
      if (statusFilter) params.append('status', statusFilter)

      const res = await fetch(`/api/test/patients-v2?${params}`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        setPatients(data.data)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('환자 목록 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [search, phaseFilter, statusFilter, sortBy, sortOrder, pagination.limit])

  // 테스트 데이터 생성
  const handleSeedData = async () => {
    if (!confirm('기존 테스트 데이터를 삭제하고 새로 생성합니다. 계속하시겠습니까?')) return
    try {
      const res = await fetch('/api/test/seed', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        fetchPatients(1)
      }
    } catch (error) {
      console.error('테스트 데이터 생성 실패:', error)
    }
  }

  useEffect(() => {
    fetchPatients(1)
  }, [search, phaseFilter, statusFilter, sortBy, sortOrder])

  // 검색 핸들러 (Enter 또는 버튼 클릭)
  const handleSearch = () => {
    setSearch(searchInput)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // 페이지 변경
  const handlePageChange = (newPage: number) => {
    fetchPatients(newPage)
  }

  // 환자 등록
  const handleAddPatient = async () => {
    try {
      const res = await fetch('/api/test/patients-v2', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPatient.name,
          phone: newPatient.phone,
          gender: newPatient.gender,
          age: newPatient.age ? parseInt(newPatient.age) : null,
          source: newPatient.source,
          interestedServices: newPatient.interestedServices,
          selectedTeeth: newPatient.selectedTeeth,
          teethUnknown: newPatient.teethUnknown,
          consultationNotes: newPatient.consultationNotes
        })
      })

      const data = await res.json()
      if (data.success) {
        setShowAddForm(false)
        setNewPatient({
          name: '',
          phone: '',
          gender: '',
          age: '',
          source: '',
          interestedServices: [],
          selectedTeeth: [],
          teethUnknown: false,
          consultationNotes: ''
        })
        fetchPatients(1) // 첫 페이지로 이동
      }
    } catch (error) {
      console.error('환자 등록 실패:', error)
    }
  }

  // 콜백 등록
  const handleAddCallback = async (patientId: string, callback: Omit<CallbackRecord, 'attempt' | 'createdAt'>) => {
    try {
      const res = await fetch(`/api/test/patients-v2/${patientId}/callback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'preVisit',
          ...callback
        })
      })

      const data = await res.json()
      if (data.success) {
        // 환자 목록 갱신
        setPatients(patients.map(p =>
          p._id === patientId ? data.data : p
        ))
        if (selectedPatient?._id === patientId) {
          setSelectedPatient(data.data)
        }
      }
    } catch (error) {
      console.error('콜백 등록 실패:', error)
    }
  }

  // 상태 변경 (예약확정, 내원확인 등)
  const handleStatusChange = async (patientId: string, action: string, additionalData?: any) => {
    try {
      const res = await fetch(`/api/test/patients-v2/${patientId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...additionalData })
      })

      const data = await res.json()
      if (data.success) {
        // 예약확정이나 내원확인 후에는 목록에서 제거될 수 있음
        if (action === 'confirmVisit') {
          setPatients(patients.filter(p => p._id !== patientId))
          setSelectedPatient(null)
        } else {
          setPatients(patients.map(p =>
            p._id === patientId ? data.data : p
          ))
          if (selectedPatient?._id === patientId) {
            setSelectedPatient(data.data)
          }
        }
      }
    } catch (error) {
      console.error('상태 변경 실패:', error)
    }
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case '전화상담': return 'bg-blue-100 text-blue-800'
      case '예약확정': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case '신규': return 'bg-purple-100 text-purple-800'
      case '콜백필요': return 'bg-yellow-100 text-yellow-800'
      case '부재중': return 'bg-gray-100 text-gray-800'
      case '잠재고객': return 'bg-orange-100 text-orange-800'
      case '예약취소': return 'bg-red-100 text-red-800'
      case '노쇼': return 'bg-red-100 text-red-800'
      default: return ''
    }
  }

  const SERVICES = ['임플란트', '교정', '충치치료', '잇몸치료', '미백', '스케일링', '보철', '기타']
  const SOURCES = ['네이버', '굿닥', '강남언니', '지인소개', '재방문', '기타']

  // 페이지 번호 생성
  const getPageNumbers = () => {
    const pages: number[] = []
    const { page, totalPages } = pagination
    const maxVisible = 5

    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    return pages
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">상담관리 v2 테스트</h1>
              <p className="text-sm text-gray-500">전화상담 환자 관리 (내원 전)</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSeedData}
                className="px-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                테스트 데이터 생성
              </button>
              <a
                href="/test/visit-v2"
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                내원관리 →
              </a>
              <a
                href="/test/daily-report-v2"
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                보고서 →
              </a>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                + 환자 등록
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* 검색 */}
            <div className="flex-1 min-w-[200px]">
              <div className="flex">
                <input
                  type="text"
                  placeholder="이름 또는 전화번호 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="flex-1 border rounded-l px-3 py-2 text-sm"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-500 text-white rounded-r hover:bg-blue-600 text-sm"
                >
                  검색
                </button>
              </div>
            </div>

            {/* 단계 필터 */}
            <div>
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">전체 단계</option>
                <option value="전화상담">전화상담</option>
                <option value="예약확정">예약확정</option>
              </select>
            </div>

            {/* 상태 필터 */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">전체 상태</option>
                <option value="신규">신규</option>
                <option value="콜백필요">콜백필요</option>
                <option value="부재중">부재중</option>
                <option value="잠재고객">잠재고객</option>
                <option value="예약취소">예약취소</option>
                <option value="노쇼">노쇼</option>
              </select>
            </div>

            {/* 정렬 */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="updatedAt">최근 수정순</option>
                <option value="createdAt">등록일순</option>
                <option value="name">이름순</option>
                <option value="callInDate">유입일순</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            {/* 검색 초기화 */}
            {(search || phaseFilter || statusFilter) && (
              <button
                onClick={() => {
                  setSearch('')
                  setSearchInput('')
                  setPhaseFilter('')
                  setStatusFilter('')
                }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                초기화
              </button>
            )}
          </div>

          {/* 검색 결과 요약 */}
          <div className="mt-3 text-sm text-gray-500">
            총 {pagination.totalCount}명
            {search && <span className="ml-2">| 검색: &quot;{search}&quot;</span>}
            {phaseFilter && <span className="ml-2">| 단계: {phaseFilter}</span>}
            {statusFilter && <span className="ml-2">| 상태: {statusFilter}</span>}
          </div>
        </div>

        {/* 환자 등록 폼 */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="font-medium mb-4">새 환자 등록</h3>
            <div className="grid grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="이름"
                value={newPatient.name}
                onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                className="border rounded px-3 py-2"
              />
              <input
                type="text"
                placeholder="전화번호"
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                className="border rounded px-3 py-2"
              />
              <select
                value={newPatient.gender}
                onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as '' | '남' | '여' })}
                className="border rounded px-3 py-2"
              >
                <option value="">성별</option>
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
              <input
                type="number"
                placeholder="나이"
                value={newPatient.age}
                onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                className="border rounded px-3 py-2"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">유입경로</label>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map(source => (
                  <button
                    key={source}
                    onClick={() => setNewPatient({ ...newPatient, source })}
                    className={`px-3 py-1 text-sm rounded ${
                      newPatient.source === source
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">관심 서비스</label>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map(service => (
                  <button
                    key={service}
                    onClick={() => {
                      const services = newPatient.interestedServices.includes(service)
                        ? newPatient.interestedServices.filter(s => s !== service)
                        : [...newPatient.interestedServices, service]
                      setNewPatient({ ...newPatient, interestedServices: services })
                    }}
                    className={`px-3 py-1 text-sm rounded ${
                      newPatient.interestedServices.includes(service)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">불편한 치아</label>
              <ToothSelector
                selectedTeeth={newPatient.selectedTeeth}
                onChange={(teeth) => setNewPatient({ ...newPatient, selectedTeeth: teeth })}
                unknown={newPatient.teethUnknown}
                onUnknownChange={(unknown) => setNewPatient({ ...newPatient, teethUnknown: unknown, selectedTeeth: unknown ? [] : newPatient.selectedTeeth })}
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">상담 메모</label>
              <textarea
                value={newPatient.consultationNotes}
                onChange={(e) => setNewPatient({ ...newPatient, consultationNotes: e.target.value })}
                placeholder="상담 내용을 입력하세요..."
                className="w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={handleAddPatient}
                disabled={!newPatient.name || !newPatient.phone}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                등록
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* 환자 목록 */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="font-medium">전화상담 환자 ({pagination.totalCount})</h3>
              </div>

              {loading ? (
                <div className="p-8 text-center text-gray-400">로딩 중...</div>
              ) : (
                <>
                  <div className="divide-y max-h-[calc(100vh-400px)] overflow-y-auto">
                    {patients.length === 0 ? (
                      <div className="p-8 text-center text-gray-400">
                        {search || phaseFilter || statusFilter ? '검색 결과가 없습니다' : '등록된 환자가 없습니다'}
                      </div>
                    ) : (
                      patients.map(patient => (
                        <div
                          key={patient._id}
                          onClick={() => setSelectedPatient(patient)}
                          className={`p-3 cursor-pointer hover:bg-gray-50 ${
                            selectedPatient?._id === patient._id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{patient.name}</span>
                              <span className="text-sm text-gray-500 ml-2">
                                {patient.gender} {patient.age}세
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <span className={`text-xs px-2 py-0.5 rounded ${getPhaseColor(patient.phase)}`}>
                                {patient.phase}
                              </span>
                              {patient.currentStatus && (
                                <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(patient.currentStatus)}`}>
                                  {patient.currentStatus}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {patient.phone} | 콜백 {patient.preVisitCallbacks?.length || 0}회
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 페이지네이션 */}
                  {pagination.totalPages > 1 && (
                    <div className="p-3 border-t flex items-center justify-center gap-1">
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={!pagination.hasPrev}
                        className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ««
                      </button>
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={!pagination.hasPrev}
                        className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        «
                      </button>

                      {getPageNumbers().map(pageNum => (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 text-sm rounded ${
                            pageNum === pagination.page
                              ? 'bg-blue-500 text-white'
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={!pagination.hasNext}
                        className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        »
                      </button>
                      <button
                        onClick={() => handlePageChange(pagination.totalPages)}
                        disabled={!pagination.hasNext}
                        className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        »»
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 환자 상세 */}
          <div className="col-span-2">
            {selectedPatient ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-lg">{selectedPatient.name}</h3>
                    <div className="text-sm text-gray-500">
                      {selectedPatient.phone} | {selectedPatient.source}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedPatient.phase === '전화상담' && (
                      <button
                        onClick={() => handleStatusChange(selectedPatient._id!, 'confirmReservation', {
                          reservation: {
                            date: new Date().toISOString().split('T')[0],
                            time: '10:00',
                            type: '초진'
                          }
                        })}
                        className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        예약확정
                      </button>
                    )}
                    {selectedPatient.phase === '예약확정' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(selectedPatient._id!, 'confirmVisit')}
                          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          내원확인
                        </button>
                        <button
                          onClick={() => handleStatusChange(selectedPatient._id!, 'cancelReservation')}
                          className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          예약취소
                        </button>
                        <button
                          onClick={() => handleStatusChange(selectedPatient._id!, 'noShow')}
                          className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                          노쇼
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* 상태 정보 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">단계</label>
                      <div className={`mt-1 inline-block px-2 py-1 rounded text-sm ${getPhaseColor(selectedPatient.phase)}`}>
                        {selectedPatient.phase}
                      </div>
                    </div>
                    {selectedPatient.currentStatus && (
                      <div>
                        <label className="text-xs text-gray-500">상태</label>
                        <div className={`mt-1 inline-block px-2 py-1 rounded text-sm ${getStatusColor(selectedPatient.currentStatus)}`}>
                          {selectedPatient.currentStatus}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 예약 정보 */}
                  {selectedPatient.reservation && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <label className="text-xs text-green-700 font-medium">예약 정보</label>
                      <div className="mt-1 text-sm">
                        {selectedPatient.reservation.date} {selectedPatient.reservation.time} ({selectedPatient.reservation.type})
                      </div>
                    </div>
                  )}

                  {/* 관심 서비스 */}
                  <div>
                    <label className="text-xs text-gray-500">관심 서비스</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedPatient.consultation?.interestedServices?.map(service => (
                        <span key={service} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 치아 정보 */}
                  <div>
                    <label className="text-xs text-gray-500">불편한 치아</label>
                    <div className="mt-1">
                      {selectedPatient.consultation?.teethUnknown ? (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">미확인</span>
                      ) : selectedPatient.consultation?.selectedTeeth?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {selectedPatient.consultation.selectedTeeth.map(tooth => (
                            <span key={tooth} className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                              #{tooth}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">선택 없음</span>
                      )}
                    </div>
                  </div>

                  {/* 상담 메모 */}
                  {selectedPatient.consultation?.consultationNotes && (
                    <div>
                      <label className="text-xs text-gray-500">상담 메모</label>
                      <div className="mt-1 p-2 bg-gray-50 rounded text-sm">
                        {selectedPatient.consultation.consultationNotes}
                      </div>
                    </div>
                  )}

                  {/* 콜백 기록 */}
                  <div className="border-t pt-4">
                    <CallbackHistoryV2
                      callbacks={selectedPatient.preVisitCallbacks || []}
                      type="preVisit"
                      onAddCallback={(callback) => handleAddCallback(selectedPatient._id!, callback)}
                    />
                  </div>

                  {/* 상태 변경 이력 */}
                  {selectedPatient.statusHistory && selectedPatient.statusHistory.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">상태 변경 이력</h4>
                      <div className="space-y-1">
                        {selectedPatient.statusHistory.slice().reverse().map((history, idx) => (
                          <div key={idx} className="text-xs text-gray-500">
                            {history.date} {history.time} - {history.note}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
                환자를 선택하세요
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
