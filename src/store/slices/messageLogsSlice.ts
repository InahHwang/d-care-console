// src/store/slices/messageLogsSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '@/store'
import { MessageLog, MessageStatus, MessageType, MessageLogSort, SortDirection } from '@/types/messageLog'
import { EventCategory } from './patientsSlice'
import axios from 'axios';

// API 클라이언트 설정
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// API에서 메시지 로그 가져오기
export const fetchMessageLogs = createAsyncThunk(
  'messageLogs/fetchMessageLogs',
  async (_, { rejectWithValue }) => {
    try {
      // MongoDB API 호출
      const response = await api.get('/messages/log');
      
      if (response.status === 200 && response.data.success) {
        return response.data.data as MessageLog[];
      }
      
      return rejectWithValue(response.data.message || '메시지 로그를 불러오는 중 오류가 발생했습니다.');
    } catch (error) {
      // API 호출 실패 시 fallback으로 localStorage 확인
      const storedLogs = localStorage.getItem('messageLogsData');
      if (storedLogs) {
        console.warn('API 호출 실패, localStorage 데이터로 폴백합니다');
        return JSON.parse(storedLogs) as MessageLog[];
      }
      
      return rejectWithValue(
        error instanceof Error ? error.message : '메시지 로그를 불러오는 중 오류가 발생했습니다.'
      );
    }
  }
);

// 새 메시지 로그 저장
export const saveMessageLog = createAsyncThunk(
  'messageLogs/saveMessageLog',
  async (messageLog: MessageLog, { getState, rejectWithValue }) => {
    try {
      // MongoDB API 호출
      const response = await api.post('/messages/log', messageLog);
      
      if (response.status === 200 && response.data.success) {
        // API 응답에서 ID가 있으면 사용, 없으면 원본 ID 유지
        const savedLog = {
          ...messageLog,
          id: response.data.logId || messageLog.id
        };
        
        // 백업으로 localStorage에도 저장
        const state = getState() as RootState;
        const currentLogs = [...state.messageLogs.logs];
        const updatedLogs = [savedLog, ...currentLogs];
        localStorage.setItem('messageLogsData', JSON.stringify(updatedLogs));
        
        return savedLog;
      }
      
      return rejectWithValue(response.data.message || '메시지 로그를 저장하는 중 오류가 발생했습니다.');
    } catch (error) {
      // API 호출 실패 시 localStorage에만 저장
      try {
        const state = getState() as RootState;
        const currentLogs = [...state.messageLogs.logs];
        const updatedLogs = [messageLog, ...currentLogs];
        localStorage.setItem('messageLogsData', JSON.stringify(updatedLogs));
        
        console.warn('API 호출 실패, localStorage에만 저장합니다');
        return messageLog;
      } catch (localStorageError) {
        return rejectWithValue(
          error instanceof Error ? error.message : '메시지 로그를 저장하는 중 오류가 발생했습니다.'
        );
      }
    }
  }
);

// 메시지 로그 일괄 저장 (다중 메시지 발송 시)
export const saveMessageLogs = createAsyncThunk(
  'messageLogs/saveMessageLogs',
  async (messageLogs: MessageLog[], { getState, rejectWithValue }) => {
    try {
      // 각 로그에 대해 개별적으로 API 호출
      const savePromises = messageLogs.map(log => api.post('/messages/log', log));
      const responses = await Promise.all(savePromises);
      
      // 저장된 로그 목록 생성
      const savedLogs = messageLogs.map((log, index) => {
        const response = responses[index];
        if (response.status === 200 && response.data.success) {
          return {
            ...log,
            id: response.data.logId || log.id
          };
        }
        return log;
      });
      
      // 백업으로 localStorage에도 저장
      const state = getState() as RootState;
      const currentLogs = [...state.messageLogs.logs];
      const updatedLogs = [...savedLogs, ...currentLogs];
      localStorage.setItem('messageLogsData', JSON.stringify(updatedLogs));
      
      return savedLogs;
    } catch (error) {
      // API 호출 실패 시 localStorage에만 저장
      try {
        const state = getState() as RootState;
        const currentLogs = [...state.messageLogs.logs];
        const updatedLogs = [...messageLogs, ...currentLogs];
        localStorage.setItem('messageLogsData', JSON.stringify(updatedLogs));
        
        console.warn('API 호출 실패, localStorage에만 저장합니다');
        return messageLogs;
      } catch (localStorageError) {
        return rejectWithValue(
          error instanceof Error ? error.message : '메시지 로그를 저장하는 중 오류가 발생했습니다.'
        );
      }
    }
  }
);

// 테스트를 위해 로그 데이터 초기화
export const clearMessageLogs = createAsyncThunk(
  'messageLogs/clearMessageLogs',
  async (_, { rejectWithValue }) => {
    try {
      // API로 로그 삭제 기능을 구현할 수 있지만, 현재는 지원하지 않음
      // 현재는 localStorage만 초기화
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
    // 로그 초기화 - API 먼저 호출, 실패 시 localStorage 사용
    initializeLogs: (state) => {
      try {
        // 이 액션은 필요한 경우 첫 로딩 시 localStorage에서 
        // 임시 데이터를 가져오는 용도로만 사용
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
    // 새 메시지 로그 추가 - 로컬 상태 업데이트만, API는 thunk에서 처리
    addMessageLog: (state, action: PayloadAction<MessageLog>) => {
      state.logs.unshift(action.payload);
    },
    // 메시지 로그 업데이트 - 로컬 상태 업데이트만, 실제 API 연동은 필요시 구현
    updateMessageLog: (state, action: PayloadAction<{ id: string; updates: Partial<MessageLog> }>) => {
      const { id, updates } = action.payload;
      const index = state.logs.findIndex(log => log.id === id);
      if (index !== -1) {
        state.logs[index] = { ...state.logs[index], ...updates };
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
        // 중복 방지를 위해 같은 ID가 있는지 확인
        const existingIndex = state.logs.findIndex(log => log.id === action.payload.id);
        if (existingIndex !== -1) {
          state.logs[existingIndex] = action.payload;
        } else {
          state.logs.unshift(action.payload);
        }
      })
      // saveMessageLogs
      .addCase(saveMessageLogs.fulfilled, (state, action) => {
        // 중복 제거 로직 추가
        const newLogs = action.payload.filter(newLog => 
          !state.logs.some(existingLog => existingLog.id === newLog.id)
        );
        state.logs = [...newLogs, ...state.logs];
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