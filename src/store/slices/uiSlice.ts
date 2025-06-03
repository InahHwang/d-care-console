//src/store/slices/uiSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  currentMenuItem: string;
  isPatientFormOpen: boolean;
  isCallFormOpen: boolean;
  isDeleteConfirmOpen: boolean;
  patientToDelete: string | null;
  notificationCount: number;
  
  // 🔥 인바운드 위젯 관련 상태 추가
  widget: {
    isVisible: boolean;
    isOpen: boolean;
    isMinimized: boolean;
    lastActivity: string | null;
  };
}

const initialState: UiState = {
  currentMenuItem: '대시보드',
  isPatientFormOpen: false,
  isCallFormOpen: false,
  isDeleteConfirmOpen: false,
  patientToDelete: null,
  notificationCount: 3,
  
  // 🔥 위젯 초기 상태
  widget: {
    isVisible: true,
    isOpen: false,
    isMinimized: false,
    lastActivity: null,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCurrentMenuItem: (state, action: PayloadAction<string>) => {
      state.currentMenuItem = action.payload;
    },
    setCurrentTab: (state, action: PayloadAction<string>) => {
      // 현재 탭을 변경하는 액션 (환자 관리 화면에서 사용)
      state.currentMenuItem = action.payload;
    },
    openPatientForm: (state) => {
      state.isPatientFormOpen = true;
    },
    closePatientForm: (state) => {
      state.isPatientFormOpen = false;
    },
    openCallForm: (state) => {
      state.isCallFormOpen = true;
    },
    closeCallForm: (state) => {
      state.isCallFormOpen = false;
    },
    openDeleteConfirm: (state, action: PayloadAction<string>) => {
      state.isDeleteConfirmOpen = true;
      state.patientToDelete = action.payload;
    },
    closeDeleteConfirm: (state) => {
      state.isDeleteConfirmOpen = false;
      state.patientToDelete = null;
    },
    setNotificationCount: (state, action: PayloadAction<number>) => {
      state.notificationCount = action.payload;
    },
    
    // 🔥 위젯 관련 액션들 추가
    toggleWidget: (state) => {
      if (state.widget.isMinimized) {
        state.widget.isMinimized = false;
        state.widget.isOpen = true;
      } else {
        state.widget.isOpen = !state.widget.isOpen;
      }
      state.widget.lastActivity = new Date().toISOString();
    },
    openWidget: (state) => {
      state.widget.isOpen = true;
      state.widget.isMinimized = false;
      state.widget.lastActivity = new Date().toISOString();
    },
    closeWidget: (state) => {
      state.widget.isOpen = false;
      state.widget.isMinimized = false;
      state.widget.lastActivity = new Date().toISOString();
    },
    minimizeWidget: (state) => {
      state.widget.isMinimized = true;
      state.widget.isOpen = false;
      state.widget.lastActivity = new Date().toISOString();
    },
    setWidgetVisibility: (state, action: PayloadAction<boolean>) => {
      state.widget.isVisible = action.payload;
      if (!action.payload) {
        state.widget.isOpen = false;
        state.widget.isMinimized = false;
      }
    },
    updateWidgetActivity: (state) => {
      state.widget.lastActivity = new Date().toISOString();
    },
  },
});

export const { 
  setCurrentMenuItem, 
  setCurrentTab, 
  openPatientForm, 
  closePatientForm, 
  openCallForm, 
  closeCallForm,
  openDeleteConfirm,
  closeDeleteConfirm,
  setNotificationCount,
  
  // 🔥 위젯 액션들 내보내기
  toggleWidget,
  openWidget,
  closeWidget,
  minimizeWidget,
  setWidgetVisibility,
  updateWidgetActivity
} = uiSlice.actions;

export default uiSlice.reducer;