// src/store/slices/patientsSlice.ts - 새로운 첫 상담 후 상태 관리 액션 추가

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { EventCategory } from '@/types/messageLog';
// 🔥 활동 로거 import 추가
import { PatientActivityLogger, CallbackActivityLogger, EventTargetActivityLogger } from '@/utils/activityLogger';
// 🔥 모든 타입들을 patient.ts에서 import
import { 
  ConsultationInfo,
  Patient,
  ConsultationType,
  ReferralSource,
  EventTargetInfo,
  EventTargetReason,
  PatientStatus,
  ReminderStatus,
  CallbackStatus,
  CallbackItem,
  CompletePatientData,
  QuickInboundPatient,
  CreatePatientData,
  UpdatePatientData,
  PostVisitStatus,
  PatientReaction,
  EstimateInfo,
  FirstConsultationStatus,
  PostReservationStatus,
  CallbackFollowupStatus,
  FirstConsultationResult,
  PostReservationResult,
  CallbackFollowupResult,
} from '@/types/patient';
import { RootState } from '..';

// 🔥 내원관리 필터 유틸리티 함수들 추가
export const getVisitManagementFilterName = (filterType: PatientFilterType): string => {
  switch (filterType) {
    case 'unprocessed_callback':
      return '미처리 콜백';
    case 'treatment_consent_not_started':
      return '치료동의 후 미시작';
    case 'needs_callback':
      return '재콜백 필요';
    case 'no_status':
      return '상태 미설정';
    default:
      return '전체 보기';
  }
};

// 🔥 내원관리 필터 검증 함수
export const isValidVisitManagementFilter = (filterType: string): boolean => {
  const validFilters = [
    'all',
    'unprocessed_callback',
    'treatment_consent_not_started',
    'in_treatment',
    'needs_callback',
    'no_status'
  ];
  return validFilters.includes(filterType);
};

// 🔥 내원관리 필터 계산 헬퍼 함수들
export const calculateUnprocessedCallbacks = (patients: Patient[]): Patient[] => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  return patients.filter(patient => {
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
      return false;
    }
    
    const visitCallbacks = patient.callbackHistory.filter(cb => 
      cb.isVisitManagementCallback === true && cb.status === '예정'
    );
    
    if (visitCallbacks.length === 0) {
      return false;
    }
    
    return visitCallbacks.some(callback => callback.date < todayString);
  });
};

export const calculateTreatmentConsentNotStarted = (patients: Patient[]): Patient[] => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  return patients.filter(patient => {
    if (patient.postVisitStatus !== '치료동의') {
      return false;
    }
    
    const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
    if (!treatmentStartDate) {
      return false;
    }
    
    return treatmentStartDate < todayString;
  });
};

// 🔥 예약 후 미내원 환자 자동 분류 액션 추가
export const updatePostReservationPatients = createAsyncThunk(
  'patients/updatePostReservationPatients',
  async (_, { rejectWithValue, getState }) => {
    try {
      console.log('예약 후 미내원 환자 자동 분류 시작');
      
      const state = getState() as { patients: PatientsState };
      const allPatients = state.patients.patients;
      
      // 예약확정이지만 내원확정이 되지 않은 환자들 중 예약일이 지난 환자들 찾기
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const patientsToUpdate: string[] = [];
      
      allPatients.forEach(patient => {
        if (
          patient.status === '예약확정' && 
          !patient.visitConfirmed && 
          patient.reservationDate && 
          patient.reservationDate < todayString &&
          !patient.isPostReservationPatient
        ) {
          patientsToUpdate.push(patient._id || patient.id);
        }
      });
      
      if (patientsToUpdate.length === 0) {
        console.log('자동 분류할 예약 후 미내원 환자가 없습니다.');
        return [];
      }
      
      // 각 환자를 예약 후 미내원 상태로 업데이트
      const updatedPatients = [];
      for (const patientId of patientsToUpdate) {
        try {
          const response = await fetch(`/api/patients/${patientId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              isPostReservationPatient: true,
              currentConsultationStage: 'post_reservation'
            }),
          });
          
          if (response.ok) {
            const updatedPatient = await response.json();
            updatedPatients.push(updatedPatient);
          }
        } catch (error) {
          console.warn(`환자 ${patientId} 업데이트 실패:`, error);
        }
      }
      
      console.log(`${updatedPatients.length}명의 환자가 예약 후 미내원 상태로 분류되었습니다.`);
      return updatedPatients;
    } catch (error: any) {
      console.error('예약 후 미내원 환자 자동 분류 실패:', error);
      return rejectWithValue(error.message || '자동 분류에 실패했습니다.');
    }
  }
);

// 🔥 내원 후 상태 데이터 초기화 액션 추가
export const resetPostVisitData = createAsyncThunk(
  'patients/resetPostVisitData',
  async (patientId: string, { rejectWithValue, getState }) => {
    try {
      console.log('Redux: 내원 후 상태 데이터 초기화 시작:', patientId);
      
      const state = getState() as { patients: PatientsState };
      const patient = state.patients.patients.find(p => p._id === patientId || p.id === patientId);
      
      const response = await fetch(`/api/patients/${patientId}/reset-post-visit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('초기화 API 응답 에러:', errorData);
        return rejectWithValue(errorData.error || '내원 후 상태 초기화에 실패했습니다.');
      }
      
      const result = await response.json();
      const updatedPatient = result.patient;
      
      console.log('Redux: 내원 후 상태 초기화 성공:', {
        patientId,
        name: updatedPatient.name,
        resetComplete: true
      });
      
      // 🔥 활동 로그 기록
      if (patient) {
        try {
          await PatientActivityLogger.resetPostVisitData(
            patient.id,
            patient.name
          );
        } catch (logError) {
          console.warn('초기화 활동 로그 기록 실패:', logError);
        }
      }
      
      return updatedPatient;
    } catch (error: any) {
      console.error('Redux: 내원 후 상태 초기화 네트워크 에러:', error);
      return rejectWithValue(error.message || '내원 후 상태 초기화에 실패했습니다.');
    }
  }
);

// 🔥 기존 컴포넌트들이 사용할 수 있도록 타입들을 re-export
export type {
  Patient,
  CallbackItem,
  CallbackStatus,
  EventTargetReason,
  PatientStatus,
  UpdatePatientData,
  CreatePatientData,
  ConsultationType,
  ReferralSource,
  EventTargetInfo,
  ReminderStatus,
  CompletePatientData,
  QuickInboundPatient,
  PostVisitStatus,
  PatientReaction,
  EstimateInfo,
  ConsultationInfo,
  FirstConsultationStatus,
  PostReservationStatus,
  CallbackFollowupStatus,
  FirstConsultationResult,
  PostReservationResult,
  CallbackFollowupResult,
};

export type PatientFilterType = 
  // 대시보드 필터 타입들
  | 'new_inquiry'           
  | 'reservation_rate'      
  | 'visit_rate'           
  | 'treatment_rate'    
  | 'potential_customer'   
  // 상태별 필터 타입들
  | 'callbackUnregistered' 
  | 'overdueCallbacks' 
  | 'callbackNeeded' 
  | 'absent' 
  | 'todayScheduled'
  // 세분화된 필터 타입들
  | 'overdueCallbacks_consultation'
  | 'overdueCallbacks_visit'
  | 'todayScheduled_consultation'
  | 'todayScheduled_visit'
  | 'callbackUnregistered_consultation'
  | 'callbackUnregistered_visit'
  | 'reminderCallbacks_scheduled'
  | 'reminderCallbacks_registrationNeeded'
  // 🔥 내원관리 새로운 필터 타입들 추가
  | 'unprocessed_callback'           // 미처리 콜백
  | 'treatment_consent_not_started'  // 치료동의 후 미시작
  | 'needs_callback'                 // 재콜백 필요
  | 'no_status';                     // 상태 미설정

// 🔥 PatientsState 인터페이스만 여기서 정의 (로컬 Patient 제거)
export interface PatientsState {
  patients: Patient[];            // import한 Patient 사용
  filteredPatients: Patient[];    
  selectedPatient: Patient | null; 
  modalContext: 'management' | 'visit-management' | null; // 🆕 추가
  pagination: {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    totalItems: number;
  };
  filters: {
    searchTerm: string;
    status: PatientStatus | 'all';
    interestArea: string | 'all';
    consultationType: ConsultationType | 'all';
    referralSource: ReferralSource | 'all';
    visitStatus: 'all' | 'visit_confirmed' | 'post_visit_needed';
  };
  isLoading: boolean;
  error: string | null;
  eventTargetPatients: Patient[];
  postVisitPatients: Patient[];
  filteredPatientsForModal: Patient[];
  modalFilterType: PatientFilterType | null; 
}

// 초기 상태 정의
const initialState: PatientsState = {
  filteredPatientsForModal: [],
  modalFilterType: null,
  patients: [],
  filteredPatients: [],
  selectedPatient: null,
  modalContext: null, 
  pagination: {
    currentPage: 1,
    totalPages: 0,
    itemsPerPage: 10,
    totalItems: 0
  },
  filters: {
    searchTerm: '',
    status: 'all',
    interestArea: 'all',
    consultationType: 'all',
    referralSource: 'all',
    visitStatus: 'all'
  },
  isLoading: true,
  error: null,
  eventTargetPatients: [],
  postVisitPatients: [],
};

// 🔥 새로운 비동기 액션 추가
export const fetchFilteredPatients = createAsyncThunk(
  'patients/fetchFilteredPatients',
  async (filterType: PatientFilterType, { rejectWithValue }) => {
    try {
      console.log('🔍 필터된 환자 목록 조회:', filterType);
      
      const response = await fetch(`/api/patients/filtered?type=${filterType}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '필터된 환자 목록을 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      console.log('🔍 필터된 환자 목록 조회 완료:', data.patients.length, '명');
      
      return {
        patients: data.patients,
        filterType
      };
    } catch (error: any) {
      return rejectWithValue(error.message || '필터된 환자 목록을 불러오는데 실패했습니다.');
    }
  }
);

// 🔥 내원 후 관리 환자 목록 가져오기 액션
export const fetchPostVisitPatients = createAsyncThunk(
  'patients/fetchPostVisitPatients',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/patients/post-visit');
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '내원 후 관리 환자 목록을 불러오는데 실패했습니다.');
      }
      
      const postVisitPatients = await response.json();
      return postVisitPatients;
    } catch (error: any) {
      return rejectWithValue(error.message || '내원 후 관리 환자 목록을 불러오는데 실패했습니다.');
    }
  }
);

// 🔥 내원 후 상태 업데이트 액션 - 환자 반응 지원
export const updatePostVisitStatus = createAsyncThunk(
  'patients/updatePostVisitStatus',
  async ({ 
    patientId, 
    postVisitStatus, 
    postVisitConsultation,
    postVisitNotes,
    nextVisitDate 
  }: { 
    patientId: string, 
    postVisitStatus?: string,
    postVisitConsultation?: any,
    postVisitNotes?: string,
    nextVisitDate?: string
  }, { rejectWithValue }) => {
    try {
      console.log('Redux: 내원 후 상태 업데이트 시작:', {
        patientId,
        postVisitStatus,
        hasConsultation: !!postVisitConsultation,
        treatmentContent: postVisitConsultation?.treatmentContent,
        patientReaction: postVisitConsultation?.estimateInfo?.patientReaction
      });
      const response = await fetch(`/api/patients/${patientId}/post-visit-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          postVisitStatus, 
          postVisitConsultation,
          postVisitNotes,
          nextVisitDate 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API 응답 에러:', errorData);
        return rejectWithValue(errorData.error || '내원 후 상태 업데이트에 실패했습니다.');
      }
      
      const updatedPatient = await response.json();
      console.log('Redux: 내원 후 상태 업데이트 성공:', {
        name: updatedPatient.name,
        postVisitStatus: updatedPatient.postVisitStatus,
        treatmentContent: updatedPatient.postVisitConsultation?.treatmentContent,
        patientReaction: updatedPatient.postVisitConsultation?.estimateInfo?.patientReaction
      });
      
      return updatedPatient;
    } catch (error: any) {
      console.error('Redux: 내원 후 상태 업데이트 네트워크 에러:', error);
      return rejectWithValue(error.message || '내원 후 상태 업데이트에 실패했습니다.');
    }
  }
);

// 🔥 상담/결제 정보 업데이트 액션
export const updateConsultationInfo = createAsyncThunk(
  'patients/updateConsultationInfo',
  async ({ 
    patientId, 
    consultationData 
  }: { 
    patientId: string, 
    consultationData: Partial<ConsultationInfo> 
  }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/patients/${patientId}`, { 
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consultation: consultationData }), 
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        return rejectWithValue(errorData.error || '상담 정보 업데이트에 실패했습니다.')
      }
      
      const updatedPatient = await response.json()
      
      console.log('🔥 상담 정보 업데이트 성공:', {
        patientId: updatedPatient._id,
        name: updatedPatient.name,
        hasConsultation: !!updatedPatient.consultation,
        estimateAgreed: updatedPatient.consultation?.estimateAgreed
      });
      
      return updatedPatient
    } catch (error: any) {
      return rejectWithValue(error.message || '상담 정보 업데이트에 실패했습니다.')
    }
  }
)

// 🔥 상담/결제 정보 삭제 액션
export const deleteConsultationInfo = createAsyncThunk(
  'patients/deleteConsultationInfo',
  async (patientId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { patients: PatientsState }
      const patient = state.patients.patients.find(p => p._id === patientId || p.id === patientId)
      
      const response = await fetch(`/api/patients/${patientId}/consultation`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        return rejectWithValue(errorData.error || '상담 정보 삭제에 실패했습니다.')
      }
      
      if (patient) {
        console.log('상담/결제 정보 삭제 완료:', patient.name)
      }
      
      return patientId
    } catch (error: any) {
      return rejectWithValue(error.message || '상담 정보 삭제에 실패했습니다.')
    }
  }
)

// 🔥 인바운드 환자 빠른 등록 비동기 액션
export const createQuickInboundPatient = createAsyncThunk(
  'patients/createQuickInboundPatient',
  async ({ phoneNumber, userInfo }: { phoneNumber: string, userInfo: any }, { rejectWithValue }) => {
    try {
      console.log('🔥 createQuickInboundPatient: 사용자 정보 포함 요청:', userInfo);
      
      const userInfoHeader = userInfo ? 
        btoa(encodeURIComponent(JSON.stringify(userInfo))) : '';
      
      const response = await fetch('/api/patients/inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Info': userInfoHeader
        },
        body: JSON.stringify({ phoneNumber }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '인바운드 환자 등록에 실패했습니다.');
      }
      
      const newPatient = await response.json();
      
      console.log('🔥 createQuickInboundPatient: 등록 성공:', {
        patientId: newPatient.patientId,
        name: newPatient.name,
        createdBy: newPatient.createdBy,
        createdByName: newPatient.createdByName
      });
      
      await PatientActivityLogger.create(
        newPatient.id,
        newPatient.name,
        { consultationType: 'inbound', phoneNumber }
      );
      
      return newPatient;
    } catch (error: any) {
      console.error('🔥 createQuickInboundPatient: 실패:', error);
      return rejectWithValue(error.message || '인바운드 환자 등록에 실패했습니다.');
    }
  }
);

// 환자 목록 가져오기 비동기 액션
export const fetchPatients = createAsyncThunk(
  'patients/fetchPatients',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/patients');
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '환자 목록을 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      
      const patients = data.patients.map((patient: any) => {
        if (typeof patient._id === 'string') {
          return patient;
        }
        return {
          ...patient,
          _id: patient._id.toString()
        };
      });
      
      return {
        patients,
        totalItems: patients.length 
      };
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 목록을 불러오는데 실패했습니다.');
    }
  }
);

// 🔥 내원확정 토글 비동기 액션
export const toggleVisitConfirmation = createAsyncThunk(
  'patients/toggleVisitConfirmation',
  async (patientId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/patients/${patientId}/visit-confirmation`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '내원확정 상태 변경에 실패했습니다');
      }
      
      const updatedPatient = await response.json();
      
      await PatientActivityLogger.toggleVisitConfirmation(
        updatedPatient.id,
        updatedPatient.name,
        updatedPatient.visitConfirmed
      );
      
      return updatedPatient;
    } catch (error) {
      console.error('내원확정 API 오류:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : '내원확정 상태 변경에 실패했습니다'
      );
    }
  }
);

// 상태별 환자 목록 가져오기 비동기 액션
export const fetchPatientsByStatus = createAsyncThunk(
  'patients/fetchPatientsByStatus',
  async (filterType: 'callbackNeeded' | 'absent' | 'todayScheduled' | 'newPatients', { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/patients/status-filter?type=${filterType}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '환자 목록을 불러오는데 실패했습니다.');
      }
      
      const patients = await response.json();
      return { filterType, patients };
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 목록을 불러오는데 실패했습니다.');
    }
  }
);

// 🔥 이벤트 타겟 초기화 액션 - 수정된 버전
export const initializeEventTargets = createAsyncThunk(
  'patients/initializeEventTargets',
  async (_, { getState, rejectWithValue }) => {
    try {
      console.log('이벤트 타겟 초기화 시작');
      
      const response = await fetch('/api/patients/event-targets', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API 응답 오류:', errorData);
        return rejectWithValue(errorData.error || '이벤트 타겟 정보 로드에 실패했습니다.');
      }
      
      const eventTargetPatients = await response.json();
      console.log('API에서 이벤트 타겟 환자 로드 완료:', eventTargetPatients.length, '명');
      
      return eventTargetPatients;
    } catch (error: any) {
      console.error('이벤트 타겟 초기화 오류:', error);
      return rejectWithValue(error.message || '이벤트 타겟 초기화에 실패했습니다.');
    }
  }
);

// 🔥 이벤트 타겟 설정 액션
export const updateEventTargetInfo = createAsyncThunk(
  'patients/updateEventTargetInfo',
  async ({ patientId, eventTargetInfo }: { patientId: string, eventTargetInfo: Partial<EventTargetInfo> }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/patients/${patientId}/event-target`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventTargetInfo),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '이벤트 타겟 정보 업데이트에 실패했습니다.');
      }
      
      const result = await response.json();
      
      if (eventTargetInfo.isEventTarget) {
        await EventTargetActivityLogger.create(
          patientId,
          result.patient.name,
          eventTargetInfo
        );
      } else {
        await EventTargetActivityLogger.delete(
          patientId,
          result.patient.name
        );
      }
      
      return {
        patientId,
        eventTargetInfo: result.eventTargetInfo,
        updatedPatient: result.patient
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : '이벤트 타겟 정보 업데이트 실패'
      );
    }
  }
);

// 이벤트 타겟 환자 필터링 액션
export const filterEventTargets = createAsyncThunk(
  'patients/filterEventTargets',
  async ({ categories, reasons }: { categories?: EventCategory[], reasons?: EventTargetReason[] }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      
      if (categories && categories.length > 0) {
        categories.forEach(cat => params.append('category', cat));
      }
      
      if (reasons && reasons.length > 0) {
        reasons.forEach(reason => params.append('reason', reason));
      }
      
      const response = await fetch(`/api/patients/event-targets/filter?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '이벤트 타겟 필터링에 실패했습니다.');
      }
      
      const filteredPatients = await response.json();
      return filteredPatients;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 🔥 신규 환자 등록 비동기 액션
export const createPatient = createAsyncThunk(
  'patients/createPatient',
  async (patientData: CreatePatientData, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const currentUser = state.auth.user;
      
      console.log('🔥 createPatient: 현재 사용자 정보:', currentUser);
      
      const userInfoHeader = currentUser ? 
        btoa(encodeURIComponent(JSON.stringify(currentUser))) : '';
      
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Info': userInfoHeader,
          // 🔥 성능 최적화 헤더 (속도개선 2 버전)
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(patientData),
        // 🔥 네트워크 최적화 옵션
        keepalive: true
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('🚨 createPatient: API 오류 응답:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          patientData: patientData
        });
        return rejectWithValue(errorData.error || '환자 생성에 실패했습니다.');
      }

      const result = await response.json();
      console.log('🔥 createPatient: 환자 생성 성공:', result);
      return result;
    } catch (error) {
      console.error('🚨 createPatient: 네트워크/기타 오류:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
        patientData: patientData,
        timestamp: new Date().toISOString()
      });
      return rejectWithValue('환자 생성 중 오류가 발생했습니다.');
    }
  }
);

// 🔥 환자 정보 수정 비동기 액션
export const updatePatient = createAsyncThunk(
  'patients/updatePatient',
  async ({ 
    patientId, 
    patientData 
  }: { 
    patientId: string, 
    patientData: UpdatePatientData 
  }, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { patients: PatientsState };
      const previousPatient = state.patients.patients.find(p => p._id === patientId || p.id === patientId);
      
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Skip-Activity-Log': 'true',
          // 🔥 성능 최적화 헤더 (속도개선 2 버전)
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(patientData),
        // 🔥 네트워크 최적화 옵션
        keepalive: true
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '환자 정보 수정에 실패했습니다.');
      }
      
      const updatedPatient = await response.json();
      
      if (previousPatient) {
        try {
          await PatientActivityLogger.update(
            updatedPatient.id || updatedPatient._id,
            updatedPatient.name,
            previousPatient,
            patientData
          );
          console.log('✅ 환자 정보 수정 로그 기록 완료');
        } catch (logError) {
          console.warn('⚠️ 활동 로그 기록 실패:', logError);
        }
      }
      
      return updatedPatient;
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 정보 수정에 실패했습니다.');
    }
  }
);

// 🔥 환자 삭제 액션
export const deletePatient = createAsyncThunk(
  'patients/deletePatient',
  async (patientId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { patients: PatientsState };
      const patientToDelete = state.patients.patients.find(p => p._id === patientId || p.id === patientId);
      
      console.log(`Redux: 환자 ID ${patientId} 삭제 시도`);
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'DELETE',
      });
      console.log(`API 응답 상태: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('삭제 실패 응답:', errorData);
        return rejectWithValue(errorData.error || '환자 삭제에 실패했습니다.');
      }
      if (patientToDelete) {
        await PatientActivityLogger.delete(
          patientToDelete.id,
          patientToDelete.name
        );
      }
      console.log('환자 삭제 성공');
      return patientId;
    } catch (error: any) {
      console.error('환자 삭제 오류:', error);
      return rejectWithValue(error.message || '환자 삭제에 실패했습니다.');
    }
  }
);

// 🔥 환자 종결 처리 액션
export const completePatient = createAsyncThunk(
  'patients/completePatient',
  async ({ 
    patientId, 
    reason 
  }: CompletePatientData, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { patients: PatientsState };
      const patient = state.patients.patients.find(p => p._id === patientId || p.id === patientId);
      
      const response = await fetch(`/api/patients/${patientId}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '환자 종결 처리에 실패했습니다.');
      }
      
      const result = await response.json();
      
      if (patient) {
        await PatientActivityLogger.complete(
          patient.id,
          patient.name,
          reason
        );
      }
      
      return { 
        patientId, 
        updatedPatient: result.updatedPatient,
        callbackHistory: result.callbackHistory || [], 
        isReservationCompletion: result.isReservationCompletion
      };
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 종결 처리에 실패했습니다.');
    }
  }
);

// 🔥 환자 종결 취소 액션
export const cancelPatientCompletion = createAsyncThunk(
  'patients/cancelPatientCompletion',
  async (patientId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { patients: PatientsState };
      const patient = state.patients.patients.find(p => p._id === patientId || p.id === patientId);
      
      const response = await fetch(`/api/patients/${patientId}/cancel-completion`, {
        method: 'PUT',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '환자 종결 취소에 실패했습니다.');
      }
      
      const result = await response.json();
      
      if (patient) {
        await PatientActivityLogger.cancelComplete(
          patient.id,
          patient.name
        );
      }
      
      return { patientId, updatedPatient: result };
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 종결 취소에 실패했습니다.');
    }
  }
);

// 🔥 콜백 추가 비동기 액션 - 새로운 상태 관리 지원
export const addCallback = createAsyncThunk(
  'patients/addCallback',
  async ({ 
    patientId, 
    callbackData 
  }: { 
    patientId: string, 
    callbackData: Omit<CallbackItem, 'id'> 
  }, { rejectWithValue, getState }) => {
    try {
      console.log(`콜백 추가 시도: 환자 ID = ${patientId}, 데이터:`, callbackData);
      
      if (!patientId) {
        console.error('환자 ID가 undefined입니다!');
        return rejectWithValue('환자 ID가 없습니다.');
      }
      
      const state = getState() as { patients: PatientsState };
      const patient = state.patients.patients.find(p => p._id === patientId || p.id === patientId);
      
      // 🔥 1차 콜백이고 상담 내용이 비어있는 경우, 견적정보 상담메모를 자동 연동
      let finalCallbackData = { ...callbackData };
      
      if (patient && callbackData.type === '1차' && (!callbackData.notes || callbackData.notes.trim() === '')) {
        const consultationNotes = patient.consultation?.consultationNotes;
        
        if (consultationNotes && consultationNotes.trim() !== '') {
          finalCallbackData.notes = consultationNotes;
          console.log('🔥 Redux: 1차 콜백에 견적정보 상담메모 자동 연동:', {
            patientName: patient.name,
            consultationNotes: consultationNotes.substring(0, 50) + '...'
          });
        }
      }
      
      const response = await fetch(`/api/patients/${patientId}/callbacks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalCallbackData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('콜백 추가 실패 응답:', errorData);
        return rejectWithValue(errorData.error || '콜백 추가에 실패했습니다.');
      }
      
      const updatedPatient = await response.json();
      console.log('콜백 추가 성공. 업데이트된 환자:', updatedPatient);
      
      if (patient) {
        await CallbackActivityLogger.create(
          patient.id,
          patient.name,
          finalCallbackData
        );
      }
      
      return { patientId, updatedPatient };
    } catch (error) {
      console.error('[addCallback] 오류 발생:', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message || '콜백 추가에 실패했습니다.');
      }
      return rejectWithValue('콜백 추가에 실패했습니다.');
    }
  }
);

// 🔥 콜백 취소 액션
export const cancelCallback = createAsyncThunk(
  'patients/cancelCallback',
  async ({ 
    patientId, 
    callbackId,
    cancelReason
  }: { 
    patientId: string,
    callbackId: string,
    cancelReason?: string
  }, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { patients: PatientsState };
      const patient = state.patients.patients.find(p => p._id === patientId || p.id === patientId);
      
      const response = await fetch(`/api/patients/${patientId}/callbacks/${callbackId}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cancelReason }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '콜백 취소에 실패했습니다.');
      }
      
      const updatedPatient = await response.json();
      
      if (patient) {
        await CallbackActivityLogger.cancel(
          patient.id,
          patient.name,
          callbackId,
          cancelReason || '사유 없음'
        );
      }
      
      return { patientId, updatedPatient };
    } catch (error: any) {
      return rejectWithValue(error.message || '콜백 취소에 실패했습니다.');
    }
  }
);

// 🔥 콜백 삭제 액션
export const deleteCallback = createAsyncThunk(
  'patients/deleteCallback',
  async ({ 
    patientId, 
    callbackId 
  }: { 
    patientId: string,
    callbackId: string
  }, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { patients: PatientsState };
      const patient = state.patients.patients.find(p => p._id === patientId || p.id === patientId);
      
      const response = await fetch(`/api/patients/${patientId}/callbacks/${callbackId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '콜백 삭제에 실패했습니다.');
      }
      
      const result = await response.json();
      
      if (patient) {
        await CallbackActivityLogger.delete(
          patient.id,
          patient.name,
          callbackId
        );
      }
      
      return { 
        patientId, 
        updatedPatient: result.updatedPatient,
        deletedCallbackInfo: result.deletedCallbackInfo
      };
    } catch (error: any) {
      return rejectWithValue(error.message || '콜백 삭제에 실패했습니다.');
    }
  }
);

// 🔥 콜백 업데이트 액션 추가 - 새로운 상태 관리 지원
export const updateCallback = createAsyncThunk(
  'patients/updateCallback',
  async ({ 
    patientId, 
    callbackId,
    updateData 
  }: { 
    patientId: string,
    callbackId: string,
    updateData: Partial<CallbackItem>
  }, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { patients: PatientsState };
      const patient = state.patients.patients.find(p => p._id === patientId || p.id === patientId);
      
      // 🔥 기존 콜백 데이터 가져오기 (activityLogger에 필요)
      const existingCallback = patient?.callbackHistory?.find(cb => cb.id === callbackId);
      
      console.log('🔥 Redux: 콜백 업데이트 시작:', {
        patientId,
        callbackId,
        updateData,
        existingCallback: existingCallback ? {
          type: existingCallback.type,
          date: existingCallback.date,
          status: existingCallback.status
        } : null
      });
      
      // 🔥 PUT 요청에 callbackId를 쿼리 파라미터로 전달
      const response = await fetch(`/api/patients/${patientId}/callbacks?callbackId=${callbackId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('콜백 업데이트 API 에러:', errorData);
        return rejectWithValue(errorData.error || '콜백 업데이트에 실패했습니다.');
      }
      
      const updatedPatient = await response.json();
      
      console.log('🔥 Redux: 콜백 업데이트 성공:', {
        patientName: updatedPatient.name,
        callbackId,
        updateType: updateData.status ? '상태 변경' : '정보 수정'
      });
      
      // 🔥 활동 로그 기록 - 5개 인자 모두 전달
      if (patient && existingCallback) {
        try {
          await CallbackActivityLogger.update(
            patient.id,
            patient.name,
            callbackId,
            existingCallback,
            updateData
          );
          console.log('✅ 콜백 업데이트 활동 로그 기록 성공');
        } catch (logError) {
          console.warn('⚠️ 콜백 업데이트 활동 로그 기록 실패:', logError);
        }
      }
      
      return { patientId, updatedPatient };
    } catch (error: any) {
      console.error('Redux: 콜백 업데이트 네트워크 에러:', error);
      return rejectWithValue(error.message || '콜백 업데이트에 실패했습니다.');
    }
  }
);

// 필터 적용 헬퍼 함수
function applyFilters(state: PatientsState) {
  let filtered = [...state.patients];
  
  const { status, interestArea, searchTerm, consultationType, referralSource, visitStatus } = state.filters;
  
  if (status !== 'all') {
    filtered = filtered.filter(patient => patient.status === status);
  }
  
  if (interestArea !== 'all') {
    filtered = filtered.filter(patient => 
      patient.interestedServices.includes(interestArea)
    );
  }
  
  if (consultationType !== 'all') {
    filtered = filtered.filter(patient => patient.consultationType === consultationType);
  }
  
  if (referralSource !== 'all') {
    filtered = filtered.filter(patient => patient.referralSource === referralSource);
  }
  
  // 🔥 내원 상태 기준 필터링
  if (visitStatus !== 'all') {
    if (visitStatus === 'visit_confirmed') {
      filtered = filtered.filter(patient => patient.visitConfirmed === true);
    } else if (visitStatus === 'post_visit_needed') {
      filtered = filtered.filter(patient => 
        patient.visitConfirmed === true && 
        patient.postVisitStatus === '재콜백필요'
      );
    }
  }
  
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(patient => 
      patient.name.toLowerCase().includes(term) || 
      patient.phoneNumber.includes(term) ||
      (patient.notes && patient.notes.toLowerCase().includes(term))
    );
  }
  
  state.filteredPatients = filtered;
  state.pagination.totalPages = Math.ceil(filtered.length / state.pagination.itemsPerPage);
  state.pagination.currentPage = 1;
}

// src/store/slices/patientsSlice.ts - selectPatient 액션 오버로드 수정

const patientsSlice = createSlice({
  name: 'patients',
  initialState,
  reducers: {
    // 🔧 selectPatient 액션을 오버로드 방식으로 수정 (기존 호환성 유지)
    selectPatient: (state, action: PayloadAction<string | { 
      patientId: string; 
      context?: 'management' | 'visit-management' 
    }>) => {
      // 문자열인 경우 (기존 방식)
      if (typeof action.payload === 'string') {
        const patientId = action.payload;
        console.log('환자 선택 시도 (기존 방식):', patientId);
        
        const updatedPatient = state.patients.find(
          (patient) => patient._id === patientId || patient.id === patientId
        );
        
        if (updatedPatient) {
          console.log('환자 찾음:', updatedPatient);
          // 🔥 임시 데이터인 경우 선택하지 않음 (실제 데이터 대기)
          if (updatedPatient.isTemporary) {
            console.warn('임시 환자 데이터는 선택할 수 없습니다. 실제 데이터 대기 중...');
            state.selectedPatient = null;
            state.modalContext = null;
          } else {
            state.selectedPatient = updatedPatient;
            state.modalContext = null; // 기본값
          }
        } else {
          console.error('환자를 찾을 수 없음:', patientId);
          state.selectedPatient = null;
          state.modalContext = null;
        }
      } else {
        // 객체인 경우 (새로운 방식)
        const { patientId, context } = action.payload;
        console.log('환자 선택 시도 (새로운 방식):', patientId, 'context:', context);
        
        const updatedPatient = state.patients.find(
          (patient) => patient._id === patientId || patient.id === patientId
        );
        
        if (updatedPatient) {
          console.log('환자 찾음:', updatedPatient);
          // 🔥 임시 데이터인 경우 선택하지 않음 (실제 데이터 대기)
          if (updatedPatient.isTemporary) {
            console.warn('임시 환자 데이터는 선택할 수 없습니다. 실제 데이터 대기 중...');
            state.selectedPatient = null;
            state.modalContext = null;
          } else {
            state.selectedPatient = updatedPatient;
            state.modalContext = context || null;
          }
        } else {
          console.error('환자를 찾을 수 없음:', patientId);
          state.selectedPatient = null;
          state.modalContext = null;
        }
      }
    },

    setSelectedPatient: (state, action: PayloadAction<Patient>) => {
      state.selectedPatient = action.payload;
    },

    clearSelectedPatient: (state) => {
      state.selectedPatient = null;
      state.modalContext = null; 
    },
    setFilters: (state, action: PayloadAction<Partial<PatientsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      applyFilters(state);
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.currentPage = action.payload;
    },
    clearFilteredPatients: (state) => {
      state.filteredPatientsForModal = [];
      state.modalFilterType = null;
    },

    updatePatientField: (state, action: PayloadAction<{
      id: string;
      field: string;
      value: any;
    }>) => {
      const { id, field, value } = action.payload;
      const updatePatientInArray = (patients: Patient[]) => {
        const patient = patients.find(p => p._id === id || p.id === id);
        if (patient) {
          // 중첩된 필드 업데이트 지원 (예: 'postVisitConsultation.firstVisitConsultationContent')
          const fieldPath = field.split('.');
          let target: any = patient;
          for (let i = 0; i < fieldPath.length - 1; i++) {
            if (!target[fieldPath[i]]) target[fieldPath[i]] = {};
            target = target[fieldPath[i]];
          }
          target[fieldPath[fieldPath.length - 1]] = value;
          }
        };
      }
    },
  
  extraReducers: (builder) => {
    builder
    // 🔥 예약 후 미내원 환자 자동 분류 처리
    .addCase(updatePostReservationPatients.pending, (state) => {
      state.error = null;
    })
    .addCase(updatePostReservationPatients.fulfilled, (state, action: PayloadAction<Patient[]>) => {
      const updatedPatients = action.payload;
      
      // patients 배열에서 해당 환자들 업데이트
      updatedPatients.forEach(updatedPatient => {
        const patientIndex = state.patients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (patientIndex !== -1) {
          state.patients[patientIndex] = updatedPatient;
        }
        
        // filteredPatients 배열에서도 업데이트
        const filteredIndex = state.filteredPatients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = updatedPatient;
        }
      });
      
      console.log('예약 후 미내원 환자 자동 분류 완료:', updatedPatients.length, '명');
    })
    .addCase(updatePostReservationPatients.rejected, (state, action) => {
      state.error = action.payload as string;
    })
    
    // resetPostVisitData 처리 케이스들을 extraReducers 빌더에 추가:
    .addCase(resetPostVisitData.pending, (state) => {
      state.error = null;
    })
    .addCase(resetPostVisitData.fulfilled, (state, action: PayloadAction<Patient>) => {
      const updatedPatient = action.payload;
      
      // patients 배열에서 해당 환자 업데이트
      const patientIndex = state.patients.findIndex(p => 
        p._id === updatedPatient._id || p.id === updatedPatient.id
      );
      if (patientIndex !== -1) {
        state.patients[patientIndex] = updatedPatient;
      }
      
      // filteredPatients 배열에서도 업데이트
      const filteredIndex = state.filteredPatients.findIndex(p => 
        p._id === updatedPatient._id || p.id === updatedPatient.id
      );
      if (filteredIndex !== -1) {
        state.filteredPatients[filteredIndex] = updatedPatient;
      }
      
      // postVisitPatients 배열에서 제거 (더 이상 내원 후 관리 대상이 아님)
      state.postVisitPatients = state.postVisitPatients.filter(p => 
        p._id !== updatedPatient._id && p.id !== updatedPatient.id
      );
      
      // eventTargetPatients 배열에서도 업데이트 (이벤트 타겟인 경우)
      const eventTargetIndex = state.eventTargetPatients.findIndex(p => 
        p._id === updatedPatient._id || p.id === updatedPatient.id
      );
      if (eventTargetIndex !== -1) {
        state.eventTargetPatients[eventTargetIndex] = updatedPatient;
      }
      
      // selectedPatient도 업데이트 (현재 선택된 환자라면)
      if (state.selectedPatient && 
          (state.selectedPatient._id === updatedPatient._id || 
          state.selectedPatient.id === updatedPatient.id)) {
        state.selectedPatient = updatedPatient;
      }
      
      console.log('Redux: 내원 후 상태 초기화 상태 업데이트 완료:', {
        patientId: updatedPatient._id,
        name: updatedPatient.name,
        postVisitStatus: updatedPatient.postVisitStatus,
        hasPostVisitConsultation: !!updatedPatient.postVisitConsultation
      });
    })
    .addCase(resetPostVisitData.rejected, (state, action) => {
      state.error = action.payload as string;
      console.error('내원 후 상태 초기화 실패:', action.payload);
    })
      // 🔥 내원 후 관리 환자 목록 가져오기 처리
      .addCase(fetchPostVisitPatients.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPostVisitPatients.fulfilled, (state, action: PayloadAction<Patient[]>) => {
        state.isLoading = false;
        state.postVisitPatients = action.payload;
        console.log('내원 후 관리 환자 목록 로드 완료:', action.payload.length);
      })
      .addCase(fetchPostVisitPatients.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // extraReducers 섹션에 추가할 케이스들:
      .addCase(updateConsultationInfo.pending, (state) => {
        state.error = null;
      })
      .addCase(updateConsultationInfo.fulfilled, (state, action: PayloadAction<Patient>) => {
        const updatedPatient = action.payload;
        
        // 🔥 patients 배열에서 해당 환자 업데이트
        const patientIndex = state.patients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (patientIndex !== -1) {
          state.patients[patientIndex] = updatedPatient;
        }
        
        // 🔥 filteredPatients 배열에서도 업데이트
        const filteredIndex = state.filteredPatients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = updatedPatient;
        }
        
        // 🔥 eventTargetPatients 배열에서도 업데이트 (이벤트 타겟인 경우)
        const eventTargetIndex = state.eventTargetPatients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (eventTargetIndex !== -1) {
          state.eventTargetPatients[eventTargetIndex] = updatedPatient;
        }
        
        // 🔥 postVisitPatients 배열에서도 업데이트 (내원 후 환자인 경우)
        const postVisitIndex = state.postVisitPatients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (postVisitIndex !== -1) {
          state.postVisitPatients[postVisitIndex] = updatedPatient;
        }
        
        // 🔥 selectedPatient도 업데이트 (현재 선택된 환자라면)
        if (state.selectedPatient && 
            (state.selectedPatient._id === updatedPatient._id || 
            state.selectedPatient.id === updatedPatient.id)) {
          state.selectedPatient = updatedPatient;
        }
        
        console.log('🔥 Redux: 상담 정보 업데이트 완료:', {
          patientId: updatedPatient._id,
          name: updatedPatient.name,
          estimateAgreed: updatedPatient.consultation?.estimateAgreed
        });
      })
      .addCase(updateConsultationInfo.rejected, (state, action) => {
        state.error = action.payload as string;
        console.error('상담 정보 업데이트 실패:', action.payload);
      })

      // 🔥 내원 후 상태 업데이트 처리
      .addCase(updatePostVisitStatus.pending, (state) => {
        state.error = null;
      })
      .addCase(updatePostVisitStatus.fulfilled, (state, action: PayloadAction<Patient>) => {
        const updatedPatient = action.payload;
        
        const patientIndex = state.patients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (patientIndex !== -1) {
          state.patients[patientIndex] = updatedPatient;
        }
        
        const filteredIndex = state.filteredPatients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = updatedPatient;
        }
        
        const postVisitIndex = state.postVisitPatients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (postVisitIndex !== -1) {
          state.postVisitPatients[postVisitIndex] = updatedPatient;
        } else {
          if (updatedPatient.visitConfirmed && updatedPatient.postVisitStatus) {
            state.postVisitPatients.push(updatedPatient);
          }
        }
        
        if (state.selectedPatient && 
            (state.selectedPatient._id === updatedPatient._id || 
             state.selectedPatient.id === updatedPatient.id)) {
          state.selectedPatient = updatedPatient;
        }
        
        console.log('내원 후 상태 업데이트 완료:', {
          patientId: updatedPatient._id,
          name: updatedPatient.name,
          postVisitStatus: updatedPatient.postVisitStatus
        });
      })
      .addCase(updatePostVisitStatus.rejected, (state, action) => {
        state.error = action.payload as string;
        console.error('내원 후 상태 업데이트 실패:', action.payload);
      })
      
      // 환자 목록 가져오기 처리
      .addCase(fetchPatients.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPatients.fulfilled, (state, action: PayloadAction<{ patients: Patient[], totalItems: number }>) => {
        state.isLoading = false;
        
        // 🔥 프론트엔드에서도 최신순 정렬 보장
        const sortedPatients = action.payload.patients.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.callInDate).getTime();
          const dateB = new Date(b.createdAt || b.callInDate).getTime();
          return dateB - dateA; // 최신순 (내림차순)
        });
        
        state.patients = sortedPatients;
        state.filteredPatients = sortedPatients;
        state.pagination.totalItems = action.payload.totalItems;
        state.pagination.totalPages = Math.ceil(action.payload.totalItems / state.pagination.itemsPerPage) || 1;
        console.log('fetchPatients 완료 - 환자 수:', action.payload.patients.length);
      })
      
      // 내원확정 토글 처리
      .addCase(toggleVisitConfirmation.fulfilled, (state, action: PayloadAction<Patient>) => {
        const updatedPatient = action.payload;
        
        const patientIndex = state.patients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (patientIndex !== -1) {
          state.patients[patientIndex] = updatedPatient;
        }
        
        const filteredIndex = state.filteredPatients.findIndex(p => 
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = updatedPatient;
        }
        
        if (state.selectedPatient && 
            (state.selectedPatient._id === updatedPatient._id || 
             state.selectedPatient.id === updatedPatient.id)) {
          state.selectedPatient = updatedPatient;
        }
        
        console.log('내원확정 상태 업데이트 완료:', {
          patientId: updatedPatient._id,
          name: updatedPatient.name,
          visitConfirmed: updatedPatient.visitConfirmed
        });
      })

      // extraReducers 섹션에 추가
      .addCase(updateCallback.fulfilled, (state, action) => {
        const { patientId, updatedPatient } = action.payload;

        console.log('🔥 Redux: updateCallback.fulfilled - 환자 상태 업데이트:', {
          patientId: patientId,
          patientName: updatedPatient.name,
          newStatus: updatedPatient.status,
          callbackCount: updatedPatient.callbackHistory?.length
        });
        
        const patientIndex = state.patients.findIndex(p => 
          p._id === patientId || p.id === patientId
        );
        if (patientIndex !== -1) {
          state.patients[patientIndex] = updatedPatient;
        }
        
        const filteredIndex = state.filteredPatients.findIndex(p => 
          p._id === patientId || p.id === patientId
        );
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = updatedPatient;
        }
        
        if (state.selectedPatient && 
            (state.selectedPatient._id === patientId || 
            state.selectedPatient.id === patientId)) {
          state.selectedPatient = updatedPatient;
        }
      })
      
      // 🔥 이벤트 타겟 초기화 처리 - 추가된 부분
      .addCase(initializeEventTargets.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        console.log('이벤트 타겟 초기화 대기 중...');
      })
      .addCase(initializeEventTargets.fulfilled, (state, action: PayloadAction<Patient[]>) => {
        state.isLoading = false;
        state.eventTargetPatients = action.payload;
        console.log('Redux: 이벤트 타겟 환자 상태 업데이트 완료:', {
          count: action.payload.length,
          patients: action.payload.map(p => ({ id: p.id, name: p.name, isEventTarget: p.eventTargetInfo?.isEventTarget }))
        });
      })
      .addCase(initializeEventTargets.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
        state.eventTargetPatients = [];
        console.error('이벤트 타겟 초기화 실패:', action.payload);
      })
      
      // 🔥 이벤트 타겟 정보 업데이트 처리 - 수정된 부분
      .addCase(updateEventTargetInfo.fulfilled, (state, action) => {
        const { patientId, eventTargetInfo, updatedPatient } = action.payload;
        
        // patients 배열에서 해당 환자 업데이트
        const patientIndex = state.patients.findIndex(p => 
          p._id === patientId || p.id === patientId
        );
        if (patientIndex !== -1) {
          state.patients[patientIndex] = updatedPatient;
        }
        
        // filteredPatients 배열에서도 업데이트
        const filteredIndex = state.filteredPatients.findIndex(p => 
          p._id === patientId || p.id === patientId
        );
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = updatedPatient;
        }
        
        // eventTargetPatients 배열 업데이트
        if (eventTargetInfo.isEventTarget) {
          // 이벤트 타겟으로 설정된 경우 추가 또는 업데이트
          const eventTargetIndex = state.eventTargetPatients.findIndex(p => 
            p._id === patientId || p.id === patientId
          );
          
          if (eventTargetIndex !== -1) {
            // 이미 존재하면 업데이트
            state.eventTargetPatients[eventTargetIndex] = updatedPatient;
          } else {
            // 새로 추가
            state.eventTargetPatients.push(updatedPatient);
          }
        } else {
          // 이벤트 타겟에서 제거된 경우
          state.eventTargetPatients = state.eventTargetPatients.filter(p => 
            p._id !== patientId && p.id !== patientId
          );
        }
        
        // selectedPatient 업데이트
        if (state.selectedPatient && 
            (state.selectedPatient._id === patientId || state.selectedPatient.id === patientId)) {
          state.selectedPatient = updatedPatient;
        }
        
        console.log('이벤트 타겟 정보 업데이트 완료:', {
          patientId,
          isEventTarget: eventTargetInfo.isEventTarget,
          eventTargetPatientsCount: state.eventTargetPatients.length
        });
      })
      
      // 환자 생성 처리
      .addCase(createPatient.fulfilled, (state, action: PayloadAction<Patient>) => {
        const newPatient = action.payload;
        
        // 🔥 최상단에 추가 (기존 unshift 방식 유지)
        state.patients.unshift(newPatient);
        state.filteredPatients.unshift(newPatient);
        
        // 🔥 혹시 몰라서 한 번 더 정렬 (안전장치)
        state.patients.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.callInDate).getTime();
          const dateB = new Date(b.createdAt || b.callInDate).getTime();
          return dateB - dateA;
        });
        
        state.filteredPatients.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.callInDate).getTime();
          const dateB = new Date(b.createdAt || b.callInDate).getTime();
          return dateB - dateA;
        });
        
        state.pagination.totalItems += 1;
        state.pagination.totalPages = Math.ceil(state.pagination.totalItems / state.pagination.itemsPerPage);
      })
      
      // 환자 정보 수정 처리
      .addCase(updatePatient.fulfilled, (state, action: PayloadAction<Patient>) => {
        const updatedPatient = action.payload;

        // 🔥 patients 배열 업데이트
        const patientIndex = state.patients.findIndex(p =>
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (patientIndex !== -1) {
          state.patients[patientIndex] = updatedPatient;
        }

        // 🔥 filteredPatients 배열 업데이트
        const filteredIndex = state.filteredPatients.findIndex(p =>
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = updatedPatient;
        }

        // 🔥 postVisitPatients 배열 업데이트 (내원관리 페이지 반영)
        const postVisitIndex = state.postVisitPatients.findIndex(p =>
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (postVisitIndex !== -1) {
          state.postVisitPatients[postVisitIndex] = updatedPatient;
        }

        // 🔥 eventTargetPatients 배열 업데이트 (이벤트 타겟 페이지 반영)
        const eventTargetIndex = state.eventTargetPatients.findIndex(p =>
          p._id === updatedPatient._id || p.id === updatedPatient.id
        );
        if (eventTargetIndex !== -1) {
          state.eventTargetPatients[eventTargetIndex] = updatedPatient;
        }

        // 🔥 selectedPatient 업데이트
        if (state.selectedPatient &&
            (state.selectedPatient._id === updatedPatient._id ||
             state.selectedPatient.id === updatedPatient.id)) {
          state.selectedPatient = updatedPatient;
        }
      })
      
      // 환자 삭제 처리
      .addCase(deletePatient.fulfilled, (state, action: PayloadAction<string>) => {
        const deletedPatientId = action.payload;
        
        state.patients = state.patients.filter(p => 
          p._id !== deletedPatientId && p.id !== deletedPatientId
        );
        state.filteredPatients = state.filteredPatients.filter(p => 
          p._id !== deletedPatientId && p.id !== deletedPatientId
        );
        state.eventTargetPatients = state.eventTargetPatients.filter(p => 
          p._id !== deletedPatientId && p.id !== deletedPatientId
        );
        
        if (state.selectedPatient && 
            (state.selectedPatient._id === deletedPatientId || 
             state.selectedPatient.id === deletedPatientId)) {
          state.selectedPatient = null;
        }
        
        state.pagination.totalItems -= 1;
        state.pagination.totalPages = Math.ceil(state.pagination.totalItems / state.pagination.itemsPerPage);
      })
      
      // 콜백 추가 처리
      .addCase(addCallback.fulfilled, (state, action) => {
        const { patientId, updatedPatient } = action.payload;
        
        const patientIndex = state.patients.findIndex(p => 
          p._id === patientId || p.id === patientId
        );
        if (patientIndex !== -1) {
          state.patients[patientIndex] = updatedPatient;
        }
        
        const filteredIndex = state.filteredPatients.findIndex(p => 
          p._id === patientId || p.id === patientId
        );
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = updatedPatient;
        }
        
        if (state.selectedPatient && 
            (state.selectedPatient._id === patientId || 
             state.selectedPatient.id === patientId)) {
          state.selectedPatient = updatedPatient;
        }
      })

      // 🔥 필터된 환자 목록 가져오기 처리
      .addCase(fetchFilteredPatients.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFilteredPatients.fulfilled, (state, action: PayloadAction<{
        patients: Patient[];
        filterType: PatientFilterType;
      }>) => {
        state.isLoading = false;
        state.filteredPatientsForModal = action.payload.patients;
        state.modalFilterType = action.payload.filterType;
        console.log('필터된 환자 목록 상태 업데이트 완료:', action.payload.patients.length, '명');
      })
      .addCase(fetchFilteredPatients.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
        state.filteredPatientsForModal = [];
        state.modalFilterType = null;
      });
  },
});

export const selectPatientWithContext = (
  patientId: string, 
  context?: 'management' | 'visit-management'
) => selectPatient({ patientId, context });

export const { selectPatient, setSelectedPatient, clearSelectedPatient, setFilters, setPage, clearFilteredPatients, updatePatientField } = patientsSlice.actions;
export default patientsSlice.reducer;

