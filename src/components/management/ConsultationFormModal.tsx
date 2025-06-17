// src/components/management/ConsultationFormModal.tsx
// 🔥 대폭 단순화된 상담 정보 입력 모달

'use client'

import { useState, useEffect } from 'react'
import { HiOutlineX, HiOutlineCreditCard, HiOutlineCalendar, HiOutlineCurrencyDollar } from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { ConsultationInfo } from '@/types/patient'
import { 
  validateConsultationInfo,
  formatAmount,
  getEstimateAgreedText,
  getEstimateAgreedColor
} from '@/utils/paymentUtils'

interface ConsultationFormModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  patientName: string
  existingConsultation?: ConsultationInfo
  onSave: (consultationData: Partial<ConsultationInfo>) => Promise<void>
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
  
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // 기존 데이터로 폼 초기화
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
  
  // 폼 데이터 변경 핸들러
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
  
  // 저장 핸들러
  const handleSave = async () => {
    // 유효성 검사
    const validationErrors = validateConsultationInfo(formData)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    
    setIsLoading(true)
    
    try {
      await onSave(formData)
      onClose()
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
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon={HiOutlineCreditCard} size={24} className="text-green-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {existingConsultation ? '상담 정보 수정' : '상담 정보 입력'}
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
        
        {/* 에러 메시지 */}
        {errors.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <ul className="text-sm text-red-600 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 모달 바디 */}
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
                치료 계획
              </label>
              <textarea
                value={formData.treatmentPlan || ''}
                onChange={(e) => handleInputChange('treatmentPlan', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="치료 계획을 입력해주세요..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상담 메모
              </label>
              <textarea
                value={formData.consultationNotes || ''}
                onChange={(e) => handleInputChange('consultationNotes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="상담 내용이나 특이사항을 입력해주세요..."
              />
            </div>
          </div>
          
          {/* 🔥 견적 동의 여부 섹션 */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <Icon icon={HiOutlineCurrencyDollar} size={18} />
              견적 동의 여부
            </h3>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                환자가 제시된 견적 금액에 동의하고 치료를 시작하였습니까?
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
                    동의 (치료 시작)
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
                    거부 (치료 안함)
                  </span>
                </label>
              </div>
            </div>
          </div>
          
          {/* 상태 미리보기 */}
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
              </div>
            </div>
          )}
        </div>
        
        {/* 모달 푸터 */}
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