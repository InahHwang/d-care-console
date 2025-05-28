// src/store/slices/messageLogsSlice.ts

import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit'
import { RootState } from '@/store'
import { MessageLog, MessageStatus, MessageType, MessageLogSort, SortDirection } from '@/types/messageLog'
import { EventCategory } from '@/types/messageLog'
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

// 새 메시지 로그 저장 - 중복 방지 로직 강화
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
        
        // 백업으로 localStorage에도 저장 - 중복 방지 강화
        const state = getState() as RootState;
        const currentLogs = [...state.messageLogs.logs];
        
        // 중복 확인 - ID 기반
        const existingIndex = currentLogs.findIndex(log => log.id === savedLog.id);
        let updatedLogs;
        
        if (existingIndex !== -1) {
          // 기존 로그 업데이트
          updatedLogs = [...currentLogs];
          updatedLogs[existingIndex] = savedLog;
          console.log(`로그 업데이트 (ID: ${savedLog.id})`);
        } else {
          // 추가 중복 검사 (내용, 시간, 환자 ID로 중복 확인)
          const potentialDuplicate = currentLogs.find(log => 
            log.patientId === savedLog.patientId && 
            log.content === savedLog.content &&
            Math.abs(new Date(log.createdAt).getTime() - new Date(savedLog.createdAt).getTime()) < 5000 // 5초 이내
          );
          
          if (potentialDuplicate) {
            console.warn(`잠재적 중복 로그 감지됨 - 저장하지 않음 (원본 ID: ${potentialDuplicate.id}, 새 ID: ${savedLog.id})`);
            return potentialDuplicate; // 기존 로그 반환
          }
          
          // 새 로그 추가
          updatedLogs = [savedLog, ...currentLogs];
          console.log(`새 로그 추가 (ID: ${savedLog.id})`);
        }
        
        localStorage.setItem('messageLogsData', JSON.stringify(updatedLogs));
        
        return savedLog;
      }
      
      return rejectWithValue(response.data.message || '메시지 로그를 저장하는 중 오류가 발생했습니다.');
    } catch (error) {
      // API 호출 실패 시 localStorage에만 저장
      try {
        const state = getState() as RootState;
        const currentLogs = [...state.messageLogs.logs];
        
        // 중복 방지를 위해 같은 ID가 이미 있는지 확인
        const existingIndex = currentLogs.findIndex(log => log.id === messageLog.id);
        let updatedLogs;
        
        if (existingIndex !== -1) {
          // 기존 로그 업데이트
          updatedLogs = [...currentLogs];
          updatedLogs[existingIndex] = messageLog;
        } else {
          // 내용 기반 중복 검사 추가
          const potentialDuplicate = currentLogs.find(log => 
            log.patientId === messageLog.patientId && 
            log.content === messageLog.content &&
            Math.abs(new Date(log.createdAt).getTime() - new Date(messageLog.createdAt).getTime()) < 5000
          );
          
          if (potentialDuplicate) {
            console.warn(`localStorage 저장 중 중복 로그 감지됨 (원본 ID: ${potentialDuplicate.id}, 새 ID: ${messageLog.id})`);
            return potentialDuplicate; // 기존 로그 반환
          }
          
          // 새 로그 추가
          updatedLogs = [messageLog, ...currentLogs];
        }
        
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

// 메시지 로그 일괄 저장 (다중 메시지 발송 시) - 중복 방지 강화
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
      
      // 중복 제거 로직 강화
      const uniqueLogsMap = new Map<string, MessageLog>();
      
      // 먼저 새로운 로그들을 맵에 추가
      savedLogs.forEach(log => {
        uniqueLogsMap.set(log.id, log);
      });
      
      // 기존 로그와 비교하여 내용 기반 중복 제거
      currentLogs.forEach(existingLog => {
        // 이미 ID가 동일한 로그가 있으면 맵의 값을 유지 (새 로그 우선)
        if (!uniqueLogsMap.has(existingLog.id)) {
          // ID는 다르지만 내용, 환자ID, 시간이 유사한 잠재적 중복 확인
          const potentialDuplicate = Array.from(uniqueLogsMap.values()).find(log => 
            log.patientId === existingLog.patientId && 
            log.content === existingLog.content &&
            Math.abs(new Date(log.createdAt).getTime() - new Date(existingLog.createdAt).getTime()) < 5000
          );
          
          if (!potentialDuplicate) {
            uniqueLogsMap.set(existingLog.id, existingLog);
          } else {
            console.warn(`내용 기반 중복 감지됨 - 기존 로그 제외`);
          }
        }
      });
      
      const uniqueLogs = Array.from(uniqueLogsMap.values());
      localStorage.setItem('messageLogsData', JSON.stringify(uniqueLogs));
      
      return savedLogs;
    } catch (error) {
      // API 호출 실패 시 localStorage에만 저장
      try {
        const state = getState() as RootState;
        const currentLogs = [...state.messageLogs.logs];
        
        // 중복 방지 - 일괄 처리에 맞게 개선
        const deduplicatedLogs: MessageLog[] = []; // 명시적 타입 지정
        
        // 먼저 각 로그가 이미 존재하는지 확인하고 중복이 아닌 것만 추가
        for (const newLog of messageLogs) {
          // ID 기반 중복 확인
          const existingLogById = currentLogs.find(log => log.id === newLog.id);
          
          if (existingLogById) {
            continue; // 중복 로그는 건너뜀
          }
          
          // 내용 기반 중복 확인
          const existingLogByContent = currentLogs.find(log => 
            log.patientId === newLog.patientId && 
            log.content === newLog.content &&
            Math.abs(new Date(log.createdAt).getTime() - new Date(newLog.createdAt).getTime()) < 5000
          );
          
          if (existingLogByContent) {
            console.warn(`내용 기반 중복 감지됨 - 로그 제외 (ID: ${newLog.id})`);
            continue; // 중복 로그는 건너뜀
          }
          
          // 새 로그들 사이에서도 중복 확인
          const duplicateInNewLogs = deduplicatedLogs.find(log => 
            log.patientId === newLog.patientId && 
            log.content === newLog.content &&
            Math.abs(new Date(log.createdAt).getTime() - new Date(newLog.createdAt).getTime()) < 5000
          );
          
          if (!duplicateInNewLogs) {
            deduplicatedLogs.push(newLog);
          } else {
            console.warn(`새 로그 간 중복 감지됨 - 로그 제외 (ID: ${newLog.id})`);
          }
        }
        
        // 중복 제거된 로그만 저장
        const updatedLogs = [...deduplicatedLogs, ...currentLogs];
        localStorage.setItem('messageLogsData', JSON.stringify(updatedLogs));
        
        console.warn('API 호출 실패, localStorage에만 저장합니다');
        return deduplicatedLogs;
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
    messageTypes: ['SMS', 'LMS', 'MMS'],
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
          console.log(`initializeLogs - ${state.logs.length}개의 로그 불러옴`);
        }
        state.isLoading = false;
        state.error = null;
      } catch (error) {
        console.error('로그 초기화 오류:', error);
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
      // 중복 방지 개선
      const newLog = action.payload;
      
      // ID 기반 중복 확인
      const existingIndex = state.logs.findIndex(log => log.id === newLog.id);
      
      if (existingIndex !== -1) {
        // 기존 로그 업데이트
        state.logs[existingIndex] = newLog;
        console.log(`로그 업데이트됨: ${newLog.id}`);
      } else {
        // 내용 기반 중복 확인
        const potentialDuplicate = state.logs.find(log => 
          log.patientId === newLog.patientId && 
          log.content === newLog.content &&
          Math.abs(new Date(log.createdAt).getTime() - new Date(newLog.createdAt).getTime()) < 5000
        );
        
        if (potentialDuplicate) {
          console.warn(`중복 로그 감지됨 - 추가하지 않음 (원본 ID: ${potentialDuplicate.id}, 새 ID: ${newLog.id})`);
          return; // 중복이면 추가하지 않음
        }
        
        // 중복이 아닌 경우만 추가
        state.logs.unshift(newLog);
        console.log(`로그 추가됨: ${newLog.id}`);
      }
      
      // localStorage에도 저장
      try {
        localStorage.setItem('messageLogsData', JSON.stringify(state.logs));
      } catch (error) {
        console.error('localStorage 저장 실패:', error);
      }
    },
    // 메시지 로그 업데이트 - 로컬 상태 업데이트만, 실제 API 연동은 필요시 구현
    updateMessageLog: (state, action: PayloadAction<{ id: string; updates: Partial<MessageLog> }>) => {
      const { id, updates } = action.payload;
      const index = state.logs.findIndex(log => log.id === id);
      if (index !== -1) {
        state.logs[index] = { ...state.logs[index], ...updates };
        
        // localStorage 업데이트
        try {
          localStorage.setItem('messageLogsData', JSON.stringify(state.logs));
        } catch (error) {
          console.error('localStorage 업데이트 실패:', error);
        }
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
        console.log(`fetchMessageLogs - ${state.logs.length}개의 로그 불러옴`);
      })
      .addCase(fetchMessageLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('fetchMessageLogs 오류:', action.payload);
      })
      // saveMessageLog
      .addCase(saveMessageLog.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(saveMessageLog.fulfilled, (state, action) => {
        state.isLoading = false;
        
        // ID 기반 중복 확인
        const existingIndex = state.logs.findIndex(log => log.id === action.payload.id);
        
        if (existingIndex !== -1) {
          // 기존 로그 업데이트
          state.logs[existingIndex] = action.payload;
          console.log(`saveMessageLog - 로그 업데이트됨: ${action.payload.id}`);
        } else {
          // 내용 기반 중복 검사 추가
          const potentialDuplicate = state.logs.find(log => 
            log.patientId === action.payload.patientId && 
            log.content === action.payload.content &&
            Math.abs(new Date(log.createdAt).getTime() - new Date(action.payload.createdAt).getTime()) < 5000
          );
          
          if (potentialDuplicate) {
            console.warn(`saveMessageLog - 중복 로그 감지됨: ${action.payload.id} (원본: ${potentialDuplicate.id})`);
            // 중복인 경우에는 상태를 변경하지 않음
          } else {
            // 중복이 아닌 경우만 추가
            state.logs.unshift(action.payload);
            console.log(`saveMessageLog - 로그 추가됨: ${action.payload.id}`);
          }
        }
      })
      .addCase(saveMessageLog.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('saveMessageLog 오류:', action.payload);
      })
      // saveMessageLogs
      .addCase(saveMessageLogs.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(saveMessageLogs.fulfilled, (state, action) => {
        state.isLoading = false;
        
        // 중복 제거 로직 개선
        const newLogs: MessageLog[] = [];
        
        // 새 로그들을 순회하면서 중복 체크
        action.payload.forEach(newLog => {
          // ID 기반 중복 확인
          const existingLogById = state.logs.find(log => log.id === newLog.id);
          
          if (existingLogById) {
            // 기존 로그 업데이트 (상태는 변경하지 않고 상태 업데이트는 별도 렌더링 사이클에서)
            console.log(`saveMessageLogs - 이미 존재하는 로그 ID: ${newLog.id}`);
            return;
          }
          
          // 내용 기반 중복 확인
          const existingLogByContent = state.logs.find(log => 
            log.patientId === newLog.patientId && 
            log.content === newLog.content &&
            Math.abs(new Date(log.createdAt).getTime() - new Date(newLog.createdAt).getTime()) < 5000
          );
          
          if (existingLogByContent) {
            console.warn(`saveMessageLogs - 내용 기반 중복 감지: ${newLog.id} (원본: ${existingLogByContent.id})`);
            return;
          }
          
          // 새 로그들 사이에서도 중복 확인
          const duplicateInNewLogs = newLogs.find(log => 
            log.patientId === newLog.patientId && 
            log.content === newLog.content &&
            Math.abs(new Date(log.createdAt).getTime() - new Date(newLog.createdAt).getTime()) < 5000
          );
          
          if (duplicateInNewLogs) {
            console.warn(`saveMessageLogs - 새 로그 간 중복 감지: ${newLog.id} (원본: ${duplicateInNewLogs.id})`);
            return;
          }
          
          // 모든 중복 검사를 통과한 로그만 추가
          newLogs.push(newLog);
        });
        
        if (newLogs.length > 0) {
          state.logs = [...newLogs, ...state.logs];
          console.log(`saveMessageLogs - ${newLogs.length}개의 로그 추가됨`);
        } else {
          console.log('saveMessageLogs - 추가할 새 로그가 없음 (모두 중복)');
        }
      })
      .addCase(saveMessageLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('saveMessageLogs 오류:', action.payload);
      })
      // clearMessageLogs
      .addCase(clearMessageLogs.fulfilled, (state) => {
        state.logs = [];
        console.log('clearMessageLogs - 모든 로그 삭제됨');
      });
  }
});

// 기본 로그 선택자
const selectLogs = (state: RootState) => state.messageLogs.logs;
const selectFilters = (state: RootState) => state.messageLogs.filters;
const selectSort = (state: RootState) => state.messageLogs.sort;

// 메모이제이션된 환자별 로그 선택자
export const selectPatientLogs = createSelector(
  [selectLogs, (_, patientId?: string) => patientId],
  (logs, patientId) => {
    if (!patientId) return [];
    return logs.filter(log => log.patientId === patientId);
  }
);

// 필터링 및 정렬된 로그 선택자 (메모이제이션)
export const selectFilteredLogs = createSelector(
  [selectLogs, selectFilters, selectSort],
  (logs, filters, sort) => {
    // 필터링
    let filteredLogs = logs.filter(log => {
      // 검색어 필터
      if (filters.searchTerm && !log.content?.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
          !log.patientName?.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
          !log.phoneNumber?.includes(filters.searchTerm)) {
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
      if (filters.startDate && log.createdAt) {
        const startDate = new Date(filters.startDate);
        const logDate = new Date(log.createdAt);
        startDate.setHours(0, 0, 0, 0);
        if (logDate < startDate) {
          return false;
        }
      }
      
      // 종료 날짜 필터
      if (filters.endDate && log.createdAt) {
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
    return [...filteredLogs].sort((a, b) => {
      if (sort.field === 'createdAt' && a.createdAt && b.createdAt) {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sort.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      if (sort.field === 'patientName') {
        return sort.direction === 'asc' 
          ? (a.patientName || '').localeCompare(b.patientName || '') 
          : (b.patientName || '').localeCompare(a.patientName || '');
      }
      
      if (sort.field === 'status') {
        return sort.direction === 'asc'
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      }
      
      return 0;
    });
  }
);

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