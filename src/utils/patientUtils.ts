// src/utils/patientUtils.ts - 새 파일 생성

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