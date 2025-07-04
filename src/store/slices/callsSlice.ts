//src/store/slices/callsSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// 🔥 Call 타입 정의 - 새로운 필드 추가
export interface Call {
  id: string;
  patientId: string;
  patientName: string;
  phoneNumber: string;
  scheduledTime: string; // ISO 형식
  status: '예정' | '완료' | '부재중' | '일정변경';
  attemptCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // 🔥 새로 추가된 필드들
  callSource?: 'management' | 'postVisit'; // 콜백 출처 구분
  postVisitInfo?: {
    visitConfirmed: boolean;
    postVisitStatus: string;
    hasPostVisitConsultation: boolean;
  };
}

export interface CallSummary {
  scheduled: number;
  completed: number;
  pending: number;
  confirmed: number;
}

interface CallsState {
  calls: Call[];
  filteredCalls: Call[];
  selectedCall: Call | null;
  isLoading: boolean;
  error: string | null;
  summary: CallSummary;
}

// 기본 목업 데이터
const mockCalls: Call[] = [
  {
    id: '1',
    patientId: '1',
    patientName: '김영희',
    phoneNumber: '010-1234-5678',
    scheduledTime: '2025-04-29T10:30:00',
    status: '예정',
    attemptCount: 0,
    createdAt: '2025-04-25T09:00:00Z',
    updatedAt: '2025-04-25T09:00:00Z'
  },
  {
    id: '2',
    patientId: '2',
    patientName: '이철수',
    phoneNumber: '010-9876-5432',
    scheduledTime: '2025-04-29T11:15:00',
    status: '예정',
    attemptCount: 1,
    createdAt: '2025-04-24T14:00:00Z',
    updatedAt: '2025-04-24T14:00:00Z'
  },
  {
    id: '3',
    patientId: '3',
    patientName: '박지민',
    phoneNumber: '010-5555-7777',
    scheduledTime: '2025-04-29T13:00:00',
    status: '예정',
    attemptCount: 2,
    createdAt: '2025-04-23T11:30:00Z',
    updatedAt: '2025-04-23T11:30:00Z'
  },
  {
    id: '4',
    patientId: '4',
    patientName: '이지민',
    phoneNumber: '010-1111-2222',
    scheduledTime: '2025-04-29T14:30:00',
    status: '예정',
    attemptCount: 3,
    createdAt: '2025-04-22T15:45:00Z',
    updatedAt: '2025-04-22T15:45:00Z'
  },
  {
    id: '5',
    patientId: '5',
    patientName: '최수진',
    phoneNumber: '010-3333-4444',
    scheduledTime: '2025-04-29T16:00:00',
    status: '예정',
    attemptCount: 0,
    createdAt: '2025-04-21T10:15:00Z',
    updatedAt: '2025-04-21T10:15:00Z'
  }
];

// LocalStorage에서 콜 데이터 불러오기
const loadCallsFromStorage = (): Call[] => {
  if (typeof window === 'undefined') return mockCalls;
  
  try {
    const storedCalls = localStorage.getItem('calls');
    if (storedCalls) {
      return JSON.parse(storedCalls);
    }
    // 처음 실행 시 mockCalls를 저장하고 반환
    localStorage.setItem('calls', JSON.stringify(mockCalls));
    return mockCalls;
  } catch (error) {
    console.error('LocalStorage에서 콜 데이터를 불러오는데 실패했습니다:', error);
    return mockCalls;
  }
};

// LocalStorage에 콜 데이터 저장
const saveCallsToStorage = (calls: Call[]) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('calls', JSON.stringify(calls));
  } catch (error) {
    console.error('LocalStorage에 콜 데이터를 저장하는데 실패했습니다:', error);
  }
};

// 초기 상태
const initialState: CallsState = {
  calls: [],
  filteredCalls: [],
  selectedCall: null,
  isLoading: false,
  error: null,
  summary: {
    scheduled: 0,
    completed: 0,
    pending: 0,
    confirmed: 0
  }
};

// 콜 목록 가져오기
export const fetchCalls = createAsyncThunk(
  'calls/fetchCalls',
  async (_, { rejectWithValue }) => {
    try {
      const calls = loadCallsFromStorage();
      
      // 요약 데이터 계산
      const scheduled = calls.filter(call => call.status === '예정' && call.attemptCount === 0).length;
      const completed = calls.filter(call => call.status === '완료').length;
      const pending = calls.filter(call => call.status === '부재중').length;
      const confirmed = calls.filter(call => call.status === '일정변경').length;
      
      const summary: CallSummary = {
        scheduled,
        completed,
        pending,
        confirmed
      };
      
      return { calls, summary };
    } catch (error: any) {
      return rejectWithValue(error.message || '콜 목록을 불러오는데 실패했습니다.');
    }
  }
);

// 콜 선택
export const selectCall = createAsyncThunk(
  'calls/selectCall',
  async (callId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { calls: CallsState };
      const call = state.calls.calls.find(c => c.id === callId);
      
      if (!call) {
        throw new Error('해당 콜을 찾을 수 없습니다.');
      }
      
      return call;
    } catch (error: any) {
      return rejectWithValue(error.message || '콜을 선택하는데 실패했습니다.');
    }
  }
);

// 슬라이스 정의
const callsSlice = createSlice({
  name: 'calls',
  initialState,
  reducers: {
    clearSelectedCall: (state) => {
      state.selectedCall = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchCalls 액션 처리
      .addCase(fetchCalls.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCalls.fulfilled, (state, action: PayloadAction<{ calls: Call[], summary: CallSummary }>) => {
        state.isLoading = false;
        state.calls = action.payload.calls;
        state.filteredCalls = action.payload.calls;
        state.summary = action.payload.summary;
      })
      .addCase(fetchCalls.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // selectCall 액션 처리
      .addCase(selectCall.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(selectCall.fulfilled, (state, action: PayloadAction<Call>) => {
        state.isLoading = false;
        state.selectedCall = action.payload;
      })
      .addCase(selectCall.rejected, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  }
});

export const { clearSelectedCall } = callsSlice.actions;
export default callsSlice.reducer;