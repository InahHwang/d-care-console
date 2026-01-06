// src/app/test/visit-v2-table/page.tsx
// 내원관리 테스트 페이지 - 테이블 + 탭 모달 버전

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { PatientV2, CallbackRecord, CallbackResult, PostVisitStatus, ResultReason, POST_VISIT_REASONS, PostVisitStatusInfo } from '@/types/patientV2'
import ToothSelector from '@/components/common/ToothSelector'

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

type ModalTab = '환자정보' | '상담관리' | '내원관리' | '사후관리' | '소개관리'

// 환자 상세 모달 컴포넌트
function PatientDetailModal({
  patient,
  onClose,
  onAddCallback,
  onStatusChange,
  onRefresh,
  onSaveConsultation,
  onConfirmTeeth,
  onUpdatePostVisitStatus
}: {
  patient: PatientV2
  onClose: () => void
  onAddCallback: (callback: Omit<CallbackRecord, 'attempt' | 'createdAt'>, type: 'preVisit' | 'postVisit') => Promise<void>
  onStatusChange: (action: string, data?: any) => Promise<void>
  onRefresh: () => void
  onSaveConsultation: (data: any) => Promise<void>
  onConfirmTeeth: (selectedTeeth: number[]) => Promise<void>
  onUpdatePostVisitStatus: (data: any) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<ModalTab>('내원관리')
  const [showCallbackForm, setShowCallbackForm] = useState(false)
  const [callbackForm, setCallbackForm] = useState({
    result: '통화완료',
    notes: '',
    // 상태 연동 필드
    statusAction: '' as '' | '치료진행' | '치료예정' | '결정대기' | '장기보류' | '종결',
    nextCallbackDate: '',
    treatmentStartDate: '',
    nextVisitDate: '',
    depositPaid: false,
    reason: '' as ResultReason | '',
    reasonDetail: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 치아 확정 상태
  const [showTeethForm, setShowTeethForm] = useState(false)
  const [tempSelectedTeeth, setTempSelectedTeeth] = useState<number[]>(patient.consultation?.selectedTeeth || [])
  const [isSavingTeeth, setIsSavingTeeth] = useState(false)

  // 치아 확정 저장
  const handleConfirmTeeth = async () => {
    setIsSavingTeeth(true)
    try {
      await onConfirmTeeth(tempSelectedTeeth)
      setShowTeethForm(false)
    } finally {
      setIsSavingTeeth(false)
    }
  }

  // 치아 폼 열기
  const openTeethForm = () => {
    setTempSelectedTeeth(patient.consultation?.selectedTeeth || [])
    setShowTeethForm(true)
  }

  // 상담기록 폼 상태
  const [showConsultationForm, setShowConsultationForm] = useState(false)
  const [consultationForm, setConsultationForm] = useState({
    regularPrice: patient.postVisitConsultation?.estimateInfo?.regularPrice || 0,
    discountPrice: patient.postVisitConsultation?.estimateInfo?.discountPrice || 0,
    discountReason: patient.postVisitConsultation?.estimateInfo?.discountReason || '',
    diagnosisNotes: patient.postVisitConsultation?.diagnosisNotes || '',
    treatmentRecommendation: patient.postVisitConsultation?.treatmentRecommendation || '',
    doctorName: patient.postVisitConsultation?.doctorName || ''
  })
  const [isSavingConsultation, setIsSavingConsultation] = useState(false)

  // 정가 변경 시 할인가 자동 동기화
  const handleRegularPriceChange = (value: number) => {
    setConsultationForm(prev => ({
      ...prev,
      regularPrice: value,
      discountPrice: prev.discountPrice === prev.regularPrice || prev.discountPrice === 0 ? value : prev.discountPrice
    }))
  }

  // 상담기록 저장
  const handleSaveConsultation = async () => {
    setIsSavingConsultation(true)
    try {
      await onSaveConsultation(consultationForm)
      setShowConsultationForm(false)
    } finally {
      setIsSavingConsultation(false)
    }
  }

  // 상담기록 폼 열기 (수정 모드)
  const openConsultationForm = () => {
    setConsultationForm({
      regularPrice: patient.postVisitConsultation?.estimateInfo?.regularPrice || 0,
      discountPrice: patient.postVisitConsultation?.estimateInfo?.discountPrice || 0,
      discountReason: patient.postVisitConsultation?.estimateInfo?.discountReason || '',
      diagnosisNotes: patient.postVisitConsultation?.diagnosisNotes || '',
      treatmentRecommendation: patient.postVisitConsultation?.treatmentRecommendation || '',
      doctorName: patient.postVisitConsultation?.doctorName || ''
    })
    setShowConsultationForm(true)
  }

  // 내원 후 상태 폼 상태
  const [selectedPostVisitStatus, setSelectedPostVisitStatus] = useState<PostVisitStatus | null>(
    patient.postVisitStatusInfo?.status || null
  )
  const [postVisitStatusForm, setPostVisitStatusForm] = useState({
    treatmentStartDate: patient.postVisitStatusInfo?.treatmentStartDate || '',
    nextVisitDate: patient.postVisitStatusInfo?.nextVisitDate || '',
    depositPaid: patient.postVisitStatusInfo?.depositPaid || false,
    treatmentNotes: patient.postVisitStatusInfo?.treatmentNotes || '',
    reason: patient.postVisitStatusInfo?.reason || '' as ResultReason | '',
    reasonDetail: patient.postVisitStatusInfo?.reasonDetail || '',
    nextCallbackDate: patient.postVisitStatusInfo?.nextCallbackDate || '',
    expectedDecisionDate: patient.postVisitStatusInfo?.expectedDecisionDate || '',
    expectedStartDate: patient.postVisitStatusInfo?.expectedStartDate || '',
    needsSpecialOffer: patient.postVisitStatusInfo?.needsSpecialOffer || false,
    canRecontact: patient.postVisitStatusInfo?.canRecontact ?? true,
    callbackNotes: patient.postVisitStatusInfo?.callbackNotes || ''
  })
  const [isSavingPostVisitStatus, setIsSavingPostVisitStatus] = useState(false)

  // 상태 선택 시 폼 초기화
  const handleSelectPostVisitStatus = (status: PostVisitStatus) => {
    setSelectedPostVisitStatus(status)
    // 기존 데이터가 있으면 유지, 없으면 초기화
    if (patient.postVisitStatusInfo?.status !== status) {
      setPostVisitStatusForm(prev => ({
        ...prev,
        reason: '' as ResultReason | '',
        reasonDetail: ''
      }))
    }
  }

  // 내원 후 상태 저장
  const handleSavePostVisitStatus = async () => {
    if (!selectedPostVisitStatus) return
    setIsSavingPostVisitStatus(true)
    try {
      await onUpdatePostVisitStatus({
        status: selectedPostVisitStatus,
        ...postVisitStatusForm,
        agreedDate: selectedPostVisitStatus === '장기보류'
          ? (patient.postVisitStatusInfo?.agreedDate || new Date().toISOString().split('T')[0])
          : undefined
      })
      setSelectedPostVisitStatus(null)
    } finally {
      setIsSavingPostVisitStatus(false)
    }
  }

  // 경과일 계산 (장기보류용)
  const getDaysSinceAgreed = () => {
    if (!patient.postVisitStatusInfo?.agreedDate) return 0
    const agreed = new Date(patient.postVisitStatusInfo.agreedDate)
    const now = new Date()
    return Math.floor((now.getTime() - agreed.getTime()) / (1000 * 60 * 60 * 24))
  }

  const tabs: { id: ModalTab; label: string; badge?: number }[] = [
    { id: '환자정보', label: '환자정보' },
    { id: '상담관리', label: '상담관리', badge: patient.preVisitCallbacks?.length || 0 },
    { id: '내원관리', label: '내원관리', badge: patient.postVisitCallbacks?.length || 0 },
    { id: '사후관리', label: '사후관리' },
    { id: '소개관리', label: '소개관리' },
  ]

  const handleAddCallback = async () => {
    setIsSubmitting(true)
    try {
      // 1. 콜백 기록 추가
      await onAddCallback({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toISOString().split('T')[1].substring(0, 5),
        result: callbackForm.result as CallbackResult,
        notes: callbackForm.notes,
        counselorId: 'test-user'
      }, 'postVisit')

      // 2. 상태 변경이 선택된 경우 함께 업데이트
      if (callbackForm.statusAction) {
        const statusData: any = {
          status: callbackForm.statusAction
        }

        switch (callbackForm.statusAction) {
          case '치료진행':
            statusData.treatmentStartDate = callbackForm.treatmentStartDate
            statusData.nextVisitDate = callbackForm.nextVisitDate
            statusData.treatmentNotes = callbackForm.notes
            break
          case '치료예정':
            statusData.treatmentStartDate = callbackForm.treatmentStartDate
            statusData.nextVisitDate = callbackForm.nextVisitDate
            statusData.depositPaid = callbackForm.depositPaid
            statusData.treatmentNotes = callbackForm.notes
            break
          case '결정대기':
          case '장기보류':
            statusData.reason = callbackForm.reason
            statusData.reasonDetail = callbackForm.reasonDetail
            statusData.nextCallbackDate = callbackForm.nextCallbackDate
            statusData.callbackNotes = callbackForm.notes
            break
          case '종결':
            statusData.reason = callbackForm.reason
            statusData.reasonDetail = callbackForm.reasonDetail
            statusData.callbackNotes = callbackForm.notes
            break
        }

        await onUpdatePostVisitStatus(statusData)
      }

      setShowCallbackForm(false)
      setCallbackForm({
        result: '통화완료',
        notes: '',
        statusAction: '',
        nextCallbackDate: '',
        treatmentStartDate: '',
        nextVisitDate: '',
        depositPaid: false,
        reason: '',
        reasonDetail: ''
      })
      onRefresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case '전화상담': return 'bg-purple-100 text-purple-800'
      case '예약확정': return 'bg-blue-100 text-blue-800'
      case '내원완료': return 'bg-green-100 text-green-800'
      case '종결': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case '신규': return 'bg-blue-100 text-blue-800'
      case '재콜백필요': return 'bg-yellow-100 text-yellow-800'
      case '부재중': return 'bg-gray-200 text-gray-700'
      case '동의': return 'bg-green-100 text-green-800'
      case '미동의': return 'bg-red-100 text-red-800'
      case '보류': return 'bg-orange-100 text-orange-800'
      default: return ''
    }
  }

  const getResultColor = (result: string | null) => {
    switch (result) {
      case '동의': return 'bg-green-100 text-green-800'
      case '미동의': return 'bg-red-100 text-red-800'
      case '보류': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const renderCallbackResult = (result: string) => {
    const colors: Record<string, string> = {
      '통화완료': 'bg-blue-100 text-blue-800',
      '부재중': 'bg-gray-200 text-gray-700',
      '콜백재요청': 'bg-yellow-100 text-yellow-800',
      '예약확정': 'bg-green-100 text-green-800',
      '예약취소': 'bg-red-100 text-red-800',
      '치료동의': 'bg-green-100 text-green-800',
      '치료거부': 'bg-red-100 text-red-800',
      '보류': 'bg-orange-100 text-orange-800'
    }
    return colors[result] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="border-b p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-bold">{patient.name}</h2>
              <div className="text-sm text-gray-500">
                {patient.phone} | {patient.gender} {patient.age}세
              </div>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPhaseColor(patient.phase)}`}>
                {patient.phase}
              </span>
              {patient.currentStatus && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(patient.currentStatus)}`}>
                  {patient.currentStatus}
                </span>
              )}
              {patient.result && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getResultColor(patient.result)}`}>
                  결과: {patient.result}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="border-b px-4 flex-shrink-0">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-xs bg-blue-500 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 환자정보 탭 */}
          {activeTab === '환자정보' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-3">기본 정보</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex"><span className="text-gray-500 w-20">이름</span><span className="font-medium">{patient.name}</span></div>
                    <div className="flex"><span className="text-gray-500 w-20">연락처</span><span>{patient.phone}</span></div>
                    <div className="flex"><span className="text-gray-500 w-20">성별/나이</span><span>{patient.gender} / {patient.age}세</span></div>
                    <div className="flex"><span className="text-gray-500 w-20">주소</span><span>{patient.address || '-'}</span></div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-3">유입 정보</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex"><span className="text-gray-500 w-20">유입일</span><span>{patient.callInDate}</span></div>
                    <div className="flex"><span className="text-gray-500 w-20">유입경로</span><span>{patient.source || '-'}</span></div>
                    <div className="flex"><span className="text-gray-500 w-20">상담유형</span><span>{patient.consultationType || '-'}</span></div>
                    <div className="flex"><span className="text-gray-500 w-20">첫 내원일</span><span className="text-blue-600 font-medium">{patient.firstVisitDate || '-'}</span></div>
                  </div>
                </div>
              </div>

              {/* 상태 이력 */}
              {patient.statusHistory && patient.statusHistory.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-3">상태 변경 이력</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {patient.statusHistory.slice().reverse().map((history, idx) => (
                      <div key={idx} className="text-sm flex items-center gap-2">
                        <span className="text-gray-400 w-32">{history.date} {history.time}</span>
                        <span className="text-gray-600">{history.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 상담관리 탭 (내원 전 콜백) */}
          {activeTab === '상담관리' && (
            <div className="space-y-4">
              {/* 상담 정보 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-3">상담 정보</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">관심 서비스</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patient.consultation?.interestedServices?.length ? (
                        patient.consultation.interestedServices.map(service => (
                          <span key={service} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">{service}</span>
                        ))
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">치료 대상 치아</span>
                    <div className="mt-1">
                      {patient.consultation?.teethUnknown ? (
                        <span className="text-gray-400">미확인</span>
                      ) : patient.consultation?.selectedTeeth?.length ? (
                        <span className="text-purple-600">{patient.consultation.selectedTeeth.length}본 ({patient.consultation.selectedTeeth.join(', ')})</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">예상 금액</span>
                    <div className="mt-1 font-medium">{patient.consultation?.estimatedAmount?.toLocaleString() || 0}원</div>
                  </div>
                  <div>
                    <span className="text-gray-500">상담 메모</span>
                    <div className="mt-1">{patient.consultation?.consultationNotes || '-'}</div>
                  </div>
                </div>
              </div>

              {/* 예약 정보 */}
              {patient.reservation && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-medium text-blue-800 mb-2">예약 정보</h3>
                  <div className="text-sm text-blue-700">
                    {patient.reservation.date} {patient.reservation.time}
                  </div>
                </div>
              )}

              {/* 내원 전 콜백 기록 */}
              <div>
                <h3 className="font-medium mb-3">내원 전 콜백 기록 ({patient.preVisitCallbacks?.length || 0}회)</h3>
                {patient.preVisitCallbacks && patient.preVisitCallbacks.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {[...patient.preVisitCallbacks].reverse().map((cb, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-blue-600">{cb.attempt}차</span>
                          <span className="text-gray-500">{cb.date} {cb.time}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${renderCallbackResult(cb.result)}`}>
                            {cb.result}
                          </span>
                          {cb.counselorName && <span className="text-gray-400">({cb.counselorName})</span>}
                        </div>
                        {cb.notes && <div className="text-gray-600 mt-1">{cb.notes}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-4">콜백 기록이 없습니다</div>
                )}
              </div>
            </div>
          )}

          {/* 내원관리 탭 (사후 콜백) */}
          {activeTab === '내원관리' && (
            <div className="space-y-4">
              {/* 치아 확정 섹션 - 미확인인 경우 눈에 띄게 표시 */}
              {/* teethUnknown이 true이거나, 치아가 선택되지 않은 경우 모두 미확인으로 처리 */}
              {(patient.consultation?.teethUnknown || (!patient.consultation?.selectedTeeth?.length)) ? (
                <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-400">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🦷</span>
                    <h3 className="font-medium text-amber-800">치아 번호 확정 필요</h3>
                    <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">미확인</span>
                  </div>
                  <p className="text-sm text-amber-700 mb-3">
                    전화상담 시 치아 번호가 확인되지 않았습니다. 내원 상담 후 치아 번호를 확정해주세요.
                  </p>

                  {showTeethForm ? (
                    <div className="space-y-3">
                      <ToothSelector
                        selectedTeeth={tempSelectedTeeth}
                        onChange={setTempSelectedTeeth}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setShowTeethForm(false)}
                          className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleConfirmTeeth}
                          disabled={isSavingTeeth || tempSelectedTeeth.length === 0}
                          className="px-4 py-2 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                        >
                          {isSavingTeeth ? '저장중...' : `치아 ${tempSelectedTeeth.length}개 확정`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={openTeethForm}
                      className="w-full py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                    >
                      치아 번호 확정하기
                    </button>
                  )}
                </div>
              ) : patient.consultation?.selectedTeeth && patient.consultation.selectedTeeth.length > 0 ? (
                /* 이미 확정된 경우 - 간단히 표시 */
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">확정된 치아:</span>
                      <div className="flex flex-wrap gap-1">
                        {[...patient.consultation.selectedTeeth].sort((a, b) => a - b).map(num => (
                          <span key={num} className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-xs rounded font-medium">
                            #{num}
                          </span>
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">({patient.consultation.selectedTeeth.length}개)</span>
                    </div>
                    <button
                      onClick={openTeethForm}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      수정
                    </button>
                  </div>

                  {/* 치아 수정 폼 */}
                  {showTeethForm && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <ToothSelector
                        selectedTeeth={tempSelectedTeeth}
                        onChange={setTempSelectedTeeth}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setShowTeethForm(false)}
                          className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleConfirmTeeth}
                          disabled={isSavingTeeth}
                          className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                          {isSavingTeeth ? '저장중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* 내원 상담 결과 */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-blue-800">내원 상담 결과</h3>
                  {!showConsultationForm && (
                    <button
                      onClick={openConsultationForm}
                      className={`px-3 py-1 text-sm rounded ${
                        patient.postVisitConsultation
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {patient.postVisitConsultation ? '수정' : '+ 상담기록 등록'}
                    </button>
                  )}
                </div>

                {/* 상담기록 입력 폼 */}
                {showConsultationForm ? (
                  <div className="space-y-3">
                    {/* 금액 입력 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-blue-600 mb-1">정가 (원)</label>
                        <input
                          type="number"
                          value={consultationForm.regularPrice || ''}
                          onChange={(e) => handleRegularPriceChange(Number(e.target.value))}
                          placeholder="예: 3000000"
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-600 mb-1">할인가 (원)</label>
                        <input
                          type="number"
                          value={consultationForm.discountPrice || ''}
                          onChange={(e) => setConsultationForm({ ...consultationForm, discountPrice: Number(e.target.value) })}
                          placeholder="예: 2500000"
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    {/* 할인율 자동 계산 표시 */}
                    {consultationForm.regularPrice > 0 && consultationForm.discountPrice > 0 && consultationForm.regularPrice !== consultationForm.discountPrice && (
                      <div className="text-xs text-green-600">
                        할인율: {Math.round((1 - consultationForm.discountPrice / consultationForm.regularPrice) * 100)}%
                        ({(consultationForm.regularPrice - consultationForm.discountPrice).toLocaleString()}원 할인)
                      </div>
                    )}

                    {/* 할인 사유 */}
                    <div>
                      <label className="block text-xs text-blue-600 mb-1">할인 사유</label>
                      <input
                        type="text"
                        value={consultationForm.discountReason}
                        onChange={(e) => setConsultationForm({ ...consultationForm, discountReason: e.target.value })}
                        placeholder="예: 첫 방문 할인, 다본 할인 등"
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                    </div>

                    {/* 담당 의사 */}
                    <div>
                      <label className="block text-xs text-blue-600 mb-1">담당 의사</label>
                      <input
                        type="text"
                        value={consultationForm.doctorName}
                        onChange={(e) => setConsultationForm({ ...consultationForm, doctorName: e.target.value })}
                        placeholder="예: 김원장"
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                    </div>

                    {/* 진단 내용 */}
                    <div>
                      <label className="block text-xs text-blue-600 mb-1">진단 내용 / 상담 메모</label>
                      <textarea
                        value={consultationForm.diagnosisNotes}
                        onChange={(e) => setConsultationForm({ ...consultationForm, diagnosisNotes: e.target.value })}
                        placeholder="진단 결과 및 상담 내용을 입력하세요..."
                        className="w-full border rounded px-3 py-2 text-sm"
                        rows={2}
                      />
                    </div>

                    {/* 권장 치료 */}
                    <div>
                      <label className="block text-xs text-blue-600 mb-1">권장 치료</label>
                      <input
                        type="text"
                        value={consultationForm.treatmentRecommendation}
                        onChange={(e) => setConsultationForm({ ...consultationForm, treatmentRecommendation: e.target.value })}
                        placeholder="예: 임플란트 2본, 크라운 1개"
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                    </div>

                    {/* 저장/취소 버튼 */}
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        onClick={() => setShowConsultationForm(false)}
                        className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSaveConsultation}
                        disabled={isSavingConsultation || !consultationForm.regularPrice}
                        className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                      >
                        {isSavingConsultation ? '저장중...' : '저장'}
                      </button>
                    </div>
                  </div>
                ) : patient.postVisitConsultation ? (
                  /* 기존 상담 정보 표시 */
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-blue-600">정가</span>
                        <div className="font-medium text-lg">{patient.postVisitConsultation.estimateInfo?.regularPrice?.toLocaleString() || 0}원</div>
                      </div>
                      <div>
                        <span className="text-blue-600">할인가</span>
                        <div className="font-medium text-lg text-green-600">{patient.postVisitConsultation.estimateInfo?.discountPrice?.toLocaleString() || 0}원</div>
                        {patient.postVisitConsultation.estimateInfo?.discountRate > 0 && (
                          <span className="text-xs text-gray-500">({patient.postVisitConsultation.estimateInfo.discountRate}% 할인)</span>
                        )}
                      </div>
                    </div>
                    {patient.postVisitConsultation.estimateInfo?.discountReason && (
                      <div>
                        <span className="text-blue-600">할인 사유</span>
                        <div className="mt-1">{patient.postVisitConsultation.estimateInfo.discountReason}</div>
                      </div>
                    )}
                    {patient.postVisitConsultation.doctorName && (
                      <div>
                        <span className="text-blue-600">담당 의사</span>
                        <div className="mt-1">{patient.postVisitConsultation.doctorName}</div>
                      </div>
                    )}
                    {patient.postVisitConsultation.diagnosisNotes && (
                      <div>
                        <span className="text-blue-600">진단 내용</span>
                        <div className="mt-1">{patient.postVisitConsultation.diagnosisNotes}</div>
                      </div>
                    )}
                    {patient.postVisitConsultation.treatmentRecommendation && (
                      <div>
                        <span className="text-blue-600">권장 치료</span>
                        <div className="mt-1">{patient.postVisitConsultation.treatmentRecommendation}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 상담 정보 없을 때 */
                  <div className="text-center py-6">
                    <div className="text-gray-400 mb-2">아직 내원 상담 기록이 없습니다</div>
                    <div className="text-sm text-gray-500">상단의 &apos;상담기록 등록&apos; 버튼을 눌러 등록하세요</div>
                  </div>
                )}
              </div>

              {/* 내원 후 상태 관리 (5단계) */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-800 mb-3">내원 후 상태</h3>

                {/* 콜백 필요 경고 - 콜백 예정일이 과거/오늘인 경우 */}
                {(() => {
                  const callbackDate = patient.postVisitStatusInfo?.nextCallbackDate
                  if (!callbackDate) return null
                  const today = new Date().toISOString().split('T')[0]
                  const isCallbackDue = callbackDate <= today

                  if (!isCallbackDue) return null

                  return (
                    <div className="mb-3 p-3 bg-red-100 border-2 border-red-400 rounded-lg">
                      <div className="flex items-center gap-2 text-red-800 font-medium">
                        <span className="text-xl">⚠️</span>
                        <span>콜백이 필요합니다!</span>
                      </div>
                      <p className="text-sm text-red-700 mt-1">
                        콜백 예정일: <strong>{callbackDate}</strong>
                        {callbackDate < today ? ' (지연됨)' : ' (오늘)'}
                      </p>
                      <p className="text-xs text-red-600 mt-2">
                        📞 상단의 &quot;콜백 기록&quot;에서 통화 결과를 기록해야 상태를 변경할 수 있습니다.
                      </p>
                    </div>
                  )
                })()}

                {/* 현재 상태 표시 */}
                {patient.postVisitStatusInfo && !selectedPostVisitStatus && (
                  <div className={`mb-3 p-3 rounded-lg border ${
                    patient.postVisitStatusInfo.status === '치료진행' ? 'bg-green-50 border-green-300' :
                    patient.postVisitStatusInfo.status === '치료예정' ? 'bg-blue-50 border-blue-300' :
                    patient.postVisitStatusInfo.status === '결정대기' ? 'bg-yellow-50 border-yellow-300' :
                    patient.postVisitStatusInfo.status === '장기보류' ? 'bg-orange-50 border-orange-300' :
                    'bg-red-50 border-red-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          patient.postVisitStatusInfo.status === '치료진행' ? 'bg-green-500 text-white' :
                          patient.postVisitStatusInfo.status === '치료예정' ? 'bg-blue-500 text-white' :
                          patient.postVisitStatusInfo.status === '결정대기' ? 'bg-yellow-500 text-white' :
                          patient.postVisitStatusInfo.status === '장기보류' ? 'bg-orange-500 text-white' :
                          'bg-red-500 text-white'
                        }`}>
                          {patient.postVisitStatusInfo.status === '치료진행' && '✅ '}
                          {patient.postVisitStatusInfo.status === '치료예정' && '📅 '}
                          {patient.postVisitStatusInfo.status === '결정대기' && '⏳ '}
                          {patient.postVisitStatusInfo.status === '장기보류' && '⚠️ '}
                          {patient.postVisitStatusInfo.status === '종결' && '❌ '}
                          {patient.postVisitStatusInfo.status}
                        </span>
                        {patient.postVisitStatusInfo.status === '장기보류' && getDaysSinceAgreed() > 0 && (
                          <span className="text-sm text-orange-700">동의 후 {getDaysSinceAgreed()}일 경과</span>
                        )}
                      </div>
                      {(() => {
                        const callbackDate = patient.postVisitStatusInfo?.nextCallbackDate
                        const today = new Date().toISOString().split('T')[0]
                        const isCallbackDue = callbackDate && callbackDate <= today

                        if (isCallbackDue) {
                          return (
                            <span className="text-xs text-gray-400" title="콜백 기록 후 변경 가능">
                              🔒 잠금
                            </span>
                          )
                        }
                        return (
                          <button
                            onClick={() => handleSelectPostVisitStatus(patient.postVisitStatusInfo!.status)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            변경
                          </button>
                        )
                      })()}
                    </div>

                    {/* 상태별 상세 정보 표시 */}
                    <div className="mt-2 text-sm space-y-1">
                      {(patient.postVisitStatusInfo.status === '치료진행' || patient.postVisitStatusInfo.status === '치료예정') && (
                        <>
                          {patient.postVisitStatusInfo.treatmentStartDate && (
                            <div><span className="text-gray-500">{patient.postVisitStatusInfo.status === '치료진행' ? '치료 시작일' : '치료 예정일'}:</span> {patient.postVisitStatusInfo.treatmentStartDate}</div>
                          )}
                          {patient.postVisitStatusInfo.nextVisitDate && (
                            <div><span className="text-gray-500">다음 내원일:</span> {patient.postVisitStatusInfo.nextVisitDate}</div>
                          )}
                          {patient.postVisitStatusInfo.status === '치료예정' && (
                            <div><span className="text-gray-500">계약금:</span> {patient.postVisitStatusInfo.depositPaid ? '수납완료' : '미수납'}</div>
                          )}
                        </>
                      )}
                      {(patient.postVisitStatusInfo.status === '결정대기' || patient.postVisitStatusInfo.status === '장기보류' || patient.postVisitStatusInfo.status === '종결') && (
                        <>
                          {patient.postVisitStatusInfo.reason && (
                            <div><span className="text-gray-500">사유:</span> {patient.postVisitStatusInfo.reason}{patient.postVisitStatusInfo.reasonDetail && ` - ${patient.postVisitStatusInfo.reasonDetail}`}</div>
                          )}
                          {patient.postVisitStatusInfo.nextCallbackDate && (
                            <div><span className="text-gray-500">다음 콜백일:</span> {patient.postVisitStatusInfo.nextCallbackDate}</div>
                          )}
                          {patient.postVisitStatusInfo.status === '장기보류' && patient.postVisitStatusInfo.needsSpecialOffer && (
                            <div className="text-orange-600 font-medium">💰 추가 할인 제안 필요</div>
                          )}
                          {patient.postVisitStatusInfo.status === '종결' && (
                            <div><span className="text-gray-500">재연락 가능:</span> {patient.postVisitStatusInfo.canRecontact ? '있음' : '없음'}</div>
                          )}
                        </>
                      )}
                      {patient.postVisitStatusInfo.callbackNotes && (
                        <div className="mt-1 pt-1 border-t text-gray-600">{patient.postVisitStatusInfo.callbackNotes}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 상태 선택 버튼 */}
                {(!patient.postVisitStatusInfo || selectedPostVisitStatus) && (
                  <div className="grid grid-cols-5 gap-1 mb-3">
                    {(['치료진행', '치료예정', '결정대기', '장기보류', '종결'] as PostVisitStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleSelectPostVisitStatus(status)}
                        className={`px-2 py-2 text-xs rounded font-medium transition-colors ${
                          selectedPostVisitStatus === status
                            ? status === '치료진행' ? 'bg-green-500 text-white' :
                              status === '치료예정' ? 'bg-blue-500 text-white' :
                              status === '결정대기' ? 'bg-yellow-500 text-white' :
                              status === '장기보류' ? 'bg-orange-500 text-white' :
                              'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}

                {/* 상태별 입력 폼 */}
                {selectedPostVisitStatus && (
                  <div className="space-y-3 p-3 bg-white rounded border">
                    {/* 치료진행 폼 */}
                    {selectedPostVisitStatus === '치료진행' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">치료 시작일 *</label>
                          <input
                            type="date"
                            value={postVisitStatusForm.treatmentStartDate}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, treatmentStartDate: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">다음 내원 예약일</label>
                          <input
                            type="date"
                            value={postVisitStatusForm.nextVisitDate}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, nextVisitDate: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">진행 메모</label>
                          <textarea
                            value={postVisitStatusForm.treatmentNotes}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, treatmentNotes: e.target.value })}
                            placeholder="치료 진행 상황..."
                            className="w-full border rounded px-3 py-2 text-sm"
                            rows={2}
                          />
                        </div>
                      </>
                    )}

                    {/* 치료예정 폼 */}
                    {selectedPostVisitStatus === '치료예정' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">치료 시작 예정일 *</label>
                          <input
                            type="date"
                            value={postVisitStatusForm.treatmentStartDate}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, treatmentStartDate: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">계약금 수납</label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1 text-sm">
                              <input
                                type="radio"
                                checked={postVisitStatusForm.depositPaid}
                                onChange={() => setPostVisitStatusForm({ ...postVisitStatusForm, depositPaid: true })}
                              />
                              수납완료
                            </label>
                            <label className="flex items-center gap-1 text-sm">
                              <input
                                type="radio"
                                checked={!postVisitStatusForm.depositPaid}
                                onChange={() => setPostVisitStatusForm({ ...postVisitStatusForm, depositPaid: false })}
                              />
                              미수납
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">준비 사항 메모</label>
                          <textarea
                            value={postVisitStatusForm.treatmentNotes}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, treatmentNotes: e.target.value })}
                            placeholder="CT 촬영 필요, 금식 안내 등..."
                            className="w-full border rounded px-3 py-2 text-sm"
                            rows={2}
                          />
                        </div>
                      </>
                    )}

                    {/* 결정대기 폼 */}
                    {selectedPostVisitStatus === '결정대기' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">보류 사유 *</label>
                          <select
                            value={postVisitStatusForm.reason}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, reason: e.target.value as ResultReason })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          >
                            <option value="">선택...</option>
                            {POST_VISIT_REASONS.결정대기.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        {postVisitStatusForm.reason === '기타' && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">상세 사유</label>
                            <input
                              type="text"
                              value={postVisitStatusForm.reasonDetail}
                              onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, reasonDetail: e.target.value })}
                              className="w-full border rounded px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">다음 콜백일 *</label>
                          <input
                            type="date"
                            value={postVisitStatusForm.nextCallbackDate}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, nextCallbackDate: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">예상 결정 시기</label>
                          <select
                            value={postVisitStatusForm.expectedDecisionDate}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, expectedDecisionDate: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          >
                            <option value="">선택...</option>
                            <option value="1주일내">1주일 내</option>
                            <option value="2주일내">2주일 내</option>
                            <option value="1개월내">1개월 내</option>
                            <option value="미정">미정</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">콜백 메모</label>
                          <textarea
                            value={postVisitStatusForm.callbackNotes}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, callbackNotes: e.target.value })}
                            placeholder="남편과 상의 후 연락주신다함..."
                            className="w-full border rounded px-3 py-2 text-sm"
                            rows={2}
                          />
                        </div>
                      </>
                    )}

                    {/* 장기보류 폼 */}
                    {selectedPostVisitStatus === '장기보류' && (
                      <>
                        <div className="p-2 bg-orange-100 rounded text-sm text-orange-800">
                          ⚠️ 동의는 했지만 치료를 미루는 환자입니다. 특별 관리가 필요합니다.
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">지연 사유 *</label>
                          <select
                            value={postVisitStatusForm.reason}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, reason: e.target.value as ResultReason })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          >
                            <option value="">선택...</option>
                            {POST_VISIT_REASONS.장기보류.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        {postVisitStatusForm.reason === '기타' && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">상세 사유</label>
                            <input
                              type="text"
                              value={postVisitStatusForm.reasonDetail}
                              onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, reasonDetail: e.target.value })}
                              className="w-full border rounded px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">예상 시작 시기</label>
                          <select
                            value={postVisitStatusForm.expectedStartDate}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, expectedStartDate: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          >
                            <option value="">선택...</option>
                            <option value="1개월내">1개월 내</option>
                            <option value="3개월내">3개월 내</option>
                            <option value="6개월내">6개월 내</option>
                            <option value="미정">미정</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">다음 콜백일</label>
                          <input
                            type="date"
                            value={postVisitStatusForm.nextCallbackDate}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, nextCallbackDate: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={postVisitStatusForm.needsSpecialOffer}
                              onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, needsSpecialOffer: e.target.checked })}
                            />
                            추가 할인 제안 필요
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">메모</label>
                          <textarea
                            value={postVisitStatusForm.callbackNotes}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, callbackNotes: e.target.value })}
                            placeholder="계속 일정 잡자고 하면 끊으심..."
                            className="w-full border rounded px-3 py-2 text-sm"
                            rows={2}
                          />
                        </div>
                      </>
                    )}

                    {/* 종결 폼 */}
                    {selectedPostVisitStatus === '종결' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">종결 사유 *</label>
                          <select
                            value={postVisitStatusForm.reason}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, reason: e.target.value as ResultReason })}
                            className="w-full border rounded px-3 py-2 text-sm"
                          >
                            <option value="">선택...</option>
                            {POST_VISIT_REASONS.종결.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        {postVisitStatusForm.reason === '기타' && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">상세 사유</label>
                            <input
                              type="text"
                              value={postVisitStatusForm.reasonDetail}
                              onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, reasonDetail: e.target.value })}
                              className="w-full border rounded px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">재연락 가능성</label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1 text-sm">
                              <input
                                type="radio"
                                checked={postVisitStatusForm.canRecontact}
                                onChange={() => setPostVisitStatusForm({ ...postVisitStatusForm, canRecontact: true })}
                              />
                              있음
                            </label>
                            <label className="flex items-center gap-1 text-sm">
                              <input
                                type="radio"
                                checked={!postVisitStatusForm.canRecontact}
                                onChange={() => setPostVisitStatusForm({ ...postVisitStatusForm, canRecontact: false })}
                              />
                              없음
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">메모</label>
                          <textarea
                            value={postVisitStatusForm.callbackNotes}
                            onChange={(e) => setPostVisitStatusForm({ ...postVisitStatusForm, callbackNotes: e.target.value })}
                            placeholder="가격이 너무 비싸다고 함..."
                            className="w-full border rounded px-3 py-2 text-sm"
                            rows={2}
                          />
                        </div>
                      </>
                    )}

                    {/* 저장/취소 버튼 */}
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        onClick={() => setSelectedPostVisitStatus(null)}
                        className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSavePostVisitStatus}
                        disabled={isSavingPostVisitStatus || (
                          (selectedPostVisitStatus === '치료진행' || selectedPostVisitStatus === '치료예정') && !postVisitStatusForm.treatmentStartDate
                        ) || (
                          (selectedPostVisitStatus === '결정대기') && (!postVisitStatusForm.reason || !postVisitStatusForm.nextCallbackDate)
                        ) || (
                          (selectedPostVisitStatus === '장기보류' || selectedPostVisitStatus === '종결') && !postVisitStatusForm.reason
                        )}
                        className={`px-4 py-2 text-sm text-white rounded disabled:opacity-50 ${
                          selectedPostVisitStatus === '치료진행' ? 'bg-green-500 hover:bg-green-600' :
                          selectedPostVisitStatus === '치료예정' ? 'bg-blue-500 hover:bg-blue-600' :
                          selectedPostVisitStatus === '결정대기' ? 'bg-yellow-500 hover:bg-yellow-600' :
                          selectedPostVisitStatus === '장기보류' ? 'bg-orange-500 hover:bg-orange-600' :
                          'bg-red-500 hover:bg-red-600'
                        }`}
                      >
                        {isSavingPostVisitStatus ? '저장중...' : '저장'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 사후 콜백 등록 폼 */}
              <div className="flex items-center justify-between">
                <h3 className="font-medium">사후 콜백 기록 ({patient.postVisitCallbacks?.length || 0}회)</h3>
                <button
                  onClick={() => setShowCallbackForm(true)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  + 콜백 등록
                </button>
              </div>

              {showCallbackForm && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-200">
                  <div className="font-medium text-blue-800 text-sm">콜백 결과 기록</div>

                  {/* 통화 결과 */}
                  <div>
                    <label className="block text-xs text-blue-600 mb-1">통화 결과</label>
                    <select
                      value={callbackForm.result}
                      onChange={(e) => {
                        const result = e.target.value
                        let statusAction = callbackForm.statusAction
                        // 결과에 따라 상태 액션 자동 추천
                        if (result === '치료동의') statusAction = '치료예정'
                        else if (result === '치료거부') statusAction = '종결'
                        else if (result === '보류' || result === '콜백재요청') statusAction = '결정대기'
                        else if (result === '부재중') statusAction = '결정대기'
                        else statusAction = ''
                        setCallbackForm({ ...callbackForm, result, statusAction })
                      }}
                      className="w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="통화완료">통화완료 (상담만)</option>
                      <option value="치료동의">✅ 치료동의</option>
                      <option value="보류">⏸️ 보류 (결정 미룸)</option>
                      <option value="콜백재요청">📞 콜백재요청</option>
                      <option value="부재중">📵 부재중</option>
                      <option value="치료거부">❌ 치료거부</option>
                    </select>
                  </div>

                  {/* 상태 변경 (결과에 따라 표시) */}
                  {callbackForm.result !== '통화완료' && (
                    <div className="p-3 bg-white rounded border space-y-3">
                      <div className="text-xs font-medium text-gray-700">
                        📋 상태 변경 (필수)
                      </div>

                      {/* 치료동의 → 치료진행/치료예정 */}
                      {callbackForm.result === '치료동의' && (
                        <>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setCallbackForm({ ...callbackForm, statusAction: '치료진행' })}
                              className={`flex-1 py-2 text-sm rounded border ${
                                callbackForm.statusAction === '치료진행'
                                  ? 'bg-green-500 text-white border-green-500'
                                  : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              치료진행 (시작됨)
                            </button>
                            <button
                              type="button"
                              onClick={() => setCallbackForm({ ...callbackForm, statusAction: '치료예정' })}
                              className={`flex-1 py-2 text-sm rounded border ${
                                callbackForm.statusAction === '치료예정'
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              치료예정 (날짜 확정)
                            </button>
                          </div>
                          {(callbackForm.statusAction === '치료진행' || callbackForm.statusAction === '치료예정') && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">
                                  {callbackForm.statusAction === '치료진행' ? '치료 시작일' : '치료 예정일'}
                                </label>
                                <input
                                  type="date"
                                  value={callbackForm.treatmentStartDate}
                                  onChange={(e) => setCallbackForm({ ...callbackForm, treatmentStartDate: e.target.value })}
                                  className="w-full border rounded px-2 py-1 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">다음 내원 예약</label>
                                <input
                                  type="date"
                                  value={callbackForm.nextVisitDate}
                                  onChange={(e) => setCallbackForm({ ...callbackForm, nextVisitDate: e.target.value })}
                                  className="w-full border rounded px-2 py-1 text-sm"
                                />
                              </div>
                              {callbackForm.statusAction === '치료예정' && (
                                <div className="col-span-2">
                                  <label className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={callbackForm.depositPaid}
                                      onChange={(e) => setCallbackForm({ ...callbackForm, depositPaid: e.target.checked })}
                                    />
                                    계약금 수납 완료
                                  </label>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* 보류/콜백재요청/부재중 → 결정대기/장기보류 */}
                      {(callbackForm.result === '보류' || callbackForm.result === '콜백재요청' || callbackForm.result === '부재중') && (
                        <>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setCallbackForm({ ...callbackForm, statusAction: '결정대기' })}
                              className={`flex-1 py-2 text-sm rounded border ${
                                callbackForm.statusAction === '결정대기'
                                  ? 'bg-yellow-500 text-white border-yellow-500'
                                  : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              결정대기
                            </button>
                            <button
                              type="button"
                              onClick={() => setCallbackForm({ ...callbackForm, statusAction: '장기보류' })}
                              className={`flex-1 py-2 text-sm rounded border ${
                                callbackForm.statusAction === '장기보류'
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              장기보류 (계속 미룸)
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">보류 사유</label>
                            <select
                              value={callbackForm.reason}
                              onChange={(e) => setCallbackForm({ ...callbackForm, reason: e.target.value as ResultReason })}
                              className="w-full border rounded px-2 py-1 text-sm"
                            >
                              <option value="">선택...</option>
                              {(callbackForm.statusAction === '장기보류'
                                ? POST_VISIT_REASONS.장기보류
                                : POST_VISIT_REASONS.결정대기
                              ).map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">다음 콜백일 (필수 - 내일 이후)</label>
                            <input
                              type="date"
                              value={callbackForm.nextCallbackDate}
                              onChange={(e) => setCallbackForm({ ...callbackForm, nextCallbackDate: e.target.value })}
                              className="w-full border rounded px-2 py-1 text-sm"
                              min={(() => {
                                const tomorrow = new Date()
                                tomorrow.setDate(tomorrow.getDate() + 1)
                                return tomorrow.toISOString().split('T')[0]
                              })()}
                            />
                          </div>
                        </>
                      )}

                      {/* 치료거부 → 종결 */}
                      {callbackForm.result === '치료거부' && (
                        <>
                          <div className="text-sm text-red-600 font-medium">→ 종결 처리됩니다</div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">종결 사유</label>
                            <select
                              value={callbackForm.reason}
                              onChange={(e) => setCallbackForm({ ...callbackForm, reason: e.target.value as ResultReason })}
                              className="w-full border rounded px-2 py-1 text-sm"
                            >
                              <option value="">선택...</option>
                              {POST_VISIT_REASONS.종결.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                          {callbackForm.reason === '기타' && (
                            <input
                              type="text"
                              value={callbackForm.reasonDetail}
                              onChange={(e) => setCallbackForm({ ...callbackForm, reasonDetail: e.target.value })}
                              placeholder="상세 사유 입력..."
                              className="w-full border rounded px-2 py-1 text-sm"
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* 메모 */}
                  <div>
                    <label className="block text-xs text-blue-600 mb-1">상담 메모</label>
                    <textarea
                      value={callbackForm.notes}
                      onChange={(e) => setCallbackForm({ ...callbackForm, notes: e.target.value })}
                      placeholder="상담 내용..."
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>

                  {/* 저장 버튼 */}
                  <div className="flex gap-2 justify-end pt-2 border-t">
                    <button
                      onClick={() => {
                        setShowCallbackForm(false)
                        setCallbackForm({
                          result: '통화완료', notes: '', statusAction: '',
                          nextCallbackDate: '', treatmentStartDate: '', nextVisitDate: '',
                          depositPaid: false, reason: '', reasonDetail: ''
                        })
                      }}
                      className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleAddCallback}
                      disabled={isSubmitting || (
                        callbackForm.result !== '통화완료' && !callbackForm.statusAction
                      ) || (
                        (callbackForm.statusAction === '결정대기' || callbackForm.statusAction === '장기보류') &&
                        (!callbackForm.nextCallbackDate || callbackForm.nextCallbackDate <= new Date().toISOString().split('T')[0])
                      )}
                      className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isSubmitting ? '저장중...' : '콜백 기록 저장'}
                    </button>
                  </div>
                </div>
              )}

              {/* 사후 콜백 기록 */}
              {patient.postVisitCallbacks && patient.postVisitCallbacks.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {[...patient.postVisitCallbacks].reverse().map((cb, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-600">{cb.attempt}차</span>
                        <span className="text-gray-500">{cb.date} {cb.time}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${renderCallbackResult(cb.result)}`}>
                          {cb.result}
                        </span>
                        {cb.counselorName && <span className="text-gray-400">({cb.counselorName})</span>}
                      </div>
                      {cb.notes && <div className="text-gray-600 mt-1">{cb.notes}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 text-center py-4">콜백 기록이 없습니다</div>
              )}
            </div>
          )}

          {/* 사후관리 탭 */}
          {activeTab === '사후관리' && (
            <div className="space-y-4">
              <div className="p-8 bg-gray-50 rounded-lg text-center">
                <div className="text-gray-400 mb-2">사후관리 기능</div>
                <div className="text-sm text-gray-500">
                  치료 후 관리, 리콜 예약 등의 기능이 추가될 예정입니다.
                </div>
              </div>

              {/* 현재 상태 요약 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-3">현재 상태</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">단계</span>
                    <div className="mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${getPhaseColor(patient.phase)}`}>{patient.phase}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">결과</span>
                    <div className="mt-1">
                      {patient.result ? (
                        <span className={`px-2 py-0.5 rounded text-xs ${getResultColor(patient.result)}`}>{patient.result}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">첫 내원일</span>
                    <div className="mt-1 font-medium">{patient.firstVisitDate || '-'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">상담 금액</span>
                    <div className="mt-1 font-medium text-green-600">
                      {patient.postVisitConsultation?.estimateInfo?.discountPrice?.toLocaleString() || 0}원
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 소개관리 탭 */}
          {activeTab === '소개관리' && (
            <div className="space-y-4">
              <div className="p-8 bg-gray-50 rounded-lg text-center">
                <div className="text-gray-400 mb-2">소개 환자 관리</div>
                <div className="text-sm text-gray-500">
                  이 환자가 소개한 환자 또는 이 환자를 소개한 환자 정보를 관리합니다.
                </div>
              </div>

              {/* 플레이스홀더 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-3">소개 현황</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 bg-white rounded border">
                    <div className="text-2xl font-bold text-blue-600">0</div>
                    <div className="text-sm text-gray-500">소개한 환자</div>
                  </div>
                  <div className="p-4 bg-white rounded border">
                    <div className="text-2xl font-bold text-green-600">-</div>
                    <div className="text-sm text-gray-500">소개받은 환자</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VisitV2TablePage() {
  const [patients, setPatients] = useState<PatientV2[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientV2 | null>(null)
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
  const [resultFilter, setResultFilter] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchPatients = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'visit',
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

  // 콜백 등록
  const handleAddCallback = async (patientId: string, callback: Omit<CallbackRecord, 'attempt' | 'createdAt'>, type: 'preVisit' | 'postVisit') => {
    const res = await fetch(`/api/test/patients-v2/${patientId}/callback`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...callback })
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

  // 상담 정보 저장
  const handleSaveConsultation = async (patientId: string, consultationData: any) => {
    const res = await fetch(`/api/test/patients-v2/${patientId}/consultation`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consultationData)
    })
    const data = await res.json()
    if (data.success) {
      setPatients(patients.map(p => p._id === patientId ? data.data : p))
      setSelectedPatient(data.data)
    }
  }

  // 치아 확정
  const handleConfirmTeeth = async (patientId: string, selectedTeeth: number[]) => {
    const res = await fetch(`/api/test/patients-v2/${patientId}/teeth`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedTeeth, teethUnknown: false })
    })
    const data = await res.json()
    if (data.success) {
      setPatients(patients.map(p => p._id === patientId ? data.data : p))
      setSelectedPatient(data.data)
    }
  }

  // 내원 후 상태 업데이트
  const handleUpdatePostVisitStatus = async (patientId: string, statusData: any) => {
    const res = await fetch(`/api/test/patients-v2/${patientId}/post-visit-status`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusData)
    })
    const data = await res.json()
    if (data.success) {
      setPatients(patients.map(p => p._id === patientId ? data.data : p))
      setSelectedPatient(data.data)
    }
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case '내원완료': return 'bg-blue-100 text-blue-800'
      case '종결': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case '재콜백필요': return 'bg-yellow-100 text-yellow-800'
      case '부재중': return 'bg-gray-200 text-gray-700'
      case '동의': return 'bg-green-100 text-green-800'
      case '미동의': return 'bg-red-100 text-red-800'
      case '보류': return 'bg-orange-100 text-orange-800'
      default: return ''
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

  const getRowColor = (patient: PatientV2) => {
    // 콜백 지연인 경우 최우선 강조
    const callbackDate = patient.postVisitStatusInfo?.nextCallbackDate
    if (callbackDate) {
      const today = new Date().toISOString().split('T')[0]
      if (callbackDate < today) return 'bg-red-100' // 지연 - 빨간색
      if (callbackDate === today) return 'bg-amber-100' // 오늘 - 노란색
    }
    if (patient.result === '동의') return 'bg-green-50'
    if (patient.result === '미동의') return 'bg-red-50'
    if (patient.result === '보류') return 'bg-orange-50'
    if (patient.currentStatus === '재콜백필요') return 'bg-yellow-50'
    return ''
  }

  // 콜백 날짜 상태 확인
  const getCallbackStatus = (callbackDate: string | undefined) => {
    if (!callbackDate) return null
    const today = new Date().toISOString().split('T')[0]
    if (callbackDate < today) return 'overdue'
    if (callbackDate === today) return 'today'
    return 'future'
  }

  // 콜백 날짜 포맷 (MM-DD)
  const formatCallbackDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
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
              <h1 className="text-xl font-bold text-gray-900">내원관리 v2 (테이블 버전)</h1>
              <p className="text-sm text-gray-500">테이블 + 탭 모달 UI</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSeedData} className="px-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600">
                테스트 데이터 생성
              </button>
              <a href="/test/visit-v2" className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                패널 버전 →
              </a>
              <a href="/test/consultation-v2-table" className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                상담관리 →
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
                <button onClick={() => setSearch(searchInput)} className="px-4 py-2 bg-blue-500 text-white rounded-r hover:bg-blue-600 text-sm">
                  검색
                </button>
              </div>
            </div>
            <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
              <option value="">전체 단계</option>
              <option value="내원완료">내원완료</option>
              <option value="종결">종결</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
              <option value="">전체 상태</option>
              <option value="재콜백필요">재콜백필요</option>
              <option value="부재중">부재중</option>
              <option value="동의">동의</option>
              <option value="미동의">미동의</option>
              <option value="보류">보류</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border rounded px-3 py-2 text-sm">
              <option value="updatedAt">최근 수정순</option>
              <option value="firstVisitDate">내원일순</option>
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

        {/* 콜백 현황 요약 */}
        {(() => {
          const today = new Date().toISOString().split('T')[0]
          const overdueCount = patients.filter(p =>
            p.postVisitStatusInfo?.nextCallbackDate && p.postVisitStatusInfo.nextCallbackDate < today
          ).length
          const todayCount = patients.filter(p =>
            p.postVisitStatusInfo?.nextCallbackDate === today
          ).length

          if (overdueCount === 0 && todayCount === 0) return null

          return (
            <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center gap-6">
              <div className="font-medium text-gray-700">콜백 현황</div>
              {overdueCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded-lg border border-red-300">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <div className="text-red-800 font-bold">{overdueCount}건 지연</div>
                    <div className="text-red-600 text-xs">즉시 연락 필요!</div>
                  </div>
                </div>
              )}
              {todayCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-lg border border-amber-300">
                  <span className="text-xl">📞</span>
                  <div>
                    <div className="text-amber-800 font-bold">{todayCount}건 오늘 예정</div>
                    <div className="text-amber-600 text-xs">오늘 콜백 하세요</div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px]">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">연락처</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">나이/성별</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">내원일</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">유입경로</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">관심분야</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">치아</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">내원후상태</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">콜백예정</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">사후콜백</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">상담금액</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
                ) : patients.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다</td></tr>
                ) : (
                  patients.map(patient => (
                    <tr
                      key={patient._id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`border-b cursor-pointer hover:bg-gray-100 transition-colors ${getRowColor(patient)}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{patient.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{patient.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{patient.age}세/{patient.gender}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{patient.firstVisitDate || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{patient.source || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {patient.consultation?.interestedServices?.slice(0, 2).map(s => (
                            <span key={s} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{s}</span>
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
                        {patient.postVisitStatusInfo?.status ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            patient.postVisitStatusInfo.status === '치료진행' ? 'bg-green-500 text-white' :
                            patient.postVisitStatusInfo.status === '치료예정' ? 'bg-blue-500 text-white' :
                            patient.postVisitStatusInfo.status === '결정대기' ? 'bg-yellow-500 text-white' :
                            patient.postVisitStatusInfo.status === '장기보류' ? 'bg-orange-500 text-white' :
                            'bg-red-500 text-white'
                          }`}>
                            {patient.postVisitStatusInfo.status}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">미설정</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {patient.postVisitStatusInfo?.nextCallbackDate ? (
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                            getCallbackStatus(patient.postVisitStatusInfo.nextCallbackDate) === 'overdue'
                              ? 'bg-red-500 text-white animate-pulse'
                              : getCallbackStatus(patient.postVisitStatusInfo.nextCallbackDate) === 'today'
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {getCallbackStatus(patient.postVisitStatusInfo.nextCallbackDate) === 'overdue' && '⚠️ '}
                            {getCallbackStatus(patient.postVisitStatusInfo.nextCallbackDate) === 'today' && '📞 '}
                            {formatCallbackDate(patient.postVisitStatusInfo.nextCallbackDate)}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(patient.postVisitCallbacks?.length || 0) > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {patient.postVisitCallbacks?.length}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {patient.postVisitConsultation?.estimateInfo?.regularPrice ? (
                          <span className="text-green-600 font-medium">
                            {patient.postVisitConsultation.estimateInfo.regularPrice.toLocaleString()}원
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
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
                <button key={p} onClick={() => fetchPatients(p)} className={`px-3 py-1 text-sm rounded ${p === pagination.page ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}>{p}</button>
              ))}
              <button onClick={() => fetchPatients(pagination.page + 1)} disabled={!pagination.hasNext} className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30">»</button>
              <button onClick={() => fetchPatients(pagination.totalPages)} disabled={!pagination.hasNext} className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-30">»»</button>
            </div>
          )}
        </div>
      </div>

      {/* 환자 상세 모달 */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onAddCallback={(callback, type) => handleAddCallback(selectedPatient._id!, callback, type)}
          onStatusChange={(action, data) => handleStatusChange(selectedPatient._id!, action, data)}
          onRefresh={() => fetchPatients(pagination.page)}
          onSaveConsultation={(data) => handleSaveConsultation(selectedPatient._id!, data)}
          onConfirmTeeth={(teeth) => handleConfirmTeeth(selectedPatient._id!, teeth)}
          onUpdatePostVisitStatus={(data) => handleUpdatePostVisitStatus(selectedPatient._id!, data)}
        />
      )}
    </div>
  )
}
