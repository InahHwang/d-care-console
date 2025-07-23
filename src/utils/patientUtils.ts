// src/utils/patientUtils.ts - 완전한 수정된 버전

import { Patient, PatientStatus } from '@/types/patient'

export interface PatientIdDebugInfo {
  patient: any;
  hasPatient: boolean;
  patientKeys: string[];
  _id: any;
  id: any;
  patientId: any;
  finalId: string | null;
  idSource: string;
}

/**
 * 환자 객체에서 안전하게 ID를 가져오는 함수
 * 우선순위: id > _id > patientId
 */
export const getSafePatientId = (patient: any): string | null => {
  if (!patient) {
    console.error('🚨 환자 객체가 없습니다:', patient);
    return null;
  }
  
  // 디버깅 정보 수집
  const debugInfo: PatientIdDebugInfo = {
    patient,
    hasPatient: !!patient,
    patientKeys: Object.keys(patient),
    _id: patient._id,
    id: patient.id,
    patientId: patient.patientId,
    finalId: null,
    idSource: 'none'
  };
  
  let finalId: string | null = null;
  let idSource = 'none';
  
  // 우선순위에 따라 ID 선택
  if (patient.id && typeof patient.id === 'string' && patient.id.trim() !== '') {
    finalId = patient.id;
    idSource = 'id';
  } else if (patient._id) {
    finalId = typeof patient._id === 'string' ? patient._id : patient._id.toString();
    idSource = '_id';
  } else if (patient.patientId && typeof patient.patientId === 'string' && patient.patientId.trim() !== '') {
    finalId = patient.patientId;
    idSource = 'patientId';
  }
  
  debugInfo.finalId = finalId;
  debugInfo.idSource = idSource;
  
  // 디버깅 로그
  console.log('🔍 getSafePatientId 결과:', debugInfo);
  
  if (!finalId) {
    console.error('🚨 환자 ID를 찾을 수 없습니다:', debugInfo);
    return null;
  }
  
  return finalId;
};

/**
 * 환자 객체의 ID 필드들을 정규화하는 함수
 */
export const normalizePatientId = (patient: any): any => {
  if (!patient) return patient;
  
  const safeId = getSafePatientId(patient);
  
  if (!safeId) {
    console.warn('🚨 환자 ID 정규화 실패:', patient);
    return patient;
  }
  
  // ID 필드들을 모두 통일
  return {
    ...patient,
    _id: safeId,
    id: safeId,
    // patientId는 원본 유지 (다를 수 있음)
  };
};

/**
 * 환자 배열의 모든 객체 ID를 정규화하는 함수
 */
export const normalizePatientIds = (patients: any[]): any[] => {
  if (!Array.isArray(patients)) return patients;
  
  return patients.map(normalizePatientId);
};

/**
 * API 호출 전 환자 ID 검증 함수
 */
export const validatePatientForAPI = (patient: any, actionName: string): string | null => {
  const safeId = getSafePatientId(patient);
  
  if (!safeId) {
    console.error(`🚨 ${actionName} 실패: 환자 ID가 없습니다.`, {
      patient,
      actionName,
      patientKeys: patient ? Object.keys(patient) : []
    });
    alert('환자 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return null;
  }
  
  console.log(`✅ ${actionName} 환자 ID 검증 성공:`, {
    actionName,
    patientId: safeId,
    patientName: patient?.name
  });
  
  return safeId;
};

// 🆕 콜백 처리 후 미조치 환자 판별 함수 (부재중 + 완료 모두 포함)
/**
 * 콜백이 처리(완료 또는 부재중)되었으면서 그 이후 새로운 예정 콜백이 없는 환자인지 확인
 * (재콜백필요 상태이면서 완료/부재중 이력이 있지만 추가 조치가 없는 환자)
 */
export const isUnprocessedAfterCallback = (patient: Patient): boolean => {
  // 재콜백필요 상태가 아니면 false
  if (patient.postVisitStatus !== '재콜백필요') {
    return false;
  }
  
  // 콜백 이력이 없으면 false
  if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
    return false;
  }
  
  // 내원 콜백 중 처리된 것들 찾기 (완료 또는 부재중)
  const processedVisitCallbacks = patient.callbackHistory.filter(cb => 
    cb.isVisitManagementCallback === true && 
    (cb.status === '완료' || cb.status === '부재중') &&
    cb.type && cb.type.startsWith('내원') && 
    cb.type.match(/\d+차$/) // 숫자차로 끝나는 것만
  );
  
  // 처리된 콜백이 없으면 false
  if (processedVisitCallbacks.length === 0) {
    return false;
  }
  
  // 가장 최근 처리된 콜백 찾기
  const latestProcessedCallback = processedVisitCallbacks.sort((a, b) => {
    const dateA = new Date(a.completedAt || a.createdAt || a.date);
    const dateB = new Date(b.completedAt || b.createdAt || b.date);
    return dateB.getTime() - dateA.getTime();
  })[0];
  
  if (!latestProcessedCallback) {
    return false;
  }
  
  const latestProcessedDate = new Date(
    latestProcessedCallback.completedAt || 
    latestProcessedCallback.createdAt || 
    latestProcessedCallback.date
  );
  
  // 가장 최근 처리된 콜백 이후에 생성된 예정 콜백이 있는지 확인
  const pendingCallbacksAfterProcessed = patient.callbackHistory.filter(cb => {
    if (!cb.isVisitManagementCallback || cb.status !== '예정') {
      return false;
    }
    
    const callbackDate = new Date(cb.createdAt || cb.date);
    return callbackDate > latestProcessedDate;
  });
  
  // 처리된 콜백 이후 새로운 예정 콜백이 없으면 미조치 상태
  return pendingCallbacksAfterProcessed.length === 0;
};

// 🆕 기존 함수명도 호환성을 위해 유지 (내부적으로 새 함수 호출)
export const isUnprocessedAfterMissed = (patient: Patient): boolean => {
  return isUnprocessedAfterCallback(patient);
};

// 🆕 콜백 처리 후 경과 시간 계산 함수 (완료/부재중 모두 포함)
/**
 * 가장 최근 처리된 콜백(완료 또는 부재중)으로부터 경과된 시간을 계산 (일 단위)
 */
export const getDaysSinceProcessed = (patient: Patient): { days: number; status: '완료' | '부재중' } | null => {
  if (!isUnprocessedAfterCallback(patient)) {
    return null;
  }
  
  const processedVisitCallbacks = patient.callbackHistory?.filter(cb => 
    cb.isVisitManagementCallback === true && 
    (cb.status === '완료' || cb.status === '부재중') &&
    cb.type && cb.type.startsWith('내원') && 
    cb.type.match(/\d+차$/)
  ) || [];
  
  if (processedVisitCallbacks.length === 0) {
    return null;
  }
  
  const latestProcessedCallback = processedVisitCallbacks.sort((a, b) => {
    const dateA = new Date(a.completedAt || a.createdAt || a.date);
    const dateB = new Date(b.completedAt || b.createdAt || b.date);
    return dateB.getTime() - dateA.getTime();
  })[0];
  
  const latestProcessedDate = new Date(
    latestProcessedCallback.completedAt || 
    latestProcessedCallback.createdAt || 
    latestProcessedCallback.date
  );
  
  const today = new Date();
  const diffTime = today.getTime() - latestProcessedDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    days: diffDays,
    status: latestProcessedCallback.status as '완료' | '부재중'
  };
};

// 🆕 기존 함수명도 호환성을 위해 유지 (내부적으로 새 함수 호출)
export const getDaysSinceMissed = (patient: Patient): number | null => {
  const result = getDaysSinceProcessed(patient);
  return result?.days || null;
};

/**
 * 환자의 콜백 히스토리를 기반으로 최종 상태를 계산하는 함수
 * 우선순위: 예정된 콜백이 있으면 '콜백필요', 마지막 콜백이 부재중이면 '부재중'
 */
export const calculatePatientStatus = (patient: Patient): PatientStatus => {
  console.log('🔥 calculatePatientStatus 시작:', {
    patientName: patient.name,
    currentStatus: patient.status,
    isCompleted: patient.isCompleted,
    visitConfirmed: patient.visitConfirmed,
    callbackCount: patient.callbackHistory?.length
  });

  // 이미 종결된 환자는 종결 상태 유지
  if (patient.isCompleted || patient.status === '종결') {
    return '종결';
  }
  
  // 예약확정/재예약확정 상태는 유지
  if (patient.status === '예약확정' || patient.status === '재예약확정') {
    return patient.status;
  }
  
  // 내원완료 환자는 현재 상태 유지
  if (patient.visitConfirmed) {
    return patient.status;
  }
  
  // 콜백 히스토리가 없으면 기본 상태 유지
  if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
    return patient.status || '잠재고객';
  }
  
  // 예정된 콜백이 있는지 확인
  const hasScheduledCallback = patient.callbackHistory.some(
    cb => cb.status === '예정' && !cb.isCompletionRecord
  );

  console.log('🔥 예정된 콜백 확인:', {
    hasScheduledCallback,
    scheduledCallbacks: patient.callbackHistory?.filter(
      cb => cb.status === '예정' && !cb.isCompletionRecord
    )
  });
  
  if (hasScheduledCallback) {
    return '콜백필요';
  }
  
  // 가장 최근의 유효한 콜백 찾기 (종결 기록 제외)
  const validCallbacks = patient.callbackHistory
    .filter(cb => !cb.isCompletionRecord)
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date).getTime();
      const dateB = new Date(b.createdAt || b.date).getTime();
      return dateB - dateA;
    });
  
  if (validCallbacks.length > 0) {
    const latestCallback = validCallbacks[0];
    
    // 마지막 콜백이 부재중이면 부재중 상태
    if (latestCallback.status === '부재중') {
      return '부재중';
    }
  }
  
  // 기본값
  return patient.status || '잠재고객';
};