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

// 환자 타입 정의 (MongoDB ID 추가)
export interface Patient {
  _id: string;            // MongoDB ID 필드 추가
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

// 초기 상태 정의
const initialState: PatientsState = {
  patients: [], // 빈 배열로 초기화
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
      const response = await fetch('/api/patients');
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '환자 목록을 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      
      // MongoDB의 _id를 문자열로 변환하여 사용하도록 처리
      const patients = data.patients.map((patient: any) => {
        // 이미 문자열인 경우는 그대로 사용
        if (typeof patient._id === 'string') {
          return patient;
        }
        // 객체인 경우 문자열로 변환
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

// 앱 시작 시 이벤트 타겟 정보 로드를 위한 액션 추가
export const initializeEventTargets = createAsyncThunk(
  'patients/initializeEventTargets',
  async (_, { getState, rejectWithValue }) => {
    try {
      console.log('이벤트 타겟 초기화 시작');
      
      // 현재 Redux 상태에서 환자 데이터 가져오기
      const state = getState() as { patients: PatientsState };
      const currentPatients = state.patients.patients;
      
      // 환자 데이터가 없으면 API에서 직접 로드
      if (!currentPatients || currentPatients.length === 0) {
        console.log('Redux에 환자 데이터가 없어서 API에서 로드합니다.');
        const response = await fetch('/api/patients/event-targets');
        
        if (!response.ok) {
          const errorData = await response.json();
          return rejectWithValue(errorData.error || '이벤트 타겟 정보 로드에 실패했습니다.');
        }
        
        const eventTargetPatients = await response.json();
        console.log('API에서 이벤트 타겟 환자 로드:', eventTargetPatients.length, '명');
        return eventTargetPatients;
      }
      
      // 기존 환자 데이터에서 이벤트 타겟 환자들 필터링
      const eventTargetPatients = currentPatients.filter(patient => 
        patient.eventTargetInfo?.isEventTarget === true
      );
      
      console.log('Redux에서 이벤트 타겟 환자 필터링 완료:', {
        totalPatients: currentPatients.length,
        eventTargetCount: eventTargetPatients.length,
        eventTargetPatients: eventTargetPatients.map(p => ({
          id: p.id,
          name: p.name,
          isEventTarget: p.eventTargetInfo?.isEventTarget,
          targetReason: p.eventTargetInfo?.targetReason
        }))
      });
      
      return eventTargetPatients;
    } catch (error: any) {
      console.error('이벤트 타겟 초기화 오류:', error);
      return rejectWithValue(error.message || '이벤트 타겟 초기화에 실패했습니다.');
    }
  }
);

// 이벤트 타겟 설정 액션
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
      
      const updatedPatient = await response.json();
      
      return {
        patientId,
        eventTargetInfo: updatedPatient.eventTargetInfo
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
      // 쿼리 파라미터 구성
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

// 신규 환자 등록 비동기 액션
export const createPatient = createAsyncThunk(
  'patients/createPatient',
  async (patientData: CreatePatientData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patientData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '환자 등록에 실패했습니다.');
      }
      
      const newPatient = await response.json();
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
  }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patientData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '환자 정보 수정에 실패했습니다.');
      }
      
      const updatedPatient = await response.json();
      return updatedPatient;
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 정보 수정에 실패했습니다.');
    }
  }
);

// deletePatient 액션 수정
export const deletePatient = createAsyncThunk(
  'patients/deletePatient',
  async (patientId: string, { rejectWithValue }) => {
    try {
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

      console.log('환자 삭제 성공');
      return patientId; // 삭제 성공 시 ID 반환
    } catch (error: any) {
      console.error('환자 삭제 오류:', error);
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
  }: CompletePatientData, { rejectWithValue }) => {
    try {
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

// 환자 종결 취소 액션
export const cancelPatientCompletion = createAsyncThunk(
  'patients/cancelPatientCompletion',
  async (patientId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/patients/${patientId}/cancel-completion`, {
        method: 'PUT',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '환자 종결 취소에 실패했습니다.');
      }
      
      const result = await response.json();
      return { patientId, updatedPatient: result };
    } catch (error: any) {
      return rejectWithValue(error.message || '환자 종결 취소에 실패했습니다.');
    }
  }
);

// 콜백 추가 비동기 액션
export const addCallback = createAsyncThunk(
  'patients/addCallback',
  async ({ 
    patientId, 
    callbackData 
  }: { 
    patientId: string, 
    callbackData: Omit<CallbackItem, 'id'> 
  }, { rejectWithValue }) => {
    try {
      console.log(`콜백 추가 시도: 환자 ID = ${patientId}, 데이터:`, callbackData);
      
      if (!patientId) {
        console.error('환자 ID가 undefined입니다!');
        return rejectWithValue('환자 ID가 없습니다.');
      }
      
      const response = await fetch(`/api/patients/${patientId}/callbacks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(callbackData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('콜백 추가 실패 응답:', errorData);
        return rejectWithValue(errorData.error || '콜백 추가에 실패했습니다.');
      }
      
      const updatedPatient = await response.json();
      console.log('콜백 추가 성공. 업데이트된 환자:', updatedPatient);
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
  }, { rejectWithValue }) => {
    try {
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
      return { patientId, updatedPatient };
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
  }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/patients/${patientId}/callbacks/${callbackId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return rejectWithValue(errorData.error || '콜백 삭제에 실패했습니다.');
      }
      
      const result = await response.json();
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

const patientsSlice = createSlice({
  name: 'patients',
  initialState,
  reducers: {
    selectPatient: (state, action: PayloadAction<string>) => {
      const patientId = action.payload;
      
      console.log('환자 선택 시도:', patientId);
      
      // MongoDB ID 형식인지 먼저 확인하고, 아니면 id 필드로 검색
      const updatedPatient = state.patients.find(
        (patient) => patient._id === patientId || patient.id === patientId
      );
      
      if (updatedPatient) {
        console.log('환자 찾음:', updatedPatient);
        state.selectedPatient = updatedPatient;
      } else {
        console.error('환자를 찾을 수 없음:', patientId);
        state.selectedPatient = null;
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
        
        // 방문 확인 상태 업데이트 API 호출
        fetch(`/api/patients/${patientId}/visit-confirmation`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ visitConfirmed: patient.visitConfirmed }),
        }).catch(error => {
          console.error('방문 확인 상태 업데이트 실패:', error);
        });
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
      
      // updatePatient 액션 처리
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
        const deletedPatientId = action.payload;
        
        // 환자 목록에서 삭제된 환자 제거 - _id 또는 id 기준으로 찾기
        state.patients = state.patients.filter((patient) => 
          patient._id !== deletedPatientId && patient.id !== deletedPatientId
        );
        
        // 필터링된 목록도 업데이트
        state.filteredPatients = state.filteredPatients.filter((patient) => 
          patient._id !== deletedPatientId && patient.id !== deletedPatientId
        );
        
        // 🔥 이벤트 타겟 환자 목록에서도 삭제된 환자 제거 (추가)
        const originalEventTargetLength = state.eventTargetPatients.length;
        state.eventTargetPatients = state.eventTargetPatients.filter((patient) => 
          patient._id !== deletedPatientId && patient.id !== deletedPatientId
        );
        
        // 디버깅을 위한 로그
        if (state.eventTargetPatients.length < originalEventTargetLength) {
          console.log(`이벤트 타겟 목록에서 환자 삭제됨: ${deletedPatientId}`);
          console.log(`이벤트 타겟 환자 수: ${originalEventTargetLength} → ${state.eventTargetPatients.length}`);
        }
        
        // 현재 선택된 환자가 삭제되었으면 선택 취소
        if (state.selectedPatient && 
            (state.selectedPatient._id === deletedPatientId || state.selectedPatient.id === deletedPatientId)) {
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
      
      // completePatient 액션 처리
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
      
      /*
      .addCase(updateEventTargetInfo.fulfilled, (state, action) => {
        state.isLoading = false;
        
        const { patientId, eventTargetInfo } = action.payload;
        
        // 환자 목록에서 해당 환자 업데이트
        const patientIndex = state.patients.findIndex(
          (patient) => patient.id === patientId || patient._id === patientId
        );
        
        if (patientIndex !== -1) {
          // 이벤트 타겟 정보 업데이트
          const currentEventTargetInfo = state.patients[patientIndex].eventTargetInfo || {};
          state.patients[patientIndex].eventTargetInfo = {
            ...currentEventTargetInfo,
            ...eventTargetInfo
          } as EventTargetInfo;

          // 선택된 환자 업데이트
          if (state.selectedPatient && 
              (state.selectedPatient.id === patientId || state.selectedPatient._id === patientId)) {
            state.selectedPatient.eventTargetInfo = state.patients[patientIndex].eventTargetInfo;
          }
          
          // 필터링된 환자 목록 업데이트
          const filteredIndex = state.filteredPatients.findIndex(
            (patient) => patient.id === patientId || patient._id === patientId
          );
          
          if (filteredIndex !== -1) {
            state.filteredPatients[filteredIndex].eventTargetInfo = state.patients[patientIndex].eventTargetInfo;
          }

          // 이벤트 타겟 환자 목록 즉시 업데이트
          if (eventTargetInfo.isEventTarget === true) {
            // 이벤트 타겟으로 설정된 경우
            const targetIndex = state.eventTargetPatients.findIndex(
              (patient) => patient.id === patientId || patient._id === patientId
            );
            
            if (targetIndex === -1) {
              // 목록에 없으면 추가
              state.eventTargetPatients.push(state.patients[patientIndex]);
              console.log('이벤트 타겟 목록에 환자 추가:', state.patients[patientIndex].name);
            } else {
              // 있으면 업데이트
              state.eventTargetPatients[targetIndex] = state.patients[patientIndex];
              console.log('이벤트 타겟 목록에서 환자 정보 업데이트:', state.patients[patientIndex].name);
            }
          } else {
            // 이벤트 타겟 해제된 경우
            const originalLength = state.eventTargetPatients.length;
            state.eventTargetPatients = state.eventTargetPatients.filter(
              (patient) => patient.id !== patientId && patient._id !== patientId
            );
            
            if (state.eventTargetPatients.length < originalLength) {
              console.log('이벤트 타겟 목록에서 환자 제거:', patientId);
            }
          }
          
          console.log('이벤트 타겟 업데이트 완료:', {
            patientId,
            patientName: state.patients[patientIndex].name,
            isEventTarget: eventTargetInfo.isEventTarget,
            totalEventTargets: state.eventTargetPatients.length
          });
        } else {
          console.error('업데이트할 환자를 찾을 수 없음:', patientId);
        }
      })
      */
          
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