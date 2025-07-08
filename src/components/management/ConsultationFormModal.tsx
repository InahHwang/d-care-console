// src/components/management/ConsultationFormModal.tsx
// 🔥 기존 기능 100% 유지 + 실시간 데이터 동기화만 추가

'use client'

import { useState, useEffect } from 'react'
import { HiOutlineX, HiOutlineCreditCard, HiOutlineCalendar, HiOutlineCurrencyDollar, HiOutlinePhone, HiOutlineClock } from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { ConsultationInfo } from '@/types/patient'
import { 
  validateConsultationInfo,
  formatAmount,
  getEstimateAgreedText,
  getEstimateAgreedColor
} from '@/utils/paymentUtils'
// 🔥 데이터 동기화 유틸리티 import 추가 (기존 기능에 영향 없음)
import { PatientDataSync } from '@/utils/dataSync'

interface ConsultationFormModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  existingConsultation?: ConsultationInfo
  onSave: (consultationData: Partial<ConsultationInfo>, additionalData?: {
    reservationDate?: string
    reservationTime?: string
    callbackDate?: string
    callbackTime?: string
    callbackNotes?: string
  }) => Promise<void>
}

export default function ConsultationFormModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  existingConsultation,
  onSave
}: ConsultationFormModalProps) {
  const [formData, setFormData] = useState<Partial<ConsultationInfo>>({
    estimatedAmount: 0,
    consultationDate: new Date().toISOString().split('T')[0],
    consultationNotes: '',
    treatmentPlan: '',
    estimateAgreed: false // 🔥 기본값은 거부
  })
  
  // 🔥 예약정보 상태 (동의 시 사용)
  const [reservationDate, setReservationDate] = useState('')
  const [reservationTime, setReservationTime] = useState('')
  
  // 🔥 콜백정보 상태 (거부 시 사용)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('')
  const [callbackNotes, setCallbackNotes] = useState('')
  
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // 기존 데이터로 폼 초기화 (기존 로직 그대로 유지)
  useEffect(() => {
    if (existingConsultation) {
      setFormData({
        estimatedAmount: existingConsultation.estimatedAmount || 0,
        consultationDate: existingConsultation.consultationDate || new Date().toISOString().split('T')[0],
        consultationNotes: existingConsultation.consultationNotes || '',
        treatmentPlan: existingConsultation.treatmentPlan || '',
        estimateAgreed: existingConsultation.estimateAgreed || false
      })
    }
  }, [existingConsultation])
  
  // 🔥 기본 날짜/시간 설정 (기존 로직 그대로 유지)
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowString = tomorrow.toISOString().split('T')[0]
      
      // 예약날짜는 내일로 기본 설정
      setReservationDate(tomorrowString)
      setReservationTime('10:00')
      
      // 콜백날짜는 내일로 기본 설정
      setCallbackDate(tomorrowString)
      setCallbackTime('10:00')
      setCallbackNotes('1차 콜백 - 견적 재검토 및 상담')
    }
  }, [isOpen])
  
  // 폼 데이터 변경 핸들러 (기존 로직 그대로 유지)
  const handleInputChange = (field: keyof ConsultationInfo, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // 에러 메시지 초기화
    if (errors.length > 0) {
      setErrors([])
    }
  }
  
  // 🔥 동의/거부 상태 변경 시 추가 입력 필드 검증 (기존 로직 그대로 유지)
  const validateAdditionalFields = (): string[] => {
    const additionalErrors: string[] = []
    
    if (formData.estimateAgreed === true) {
      // 동의 시 예약정보 검증
      if (!reservationDate) {
        additionalErrors.push('예약날짜를 선택해주세요.')
      }
      if (!reservationTime) {
        additionalErrors.push('예약시간을 선택해주세요.')
      }
    } else if (formData.estimateAgreed === false) {
      // 거부 시 콜백정보 검증
      if (!callbackDate) {
        additionalErrors.push('콜백날짜를 선택해주세요.')
      }
      if (!callbackTime) {
        additionalErrors.push('콜백시간을 선택해주세요.')
      }
      if (!callbackNotes || callbackNotes.trim() === '') {
        additionalErrors.push('콜백 메모를 입력해주세요.')
      }
    }
    
    return additionalErrors
  }
  
  // 🔥 저장 핸들러 - 기존 로직 + 데이터 동기화 트리거만 추가
  const handleSave = async () => {
    // 기본 유효성 검사 (기존 로직 그대로)
    const validationErrors = validateConsultationInfo(formData)
    const additionalErrors = validateAdditionalFields()
    const allErrors = [...validationErrors, ...additionalErrors]
    
    if (allErrors.length > 0) {
      setErrors(allErrors)
      return
    }
    
    setIsLoading(true)
    
    try {
      // 🔥 추가 데이터 구성 (기존 로직 그대로)
      const additionalData: {
        reservationDate?: string
        reservationTime?: string
        callbackDate?: string
        callbackTime?: string
        callbackNotes?: string
      } = {}
      
      if (formData.estimateAgreed === true) {
        // 동의 시 예약정보 추가
        additionalData.reservationDate = reservationDate
        additionalData.reservationTime = reservationTime
      } else if (formData.estimateAgreed === false) {
        // 거부 시 콜백정보 추가
        additionalData.callbackDate = callbackDate
        additionalData.callbackTime = callbackTime
        additionalData.callbackNotes = callbackNotes
      }
      
      // 🔥 기존 onSave 호출 (기존 로직 그대로)
      await onSave(formData, additionalData)
      
      // 🔥 성공 후 데이터 동기화 트리거 (새로 추가된 부분 - 기존 기능에 영향 없음)
      PatientDataSync.onConsultationUpdate(patientId, 'ConsultationFormModal')
      
      onClose() // 기존 로직 그대로
    } catch (error) {
      console.error('상담 정보 저장 실패:', error)
      setErrors(['상담 정보 저장에 실패했습니다.'])
    } finally {
      setIsLoading(false)
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* 모달 헤더 (기존 UI 그대로 유지) */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon={HiOutlineCreditCard} size={24} className="text-green-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {existingConsultation ? '최초 상담 기록 수정' : '최초 상담 기록 입력'}
              </h2>
              <p className="text-sm text-gray-500">환자: {patientName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <Icon icon={HiOutlineX} size={20} />
          </button>
        </div>
        
        {/* 에러 메시지 (기존 UI 그대로 유지) */}
        {errors.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <ul className="text-sm text-red-600 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 모달 바디 (기존 UI 그대로 유지) */}
        <div className="p-6 space-y-6">
          {/* 기본 상담 정보 */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <Icon icon={HiOutlineCalendar} size={18} />
              상담 정보
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상담 날짜 *
                </label>
                <input
                  type="date"
                  value={formData.consultationDate || ''}
                  onChange={(e) => handleInputChange('consultationDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  견적 금액 *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.estimatedAmount || ''}
                    onChange={(e) => handleInputChange('estimatedAmount', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-sm">원</span>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                불편한 부분 *
              </label>
              <textarea
                value={formData.treatmentPlan || ''}
                onChange={(e) => handleInputChange('treatmentPlan', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="환자의 불편한 부분을 입력해주세요 (ex. 치료할 치아 개수, 부위, 증상, 통증정도)"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상담 메모 *
              </label>
              <textarea
                value={formData.consultationNotes || ''}
                onChange={(e) => handleInputChange('consultationNotes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="상담 내용이나 특이사항을 입력해주세요..."
                required
              />
            </div>
          </div>
          
          {/* 🔥 견적 동의 여부 섹션 (기존 UI 그대로 유지) */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <Icon icon={HiOutlineCurrencyDollar} size={18} />
              최초 상담 동의 여부
            </h3>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                환자가 최초 상담에 동의하고 예약을 완료하였습니까?
              </p>
              
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="estimateAgreed"
                    checked={formData.estimateAgreed === true}
                    onChange={() => handleInputChange('estimateAgreed', true)}
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm font-medium text-green-700">
                    동의 (예약 완료)
                  </span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="estimateAgreed"
                    checked={formData.estimateAgreed === false}
                    onChange={() => handleInputChange('estimateAgreed', false)}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className="ml-2 text-sm font-medium text-red-700">
                    거부 (미예약)
                  </span>
                </label>
              </div>
            </div>
            
            {/* 🔥 동의 선택 시 예약정보 입력 (기존 UI 그대로 유지) */}
            {formData.estimateAgreed === true && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <Icon icon={HiOutlineCalendar} size={16} />
                  예약 정보 입력
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      예약 날짜 *
                    </label>
                    <input
                      type="date"
                      value={reservationDate}
                      onChange={(e) => setReservationDate(e.target.value)}
                      className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      예약 시간 *
                    </label>
                    <input
                      type="time"
                      value={reservationTime}
                      onChange={(e) => setReservationTime(e.target.value)}
                      className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                </div>
                
                <div className="mt-3 p-2 bg-green-100 rounded text-sm text-green-800">
                  💡 저장 시 환자 상태가 "예약완료"로 변경됩니다.
                </div>
              </div>
            )}
            
            {/* 🔥 거부 선택 시 1차 콜백 등록 (기존 UI 그대로 유지) */}
            {formData.estimateAgreed === false && (
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                  <Icon icon={HiOutlinePhone} size={16} />
                  1차 콜백 등록
                </h4>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-orange-700 mb-1">
                        콜백 날짜 *
                      </label>
                      <input
                        type="date"
                        value={callbackDate}
                        onChange={(e) => setCallbackDate(e.target.value)}
                        className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-orange-700 mb-1">
                        콜백 시간 *
                      </label>
                      <input
                        type="time"
                        value={callbackTime}
                        onChange={(e) => setCallbackTime(e.target.value)}
                        className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-1">
                      콜백 계획 *
                    </label>
                    <textarea
                      value={callbackNotes}
                      onChange={(e) => setCallbackNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      placeholder="1차 콜백 계획이나 특이사항을 입력해주세요..."
                    />
                  </div>
                </div>
                
                <div className="mt-3 p-2 bg-orange-100 rounded text-sm text-orange-800">
                  💡 저장 시 콜백 관리에 1차 콜백이 자동 등록됩니다.
                </div>
              </div>
            )}
          </div>
          
          {/* 상태 미리보기 (기존 UI 그대로 유지) */}
          {formData.estimatedAmount && formData.estimatedAmount > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">상담 결과 미리보기</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">견적 금액:</span>
                  <span className="ml-2 font-medium">{formatAmount(formData.estimatedAmount)}원</span>
                </div>
                <div>
                  <span className="text-gray-600">동의 여부:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    getEstimateAgreedColor(formData.estimateAgreed || false)
                  }`}>
                    {getEstimateAgreedText(formData.estimateAgreed || false)}
                  </span>
                </div>
                
                {/* 🔥 추가 정보 미리보기 */}
                {formData.estimateAgreed === true && reservationDate && reservationTime && (
                  <div className="col-span-2">
                    <span className="text-gray-600">예약 일시:</span>
                    <span className="ml-2 font-medium text-green-700">
                      {reservationDate} {reservationTime}
                    </span>
                  </div>
                )}
                
                {formData.estimateAgreed === false && callbackDate && callbackTime && (
                  <div className="col-span-2">
                    <span className="text-gray-600">1차 콜백 일시:</span>
                    <span className="ml-2 font-medium text-orange-700">
                      {callbackDate} {callbackTime}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* 모달 푸터 (기존 UI 그대로 유지) */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={isLoading}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}