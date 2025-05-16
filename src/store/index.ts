//src/store/index.ts

import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import patientsReducer from './slices/patientsSlice';
import callsReducer from './slices/callsSlice';
import campaignsSlice from './slices/campaignsSlice'; 
import messageLogsReducer from './slices/messageLogsSlice';
import templatesReducer from './slices/templatesSlice'
export const store = configureStore({
  reducer: {
    ui: uiReducer,
    patients: patientsReducer,
    campaigns: campaignsSlice,
    messageLogs: messageLogsReducer,
    calls: callsReducer,
    templates: templatesReducer // 추가
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store;