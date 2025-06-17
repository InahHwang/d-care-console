// src/utils/paymentUtils.ts

import { ConsultationInfo } from '@/types/patient'

// 🔥 견적 동의 상태 텍스트 반환
export const getEstimateAgreedText = (agreed: boolean): string => {
  return agreed ? '동의' : '거부'
}

// 🔥 견적 동의 상태에 따른 색상 클래스 반환
export const getEstimateAgreedColor = (agreed: boolean): string => {
  return agreed 
    ? 'bg-green-100 text-green-800' 
    : 'bg-red-100 text-red-800'
}

// 🔥 결제율 계산 - 전체 환자 중 견적 동의한 환자 비율
export const calculateOverallPaymentRate = (patients: any[]): number => {
  if (patients.length === 0) return 0
  
  const patientsWithAgreement = patients.filter(patient => 
    patient.consultation && patient.consultation.estimateAgreed === true
  ).length
  
  return Math.round((patientsWithAgreement / patients.length) * 100 * 10) / 10 // 소수점 첫째자리까지
}

// 금액 포맷팅 (천 단위 콤마)
export const formatAmount = (amount: number): string => {
  return amount.toLocaleString('ko-KR')
}

// 🔥 견적 동의 상태에 따른 아이콘 반환
export const getEstimateAgreedIcon = (agreed: boolean): string => {
  return agreed ? '✅' : '❌'
}

// 🔥 치료 시작 여부 체크
export const isTreatmentStarted = (consultation?: ConsultationInfo): boolean => {
  if (!consultation) return false
  return consultation.estimateAgreed === true
}

// 🔥 상담 정보 유효성 검증
export const validateConsultationInfo = (consultation: Partial<ConsultationInfo>): string[] => {
  const errors: string[] = []
  
  if (consultation.estimatedAmount !== undefined && consultation.estimatedAmount < 0) {
    errors.push('견적 금액은 0 이상이어야 합니다.')
  }
  
  if (consultation.consultationDate && !isValidDate(consultation.consultationDate)) {
    errors.push('올바른 상담 날짜를 입력해주세요.')
  }
  
  return errors
}

// 날짜 유효성 검증 헬퍼
const isValidDate = (dateString: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}