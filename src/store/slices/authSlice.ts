// src/store/slices/authSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/types/user';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean; // 🔥 초기화 상태 추가
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: false,
  error: null,
  isInitialized: false, // 🔥 초기화 상태 추가
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.error = null;
      state.isInitialized = true; // 🔥 초기화 완료
      
      // 🔥 토큰을 localStorage에 저장
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', action.payload.token);
      }
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.error = action.payload;
      state.isInitialized = true; // 🔥 실패해도 초기화는 완료
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.error = null;
      state.isLoading = false;
      state.isInitialized = true; // 🔥 로그아웃 후에도 초기화된 상태
      
      // localStorage에서 토큰 제거
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
    },
    // 🔥 새로고침 시 토큰으로부터 사용자 정보 복원 - 개선됨
    restoreAuth: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isLoading = false;
      state.error = null;
      state.isInitialized = true; // 🔥 복원 완료
      
      console.log('🔥 Auth 상태 복원 완료:', {
        userId: action.payload.user._id,
        userName: action.payload.user.name,
        userRole: action.payload.user.role
      });
    },
    // 🔥 초기화 시작 액션 추가
    initializeAuth: (state) => {
      state.isLoading = true;
      state.isInitialized = false;
      state.error = null;
    },
    // 🔥 초기화 완료 액션 추가
    initializeComplete: (state) => {
      state.isLoading = false;
      state.isInitialized = true;
    },
    clearError: (state) => {
      state.error = null;
    },
    // 사용자 정보 업데이트 (프로필 수정 등)
    updateUserInfo: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  restoreAuth,
  initializeAuth, // 🔥 새로 추가
  initializeComplete, // 🔥 새로 추가
  clearError,
  updateUserInfo,
} = authSlice.actions;

export default authSlice.reducer;