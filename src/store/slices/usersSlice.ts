// src/store/slices/usersSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, CreateUserRequest, UpdateUserRequest, UsersListResponse } from '@/types/user';

// 사용자 목록 조회
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (params: { page?: number; limit?: number; search?: string } = {}) => {
    const { page = 1, limit = 10, search = '' } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search })
    });

    const response = await fetch(`/api/users?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('사용자 목록 조회에 실패했습니다.');
    }

    return response.json() as Promise<UsersListResponse>;
  }
);

// 사용자 생성
export const createUser = createAsyncThunk(
  'users/createUser',
  async (userData: CreateUserRequest, { dispatch, rejectWithValue }) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '사용자 생성에 실패했습니다.');
      }

      const result = await response.json();
      
      // 생성 성공 후 목록 새로고침
      dispatch(fetchUsers({}));
      
      return result;
    } catch (error) {
      return rejectWithValue('사용자 생성 중 오류가 발생했습니다.');
    }
  }
);

// 사용자 수정
export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ userId, userData }: { userId: string; userData: UpdateUserRequest }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '사용자 수정에 실패했습니다.');
      }

      return response.json();
    } catch (error) {
      return rejectWithValue('사용자 수정 중 오류가 발생했습니다.');
    }
  }
);

// 사용자 활성화/비활성화
export const toggleUserStatus = createAsyncThunk(
  'users/toggleUserStatus',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/users/${userId}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '사용자 상태 변경에 실패했습니다.');
      }

      return response.json();
    } catch (error) {
      return rejectWithValue('사용자 상태 변경 중 오류가 발생했습니다.');
    }
  }
);


// 사용자 삭제 (소프트 삭제) - 수정된 버전
export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (userId: string, { dispatch, rejectWithValue }) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '사용자 삭제에 실패했습니다.');
      }

      // 삭제 성공 후 목록 새로고침
      dispatch(fetchUsers({}));
      
      return { userId };
    } catch (error) {
      return rejectWithValue('사용자 삭제 중 오류가 발생했습니다.');
    }
  }
);

interface UsersState {
  users: User[];
  totalUsers: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  selectedUser: User | null;
}

const initialState: UsersState = {
  users: [],
  totalUsers: 0,
  currentPage: 1,
  totalPages: 0,
  isLoading: false,
  error: null,
  searchTerm: '',
  selectedUser: null,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
      state.currentPage = 1; // 검색 시 첫 페이지로 이동
    },
    setSelectedUser: (state, action: PayloadAction<User | null>) => {
      state.selectedUser = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 사용자 목록 조회
      .addCase(fetchUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload.users;
        state.totalUsers = action.payload.total;
        state.currentPage = action.payload.page;
        state.totalPages = Math.ceil(action.payload.total / 10); // limit 기본값 10
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '사용자 목록 조회에 실패했습니다.';
      })
      
      // 사용자 생성
      .addCase(createUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.isLoading = false;
        // fetchUsers가 다시 호출되므로 여기서는 별도 처리 불필요
        // 성공 메시지는 컴포넌트에서 처리
      })
      .addCase(createUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // 사용자 수정
      .addCase(updateUser.pending, (state) => {
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        const index = state.users.findIndex(user => user.id === action.payload.user.id);
        if (index !== -1) {
          state.users[index] = action.payload.user;
        }
        if (state.selectedUser?.id === action.payload.user.id) {
          state.selectedUser = action.payload.user;
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      
      // 사용자 상태 토글
      .addCase(toggleUserStatus.fulfilled, (state, action) => {
        const index = state.users.findIndex(user => user.id === action.payload.user.id);
        if (index !== -1) {
          state.users[index] = action.payload.user;
        }
      })
      .addCase(toggleUserStatus.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      
      // 사용자 삭제
      .addCase(deleteUser.pending, (state) => {
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        // fetchUsers가 다시 호출되므로 여기서는 별도 처리 불필요
        // 단, 선택된 사용자가 삭제된 경우 초기화
        if (state.selectedUser?.id === action.payload.userId) {
          state.selectedUser = null;
        }
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { setSearchTerm, setSelectedUser, clearError } = usersSlice.actions;
export default usersSlice.reducer;