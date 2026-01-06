// src/types/funnel.ts
// 퍼널 단계 타입 및 상수 정의

import { Patient } from './patient'

// 퍼널 단계 타입 정의
export type FunnelStage =
  | 'consulting'      // 상담중 (첫 상담 진행 중, 콜백 진행 중)
  | 'reserved'        // 예약확정 (예약은 잡았으나 아직 내원 전)
  | 'visited'         // 내원완료 (내원했으나 아직 치료 결정 전)
  | 'in_treatment'    // 치료중 (치료 동의 후 치료 진행 중)
  | 'completed'       // 종결 (치료 완료 또는 이탈)

// 긴급 액션 타입 정의
export type UrgentActionType =
  | 'overdue_callback'        // 콜백 지연 (예정일 지남)
  | 'today_reservation'       // 오늘 예약
  | 'post_reservation_no_show' // 예약 후 미내원
  | 'treatment_not_started'   // 치료 동의 후 미시작
  | 'no_status'               // 상태 미설정

// 퍼널 단계 정보
export interface FunnelStageInfo {
  key: FunnelStage
  label: string
  description: string
  color: string
  bgColor: string
  hoverColor: string
  icon: string
}

// 퍼널 단계 상수 정의
export const FUNNEL_STAGES: Record<FunnelStage, FunnelStageInfo> = {
  consulting: {
    key: 'consulting',
    label: '상담중',
    description: '첫 상담 또는 콜백 진행 중인 환자',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    hoverColor: 'hover:bg-blue-100',
    icon: '📞'
  },
  reserved: {
    key: 'reserved',
    label: '예약확정',
    description: '내원 예약이 확정된 환자',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    hoverColor: 'hover:bg-purple-100',
    icon: '📅'
  },
  visited: {
    key: 'visited',
    label: '내원완료',
    description: '내원했으나 치료 결정 전인 환자',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    hoverColor: 'hover:bg-green-100',
    icon: '🏥'
  },
  in_treatment: {
    key: 'in_treatment',
    label: '치료중',
    description: '치료가 진행 중인 환자',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    hoverColor: 'hover:bg-orange-100',
    icon: '💊'
  },
  completed: {
    key: 'completed',
    label: '종결',
    description: '치료 완료 또는 이탈한 환자',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    hoverColor: 'hover:bg-gray-100',
    icon: '✅'
  }
}

// 긴급 액션 정보
export interface UrgentActionInfo {
  key: UrgentActionType
  label: string
  description: string
  color: string
  bgColor: string
  priority: number // 우선순위 (낮을수록 긴급)
}

// 긴급 액션 상수 정의
export const URGENT_ACTIONS: Record<UrgentActionType, UrgentActionInfo> = {
  overdue_callback: {
    key: 'overdue_callback',
    label: '콜백 지연',
    description: '콜백 예정일이 지났으나 처리되지 않은 환자',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    priority: 1
  },
  today_reservation: {
    key: 'today_reservation',
    label: '오늘 예약',
    description: '오늘 내원 예약이 있는 환자',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    priority: 2
  },
  post_reservation_no_show: {
    key: 'post_reservation_no_show',
    label: '예약 후 미내원',
    description: '예약일이 지났으나 내원하지 않은 환자',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    priority: 3
  },
  treatment_not_started: {
    key: 'treatment_not_started',
    label: '치료 미시작',
    description: '치료 동의 후 예정일이 지났으나 시작하지 않은 환자',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    priority: 4
  },
  no_status: {
    key: 'no_status',
    label: '상태 미설정',
    description: '내원 후 상태가 설정되지 않은 환자',
    color: 'text-gray-600',
    bgColor: 'bg-gray-200',
    priority: 5
  }
}

// 환자의 퍼널 단계 판별 함수
export const getPatientFunnelStage = (patient: Patient): FunnelStage => {
  // 1. 종결 체크
  if (patient.isCompleted || patient.status === '종결') {
    return 'completed'
  }

  // 2. 내원완료 환자 분기
  if (patient.visitConfirmed === true) {
    // 치료중 (치료시작 또는 치료동의)
    if (patient.postVisitStatus === '치료시작' || patient.postVisitStatus === '치료동의') {
      return 'in_treatment'
    }
    // 내원완료 (재콜백필요, 상태 미설정 등)
    return 'visited'
  }

  // 3. 예약확정 체크
  if (patient.status === '예약확정' || patient.status === '재예약확정') {
    return 'reserved'
  }

  // 4. 그 외는 상담중
  return 'consulting'
}

// 환자의 긴급 액션 체크 함수
export const getPatientUrgentActions = (patient: Patient): UrgentActionType[] => {
  const actions: UrgentActionType[] = []
  const today = new Date().toISOString().split('T')[0]

  // 1. 콜백 지연 체크
  const hasOverdueCallback = (patient.callbackHistory || []).some(callback =>
    callback.status === '예정' && callback.date < today
  )
  if (hasOverdueCallback) {
    actions.push('overdue_callback')
  }

  // 2. 오늘 예약 체크
  if (patient.reservationDate === today) {
    actions.push('today_reservation')
  }

  // 3. 예약 후 미내원 체크
  if (patient.hasBeenPostReservationPatient === true || patient.isPostReservationPatient === true) {
    actions.push('post_reservation_no_show')
  }

  // 4. 치료 미시작 체크 (내원완료 + 치료동의 + 예정일 지남)
  if (
    patient.visitConfirmed === true &&
    patient.postVisitStatus === '치료동의' &&
    patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate &&
    patient.postVisitConsultation.treatmentConsentInfo.treatmentStartDate < today
  ) {
    actions.push('treatment_not_started')
  }

  // 5. 상태 미설정 체크 (내원완료인데 postVisitStatus가 없음)
  if (patient.visitConfirmed === true && !patient.postVisitStatus) {
    actions.push('no_status')
  }

  return actions
}

// 퍼널별 환자 통계 타입
export interface FunnelStats {
  consulting: number
  reserved: number
  visited: number
  in_treatment: number
  completed: number
  total: number
}

// 긴급 액션별 환자 통계 타입
export interface UrgentStats {
  overdue_callback: number
  today_reservation: number
  post_reservation_no_show: number
  treatment_not_started: number
  no_status: number
}

// 퍼널 통계 계산 함수
export const calculateFunnelStats = (patients: Patient[]): FunnelStats => {
  const stats: FunnelStats = {
    consulting: 0,
    reserved: 0,
    visited: 0,
    in_treatment: 0,
    completed: 0,
    total: patients.length
  }

  patients.forEach(patient => {
    const stage = getPatientFunnelStage(patient)
    stats[stage]++
  })

  return stats
}

// 긴급 액션 통계 계산 함수
export const calculateUrgentStats = (patients: Patient[]): UrgentStats => {
  const stats: UrgentStats = {
    overdue_callback: 0,
    today_reservation: 0,
    post_reservation_no_show: 0,
    treatment_not_started: 0,
    no_status: 0
  }

  patients.forEach(patient => {
    const actions = getPatientUrgentActions(patient)
    actions.forEach(action => {
      stats[action]++
    })
  })

  return stats
}

// 퍼널별 환자 필터링 함수
export const filterPatientsByFunnel = (
  patients: Patient[],
  stage: FunnelStage | 'all'
): Patient[] => {
  if (stage === 'all') return patients
  return patients.filter(patient => getPatientFunnelStage(patient) === stage)
}

// 긴급 액션별 환자 필터링 함수
export const filterPatientsByUrgentAction = (
  patients: Patient[],
  action: UrgentActionType | 'all'
): Patient[] => {
  if (action === 'all') return patients
  return patients.filter(patient => getPatientUrgentActions(patient).includes(action))
}
