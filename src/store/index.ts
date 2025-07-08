// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import callsReducer from './slices/callsSlice';
import campaignsReducer from './slices/campaignsSlice';
import messageLogsReducer from './slices/messageLogsSlice';
import patientsReducer from './slices/patientsSlice';
import templatesReducer from './slices/templatesSlice';
import categoriesReducer from './slices/categoriesSlice';
import uiReducer from './slices/uiSlice';
import goalsReducer from './slices/goalsSlice';
// 새로 추가된 slice들
import usersReducer from './slices/usersSlice';
import activityLogsReducer from './slices/activityLogsSlice';
import reportsReducer from './slices/reportsSlice'; // 🔥 추가
import memosReducer from './slices/memosSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    calls: callsReducer,
    campaigns: campaignsReducer,
    messageLogs: messageLogsReducer,
    patients: patientsReducer,
    templates: templatesReducer,
    categories: categoriesReducer,
    ui: uiReducer,
    goals: goalsReducer,
    memos: memosReducer, // 🔥 추가
    // 새로 추가된 reducer들
    users: usersReducer,
    activityLogs: activityLogsReducer,
    reports: reportsReducer, // 🔥 추가
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store