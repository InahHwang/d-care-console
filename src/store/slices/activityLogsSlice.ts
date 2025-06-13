// src/store/slices/activityLogsSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  ActivityLog, 
  ActivityLogQuery, 
  ActivityLogResponse, 
  CreateActivityLogRequest,
  ActivityLogFilters 
} from '@/types/activityLog';

// 활동 로그 조회
export const fetchActivityLogs = createAsyncThunk(
  'activityLogs/fetchActivityLogs',
  async (query: ActivityLogQuery = {}) => {
    const queryParams = new URLSearchParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const response = await fetch(`/api/activity-logs?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('활동 로그 조회에 실패했습니다.');
    }

    return response.json() as Promise<ActivityLogResponse>;
  }
);

// 활동 로그 생성 (내부적으로 사용)
export const createActivityLog = createAsyncThunk(
  'activityLogs/createActivityLog',
  async (logData: CreateActivityLogRequest) => {
    const response = await fetch('/api/activity-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(logData),
    });

    if (!response.ok) {
      // 로그 생성 실패는 중요하지 않으므로 조용히 실패
      console.warn('활동 로그 생성 실패');
      return null;
    }

    return response.json();
  }
);

// 특정 대상의 활동 로그 조회 (환자별 편집 이력 등)
export const fetchTargetActivityLogs = createAsyncThunk(
  'activityLogs/fetchTargetActivityLogs',
  async ({ targetId, target }: { targetId: string; target: string }) => {
    const response = await fetch(`/api/activity-logs/target/${targetId}?target=${target}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('대상별 활동 로그 조회에 실패했습니다.');
    }

    return response.json() as Promise<ActivityLog[]>;
  }
);

interface ActivityLogsState {
  logs: ActivityLog[];
  targetLogs: Record<string, ActivityLog[]>; // targetId를 키로 하는 로그 저장
  totalLogs: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  filters: ActivityLogFilters;
  selectedLog: ActivityLog | null;
}

const initialState: ActivityLogsState = {
  logs: [],
  targetLogs: {},
  totalLogs: 0,
  currentPage: 1,
  totalPages: 0,
  isLoading: false,
  error: null,
  filters: {},
  selectedLog: null,
};

const activityLogsSlice = createSlice({
  name: 'activityLogs',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<ActivityLogFilters>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.currentPage = 1; // 필터 변경 시 첫 페이지로 이동
    },
    clearFilters: (state) => {
      state.filters = {};
      state.currentPage = 1;
    },
    setSelectedLog: (state, action: PayloadAction<ActivityLog | null>) => {
      state.selectedLog = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // 활동 로그 목록 조회
      .addCase(fetchActivityLogs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchActivityLogs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.logs = action.payload.logs;
        state.totalLogs = action.payload.total;
        state.currentPage = action.payload.page ?? state.currentPage;
        state.totalPages = Math.ceil(action.payload.total / (action.payload.limit || 20));
      })
      .addCase(fetchActivityLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '활동 로그 조회에 실패했습니다.';
      })
      
      // 대상별 활동 로그 조회
      .addCase(fetchTargetActivityLogs.pending, (state) => {
        // 대상별 로그 조회는 별도 로딩 상태 없음 (빠른 조회)
      })
      .addCase(fetchTargetActivityLogs.fulfilled, (state, action) => {
        // targetId를 키로 로그 저장
        const targetId = action.meta.arg.targetId;
        state.targetLogs[targetId] = action.payload;
      })
      .addCase(fetchTargetActivityLogs.rejected, (state, action) => {
        console.warn('대상별 활동 로그 조회 실패:', action.error.message);
      })
      
      // 활동 로그 생성
      .addCase(createActivityLog.fulfilled, (state, action) => {
        if (action.payload) {
          // 새 로그를 맨 앞에 추가 (최신순)
          state.logs.unshift(action.payload);
          state.totalLogs += 1;
        }
      });
  },
});

export const { 
  setFilters, 
  clearFilters, 
  setSelectedLog, 
  clearError, 
  setPage 
} = activityLogsSlice.actions;

export default activityLogsSlice.reducer;