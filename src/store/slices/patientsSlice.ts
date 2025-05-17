//src/store/slices/patientsSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// 이벤트 타겟 사유 타입
export type EventTargetReason = 
  | 'price_hesitation'    // 가격 망설임
  | 'treatment_consideration' // 치료 방법 고민
  | 'scheduling_issue'    // 시간 조율 필요
  | 'competitor_comparison' // 경쟁업체 비교 중
  | 'other'              // 기타 (직접 입력)
  | '';

// 이벤트 카테고리 타입
export type EventCategory = 
  | 'discount'         // 할인 프로모션
  | 'new_treatment'    // 신규 치료법 안내
  | 'checkup'          // 정기 검진 리마인더
  | 'seasonal'         // 계절 이벤트
  | '';

// 이벤트 타겟 정보 타입
export interface EventTargetInfo {
  isEventTarget: boolean;          // 이벤트 타겟 여부
  targetReason: EventTargetReason; // 타겟 사유 (선택)
  customTargetReason?: string;     // 직접 입력한 타겟 사유 (기타 선택 시)
  categories: EventCategory[];     // 이벤트 카테고리 (다중 선택)
  scheduledDate?: string;          // 발송 가능 시기
  notes?: string;                  // 메모
  createdAt?: string;               // 타겟 지정 일시
  updatedAt?: string;               // 마지막 수정 일시
}

// 환자 상태 타입 정의
export type PatientStatus = 
  | '잠재고객'
  | '콜백필요'
  | '부재중'
  | '활성고객'
  | 'VIP'
  | '예약확정'  // 예약 확정된 환자
  | '종결';     // 일반 종결된 환자

// 리마인드 콜 상태 타입 정의
export type ReminderStatus = 
  | '초기'
  | '1차'
  | '2차'
  | '3차'
  | '4차'  // 추가
  | '5차'  // 추가
  | '-';

// 콜백 상태 타입 정의
export type CallbackStatus = 
  | '예정'
  | '완료'
  | '취소'
  | '종결'
  | '부재중'  
  | '예약확정';  // 이 부분을 추가

// 콜백 아이템 타입 정의
export interface CallbackItem {
  completedAt?: string;  // 선택적 필드로 변경 (물음표 추가)
  time: string | undefined; 
  id: string;
  date: string;
  status: CallbackStatus;
  notes?: string;          
  resultNotes?: string;   
  customerResponse?: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  type: '1차' | '2차' | '3차' | '4차' | '5차';
  cancelReason?: string;
  cancelDate?: string;
  isCompletionRecord?: boolean;
  nextStep?: '2차_콜백' | '3차_콜백' | '4차_콜백' | '5차_콜백' | '예약_확정' | '종결_처리' | '';
}

// 종결 처리를 위한 타입 정의
export interface CompletePatientData {
  patientId: string;
  reason: string;
}

// 환자 타입 정의
export interface Patient {
  nextCallbackDate: string;
  id: string;
  patientId: string; // PT-XXXX 형식
  name: string;
  phoneNumber: string;
  interestedServices: string[];
  lastConsultation: string; // YYYY-MM-DD 형식
  status: PatientStatus;
  reminderStatus: ReminderStatus;
  notes?: string;
  callInDate: string;
  firstConsultDate: string;
  callbackHistory?: CallbackItem[];
  age?: number;
  region?: {
    province: string; // 시/도
    city?: string; // 시/군/구
  };
  createdAt: string;
  updatedAt: string;
  isCompleted?: boolean; // 종결 처리 여부
  visitConfirmed?: boolean; // 내원 확정 필드 추가
  completedAt?: string; // 종결 처리 일자
  completedReason?: string; // 종결 사유
  eventTargetInfo?: EventTargetInfo; 
}

// 환자 생성을 위한 타입
export interface CreatePatientData {
  name: string;
  phoneNumber: string;
  status: PatientStatus;
  interestedServices: string[];
  memo?: string;
  callInDate: string;
  firstConsultDate?: string;
  age?: number;
  region?: {
    province: string; // 시/도
    city?: string; // 시/군/구
  };
}

// 환자 수정을 위한 타입
export interface UpdatePatientData {
  name?: string;
  phoneNumber?: string;
  status?: PatientStatus;
  interestedServices?: string[];
  notes?: string;
  callInDate?: string;
  firstConsultDate?: string;
  age?: number;
  region?: {
    province: string;
    city?: string;
  };
  reminderStatus?: ReminderStatus; // 리마인더 상태 필드 추가
  isCompleted?: boolean; // 종결 처리 여부 필드 추가
  completedAt?: string; // 종결 처리 일자 필드 추가
  completedReason?: string; // 종결 사유 필드 추가
  callbackHistory?: CallbackItem[];
}



// LocalStorage에서 환자 데이터 불러오기
const loadPatientsFromStorage = (): Patient[] => {
  if (typeof window === 'undefined') return []; // 빈 배열 반환
  
  try {
    const storedPatients = localStorage.getItem('patients');
    if (storedPatients) {
      const parsedPatients = JSON.parse(storedPatients);
      
      // 디버깅용 로그
      console.log('로컬 스토리지에서 환자 데이터 로드:', parsedPatients.length, '명');
      console.log('이벤트 타겟 환자 수:', 
        parsedPatients.filter((p: Patient) => p.eventTargetInfo?.isEventTarget === true).length
      );
      
      return parsedPatients;
    }
    
    // 저장된 데이터가 없으면 빈 배열 반환
    return [];
  } catch (error) {
    console.error('LocalStorage에서 데이터를 불러오는데 실패했습니다:', error);
    return []; // 오류 시 빈 배열 반환
  }
};

// LocalStorage에 환자 데이터 저장
const savePatientsToStorage = (patients: Patient[]) => {
  if (typeof window === 'undefined') return;
  
  try {
    // 저장 전 환자 상태 로깅
    console.log('[localStorage] 저장 전 환자 상태 샘플:', 
      patients.slice(0, 3).map(p => ({ id: p.id, name: p.name, status: p.status }))
    );
    
    localStorage.setItem('patients', JSON.stringify(patients));
    console.log('[localStorage] 환자 데이터 저장 완료');
    
    // 저장 후 확인
    const saved = localStorage.getItem('patients');
    const parsed = JSON.parse(saved || '[]');
    console.log('[localStorage] 저장 후 검증 샘플:', 
      parsed.slice(0, 3).map((p: any) => ({ id: p.id, name: p.name, status: p.status }))
    );
  } catch (error) {
    console.error('LocalStorage에 데이터를 저장하는데 실패했습니다:', error);
  }
};

export interface PatientsState {
  patients: Patient[];            // 모든 환자 목록 (allPatients 대신 이 필드 사용)
  filteredPatients: Patient[];    // 필터링된 환자 목록
  selectedPatient: Patient | null; // 현재 선택된 환자
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
  };
  isLoading: boolean;
  error: string | null;
  eventTargetPatients: Patient[];  // 이벤트 타겟 환자 목록
}

// 2. 초기 상태 정의
const initialState: PatientsState = {
  patients: [], // 빈 배열로 초기화 - loadPatientsFromStorage() 대신
  filteredPatients: [], // 빈 배열로 초기화
  selectedPatient: null,
  pagination: {
    currentPage: 1,
    totalPages: 0, // 페이지도 0으로 시작
    itemsPerPage: 10,
    totalItems: 0
  },
  filters: {
    searchTerm: '',
    status: 'all',
    interestArea: 'all'
  },
  isLoading: true,
  error: null,
  eventTargetPatients: []
};


// 환자 목록 가져오기 비동기 액션
export const fetchPatients = createAsyncThunk(
  'patients/fetchPatients',
  async (_, { rejectWithValue }) => {
    try {
      // 클라이언트 사이드에서만 로컬스토리지 접근
      if (typeof window === 'undefined') {
        return {
          patients: [],
          totalItems: 0
        };
      }
      
      // LocalStorage에서 환자 데이터 불러오기
      const patients = loadPatientsFromStorage();
      
      return {
        patients,
        totalItems: patients.length,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 목록을 불러오는데 실패했습니다.');
    }
  }
);

// 앱 시작 시 이벤트 타겟 정보 로드를 위한 액션 추가
export const initializeEventTargets = createAsyncThunk(
  'patients/initializeEventTargets',
  async (_, { getState }) => {
    try {
      // 현재 로컬 스토리지에서 로드된 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const allPatients = state.patients.patients;
      
      // 이벤트 타겟으로 지정된 환자만 필터링
      const eventTargetPatients = allPatients.filter(patient => 
        patient.eventTargetInfo?.isEventTarget === true
      );
      
      console.log('이벤트 타겟 초기화:', eventTargetPatients.length, '명의 환자 로드됨');
      
      return eventTargetPatients;
    } catch (error) {
      console.error('이벤트 타겟 초기화 오류:', error);
      throw error;
    }
  }
);

// 이벤트 타겟 설정 액션
export const updateEventTargetInfo = createAsyncThunk(
  'patients/updateEventTargetInfo',
  async ({ patientId, eventTargetInfo }: { patientId: string, eventTargetInfo: Partial<EventTargetInfo> }, { getState, rejectWithValue }) => {
    try {
      // 현재 목업 데이터로 동작
      const now = new Date().toISOString();
      
      // 현재 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const allPatients = [...state.patients.patients];
      
      // 해당 환자 찾기
      const patientIndex = allPatients.findIndex(p => p.id === patientId);
      
      if (patientIndex === -1) {
        return rejectWithValue('환자를 찾을 수 없습니다.');
      }
      
      // 현재 환자의 eventTargetInfo 가져오기 (없으면 기본값으로 초기화)
      const currentEventTargetInfo = allPatients[patientIndex].eventTargetInfo || {
        isEventTarget: false,
        targetReason: '',
        categories: []
      };
      
      // 최종 eventTargetInfo 객체 생성
      let finalEventTargetInfo: EventTargetInfo = {
        ...currentEventTargetInfo,
        ...eventTargetInfo as Partial<EventTargetInfo>,
        updatedAt: now
      } as EventTargetInfo;
      
      // isEventTarget이 true인 경우에만 createdAt 처리
      if (eventTargetInfo.isEventTarget === true) {
        // 기존에 생성 시간이 있으면 그대로 유지, 없으면 현재 시간 사용
        if (!finalEventTargetInfo.createdAt) {
          finalEventTargetInfo.createdAt = now;
        }
      }
      
      // 환자 정보 업데이트
      allPatients[patientIndex] = {
        ...allPatients[patientIndex],
        eventTargetInfo: finalEventTargetInfo
      };
      
      // LocalStorage에 저장
      savePatientsToStorage(allPatients);
      
      return {
        patientId,
        eventTargetInfo: finalEventTargetInfo
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
  async ({ categories, reasons }: { categories?: EventCategory[], reasons?: EventTargetReason[] }, { getState }) => {
    try {
      // API 호출 대신 클라이언트 측 필터링으로 동작
      const state = getState() as { patients: PatientsState };
      const filteredPatients = state.patients.patients.filter((patient: Patient) => 
        patient.eventTargetInfo?.isEventTarget && 
        (!categories?.length || patient.eventTargetInfo.categories.some((cat: EventCategory) => categories.includes(cat))) &&
        (!reasons?.length || reasons.includes(patient.eventTargetInfo.targetReason))
      );
      
      return filteredPatients;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 신규 환자 등록 비동기 액션
export const createPatient = createAsyncThunk(
  'patients/createPatient',
  async (patientData: CreatePatientData, { rejectWithValue, getState }) => {
    try {
      // 현재 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const currentPatients = state.patients.patients;
      
      // 새 환자 생성
      const now = new Date().toISOString();
      // 마지막 환자 ID + 1로 새 ID 생성
      const lastId = currentPatients.length > 0 
        ? parseInt(currentPatients[currentPatients.length - 1].id) 
        : 0;
      const newId = (lastId + 1).toString();
      // 환자 ID 생성 (PT-XXXX 형식)
      const patientId = typeof window === 'undefined' 
        ? `PT-${2500 + newId}` // 서버에서는 고정 패턴 사용
        : `PT-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const newPatient: Patient = {
        id: newId,
        patientId,
        name: patientData.name,
        phoneNumber: patientData.phoneNumber,
        interestedServices: patientData.interestedServices,
        lastConsultation: '', // 콜 유입 날짜 대신 빈 문자열로 설정
        status: patientData.status,
        reminderStatus: '초기', // 신규 환자는 초기 상태
        notes: patientData.memo,
        callInDate: patientData.callInDate, // 콜 유입 날짜 추가
        firstConsultDate: '', // 첫 상담 날짜는 빈 문자열로 초기화
        age: patientData.age,
        region: patientData.region,
        createdAt: now,
        updatedAt: now,
        nextCallbackDate: '',
        visitConfirmed: false // 내원 확정 초기값 추가
      };
      
      // 새 환자를 포함한 환자 목록 생성
      const updatedPatients = [...currentPatients, newPatient];
      
      // LocalStorage에 저장
      savePatientsToStorage(updatedPatients);
      
      return newPatient;
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 등록에 실패했습니다.');
    }
  }
);

// 환자 정보 수정 비동기 액션
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
      // 현재 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const currentPatients = state.patients.patients;
      
      // 해당 환자 찾기
      const patientIndex = currentPatients.findIndex(patient => patient.id === patientId);
      if (patientIndex === -1) {
        return rejectWithValue('환자를 찾을 수 없습니다.');
      }
      
      // 환자 정보 복제
      const updatedPatients = [...currentPatients];
      const patient = { ...updatedPatients[patientIndex] };
      
      // 환자 정보 업데이트
      const now = new Date().toISOString();
      
      // 수정된 필드만 업데이트
      if (patientData.name !== undefined) patient.name = patientData.name;
      if (patientData.phoneNumber !== undefined) patient.phoneNumber = patientData.phoneNumber;
      if (patientData.status !== undefined) patient.status = patientData.status;
      if (patientData.interestedServices !== undefined) patient.interestedServices = patientData.interestedServices;
      if (patientData.notes !== undefined) patient.notes = patientData.notes;
      if (patientData.callInDate !== undefined) patient.callInDate = patientData.callInDate;
      if (patientData.firstConsultDate !== undefined) {
        patient.firstConsultDate = patientData.firstConsultDate;
        // 첫 상담 날짜가 최근이면 마지막 상담 날짜도 업데이트
        if (new Date(patientData.firstConsultDate) > new Date(patient.lastConsultation)) {
          patient.lastConsultation = patientData.firstConsultDate;
        }
      }
      if (patientData.age !== undefined) patient.age = patientData.age;
      if (patientData.region !== undefined) patient.region = patientData.region;
      
      // reminderStatus는 수동으로 설정되었을 때만 업데이트
      if (patientData.reminderStatus !== undefined) {
        patient.reminderStatus = patientData.reminderStatus;
      }
      
      if (patientData.isCompleted !== undefined) patient.isCompleted = patientData.isCompleted;
      if (patientData.completedAt !== undefined) patient.completedAt = patientData.completedAt;
      if (patientData.completedReason !== undefined) patient.completedReason = patientData.completedReason;
      
      // 콜백 이력이 전달되었다면 업데이트
      if (patientData.callbackHistory !== undefined) {
        patient.callbackHistory = patientData.callbackHistory;
        
        // 모든 완료된 콜백 중 가장 오래된 날짜를 찾아 첫 상담 날짜로 설정
        const completedCallbacks = patientData.callbackHistory
          .filter(cb => cb.status === '완료')
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
        if (completedCallbacks.length > 0) {
          // 첫 상담 날짜 업데이트 (가장 오래된 완료 콜백)
          patient.firstConsultDate = completedCallbacks[0].date;
          
          // 마지막 상담 날짜 업데이트 (가장 최근 완료 콜백)
          patient.lastConsultation = completedCallbacks[completedCallbacks.length - 1].date;
        } else {
          // 완료된 콜백이 없으면 첫 상담 날짜와 마지막 상담 날짜를 초기화
          patient.firstConsultDate = '';
          patient.lastConsultation = '';
        }
        
        // 가장 최근 콜백 상태에 따라 환자 상태 갱신 (기존 코드 유지)
        const latestCallback = [...patientData.callbackHistory]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        if (latestCallback) {
          if (latestCallback.status === '부재중') {
            console.log('[updatePatient] 환자 상태를 부재중으로 설정:', patientId);
            patient.status = '부재중';
          } else if (latestCallback.status === '예정') {
            patient.status = '콜백필요';
          } else if (latestCallback.status === '완료') {
            patient.status = '콜백필요';
          }
        }
      }
      
      // 업데이트 시간 갱신
      patient.updatedAt = now;
      
      // 환자 목록 업데이트
      updatedPatients[patientIndex] = patient;
      
      // LocalStorage에 저장
      savePatientsToStorage(updatedPatients);
      
      return patient;
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 정보 수정에 실패했습니다.');
    }
  }
);

// 환자 삭제 비동기 액션
export const deletePatient = createAsyncThunk(
  'patients/deletePatient',
  async (patientId: string, { rejectWithValue, getState }) => {
    try {
      // 현재 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const currentPatients = state.patients.patients;
      
      // 해당 환자를 제외한 목록 생성
      const updatedPatients = currentPatients.filter(patient => patient.id !== patientId);
      
      // LocalStorage에 저장
      savePatientsToStorage(updatedPatients);
      
      return patientId;
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 삭제에 실패했습니다.');
    }
  }
);

  // 환자 종결 처리 액션
  export const completePatient = createAsyncThunk(
    'patients/completePatient',
    async ({ 
      patientId, 
      reason 
    }: CompletePatientData, { rejectWithValue, getState }) => {
    try {
      // 현재 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const currentPatients = state.patients.patients;
      
      // 해당 환자 찾기
      const patientIndex = currentPatients.findIndex(patient => patient.id === patientId);
      if (patientIndex === -1) {
        return rejectWithValue('환자를 찾을 수 없습니다.');
      }
      
      // 환자 정보 복제
      const updatedPatients = [...currentPatients];
      const patient = { ...updatedPatients[patientIndex] };
      
      // 이미 종결된 환자인지 확인
      if (patient.isCompleted) {
        return rejectWithValue('이미 종결 처리된 환자입니다.');
      }
      
      // 현재 날짜
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      
      // 예약 완료인지 확인
      const isReservationCompletion = reason.includes('[예약완료]') || reason.includes('예약일시:');
      
      // 종결 처리 콜백 아이템 생성
      const completionCallbackId = `cb-completion-${Date.now()}`;
      const completionCallback: CallbackItem = {
        id: completionCallbackId,
        date: today,
        status: '종결', // 항상 '종결' 상태로 통일
        notes: reason,
        type: '3차', // 종결 처리는 항상 최종 단계로 설정
        isCompletionRecord: true, // 종결 기록임을 표시
        time: undefined
      };

      // 콜백 이력 배열이 없으면 초기화
      const callbackHistory = patient.callbackHistory || [];
      
      // 이미 오늘 생성된 종결 관련 기록이 있는지 확인
      const existingCompletionRecord = callbackHistory.some(
        cb => cb.isCompletionRecord && cb.date === today
      );

      // 종결 기록이 없는 경우에만 새로 추가
      if (!existingCompletionRecord) {
        patient.callbackHistory = [...callbackHistory, completionCallback];
      }
      
      // 환자 종결 상태로 업데이트
      patient.isCompleted = true;
      patient.completedAt = today;
      patient.completedReason = reason;
      
      // 환자 상태를 예약확정 또는 종결로 변경
      // 예약 완료인 경우 '예약확정'으로, 그 외에는 '종결'로 설정
      if (isReservationCompletion) {
        patient.status = '예약확정';
      } else {
        patient.status = '종결';
      }
      
      patient.reminderStatus = '-'; // 리마인더 상태 초기화
      
      // 업데이트 시간 갱신
      patient.updatedAt = now;
      
      // 환자 목록 업데이트
      updatedPatients[patientIndex] = patient;
      
      // LocalStorage에 저장
      savePatientsToStorage(updatedPatients);
      
      return { 
        patientId, 
        updatedPatient: patient,
        callbackHistory: patient.callbackHistory || [], // undefined가 아닌 빈 배열 반환
        isReservationCompletion // 예약 완료 여부 추가하여 반환
      };
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 종결 처리에 실패했습니다.');
    }
  }
);

// 환자 종결 취소 액션
export const cancelPatientCompletion = createAsyncThunk(
  'patients/cancelPatientCompletion',
  async (patientId: string, { rejectWithValue, getState }) => {
    try {
      // 현재 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const currentPatients = state.patients.patients;
      
      // 해당 환자 찾기
      const patientIndex = currentPatients.findIndex(patient => patient.id === patientId);
      if (patientIndex === -1) {
        return rejectWithValue('환자를 찾을 수 없습니다.');
      }
      
      // 환자 정보 복제
      const updatedPatients = [...currentPatients];
      const patient = { ...updatedPatients[patientIndex] };
      
      // 종결 처리된 환자가 아닌 경우
      if (!patient.isCompleted) {
        return rejectWithValue('종결 처리된 환자가 아닙니다.');
      }
      
      // 종결 관련 필드 초기화
      patient.isCompleted = false;
      patient.completedAt = undefined;
      patient.completedReason = undefined;
      
      // 종결 기록 콜백 항목 찾기 및 제거
      if (patient.callbackHistory) {
        patient.callbackHistory = patient.callbackHistory.filter(
          callback => !callback.isCompletionRecord
        );
      }
      
      // 상태를 마지막 콜백 기록에 따라 업데이트
      if (patient.callbackHistory && patient.callbackHistory.length > 0) {
        // 완료된 콜백이 있으면 콜백필요 상태로
        const hasCompletedCallback = patient.callbackHistory.some(cb => cb.status === '완료');
        if (hasCompletedCallback) {
          patient.status = '콜백필요';
          
          // 리마인더 상태 업데이트 - 최신 완료된 콜백의 타입으로 설정
          const completedCallbacks = patient.callbackHistory.filter(cb => cb.status === '완료');
          if (completedCallbacks.length > 0) {
            const latestCallback = completedCallbacks[completedCallbacks.length - 1];
            patient.reminderStatus = latestCallback.type;
          } else {
            patient.reminderStatus = '초기';
          }
        } else {
          // 완료된 콜백이 없으면 잠재고객으로
          patient.status = '잠재고객';
          patient.reminderStatus = '초기';
        }
      } else {
        // 콜백 기록이 없으면 잠재고객으로
        patient.status = '잠재고객';
        patient.reminderStatus = '초기';
      }
      
      // 업데이트 시간 갱신
      patient.updatedAt = new Date().toISOString();
      
      // 환자 목록 업데이트
      updatedPatients[patientIndex] = patient;
      
      // LocalStorage에 저장
      savePatientsToStorage(updatedPatients);
      
      return { patientId, updatedPatient: patient };
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 종결 취소에 실패했습니다.');
    }
  }
);

// 콜백 추가 액션
// 콜백 추가 비동기 액션
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
      // 현재 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const currentPatients = state.patients.patients;
      
      // 해당 환자 찾기
      const patientIndex = currentPatients.findIndex(patient => patient.id === patientId);
      if (patientIndex === -1) {
        return rejectWithValue('환자를 찾을 수 없습니다.');
      }
      
      // 환자 정보 복제
      const updatedPatients = [...currentPatients];
      const patient = { ...updatedPatients[patientIndex] };
      
      // 종결 처리된 환자인 경우 콜백 추가 불가
      if (patient.isCompleted) {
        return rejectWithValue('종결 처리된 환자에게는 콜백을 추가할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
      }
      
      // 고유 ID 생성
      const callbackId = `cb-${Date.now()}`;
      
      console.log('[addCallback] 콜백 추가 전 환자 상태:', patient.status);

      // 콜백 이력 추가
      const callbackHistory = patient.callbackHistory || [];
      
      // notes에 "부재중:" 접두어가 있는지 확인
      const isMissedCall = callbackData.notes?.startsWith('부재중:');
      
      // 콜백 객체 생성 - time 필드 처리 개선
      const newCallback = { 
        id: callbackId, 
        ...callbackData, 
        // 메모 필드는 전달받은 그대로 사용 (이전 콜백 메모와 합치지 않음)
        time: typeof callbackData.time === 'string' ? callbackData.time : undefined 
      };

      console.log('[addCallback] 추가할 콜백:', newCallback);
      
      // 콜백 이력에 추가
      patient.callbackHistory = [...callbackHistory, newCallback];
      
      // 콜백 상태가 '완료'인 경우 마지막 상담 날짜 업데이트
      if (callbackData.status === '완료') {
        // 첫 상담 날짜가 없는 경우 설정
        if (!patient.firstConsultDate || patient.firstConsultDate === '') {
          patient.firstConsultDate = callbackData.date;
          console.log('[addCallback] 첫 상담 날짜 설정:', patient.firstConsultDate);
        }

        // 마지막 상담 날짜 업데이트 (항상 최신 완료된 콜백 날짜로 갱신)
        patient.lastConsultation = callbackData.date;
        console.log('[addCallback] 마지막 상담 날짜 업데이트:', patient.lastConsultation);          

        // 첫 상담 날짜를 설정할 때 마지막 상담 날짜도 업데이트
        if (new Date(callbackData.date) > new Date(patient.lastConsultation)) {
          patient.lastConsultation = callbackData.date;
        }
      }
      
      // 상태 변경 로직
      if (callbackData.status === '부재중') {
        console.log('[addCallback] 환자 상태를 부재중으로 설정:', patientId);
        patient.status = '부재중';
      } else if (callbackData.status === '예정') {
        patient.status = '콜백필요';
      } else if (callbackData.status === '완료') {
        patient.reminderStatus = callbackData.type;
        patient.status = '콜백필요';
      }
      
      // 업데이트 시간 갱신
      patient.updatedAt = new Date().toISOString();
      
      // 환자 목록 업데이트
      updatedPatients[patientIndex] = patient;
      
      // LocalStorage에 저장
      savePatientsToStorage(updatedPatients);
      
      return { patientId, updatedPatient: patient };
    } catch (error) {
      console.error('[addCallback] 오류 발생:', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message || '콜백 추가에 실패했습니다.');
      }
      return rejectWithValue('콜백 추가에 실패했습니다.');
    }
  }
);

// 콜백 취소 액션
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
      // 현재 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const currentPatients = state.patients.patients;
      
      // 해당 환자 찾기
      const patientIndex = currentPatients.findIndex(patient => patient.id === patientId);
      if (patientIndex === -1) {
        return rejectWithValue('환자를 찾을 수 없습니다.');
      }
      
      // 환자 정보 복제
      const updatedPatients = [...currentPatients];
      const patient = { ...updatedPatients[patientIndex] };
      
      // 종결 처리된 환자인 경우 콜백 취소 불가
      if (patient.isCompleted) {
        return rejectWithValue('종결 처리된 환자의 콜백은 취소할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
      }
      
      // 해당 콜백 찾기
      if (!patient.callbackHistory) {
        return rejectWithValue('콜백 이력이 없습니다.');
      }
      
      const callbackIndex = patient.callbackHistory.findIndex(callback => callback.id === callbackId);
      if (callbackIndex === -1) {
        return rejectWithValue('해당 콜백을 찾을 수 없습니다.');
      }
      
      // 콜백 상태 업데이트
      const updatedCallbacks = [...patient.callbackHistory];
      updatedCallbacks[callbackIndex] = {
        ...updatedCallbacks[callbackIndex],
        status: '취소',
        cancelReason,
        cancelDate: new Date().toISOString().split('T')[0]
      };

      patient.callbackHistory = updatedCallbacks;

      const hasOtherScheduledCallbacks = patient.callbackHistory.some(
        cb => cb.id !== callbackId && cb.status === '예정'
      );

      if (!hasOtherScheduledCallbacks) {
        // 다른 예정된 콜백이 없다면 환자 상태를 변경
        // 가장 최근 콜백 이력을 확인
        const latestCallback = patient.callbackHistory
          .filter(cb => cb.status !== '취소')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        if (latestCallback) {
          if (latestCallback.status === '부재중') {
            console.log('[cancelCallback] 환자 상태를 부재중으로 설정:', patientId);
            // 가장 최근 콜백이 부재중인 경우
            patient.status = '부재중';
          } else if (latestCallback.status === '완료') {
            // 가장 최근 콜백이 완료된 경우
            // 고객 반응이 부정적이었는지 확인
            if (latestCallback.customerResponse === 'negative' || 
                latestCallback.customerResponse === 'very_negative') {
              // 부정적 반응인 경우 '부재중'으로 (이전에는 '미응답'이었음)
              patient.status = '콜백필요';
            } else {
              // 기타 완료된 콜백인 경우 '콜백필요'로
              patient.status = '콜백필요';
            }
          }
        } else {
          // 유효한 콜백 기록이 없으면 '잠재고객'으로
          patient.status = '잠재고객';
        }
      }
      
      // 리마인더 상태 업데이트 - 완료된 콜백만 고려하도록 수정
      const completedCallbacks = updatedCallbacks.filter(cb => cb.status === '완료');
      if (completedCallbacks.length > 0) {
        // 가장 높은 단계의 완료된 콜백으로 설정
        const maxType = getHighestCallbackType(completedCallbacks);
        patient.reminderStatus = maxType;
      } else {
        // 완료된 콜백이 없으면 초기 상태로
        patient.reminderStatus = '초기';
      }
      
      // 업데이트 시간 갱신
      patient.updatedAt = new Date().toISOString();
      
      // 환자 목록 업데이트
      updatedPatients[patientIndex] = patient;
      
      // LocalStorage에 저장
      savePatientsToStorage(updatedPatients);
      
      return { patientId, updatedPatient: patient };
    } catch (error: any) {
      return rejectWithValue(error.message || '콜백 취소에 실패했습니다.');
    }
  }
);

// 콜백 삭제 액션
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
      // 현재 환자 목록 가져오기
      const state = getState() as { patients: PatientsState };
      const currentPatients = state.patients.patients;
      
      // 해당 환자 찾기
      const patientIndex = currentPatients.findIndex(patient => patient.id === patientId);
      if (patientIndex === -1) {
        return rejectWithValue('환자를 찾을 수 없습니다.');
      }
      
      // 환자 정보 복제
      const updatedPatients = [...currentPatients];
      const patient = { ...updatedPatients[patientIndex] };
      
      // 해당 콜백 찾기
      if (!patient.callbackHistory) {
        return rejectWithValue('콜백 이력이 없습니다.');
      }
      
      // 지울 콜백 찾기
      const callbackToDelete = patient.callbackHistory.find(callback => callback.id === callbackId);
      if (!callbackToDelete) {
        return rejectWithValue('해당 콜백을 찾을 수 없습니다.');
      }
      
      // 종결 처리된 환자의 종결 기록은 삭제 불가
      if (patient.isCompleted && callbackToDelete.isCompletionRecord === true) {
        return rejectWithValue('종결 처리 기록은 삭제할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
      }
      
      // 콜백 삭제 전 정보 저장
      const deletedType = callbackToDelete.type;
      const deletedStatus = callbackToDelete.status;
      
      // 콜백 삭제
      const updatedCallbacks = patient.callbackHistory.filter(
        callback => callback.id !== callbackId
      );

      patient.callbackHistory = updatedCallbacks;

      // 완료된 콜백이 있는지 확인하고 상담 날짜 업데이트
      const completedCallbacks = updatedCallbacks
        .filter(cb => cb.status === '완료')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (completedCallbacks.length > 0) {
        // 첫 상담 날짜 업데이트 (가장 오래된 완료 콜백)
        patient.firstConsultDate = completedCallbacks[0].date;
        
        // 마지막 상담 날짜 업데이트 (가장 최근 완료 콜백)
        patient.lastConsultation = completedCallbacks[completedCallbacks.length - 1].date;
      } else {
        // 완료된 콜백이 없으면 첫 상담 날짜와 마지막 상담 날짜를 초기화
        patient.firstConsultDate = '';
        patient.lastConsultation = '';
      }
      
      // 업데이트 시간 갱신
      patient.updatedAt = new Date().toISOString();
      
      // 환자 목록 업데이트
      updatedPatients[patientIndex] = patient;
      
      // LocalStorage에 저장
      savePatientsToStorage(updatedPatients);
      console.log('[addCallback] 반환 직전 환자 상태:', patient.status);
      
      return { 
        patientId, 
        updatedPatient: patient, 
        deletedCallbackInfo: {
          type: deletedType,
          status: deletedStatus
        }
      };
    } catch (error: any) {
      return rejectWithValue(error.message || '콜백 삭제에 실패했습니다.');
    }
  }
);

// 가장 높은 콜백 타입 반환 헬퍼 함수
function getHighestCallbackType(callbacks: CallbackItem[]): ReminderStatus {
  if (callbacks.some(cb => cb.type === '5차')) return '5차';
  if (callbacks.some(cb => cb.type === '4차')) return '4차';
  if (callbacks.some(cb => cb.type === '3차')) return '3차';
  if (callbacks.some(cb => cb.type === '2차')) return '2차';
  if (callbacks.some(cb => cb.type === '1차')) return '1차';
  return '초기';
}

const patientsSlice = createSlice({
  name: 'patients',
  initialState,
  reducers: {
    selectPatient: (state, action: PayloadAction<string>) => {
      const patientId = action.payload;
      const updatedPatient = state.patients.find((patient: { id: string; }) => patient.id === patientId);
      state.selectedPatient = updatedPatient || null;

      const filteredIndex = state.filteredPatients.findIndex((p: { id: string; }) => p.id === patientId);
      if (filteredIndex !== -1 && updatedPatient) {
        state.filteredPatients[filteredIndex] = updatedPatient;
      }
    },
    clearSelectedPatient: (state) => {
      state.selectedPatient = null;
    },
    setFilters: (state, action: PayloadAction<Partial<PatientsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      // 필터 적용
      applyFilters(state);
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.currentPage = action.payload;
    },
    toggleVisitConfirmation: (state, action: PayloadAction<string>) => {
      const patientId = action.payload;
      const patient = state.patients.find(p => p.id === patientId);
      if (patient) {
        patient.visitConfirmed = !patient.visitConfirmed;
        
        // 필터링된 환자 목록도 업데이트
        const filteredIndex = state.filteredPatients.findIndex(p => p.id === patientId);
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex].visitConfirmed = patient.visitConfirmed;
        }
        
        // 선택된 환자도 업데이트
        if (state.selectedPatient && state.selectedPatient.id === patientId) {
          state.selectedPatient.visitConfirmed = patient.visitConfirmed;
        }
        
        // localStorage에 업데이트된 환자 정보 저장
        savePatientsToStorage(state.patients);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchPatients 액션 처리
      .addCase(fetchPatients.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPatients.fulfilled, (state, action: PayloadAction<{ patients: Patient[], totalItems: number }>) => {
        state.isLoading = false;
        state.patients = action.payload.patients;
        state.filteredPatients = action.payload.patients;
        state.pagination.totalItems = action.payload.totalItems;
        state.pagination.totalPages = Math.ceil(action.payload.totalItems / state.pagination.itemsPerPage) || 1; // 최소 1 페이지
        console.log('fetchPatients 완료 - 환자 수:', action.payload.patients.length);
      })
      .addCase(fetchPatients.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })         
      // createPatient 액션 처리
      .addCase(createPatient.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPatient.fulfilled, (state, action: PayloadAction<Patient>) => {
        state.isLoading = false;
        state.patients = [...state.patients, action.payload];
        applyFilters(state); // 필터 다시 적용
      })
      .addCase(createPatient.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // updatePatient 액션 처리 - 수정
      .addCase(updatePatient.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePatient.fulfilled, (state, action: PayloadAction<Patient>) => {
        state.isLoading = false;
        
        // 환자 목록에서 해당 환자 업데이트
        const patientIndex = state.patients.findIndex((p: { id: string; }) => p.id === action.payload.id);
        if (patientIndex !== -1) {
          state.patients[patientIndex] = action.payload;
        }
        
        // 필터링된 목록에서도 해당 환자 업데이트
        const filteredIndex = state.filteredPatients.findIndex((p: { id: string; }) => p.id === action.payload.id);
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = action.payload;
        }
        
        // 현재 선택된 환자가 업데이트 대상이면 업데이트
        if (state.selectedPatient && state.selectedPatient.id === action.payload.id) {
          state.selectedPatient = action.payload;
        }
      })
      .addCase(updatePatient.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // deletePatient 액션 처리
      .addCase(deletePatient.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deletePatient.fulfilled, (state, action: PayloadAction<string>) => {
        state.isLoading = false;
        // 환자 목록에서 삭제된 환자 제거
        state.patients = state.patients.filter((patient: { id: string; }) => patient.id !== action.payload);
        // 필터링된 목록도 업데이트
        state.filteredPatients = state.filteredPatients.filter((patient: { id: string; }) => patient.id !== action.payload);
        
        // 현재 선택된 환자가 삭제되었으면 선택 취소
        if (state.selectedPatient && state.selectedPatient.id === action.payload) {
          state.selectedPatient = null;
        }
        
        // 페이지네이션 업데이트
        state.pagination.totalItems = state.pagination.totalItems - 1;
        state.pagination.totalPages = Math.ceil(state.filteredPatients.length / state.pagination.itemsPerPage);
        
        // 현재 페이지가 유효하지 않은 경우 조정
        if (state.pagination.currentPage > state.pagination.totalPages && state.pagination.totalPages > 0) {
          state.pagination.currentPage = state.pagination.totalPages;
        }
      })
      .addCase(deletePatient.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // completePatient 액션 처리 - 수정
      .addCase(completePatient.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(completePatient.fulfilled, (state, action: PayloadAction<{
        patientId: string,
        updatedPatient: Patient,
        callbackHistory: CallbackItem[],
        isReservationCompletion: boolean
      }>) => {
        state.isLoading = false;
        
        // 환자 목록에서 해당 환자 업데이트
        const patientIndex = state.patients.findIndex((p: { id: string; }) => p.id === action.payload.patientId);
        if (patientIndex !== -1) {
          state.patients[patientIndex] = action.payload.updatedPatient;
          
          // 예약 완료인 경우 상태 명시적으로 설정
          if (action.payload.isReservationCompletion) {
            state.patients[patientIndex].status = '예약확정';
          } else {
            state.patients[patientIndex].status = '종결';
          }
        }
        
        // 필터링된 목록에서도 해당 환자 업데이트
        const filteredIndex = state.filteredPatients.findIndex((p: { id: string; }) => p.id === action.payload.patientId);
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = action.payload.updatedPatient;
          
          // 예약 완료인 경우 상태 명시적으로 설정
          if (action.payload.isReservationCompletion) {
            state.filteredPatients[filteredIndex].status = '예약확정';
          } else {
            state.filteredPatients[filteredIndex].status = '종결';
          }
        }
        
        // 현재 선택된 환자가 업데이트 대상이면 업데이트
        if (state.selectedPatient && state.selectedPatient.id === action.payload.patientId) {
          state.selectedPatient = action.payload.updatedPatient;
          
          // 예약 완료인 경우 상태 명시적으로 설정
          if (action.payload.isReservationCompletion) {
            state.selectedPatient.status = '예약확정';
          } else {
            state.selectedPatient.status = '종결';
          }
        }
      })
      .addCase(completePatient.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // addCallback 액션 처리
      .addCase(addCallback.fulfilled, (state, action) => {
        state.isLoading = false;
        
        const { patientId, updatedPatient } = action.payload;
        console.log('[리듀서] 받은 환자 데이터:', updatedPatient);
        console.log('[리듀서] 받은 환자 상태:', updatedPatient.status);
        
        // 환자 목록 업데이트
        const patientIndex = state.patients.findIndex(p => p.id === patientId);
        if (patientIndex !== -1) {
          // 상태를 명시적으로 설정
          state.patients[patientIndex] = {
            ...updatedPatient
          };
          console.log('[리듀서] 업데이트 후 환자 상태:', state.patients[patientIndex].status);
        }
        
        // 필터링된 목록 업데이트
        const filteredIndex = state.filteredPatients.findIndex(p => p.id === patientId);
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = {
            ...updatedPatient
          };
        }
        
        // 선택된 환자 업데이트
        if (state.selectedPatient && state.selectedPatient.id === patientId) {
          state.selectedPatient = {
            ...updatedPatient
          };
        }
      })

      .addCase(addCallback.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // cancelCallback 액션 처리
      .addCase(cancelCallback.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelCallback.fulfilled, (state, action: PayloadAction<{ patientId: string, updatedPatient: Patient }>) => {
        state.isLoading = false;
        
        // 환자 목록에서 해당 환자 업데이트
        const patientIndex = state.patients.findIndex((p: { id: string; }) => p.id === action.payload.patientId);
        if (patientIndex !== -1) {
          state.patients[patientIndex] = action.payload.updatedPatient;
        }
        
        // 필터링된 목록에서도 해당 환자 업데이트
        const filteredIndex = state.filteredPatients.findIndex((p: { id: string; }) => p.id === action.payload.patientId);
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = action.payload.updatedPatient;
        }
        
        // 현재 선택된 환자가 업데이트 대상이면 업데이트
        if (state.selectedPatient && state.selectedPatient.id === action.payload.patientId) {
          state.selectedPatient = action.payload.updatedPatient;
        }
      })
      .addCase(cancelCallback.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // cancelPatientCompletion 액션 처리
      .addCase(cancelPatientCompletion.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelPatientCompletion.fulfilled, (state, action: PayloadAction<{ patientId: string, updatedPatient: Patient }>) => {
        state.isLoading = false;
        
        // 환자 목록에서 해당 환자 업데이트
        const patientIndex = state.patients.findIndex((p: { id: string; }) => p.id === action.payload.patientId);
        if (patientIndex !== -1) {
          state.patients[patientIndex] = action.payload.updatedPatient;
        }
        
        // 필터링된 목록에서도 해당 환자 업데이트
        const filteredIndex = state.filteredPatients.findIndex((p: { id: string; }) => p.id === action.payload.patientId);
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = action.payload.updatedPatient;
        }
        
        // 현재 선택된 환자가 업데이트 대상이면 업데이트
        if (state.selectedPatient && state.selectedPatient.id === action.payload.patientId) {
          state.selectedPatient = action.payload.updatedPatient;
        }
      })
      .addCase(cancelPatientCompletion.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // deleteCallback 액션 처리
      .addCase(deleteCallback.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteCallback.fulfilled, (state, action: PayloadAction<{ 
        patientId: string, 
        updatedPatient: Patient,
        deletedCallbackInfo: {
          type: string,
          status: string
        }
      }>) => {
        state.isLoading = false;
        
        // 환자 목록에서 해당 환자 업데이트
        const patientIndex = state.patients.findIndex((p: { id: string; }) => p.id === action.payload.patientId);
        if (patientIndex !== -1) {
          state.patients[patientIndex] = action.payload.updatedPatient;
        }
        
        // 필터링된 목록에서도 해당 환자 업데이트
        const filteredIndex = state.filteredPatients.findIndex((p: { id: string; }) => p.id === action.payload.patientId);
        if (filteredIndex !== -1) {
          state.filteredPatients[filteredIndex] = action.payload.updatedPatient;
        }
        
        // 현재 선택된 환자가 업데이트 대상이면 업데이트
        if (state.selectedPatient && state.selectedPatient.id === action.payload.patientId) {
          state.selectedPatient = action.payload.updatedPatient;
        }
      })
      .addCase(deleteCallback.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(updateEventTargetInfo.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateEventTargetInfo.fulfilled, (state, action) => {
        state.isLoading = false;
        
        // 해당 환자 찾기
        const patientIndex = state.patients.findIndex(
          (patient) => patient.id === action.payload.patientId
        );
        
        if (patientIndex !== -1) {
          // 이벤트 타겟 정보 업데이트
          const currentEventTargetInfo = state.patients[patientIndex].eventTargetInfo || {};
          state.patients[patientIndex].eventTargetInfo = {
            ...currentEventTargetInfo,
            ...action.payload.eventTargetInfo
          } as EventTargetInfo;

          // isEventTarget이 false인 경우 createdAt과 updatedAt을 제거
          if (action.payload.eventTargetInfo.isEventTarget === false) {
            if (state.patients[patientIndex].eventTargetInfo) {
              delete state.patients[patientIndex].eventTargetInfo.createdAt;
              delete state.patients[patientIndex].eventTargetInfo.updatedAt;
            }
          }
          
          // 선택된 환자가 있고, 그 환자가 현재 업데이트된 환자라면 selectedPatient도 업데이트
          if (state.selectedPatient && state.selectedPatient.id === action.payload.patientId) {
            const currentSelectedEventTargetInfo = state.selectedPatient.eventTargetInfo || {};
            state.selectedPatient.eventTargetInfo = {
              ...currentSelectedEventTargetInfo,
              ...action.payload.eventTargetInfo
            } as EventTargetInfo;
            
            // isEventTarget이 false인 경우 createdAt과 updatedAt을 제거
            if (action.payload.eventTargetInfo.isEventTarget === false && state.selectedPatient.eventTargetInfo) {
              delete state.selectedPatient.eventTargetInfo.createdAt;
              delete state.selectedPatient.eventTargetInfo.updatedAt;
            }
          }
          
          // filteredPatients도 필요한 경우 업데이트
          const filteredIndex = state.filteredPatients.findIndex(
            (patient) => patient.id === action.payload.patientId
          );
          
          if (filteredIndex !== -1) {
            const currentFilteredEventTargetInfo = state.filteredPatients[filteredIndex].eventTargetInfo || {};
            state.filteredPatients[filteredIndex].eventTargetInfo = {
              ...currentFilteredEventTargetInfo,
              ...action.payload.eventTargetInfo
            } as EventTargetInfo;
            
            // isEventTarget이 false인 경우 createdAt과 updatedAt을 제거
            if (action.payload.eventTargetInfo.isEventTarget === false && 
                state.filteredPatients[filteredIndex].eventTargetInfo) {
              delete state.filteredPatients[filteredIndex].eventTargetInfo.createdAt;
              delete state.filteredPatients[filteredIndex].eventTargetInfo.updatedAt;
            }
          }

          // 이벤트 타겟 목록도 업데이트
          if (action.payload.eventTargetInfo.isEventTarget === true) {
            // 이벤트 타겟으로 설정된 경우, 목록에 추가/업데이트
            const targetIndex = state.eventTargetPatients.findIndex(
              (patient) => patient.id === action.payload.patientId
            );
            
            if (targetIndex === -1) {
              // 목록에 없으면 추가
              state.eventTargetPatients.push(state.patients[patientIndex]);
            } else {
              // 있으면 업데이트
              state.eventTargetPatients[targetIndex] = state.patients[patientIndex];
            }
          } else {
            // 이벤트 타겟 해제된 경우, 목록에서 제거
            state.eventTargetPatients = state.eventTargetPatients.filter(
              (patient) => patient.id !== action.payload.patientId
            );
          }
        }
      })
          
      .addCase(updateEventTargetInfo.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // 이벤트 타겟 초기화 처리
      .addCase(initializeEventTargets.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeEventTargets.fulfilled, (state, action) => {
        state.isLoading = false;
        state.eventTargetPatients = action.payload;
      })
      .addCase(initializeEventTargets.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '이벤트 타겟 초기화 실패';
      })
      
      // 이벤트 타겟 필터링 처리
      .addCase(filterEventTargets.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(filterEventTargets.fulfilled, (state, action) => {
        state.isLoading = false;
        state.eventTargetPatients = action.payload;
      })
      .addCase(filterEventTargets.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '이벤트 타겟 필터링 실패';
      });
  },
});

// 필터 적용 헬퍼 함수
function applyFilters(state: PatientsState) {
  let filtered = [...state.patients];
  
  const { status, interestArea, searchTerm } = state.filters;
  
  // 상태 기준 필터링
  if (status !== 'all') {
    filtered = filtered.filter(patient => patient.status === status);
  }
  
  // 관심 분야 기준 필터링
  if (interestArea !== 'all') {
    filtered = filtered.filter(patient => 
      patient.interestedServices.includes(interestArea)
    );
  }
  
  // 검색어 기준 필터링
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
  state.pagination.currentPage = 1; // 필터가 변경될 때마다 첫 페이지로 리셋
}

export const { selectPatient, clearSelectedPatient, setFilters, setPage, toggleVisitConfirmation  } = patientsSlice.actions;
export default patientsSlice.reducer;