// src/store/slices/reportsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MonthlyReportData, ReportListItem, ReportFormData, FeedbackFormData } from '@/types/report';
import { RootState } from '../index';


interface ReportsState {
  reports: ReportListItem[];
  currentReport: MonthlyReportData | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isRefreshing: boolean;
  isFeedbackSubmitting: boolean; // 🔥 새로 추가: 피드백 제출 상태
  error: string | null;
}

const initialState: ReportsState = {
  reports: [],
  currentReport: null,
  isLoading: false,
  isSubmitting: false,
  isRefreshing: false,
  isFeedbackSubmitting: false, // 🔥 새로 추가
  error: null,
};

// 보고서 목록 조회
export const fetchReports = createAsyncThunk(
  'reports/fetchReports',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/reports', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('보고서 목록을 불러오는데 실패했습니다.');
      }
      const data = await response.json();
      return data.reports;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 특정 보고서 조회
export const fetchReport = createAsyncThunk(
  'reports/fetchReport',
  async (reportId: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('보고서를 불러오는데 실패했습니다.');
      }
      const data = await response.json();
      return data.report;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 🔥 새로 추가: 보고서 데이터 새로고침
export const refreshReportData = createAsyncThunk(
  'reports/refreshReportData',
  async (reportId: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshStats: true }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '보고서 데이터 새로고침에 실패했습니다.');
      }
      
      const data = await response.json();
      return data.report;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 월별 보고서 생성
export const generateMonthlyReport = createAsyncThunk(
  'reports/generateMonthlyReport',
  async ({ month, year }: { month: number; year: number }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ month, year }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '보고서 생성에 실패했습니다.');
      }
      
      const data = await response.json();
      return data.report;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 보고서 저장 (임시저장)
export const saveReport = createAsyncThunk(
  'reports/saveReport',
  async ({ reportId, formData }: { reportId: string; formData: Partial<ReportFormData> }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, status: 'draft' }),
      });
      
      if (!response.ok) {
        throw new Error('보고서 저장에 실패했습니다.');
      }
      
      const data = await response.json();
      return data.report;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 보고서 제출
export const submitReport = createAsyncThunk(
  'reports/submitReport',
  async ({ reportId, formData }: { reportId: string; formData: ReportFormData }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, status: 'submitted' }),
      });
      
      if (!response.ok) {
        throw new Error('보고서 제출에 실패했습니다.');
      }
      
      const data = await response.json();
      return data.report;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 보고서 삭제
export const deleteReport = createAsyncThunk(
  'reports/deleteReport',
  async (reportId: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('보고서 삭제에 실패했습니다.');
      }
      
      return reportId;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 🔥 새로 추가: 피드백 추가
export const addDirectorFeedback = createAsyncThunk(
  'reports/addDirectorFeedback',
  async ({ reportId, feedbackData }: { reportId: string; feedbackData: FeedbackFormData }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          feedbackAction: 'add',
          feedbackData
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '피드백 추가에 실패했습니다.');
      }
      
      const data = await response.json();
      return data.report;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 🔥 새로 추가: 피드백 수정
export const updateDirectorFeedback = createAsyncThunk(
  'reports/updateDirectorFeedback',
  async ({ reportId, feedbackId, feedbackData }: { reportId: string; feedbackId: string; feedbackData: FeedbackFormData }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          feedbackAction: 'update',
          feedbackId,
          feedbackData
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '피드백 수정에 실패했습니다.');
      }
      
      const data = await response.json();
      return data.report;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 🔥 새로 추가: 피드백 삭제
export const deleteDirectorFeedback = createAsyncThunk(
  'reports/deleteDirectorFeedback',
  async ({ reportId, feedbackId }: { reportId: string; feedbackId: string }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          feedbackAction: 'delete',
          feedbackId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '피드백 삭제에 실패했습니다.');
      }
      
      const data = await response.json();
      return data.report;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }
);


const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    clearCurrentReport: (state) => {
      state.currentReport = null;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateCurrentReport: (state, action: PayloadAction<Partial<MonthlyReportData>>) => {
      if (state.currentReport) {
        state.currentReport = { ...state.currentReport, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchReports
      .addCase(fetchReports.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.isLoading = false;
        state.reports = action.payload;
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // fetchReport
      .addCase(fetchReport.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReport.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentReport = action.payload;
      })
      .addCase(fetchReport.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // 🔥 새로 추가: refreshReportData
      .addCase(refreshReportData.pending, (state) => {
        state.isRefreshing = true;
        state.error = null;
      })
      .addCase(refreshReportData.fulfilled, (state, action) => {
        state.isRefreshing = false;
        state.currentReport = action.payload;
        // 보고서 목록에서도 업데이트
        const index = state.reports.findIndex(r => r._id === action.payload._id);
        if (index !== -1) {
          state.reports[index] = {
            _id: action.payload._id!,
            month: action.payload.month,
            year: action.payload.year,
            status: action.payload.status,
            createdBy: action.payload.createdBy,
            createdByName: action.payload.createdByName,
            createdAt: action.payload.createdAt,
            updatedAt: action.payload.updatedAt,
          };
        }
      })
      .addCase(refreshReportData.rejected, (state, action) => {
        state.isRefreshing = false;
        state.error = action.payload as string;
      })
      
      // generateMonthlyReport
      .addCase(generateMonthlyReport.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(generateMonthlyReport.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentReport = action.payload;
      })
      .addCase(generateMonthlyReport.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // saveReport
      .addCase(saveReport.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(saveReport.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.currentReport = action.payload;
        // 보고서 목록에서도 업데이트
        const index = state.reports.findIndex(r => r._id === action.payload._id);
        if (index !== -1) {
          state.reports[index] = {
            _id: action.payload._id!,
            month: action.payload.month,
            year: action.payload.year,
            status: action.payload.status,
            createdBy: action.payload.createdBy,
            createdByName: action.payload.createdByName,
            createdAt: action.payload.createdAt,
            updatedAt: action.payload.updatedAt,
          };
        }
      })
      .addCase(saveReport.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload as string;
      })
      
      // submitReport
      .addCase(submitReport.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(submitReport.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.currentReport = action.payload;
        // 보고서 목록에서도 업데이트
        const index = state.reports.findIndex(r => r._id === action.payload._id);
        if (index !== -1) {
          state.reports[index] = {
            _id: action.payload._id!,
            month: action.payload.month,
            year: action.payload.year,
            status: action.payload.status,
            createdBy: action.payload.createdBy,
            createdByName: action.payload.createdByName,
            createdAt: action.payload.createdAt,
            updatedAt: action.payload.updatedAt,
          };
        }
      })
      .addCase(submitReport.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload as string;
      })

      // deleteReport
      .addCase(deleteReport.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(deleteReport.fulfilled, (state, action) => {
        state.isSubmitting = false;
        const deletedReportId = action.payload;
        
        // 보고서 목록에서 삭제
        state.reports = state.reports.filter(r => r._id !== deletedReportId);
        
        // 현재 보고서가 삭제된 것이면 초기화
        if (state.currentReport && state.currentReport._id === deletedReportId) {
          state.currentReport = null;
        }
      })
      .addCase(deleteReport.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload as string;
      })
      // 🔥 새로 추가: addDirectorFeedback
      .addCase(addDirectorFeedback.pending, (state) => {
        state.isFeedbackSubmitting = true;
        state.error = null;
      })
      .addCase(addDirectorFeedback.fulfilled, (state, action) => {
        state.isFeedbackSubmitting = false;
        state.currentReport = action.payload;
      })
      .addCase(addDirectorFeedback.rejected, (state, action) => {
        state.isFeedbackSubmitting = false;
        state.error = action.payload as string;
      })
      
      // 🔥 새로 추가: updateDirectorFeedback
      .addCase(updateDirectorFeedback.pending, (state) => {
        state.isFeedbackSubmitting = true;
        state.error = null;
      })
      .addCase(updateDirectorFeedback.fulfilled, (state, action) => {
        state.isFeedbackSubmitting = false;
        state.currentReport = action.payload;
      })
      .addCase(updateDirectorFeedback.rejected, (state, action) => {
        state.isFeedbackSubmitting = false;
        state.error = action.payload as string;
      })
      
      // 🔥 새로 추가: deleteDirectorFeedback
      .addCase(deleteDirectorFeedback.pending, (state) => {
        state.isFeedbackSubmitting = true;
        state.error = null;
      })
      .addCase(deleteDirectorFeedback.fulfilled, (state, action) => {
        state.isFeedbackSubmitting = false;
        state.currentReport = action.payload;
      })
      .addCase(deleteDirectorFeedback.rejected, (state, action) => {
        state.isFeedbackSubmitting = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentReport, clearError, updateCurrentReport } = reportsSlice.actions;

// Selectors
export const selectReports = (state: RootState) => state.reports.reports;
export const selectCurrentReport = (state: RootState) => state.reports.currentReport;
export const selectReportsLoading = (state: RootState) => state.reports.isLoading;
export const selectReportsSubmitting = (state: RootState) => state.reports.isSubmitting;
export const selectReportsRefreshing = (state: RootState) => state.reports.isRefreshing; // 🔥 새로 추가
export const selectFeedbackSubmitting = (state: RootState) => state.reports.isFeedbackSubmitting; // 🔥 새로 추가
export const selectReportsError = (state: RootState) => state.reports.error;

export default reportsSlice.reducer;