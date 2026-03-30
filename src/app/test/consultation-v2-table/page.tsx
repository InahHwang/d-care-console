// src/app/test/consultation-v2-table/page.tsx
// 상담관리 테스트 페이지 - 테이블 + 모달 버전 (탭 기능 포함)

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { PatientV2, CallbackRecord, CallbackResult } from '@/types/patientV2'

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// 탭 타입 정의
type ModalTab = '환자정보' | '상담관리' | '내원관리' | '사후관리' | '소개관리'

// 환자 등록 모달
function PatientRegisterModal({
  onClose,
  onRegister
}: {
  onClose: () => void
  onRegister: (patient: any) => Promise<void>
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    gender: '여',
    age: '',
    address: '',
    consultationType: '인바운드',
    source: '',
    interestedServices: [] as string[],
    estimatedAmount: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const consultationTypes = ['인바운드', '아웃바운드', '팀플DB', '소개', '재내원', '기타']
  const services = ['임플란트', '교정', '충치치료', '스케일링', '미백', '보철', '발치', '잇몸치료']

  const toggleService = (service: string) => {
    setForm(prev => ({
      ...prev,
      interestedServices: prev.interestedServices.includes(service)
        ? prev.interestedServices.filter(s => s !== service)
        : [...prev.interestedServices, service]
    }))
  }

  const handleSubmit = async () => {
    if (!form.name || !form.phone) {
      alert('이름과 전화번호는 필수입니다.')
      return
    }
    setIsSubmitting(true)
    try {
      await onRegister({
        ...form,
        age: form.age ? parseInt(form.age) : null,
        estimatedAmount: form.estimatedAmount ? parseInt(form.estimatedAmount.replace(/,/g, '')) : 0
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  // 주소에서 지역 추출
  const extractRegion = (address: string) => {
    const match = address.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/)
    return match ? match[0] : ''
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">신규 환자 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 *</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="010-1234-5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="여">여</option>
                <option value="남">남</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">나이</label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="30"
              />
            </div>
          </div>

          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="서울시 강남구..."
            />
            {form.address && extractRegion(form.address) && (
              <span className="text-xs text-orange-600 mt-1">지역: {extractRegion(form.address)}</span>
            )}
          </div>

          {/* 상담타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상담타입</label>
            <div className="flex flex-wrap gap-2">
              {consultationTypes.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, consultationType: type })}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    form.consultationType === type
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 유입경로 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">유입경로</label>
            <input
              type="text"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="네이버, 인스타그램, 지인소개 등"
            />
          </div>

          {/* 관심 서비스 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">관심 서비스</label>
            <div className="flex flex-wrap gap-2">
              {services.map(service => (
                <button
                  key={service}
                  type="button"
                  onClick={() => toggleService(service)}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    form.interestedServices.includes(service)
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {service}
                </button>
              ))}
            </div>
          </div>

          {/* 견적금액 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">예상 견적금액</label>
            <input
              type="text"
              value={form.estimatedAmount}
              onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value.replace(/[^0-9]/g, '') })}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="5,000,000"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {isSubmitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 환자 상세 모달 컴포넌트 (탭 기능 포함)
function PatientDetailModal({
  patient,
  onClose,
  onAddCallback,
  onStatusChange,
  onRefresh
}: {
  patient: PatientV2
  onClose: () => void
  onAddCallback: (callback: Omit<CallbackRecord, 'attempt' | 'createdAt'>) => Promise<void>
  onStatusChange: (action: string, data?: any) => Promise<void>
  onRefresh: () => void
}) {
  const [activeTab, setActiveTab] = useState<ModalTab>('환자정보')
  const [showCallbackForm, setShowCallbackForm] = useState(false)
  const [callbackForm, setCallbackForm] = useState({
    result: '통화완료',
    notes: '',
    nextCallbackDate: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddCallback = async () => {
    setIsSubmitting(true)
    try {
      await onAddCallback({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toISOString().split('T')[1].substring(0, 5),
        result: callbackForm.result as CallbackResult,
        notes: callbackForm.notes,
        counselorId: 'test-user'
      })
      setShowCallbackForm(false)
      setCallbackForm({ result: '통화완료', notes: '', nextCallbackDate: '' })
      onRefresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case '전화상담': return 'bg-orange-100 text-orange-800'
      case '예약확정': return 'bg-green-100 text-green-800'
      case '내원완료': return 'bg-purple-100 text-purple-800'
      case '종결': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case '신규': return 'bg-purple-100 text-purple-800'
      case '콜백필요': return 'bg-yellow-100 text-yellow-800'
      case '부재중': return 'bg-gray-200 text-gray-700'
      case '잠재고객': return 'bg-orange-100 text-orange-800'
      case '예약취소': return 'bg-red-100 text-red-800'
      case '노쇼': return 'bg-red-100 text-red-800'
      case '재콜백필요': return 'bg-yellow-100 text-yellow-800'
      default: return ''
    }
  }

  const isVisitConfirmed = patient.visitConfirmed === true

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">{patient.name}</h2>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getPhaseColor(patient.phase)}`}>
              {patient.phase}
            </span>
            {patient.currentStatus && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(patient.currentStatus)}`}>
                {patient.currentStatus}
              </span>
            )}
            {isVisitConfirmed && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                내원확인
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{patient.phone}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="bg-white border-b px-6 flex items-center flex-shrink-0">
          <button
            className={`px-4 py-3 text-sm font-medium relative ${activeTab === '환자정보' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('환자정보')}
          >
            환자정보
            {activeTab === '환자정보' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium relative ${activeTab === '상담관리' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('상담관리')}
          >
            상담관리
            {patient.preVisitCallbacks && patient.preVisitCallbacks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">
                {patient.preVisitCallbacks.length}
              </span>
            )}
            {activeTab === '상담관리' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium relative ${
              !isVisitConfirmed ? 'text-gray-300 cursor-not-allowed' :
              activeTab === '내원관리' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => isVisitConfirmed && setActiveTab('내원관리')}
            disabled={!isVisitConfirmed}
          >
            내원관리 {!isVisitConfirmed && '🔒'}
            {patient.postVisitCallbacks && patient.postVisitCallbacks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">
                {patient.postVisitCallbacks.length}
              </span>
            )}
            {activeTab === '내원관리' && isVisitConfirmed && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium relative ${
              !isVisitConfirmed ? 'text-gray-300 cursor-not-allowed' :
              activeTab === '사후관리' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => isVisitConfirmed && setActiveTab('사후관리')}
            disabled={!isVisitConfirmed}
          >
            사후관리 {!isVisitConfirmed && '🔒'}
            {activeTab === '사후관리' && isVisitConfirmed && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium relative ${activeTab === '소개관리' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('소개관리')}
          >
            소개관리
            {activeTab === '소개관리' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 환자정보 탭 */}
          {activeTab === '환자정보' && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">이름:</span>
                    <span className="ml-2 font-medium">{patient.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">연락처:</span>
                    <span className="ml-2 font-medium">{patient.phone}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">나이:</span>
                    <span className="ml-2 font-medium">{patient.age}세</span>
                  </div>
                  <div>
                    <span className="text-gray-500">성별:</span>
                    <span className="ml-2 font-medium">{patient.gender}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">상담타입:</span>
                    <span className="ml-2 font-medium">{patient.consultationType || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">유입경로:</span>
                    <span className="ml-2 font-medium">{patient.source || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">주소:</span>
                    <span className="ml-2 font-medium">{patient.address || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 상담 정보 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4">상담 정보</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">관심 서비스:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patient.consultation?.interestedServices?.map(service => (
                        <span key={service} className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">
                          {service}
                        </span>
                      )) || <span className="text-gray-400">-</span>}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">치료 대상 치아:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patient.consultation?.teethUnknown ? (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">미확인</span>
                      ) : patient.consultation?.selectedTeeth?.length ? (
                        <>
                          {patient.consultation.selectedTeeth.map(tooth => (
                            <span key={tooth} className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                              #{tooth}
                            </span>
                          ))}
                          <span className="text-gray-500 ml-1">({patient.consultation.selectedTeeth.length}본)</span>
                        </>
                      ) : <span className="text-gray-400">-</span>}
                    </div>
                  </div>
                  {patient.consultation?.consultationNotes && (
                    <div>
                      <span className="text-gray-500">상담 메모:</span>
                      <p className="mt-1 p-2 bg-white rounded border text-gray-700">{patient.consultation.consultationNotes}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">예상 견적:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {patient.consultation?.estimatedAmount?.toLocaleString() || 0}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 예약 정보 */}
              {patient.reservation && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h3 className="font-medium text-green-800 mb-2">예약 정보</h3>
                  <div className="text-sm text-green-700">
                    <p>{patient.reservation.date} {patient.reservation.time} ({patient.reservation.type})</p>
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              {!isVisitConfirmed && (
                <div className="flex gap-2 pt-4 border-t">
                  {patient.phase === '전화상담' && (
                    <button
                      onClick={() => onStatusChange('confirmReservation', {
                        reservation: {
                          date: new Date().toISOString().split('T')[0],
                          time: '10:00',
                          type: '초진'
                        }
                      })}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      예약 확정
                    </button>
                  )}
                  {patient.phase === '예약확정' && (
                    <>
                      <button
                        onClick={() => onStatusChange('confirmVisit')}
                        className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                      >
                        내원 확인
                      </button>
                      <button
                        onClick={() => onStatusChange('cancelReservation')}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        예약 취소
                      </button>
                      <button
                        onClick={() => onStatusChange('noShow')}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        노쇼
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 상담관리 탭 (전화상담 콜백) */}
          {activeTab === '상담관리' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">전화상담 콜백 기록</h3>
                {!isVisitConfirmed && (
                  <button
                    onClick={() => setShowCallbackForm(true)}
                    className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
                  >
                    + 콜백 등록
                  </button>
                )}
              </div>

              {showCallbackForm && (
                <div className="p-4 bg-orange-50 rounded-lg space-y-3">
                  <select
                    value={callbackForm.result}
                    onChange={(e) => setCallbackForm({ ...callbackForm, result: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="통화완료">통화완료</option>
                    <option value="부재중">부재중</option>
                    <option value="콜백재요청">콜백재요청</option>
                    <option value="예약확정">예약확정</option>
                    <option value="보류">보류</option>
                  </select>
                  <textarea
                    value={callbackForm.notes}
                    onChange={(e) => setCallbackForm({ ...callbackForm, notes: e.target.value })}
                    placeholder="메모..."
                    className="w-full border rounded px-3 py-2 text-sm"
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowCallbackForm(false)}
                      className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleAddCallback}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm disabled:opacity-50"
                    >
                      {isSubmitting ? '저장중...' : '저장'}
                    </button>
                  </div>
                </div>
              )}

              {patient.preVisitCallbacks && patient.preVisitCallbacks.length > 0 ? (
                <div className="space-y-2">
                  {[...patient.preVisitCallbacks].reverse().map((cb, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-orange-600">{cb.attempt}차 콜백</span>
                          <span className="text-sm text-gray-500">{cb.date} {cb.time}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          cb.result === '예약확정' ? 'bg-green-100 text-green-800' :
                          cb.result === '부재중' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {cb.result}
                        </span>
                      </div>
                      {cb.notes && <p className="text-sm text-gray-600">{cb.notes}</p>}
                      {cb.counselorName && (
                        <p className="text-xs text-gray-400 mt-1">담당: {cb.counselorName}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>콜백 기록이 없습니다</p>
                  {!isVisitConfirmed && (
                    <p className="text-sm mt-1">위의 &quot;+ 콜백 등록&quot; 버튼을 눌러 콜백을 등록하세요</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 내원관리 탭 */}
          {activeTab === '내원관리' && isVisitConfirmed && (
            <div className="space-y-4">
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 mb-4">
                <h3 className="font-medium text-orange-800 mb-2">내원 정보</h3>
                <p className="text-sm text-orange-700">첫 내원일: {patient.firstVisitDate || '-'}</p>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">사후 콜백 기록</h3>
                <button
                  onClick={() => setShowCallbackForm(true)}
                  className="px-3 py-1.5 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                >
                  + 사후 콜백 등록
                </button>
              </div>

              {patient.postVisitCallbacks && patient.postVisitCallbacks.length > 0 ? (
                <div className="space-y-2">
                  {[...patient.postVisitCallbacks].reverse().map((cb, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-purple-600">{cb.attempt}차 사후콜백</span>
                          <span className="text-sm text-gray-500">{cb.date} {cb.time}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          cb.result === '치료동의' ? 'bg-green-100 text-green-800' :
                          cb.result === '치료거부' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {cb.result}
                        </span>
                      </div>
                      {cb.notes && <p className="text-sm text-gray-600">{cb.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>사후 콜백 기록이 없습니다</p>
                </div>
              )}

              {/* 내원관리 액션 */}
              {patient.phase === '내원완료' && !patient.result && (
                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={() => onStatusChange('agree')}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    동의
                  </button>
                  <button
                    onClick={() => onStatusChange('disagree')}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    미동의
                  </button>
                  <button
                    onClick={() => onStatusChange('hold')}
                    className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                  >
                    보류
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 사후관리 탭 */}
          {activeTab === '사후관리' && isVisitConfirmed && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4">사후관리 현황</h3>
                {patient.result ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">결과:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        patient.result === '동의' ? 'bg-green-100 text-green-800' :
                        patient.result === '미동의' ? 'bg-red-100 text-red-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {patient.result}
                      </span>
                    </div>
                    {patient.resultReason && (
                      <div>
                        <span className="text-gray-500">사유:</span>
                        <span className="ml-2">{patient.resultReason}</span>
                        {patient.resultReasonDetail && (
                          <span className="text-gray-500 ml-1">- {patient.resultReasonDetail}</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">아직 결과가 등록되지 않았습니다</p>
                )}
              </div>
            </div>
          )}

          {/* 소개관리 탭 */}
          {activeTab === '소개관리' && (
            <div className="text-center py-8 text-gray-400">
              <p>소개환자 관리 기능</p>
              <p className="text-sm mt-1">v2 테스트에서는 아직 구현되지 않았습니다</p>
            </div>
          )}
        </div>

        {/* 상태 이력 (하단 고정) */}
        <div className="bg-gray-50 border-t px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              상태 변경 이력: {patient.statusHistory?.length || 0}건
            </span>
            <span className="text-xs text-gray-400">
              마지막 수정: {patient.updatedAt?.split('T')[0]}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConsultationV2TablePage() {
  const [patients, setPatients] = useState<PatientV2[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientV2 | null>(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // 페이지네이션
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 20, totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false
  })

  // 검색/필터
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchPatients = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'consultation_all', // 내원확인 환자 포함
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy, sortOrder
      })
      if (search) params.append('search', search)
      if (phaseFilter) params.append('phase', phaseFilter)
      if (statusFilter) params.append('status', statusFilter)

      const res = await fetch(`/api/test/patients-v2?${params}`, { credentials: 'include' })
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

  useEffect(() => {
    fetchPatients(1)
  }, [search, phaseFilter, statusFilter, sortBy, sortOrder])

  const handleSeedData = async () => {
    if (!confirm('기존 테스트 데이터를 삭제하고 새로 생성합니다. 계속하시겠습니까?')) return
    try {
      const res = await fetch('/api/test/seed', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        fetchPatients(1)
      }
    } catch (error) {
      console.error('테스트 데이터 생성 실패:', error)
    }
  }

  // 환자 등록
  const handleRegisterPatient = async (patientData: any) => {
    const res = await fetch('/api/test/patients-v2', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData)
    })
    const data = await res.json()
    if (data.success) {
      fetchPatients(1)
    }
  }

  // 환자 삭제
  const handleDeletePatient = async (patientId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('이 환자를 삭제하시겠습니까?')) return

    const res = await fetch(`/api/test/patients-v2?id=${patientId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    const data = await res.json()
    if (data.success) {
      setPatients(patients.filter(p => p._id !== patientId))
      if (selectedPatient?._id === patientId) {
        setSelectedPatient(null)
      }
    }
  }

  // 콜백 등록
  const handleAddCallback = async (patientId: string, callback: Omit<CallbackRecord, 'attempt' | 'createdAt'>) => {
    const res = await fetch(`/api/test/patients-v2/${patientId}/callback`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'preVisit', ...callback })
    })
    const data = await res.json()
    if (data.success) {
      setPatients(patients.map(p => p._id === patientId ? data.data : p))
      setSelectedPatient(data.data)
    }
  }

  // 상태 변경
  const handleStatusChange = async (patientId: string, action: string, additionalData?: any) => {
    const res = await fetch(`/api/test/patients-v2/${patientId}/status`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...additionalData })
    })
    const data = await res.json()
    if (data.success) {
      setPatients(patients.map(p => p._id === patientId ? data.data : p))
      setSelectedPatient(data.data)
    }
  }

  // 환자 데이터 새로고침
  const handleRefreshPatient = async () => {
    if (!selectedPatient?._id) return
    try {
      const res = await fetch(`/api/test/patients-v2/${selectedPatient._id}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setSelectedPatient(data.data)
        setPatients(patients.map(p => p._id === selectedPatient._id ? data.data : p))
      }
    } catch (error) {
      console.error('환자 데이터 새로고침 실패:', error)
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case '신규': return 'bg-purple-100 text-purple-800'
      case '콜백필요': return 'bg-yellow-100 text-yellow-800'
      case '부재중': return 'bg-gray-200 text-gray-700'
      case '잠재고객': return 'bg-orange-100 text-orange-800'
      case '예약취소': return 'bg-red-100 text-red-800'
      case '노쇼': return 'bg-red-100 text-red-800'
      default: return ''
    }
  }

  const getRowStyle = (patient: PatientV2) => {
    // 내원확인된 환자는 회색 처리
    if (patient.visitConfirmed) {
      return 'bg-gray-100 text-gray-400 opacity-60'
    }
    if (patient.phase === '예약확정') return 'bg-green-50'
    if (patient.currentStatus === '부재중') return 'bg-red-50'
    if (patient.currentStatus === '콜백필요') return 'bg-yellow-50'
    if (patient.currentStatus === '신규') return 'bg-purple-50/50'
    return ''
  }

  // 주소에서 지역 추출
  const extractRegion = (address: string | undefined) => {
    if (!address) return '-'
    const match = address.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/)
    return match ? match[0] : address.split(' ')[0] || '-'
  }

  const getPageNumbers = () => {
    const pages: number[] = []
    const { page, totalPages } = pagination
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">상담관리 v2 (테이블 버전)</h1>
              <p className="text-sm text-gray-500">테이블 + 탭 모달 UI</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRegisterModal(true)}
                className="px-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                + 환자 등록
              </button>
              <button onClick={handleSeedData} className="px-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600">
                테스트 데이터 생성
              </button>
              <a href="/test/consultation-v2" className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                패널 버전 →
              </a>
              <a href="/test/visit-v2-table" className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                내원관리 →
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 py-6">
        {/* 검색/필터 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] max-w-md">
              <div className="flex">
                <input
                  type="text"
                  placeholder="이름 또는 전화번호 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
                  className="flex-1 border rounded-l px-3 py-2 text-sm"
                />
                <button onClick={() => setSearch(searchInput)} className="px-4 py-2 bg-orange-500 text-white rounded-r hover:bg-orange-600 text-sm">
                  검색
                </button>
              </div>
            </div>
            <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
              <option value="">전체 단계</option>
              <option value="전화상담">전화상담</option>
              <option value="예약확정">예약확정</option>
              <option value="내원완료">내원완료</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
              <option value="">전체 상태</option>
              <option value="신규">신규</option>
              <option value="콜백필요">콜백필요</option>
              <option value="부재중">부재중</option>
              <option value="잠재고객">잠재고객</option>
              <option value="예약취소">예약취소</option>
              <option value="노쇼">노쇼</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border rounded px-3 py-2 text-sm">
              <option value="updatedAt">최근 수정순</option>
              <option value="createdAt">등록일순</option>
              <option value="name">이름순</option>
              <option value="callInDate">유입일순</option>
            </select>
            <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} className="px-3 py-2 border rounded text-sm hover:bg-gray-50">
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
            {(search || phaseFilter || statusFilter) && (
              <button onClick={() => { setSearch(''); setSearchInput(''); setPhaseFilter(''); setStatusFilter(''); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                초기화
              </button>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            총 {pagination.totalCount}명
            {search && <span className="ml-2">| 검색: &quot;{search}&quot;</span>}
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">연락처</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">나이/성별</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">상담타입</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">지역</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">관심분야</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">치아</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">콜백</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">견적금액</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">예약일</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">삭제</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
                ) : patients.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다</td></tr>
                ) : (
                  patients.map(patient => (
                    <tr
                      key={patient._id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`border-b cursor-pointer hover:bg-gray-100 transition-colors ${getRowStyle(patient)}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        {patient.name}
                        {patient.visitConfirmed && (
                          <span className="ml-1 text-xs text-gray-400">(내원완료)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{patient.phone}</td>
                      <td className="px-4 py-3 text-sm">{patient.age}세/{patient.gender}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          patient.consultationType === '인바운드' ? 'bg-orange-100 text-orange-800' :
                          patient.consultationType === '아웃바운드' ? 'bg-green-100 text-green-800' :
                          patient.consultationType === '팀플DB' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {patient.consultationType || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{extractRegion(patient.address)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {patient.consultation?.interestedServices?.slice(0, 2).map(s => (
                            <span key={s} className="px-1.5 py-0.5 bg-orange-50 text-orange-700 text-xs rounded">{s}</span>
                          ))}
                          {(patient.consultation?.interestedServices?.length || 0) > 2 && (
                            <span className="text-xs text-gray-400">+{(patient.consultation?.interestedServices?.length || 0) - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {patient.consultation?.teethUnknown ? (
                          <span className="text-gray-400">미확인</span>
                        ) : patient.consultation?.selectedTeeth?.length ? (
                          <span className="text-purple-600">{patient.consultation.selectedTeeth.length}본</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {patient.currentStatus && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(patient.currentStatus)}`}>
                            {patient.currentStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(patient.preVisitCallbacks?.length || 0) > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            {patient.preVisitCallbacks?.length}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {patient.consultation?.estimatedAmount ? (
                          <span className="text-green-600 font-medium">
                            {patient.consultation.estimatedAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {patient.reservation ? (
                          <div className="text-green-600">
                            <div>{patient.reservation.date}</div>
                            <div className="text-xs">{patient.reservation.time}</div>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => handleDeletePatient(patient._id!, e)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="삭제"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-center gap-1">
              <button onClick={() => fetchPatients(1)} disabled={!pagination.hasPrev} className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30">««</button>
              <button onClick={() => fetchPatients(pagination.page - 1)} disabled={!pagination.hasPrev} className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30">«</button>
              {getPageNumbers().map(p => (
                <button key={p} onClick={() => fetchPatients(p)} className={`px-3 py-1 text-sm rounded ${p === pagination.page ? 'bg-orange-500 text-white' : 'hover:bg-gray-100'}`}>{p}</button>
              ))}
              <button onClick={() => fetchPatients(pagination.page + 1)} disabled={!pagination.hasNext} className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30">»</button>
              <button onClick={() => fetchPatients(pagination.totalPages)} disabled={!pagination.hasNext} className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30">»»</button>
            </div>
          )}
        </div>
      </div>

      {/* 환자 등록 모달 */}
      {showRegisterModal && (
        <PatientRegisterModal
          onClose={() => setShowRegisterModal(false)}
          onRegister={handleRegisterPatient}
        />
      )}

      {/* 환자 상세 모달 */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onAddCallback={(callback) => handleAddCallback(selectedPatient._id!, callback)}
          onStatusChange={(action, data) => handleStatusChange(selectedPatient._id!, action, data)}
          onRefresh={handleRefreshPatient}
        />
      )}
    </div>
  )
}
