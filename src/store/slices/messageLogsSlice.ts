// src/store/slices/messageLogsSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '@/store'
import { MessageLog, MessageStatus, MessageType, MessageLogSort, SortDirection } from '@/types/messageLog'
import { EventCategory } from './patientsSlice'

// 필터 타입 정의
export interface MessageLogFilters {
  searchTerm: string;
  startDate?: string;
  endDate?: string;
  statuses: MessageStatus[];
  messageTypes: MessageType[];
  categories: EventCategory[];
  patientId?: string;
  phoneNumber?: string;
}

// 초기 상태를 위한 인터페이스
interface MessageLogsState {
  logs: MessageLog[];
  isLoading: boolean;
  error: string | null;
  filters: MessageLogFilters;
  sort: MessageLogSort;
}

// API에서 메시지 로그 가져오기 (localStorage를 임시 저장소로 사용)
export const fetchMessageLogs = createAsyncThunk(
  'messageLogs/fetchMessageLogs',
  async (_, { rejectWithValue }) => {
    try {
      // 실제 API 호출 대신 localStorage에서 가져오기
      const storedLogs = localStorage.getItem('messageLogsData');
      
      if (storedLogs) {
        return JSON.parse(storedLogs) as MessageLog[];
      }
      
      // 저장된 데이터가 없으면 빈 배열 반환
      return [] as MessageLog[];
    } catch (error) {
      return rejectWithValue('메시지 로그를 불러오는 중 오류가 발생했습니다.');
    }
  }
);

// 새 메시지 로그 저장
export const saveMessageLog = createAsyncThunk(
  'messageLogs/saveMessageLog',
  async (messageLog: MessageLog, { getState, rejectWithValue }) => {
    try {
      // 현재 로그 가져오기
      const state = getState() as RootState;
      const currentLogs = [...state.messageLogs.logs];
      
      // 새 로그 추가
      const updatedLogs = [messageLog, ...currentLogs];
      
      // localStorage에 저장 (실제 API 호출 대체)
      localStorage.setItem('messageLogsData', JSON.stringify(updatedLogs));
      
      return messageLog;
    } catch (error) {
      return rejectWithValue('메시지 로그를 저장하는 중 오류가 발생했습니다.');
    }
  }
);

// 메시지 로그 일괄 저장 (다중 메시지 발송 시)
export const saveMessageLogs = createAsyncThunk(
  'messageLogs/saveMessageLogs',
  async (messageLogs: MessageLog[], { getState, rejectWithValue }) => {
    try {
      // 현재 로그 가져오기
      const state = getState() as RootState;
      const currentLogs = [...state.messageLogs.logs];
      
      // 새 로그 추가
      const updatedLogs = [...messageLogs, ...currentLogs];
      
      // localStorage에 저장 (실제 API 호출 대체)
      localStorage.setItem('messageLogsData', JSON.stringify(updatedLogs));
      
      return messageLogs;
    } catch (error) {
      return rejectWithValue('메시지 로그를 저장하는 중 오류가 발생했습니다.');
    }
  }
);

// 테스트를 위해 로그 데이터 초기화
export const clearMessageLogs = createAsyncThunk(
  'messageLogs/clearMessageLogs',
  async (_, { rejectWithValue }) => {
    try {
      localStorage.removeItem('messageLogsData');
      return true;
    } catch (error) {
      return rejectWithValue('메시지 로그를 초기화하는 중 오류가 발생했습니다.');
    }
  }
);

// 초기 상태
const initialState: MessageLogsState = {
  logs: [],
  isLoading: false,
  error: null,
  filters: {
    searchTerm: '',
    statuses: ['success', 'failed'],
    messageTypes: ['SMS', 'LMS'],
    categories: [],
  },
  sort: {
    field: 'createdAt',
    direction: 'desc'
  }
};

// 슬라이스 생성
const messageLogsSlice = createSlice({
  name: 'messageLogs',
  initialState,
  reducers: {
    // 로그 초기화 (API 호출 대신 localStorage에서 로드)
    initializeLogs: (state) => {
      try {
        const storedLogs = localStorage.getItem('messageLogsData');
        if (storedLogs) {
          state.logs = JSON.parse(storedLogs);
        }
        state.isLoading = false;
        state.error = null;
      } catch (error) {
        state.error = '로그 데이터를 불러오는 중 오류가 발생했습니다.';
      }
    },
    // 필터 설정
    setFilters: (state, action: PayloadAction<Partial<MessageLogFilters>>) => {
      state.filters = {
        ...state.filters,
        ...action.payload
      };
    },
    // 필터 초기화
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    // 정렬 설정
    setSort: (state, action: PayloadAction<MessageLogSort>) => {
      state.sort = action.payload;
    },
    // 새 메시지 로그 추가
    addMessageLog: (state, action: PayloadAction<MessageLog>) => {
      state.logs.unshift(action.payload);
      
      // localStorage에 저장 (실제 API 호출 대체)
      localStorage.setItem('messageLogsData', JSON.stringify(state.logs));
    },
    // 메시지 로그 업데이트
    updateMessageLog: (state, action: PayloadAction<{ id: string; updates: Partial<MessageLog> }>) => {
      const { id, updates } = action.payload;
      const index = state.logs.findIndex(log => log.id === id);
      if (index !== -1) {
        state.logs[index] = { ...state.logs[index], ...updates };
        
        // localStorage에 저장 (실제 API 호출 대체)
        localStorage.setItem('messageLogsData', JSON.stringify(state.logs));
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchMessageLogs
      .addCase(fetchMessageLogs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMessageLogs.fulfilled, (state, action) => {
        state.logs = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchMessageLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // saveMessageLog
      .addCase(saveMessageLog.fulfilled, (state, action) => {
        state.logs.unshift(action.payload);
      })
      // saveMessageLogs
      .addCase(saveMessageLogs.fulfilled, (state, action) => {
        state.logs = [...action.payload, ...state.logs];
      })
      // clearMessageLogs
      .addCase(clearMessageLogs.fulfilled, (state) => {
        state.logs = [];
      });
  }
});

// 필터링 및 정렬된 로그 선택자
export const selectFilteredLogs = (state: RootState) => {
  const { logs, filters, sort } = state.messageLogs;
  
  // 필터링
  let filteredLogs = logs.filter(log => {
    // 검색어 필터
    if (filters.searchTerm && !log.content.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
        !log.patientName.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
        !log.phoneNumber.includes(filters.searchTerm)) {
      return false;
    }
    
    // 상태 필터
    if (filters.statuses.length > 0 && !filters.statuses.includes(log.status)) {
      return false;
    }
    
    // 메시지 타입 필터
    if (filters.messageTypes.length > 0 && !filters.messageTypes.includes(log.messageType)) {
      return false;
    }
    
    // 카테고리 필터
    if (filters.categories.length > 0 && (!log.category || !filters.categories.includes(log.category))) {
      return false;
    }
    
    // 시작 날짜 필터
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      const logDate = new Date(log.createdAt);
      startDate.setHours(0, 0, 0, 0);
      if (logDate < startDate) {
        return false;
      }
    }
    
    // 종료 날짜 필터
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      const logDate = new Date(log.createdAt);
      endDate.setHours(23, 59, 59, 999);
      if (logDate > endDate) {
        return false;
      }
    }
    
    // 환자 ID 필터
    if (filters.patientId && log.patientId !== filters.patientId) {
      return false;
    }
    
    // 전화번호 필터
    if (filters.phoneNumber && log.phoneNumber !== filters.phoneNumber) {
      return false;
    }
    
    return true;
  });
  
  // 정렬
  filteredLogs.sort((a, b) => {
    if (sort.field === 'createdAt') {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sort.direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    if (sort.field === 'patientName') {
      return sort.direction === 'asc' 
        ? a.patientName.localeCompare(b.patientName) 
        : b.patientName.localeCompare(a.patientName);
    }
    
    if (sort.field === 'status') {
      return sort.direction === 'asc'
        ? a.status.localeCompare(b.status)
        : b.status.localeCompare(a.status);
    }
    
    return 0;
  });
  
  return filteredLogs;
};

// 액션 내보내기
export const { 
  initializeLogs,
  setFilters,
  resetFilters,
  setSort,
  addMessageLog,
  updateMessageLog
} = messageLogsSlice.actions;

// 리듀서 내보내기
export default messageLogsSlice.reducer;