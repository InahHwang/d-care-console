// src/app/test/visit-v2/page.tsx
// 내원관리 테스트 페이지 (v2 구조)

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { PatientV2, CallbackRecord, ResultReason } from '@/types/patientV2'
import CallbackHistoryV2 from '@/components/test/CallbackHistoryV2'

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const RESULT_REASONS: { value: ResultReason; label: string }[] = [
  { value: '예산초과', label: '예산 초과' },
  { value: '분납조건불가', label: '분납 조건 안 맞음' },
  { value: '치료계획이견', label: '치료 계획 이견' },
  { value: '치료거부', label: '제안 치료 거부' },
  { value: '치료기간부담', label: '치료 기간 부담' },
  { value: '가족상의필요', label: '가족 상의 필요' },
  { value: '타병원비교', label: '타 병원 비교 중' },
  { value: '추가정보필요', label: '추가 정보 필요' },
  { value: '일정조율어려움', label: '일정 조율 어려움' },
  { value: '치료두려움', label: '치료 두려움/불안' },
  { value: '연락두절', label: '연락 두절' },
  { value: '기타', label: '기타' }
]

export default function VisitV2TestPage() {
  const [patients, setPatients] = useState<PatientV2[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientV2 | null>(null)
  const [loading, setLoading] = useState(true)

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
  const [resultFilter, setResultFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 종결 모달
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completeForm, setCompleteForm] = useState({
    result: '동의' as '동의' | '미동의' | '보류',
    resultReason: '' as ResultReason | '',
    resultReasonDetail: ''
  })

  const fetchPatients = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'visit',
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder
      })

      if (search) params.append('search', search)
      if (phaseFilter) params.append('phase', phaseFilter)

      const res = await fetch(`/api/test/patients-v2?${params}`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        // 결과 필터 적용 (클라이언트 측)
        let filteredData = data.data
        if (resultFilter) {
          filteredData = data.data.filter((p: PatientV2) => p.result === resultFilter)
        }
        setPatients(filteredData)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('환자 목록 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [search, phaseFilter, resultFilter, sortBy, sortOrder, pagination.limit])

  useEffect(() => {
    fetchPatients(1)
  }, [search, phaseFilter, resultFilter, sortBy, sortOrder])

  // 검색 핸들러
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

  // 콜백 등록
  const handleAddCallback = async (patientId: string, callback: Omit<CallbackRecord, 'attempt' | 'createdAt'>) => {
    try {
      const res = await fetch(`/api/test/patients-v2/${patientId}/callback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'postVisit',
          ...callback
        })
      })

      const data = await res.json()
      if (data.success) {
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

  // 종결 처리
  const handleComplete = async () => {
    if (!selectedPatient) return

    try {
      const res = await fetch(`/api/test/patients-v2/${selectedPatient._id}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          result: completeForm.result,
          resultReason: completeForm.resultReason || null,
          resultReasonDetail: completeForm.resultReasonDetail
        })
      })

      const data = await res.json()
      if (data.success) {
        setPatients(patients.map(p =>
          p._id === selectedPatient._id ? data.data : p
        ))
        setSelectedPatient(data.data)
        setShowCompleteModal(false)
        setCompleteForm({ result: '동의', resultReason: '', resultReasonDetail: '' })
      }
    } catch (error) {
      console.error('종결 처리 실패:', error)
    }
  }

  // 종결 취소
  const handleReopen = async () => {
    if (!selectedPatient) return

    try {
      const res = await fetch(`/api/test/patients-v2/${selectedPatient._id}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' })
      })

      const data = await res.json()
      if (data.success) {
        setPatients(patients.map(p =>
          p._id === selectedPatient._id ? data.data : p
        ))
        setSelectedPatient(data.data)
      }
    } catch (error) {
      console.error('종결 취소 실패:', error)
    }
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case '내원완료': return 'bg-blue-100 text-blue-800'
      case '종결': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getResultColor = (result: string | null) => {
    switch (result) {
      case '동의': return 'bg-green-100 text-green-800'
      case '미동의': return 'bg-red-100 text-red-800'
      case '보류': return 'bg-orange-100 text-orange-800'
      default: return ''
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case '재콜백필요': return 'bg-yellow-100 text-yellow-800'
      default: return ''
    }
  }

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
              <h1 className="text-xl font-bold text-gray-900">내원관리 v2 테스트</h1>
              <p className="text-sm text-gray-500">내원 후 환자 관리</p>
            </div>
            <div className="flex gap-2">
              <a
                href="/test/consultation-v2"
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                ← 상담관리
              </a>
              <a
                href="/test/daily-report-v2"
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                보고서 →
              </a>
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
                <option value="내원완료">내원완료</option>
                <option value="종결">종결</option>
              </select>
            </div>

            {/* 결과 필터 */}
            <div>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">전체 결과</option>
                <option value="동의">동의</option>
                <option value="미동의">미동의</option>
                <option value="보류">보류</option>
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
                <option value="firstVisitDate">내원일순</option>
                <option value="name">이름순</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            {/* 초기화 */}
            {(search || phaseFilter || resultFilter) && (
              <button
                onClick={() => {
                  setSearch('')
                  setSearchInput('')
                  setPhaseFilter('')
                  setResultFilter('')
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
            {resultFilter && <span className="ml-2">| 결과: {resultFilter}</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 환자 목록 */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="font-medium">내원 환자 ({pagination.totalCount})</h3>
              </div>

              {loading ? (
                <div className="p-8 text-center text-gray-400">로딩 중...</div>
              ) : (
                <>
                  <div className="divide-y max-h-[calc(100vh-400px)] overflow-y-auto">
                    {patients.length === 0 ? (
                      <div className="p-8 text-center text-gray-400">
                        {search || phaseFilter || resultFilter ? '검색 결과가 없습니다' : '내원한 환자가 없습니다'}
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
                              {patient.result && (
                                <span className={`text-xs px-2 py-0.5 rounded ${getResultColor(patient.result)}`}>
                                  {patient.result}
                                </span>
                              )}
                              {patient.currentStatus && (
                                <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(patient.currentStatus)}`}>
                                  {patient.currentStatus}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {patient.phone} |
                            내원후 콜백 {patient.postVisitCallbacks?.length || 0}회
                            {patient.firstVisitDate && ` | 내원: ${patient.firstVisitDate}`}
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
                      {selectedPatient.phone} | 내원일: {selectedPatient.firstVisitDate}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedPatient.phase !== '종결' ? (
                      <button
                        onClick={() => setShowCompleteModal(true)}
                        className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        종결 처리
                      </button>
                    ) : (
                      <button
                        onClick={handleReopen}
                        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        종결 취소
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* 상태 정보 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">단계</label>
                      <div className={`mt-1 inline-block px-2 py-1 rounded text-sm ${getPhaseColor(selectedPatient.phase)}`}>
                        {selectedPatient.phase}
                      </div>
                    </div>
                    {selectedPatient.result && (
                      <div>
                        <label className="text-xs text-gray-500">결과</label>
                        <div className={`mt-1 inline-block px-2 py-1 rounded text-sm ${getResultColor(selectedPatient.result)}`}>
                          {selectedPatient.result}
                        </div>
                      </div>
                    )}
                    {selectedPatient.currentStatus && (
                      <div>
                        <label className="text-xs text-gray-500">상태</label>
                        <div className={`mt-1 inline-block px-2 py-1 rounded text-sm ${getStatusColor(selectedPatient.currentStatus)}`}>
                          {selectedPatient.currentStatus}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 미동의/보류 사유 */}
                  {selectedPatient.resultReason && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <label className="text-xs text-yellow-700 font-medium">사유</label>
                      <div className="mt-1 text-sm">
                        {RESULT_REASONS.find(r => r.value === selectedPatient.resultReason)?.label || selectedPatient.resultReason}
                        {selectedPatient.resultReasonDetail && (
                          <span className="text-gray-500 ml-2">- {selectedPatient.resultReasonDetail}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 치아 정보 */}
                  <div>
                    <label className="text-xs text-gray-500">치료 대상 치아</label>
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
                          <span className="text-xs text-gray-500 ml-2">
                            ({selectedPatient.consultation.selectedTeeth.length}본)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">선택 없음</span>
                      )}
                    </div>
                  </div>

                  {/* 관심 서비스 */}
                  <div>
                    <label className="text-xs text-gray-500">치료 항목</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedPatient.consultation?.interestedServices?.map(service => (
                        <span key={service} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 전화상담 콜백 기록 (읽기 전용) */}
                  {selectedPatient.preVisitCallbacks && selectedPatient.preVisitCallbacks.length > 0 && (
                    <div className="border-t pt-4">
                      <CallbackHistoryV2
                        callbacks={selectedPatient.preVisitCallbacks}
                        type="preVisit"
                        readonly
                      />
                    </div>
                  )}

                  {/* 내원후 콜백 기록 */}
                  <div className="border-t pt-4">
                    <CallbackHistoryV2
                      callbacks={selectedPatient.postVisitCallbacks || []}
                      type="postVisit"
                      onAddCallback={(callback) => handleAddCallback(selectedPatient._id!, callback)}
                      readonly={selectedPatient.phase === '종결'}
                    />
                  </div>

                  {/* 상태 변경 이력 */}
                  {selectedPatient.statusHistory && selectedPatient.statusHistory.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">상태 변경 이력</h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
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

      {/* 종결 모달 */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-medium mb-4">종결 처리</h3>

            <div className="space-y-4">
              {/* 결과 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">결과</label>
                <div className="flex gap-2">
                  {['동의', '미동의', '보류'].map(result => (
                    <button
                      key={result}
                      onClick={() => setCompleteForm({ ...completeForm, result: result as any })}
                      className={`flex-1 py-2 rounded text-sm ${
                        completeForm.result === result
                          ? result === '동의'
                            ? 'bg-green-500 text-white'
                            : result === '미동의'
                            ? 'bg-red-500 text-white'
                            : 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {result}
                    </button>
                  ))}
                </div>
              </div>

              {/* 사유 선택 (미동의/보류 시) */}
              {(completeForm.result === '미동의' || completeForm.result === '보류') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">사유</label>
                  <select
                    value={completeForm.resultReason}
                    onChange={(e) => setCompleteForm({ ...completeForm, resultReason: e.target.value as ResultReason })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">사유 선택</option>
                    {RESULT_REASONS.map(reason => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 기타 사유 상세 */}
              {completeForm.resultReason === '기타' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">상세 사유</label>
                  <textarea
                    value={completeForm.resultReasonDetail}
                    onChange={(e) => setCompleteForm({ ...completeForm, resultReasonDetail: e.target.value })}
                    placeholder="상세 사유를 입력하세요..."
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCompleteModal(false)
                  setCompleteForm({ result: '동의', resultReason: '', resultReasonDetail: '' })
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                종결 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
