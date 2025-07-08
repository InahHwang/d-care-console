// src/store/slices/memosSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Memo, CreateMemoRequest, UpdateMemoRequest, MemosState } from '@/types/memo';

// API 호출 함수들
export const fetchMemos = createAsyncThunk(
  'memos/fetchMemos',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/memos', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('메모를 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      return data.memos || [];
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createMemo = createAsyncThunk(
  'memos/createMemo',
  async (memoData: CreateMemoRequest, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/memos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(memoData),
      });
      
      if (!response.ok) {
        throw new Error('메모 생성에 실패했습니다.');
      }
      
      const data = await response.json();
      return data.memo;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateMemo = createAsyncThunk(
  'memos/updateMemo',
  async ({ id, updates }: { id: string; updates: UpdateMemoRequest }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/memos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('메모 수정에 실패했습니다.');
      }
      
      const data = await response.json();
      return data.memo;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteMemo = createAsyncThunk(
  'memos/deleteMemo',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/memos/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('메모 삭제에 실패했습니다.');
      }
      
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState: MemosState = {
  memos: [],
  isLoading: false,
  error: null,
  isManagerVisible: false,
  maxZIndex: 1000,
};

const memosSlice = createSlice({
  name: 'memos',
  initialState,
  reducers: {
    toggleMemoManager: (state) => {
      state.isManagerVisible = !state.isManagerVisible;
    },
    setMemoManagerVisible: (state, action: PayloadAction<boolean>) => {
      state.isManagerVisible = action.payload;
    },
    updateMemoPosition: (state, action: PayloadAction<{ id: string; position: { x: number; y: number } }>) => {
      const memo = state.memos.find(m => m._id === action.payload.id);
      if (memo) {
        memo.position = action.payload.position;
      }
    },
    updateMemoSize: (state, action: PayloadAction<{ id: string; size: { width: number; height: number } }>) => {
      const memo = state.memos.find(m => m._id === action.payload.id);
      if (memo) {
        memo.size = action.payload.size;
      }
    },
    bringMemoToFront: (state, action: PayloadAction<string>) => {
      const memo = state.memos.find(m => m._id === action.payload);
      if (memo) {
        state.maxZIndex += 1;
        memo.zIndex = state.maxZIndex;
      }
    },
    toggleMemoMinimized: (state, action: PayloadAction<string>) => {
      const memo = state.memos.find(m => m._id === action.payload);
      if (memo) {
        memo.isMinimized = !memo.isMinimized;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchMemos
      .addCase(fetchMemos.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMemos.fulfilled, (state, action) => {
        state.isLoading = false;
        state.memos = action.payload;
        // maxZIndex 업데이트
        const maxZ = Math.max(...action.payload.map((m: Memo) => m.zIndex), 1000);
        state.maxZIndex = maxZ;
      })
      .addCase(fetchMemos.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // createMemo
      .addCase(createMemo.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createMemo.fulfilled, (state, action) => {
        state.isLoading = false;
        state.memos.push(action.payload);
        // 새 메모를 최상단으로
        state.maxZIndex += 1;
        action.payload.zIndex = state.maxZIndex;
      })
      .addCase(createMemo.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // updateMemo
      .addCase(updateMemo.fulfilled, (state, action) => {
        const index = state.memos.findIndex(m => m._id === action.payload._id);
        if (index !== -1) {
          state.memos[index] = action.payload;
        }
      })
      .addCase(updateMemo.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      
      // deleteMemo
      .addCase(deleteMemo.fulfilled, (state, action) => {
        state.memos = state.memos.filter(m => m._id !== action.payload);
      })
      .addCase(deleteMemo.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  toggleMemoManager,
  setMemoManagerVisible,
  updateMemoPosition,
  updateMemoSize,
  bringMemoToFront,
  toggleMemoMinimized,
  clearError,
} = memosSlice.actions;

export default memosSlice.reducer;