//src/store/slices/uiSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  currentMenuItem: string;
  isPatientFormOpen: boolean;
  isCallFormOpen: boolean;
  isDeleteConfirmOpen: boolean;
  patientToDelete: string | null;
  notificationCount: number;
}

const initialState: UiState = {
  currentMenuItem: '대시보드',
  isPatientFormOpen: false,
  isCallFormOpen: false,
  isDeleteConfirmOpen: false,
  patientToDelete: null,
  notificationCount: 3,
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
  setNotificationCount
} = uiSlice.actions;

export default uiSlice.reducer;