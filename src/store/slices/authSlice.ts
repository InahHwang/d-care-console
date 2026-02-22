// src/store/slices/authSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/types/user';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  isInitialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{ user: User; token: string; refreshToken?: string }>) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken || null;
      state.error = null;
      state.isInitialized = true;
      // localStorage 폴백 (httpOnly 쿠키 전환 완료 시 제거 예정)
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', action.payload.token);
        if (action.payload.refreshToken) {
          localStorage.setItem('refreshToken', action.payload.refreshToken);
        }
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
      state.refreshToken = null;
      state.error = null;
      state.isLoading = false;
      state.isInitialized = true;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
    },
    restoreAuth: (state, action: PayloadAction<{ user: User; token: string; refreshToken?: string }>) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken || null;
      state.isLoading = false;
      state.error = null;
      state.isInitialized = true;
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