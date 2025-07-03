// src/store/slices/goalsSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';

export interface GoalData {
  newPatients: {
    current: number;
    target: number;
    percentage: number;
  };
  appointments: {
    current: number;
    target: number;
    percentage: number;
  };
}

interface GoalsState {
  currentMonth: GoalData;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

// 목표 달성률 계산 함수
const calculatePercentage = (current: number, target: number): number => {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
};

// 비동기 액션: 서버에서 목표 불러오기
export const loadGoalsFromServer = createAsyncThunk(
  'goals/loadFromServer',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/goals');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '목표 불러오기 실패');
      }
      
      return result.data;
    } catch (error) {
      console.error('목표 불러오기 오류:', error);
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류');
    }
  }
);

// 비동기 액션: 서버에 목표 저장하기
export const saveGoalsToServer = createAsyncThunk(
  'goals/saveToServer',
  async (
    { newPatientsTarget, appointmentsTarget }: { newPatientsTarget: number; appointmentsTarget: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPatientsTarget,
          appointmentsTarget,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '목표 저장 실패');
      }
      
      return result.data;
    } catch (error) {
      console.error('목표 저장 오류:', error);
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류');
    }
  }
);

const initialState: GoalsState = {
  currentMonth: {
    newPatients: {
      current: 0,
      target: 30, // 기본값
      percentage: 0,
    },
    appointments: {
      current: 0,
      target: 50, // 기본값
      percentage: 0,
    },
  },
  isLoading: false,
  error: null,
  lastUpdated: null,
};

const goalsSlice = createSlice({
  name: 'goals',
  initialState,
  reducers: {
    // 🔥 수정된 버전: 실제 환자 데이터 기반으로 현재 달성률 계산
    calculateCurrentProgress: (state, action: PayloadAction<{ patients: any[] }>) => {
      const { patients } = action.payload;
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      console.log('🎯 목표 달성률 계산 시작:', patients.length, '명의 환자 데이터');

      // 🔥 createdAt 대신 callInDate 기준으로 변경
      const newPatientsThisMonth = patients.filter(patient => {
        if (!patient.callInDate) return false; // createdAt → callInDate로 변경
        
        const callInDate = new Date(patient.callInDate); // createdDate → callInDate로 변경
        const isThisMonth = callInDate.getMonth() === currentMonth && 
                          callInDate.getFullYear() === currentYear;
        
        if (isThisMonth) {
          console.log('✅ 신규 환자 발견:', patient.name, '등록일:', patient.callInDate);
        }
        return isThisMonth;
      }).length;

      // 🔥 수정: 이번 달 예약 건수 계산 (월별 필터링 추가)
      const appointmentsThisMonth = patients.filter(patient => {
      // 🎯 1단계: 이번 달 신규 문의 환자인지 확인 (callInDate 기준)
      if (!patient.callInDate) return false;
      
      const callInDate = new Date(patient.callInDate); // ✅ callInDate 기준으로 통일
      const isThisMonth = callInDate.getMonth() === currentMonth && 
                        callInDate.getFullYear() === currentYear;
      
      // 이번 달 신규 문의가 아니면 제외
      if (!isThisMonth) return false;
      
      // 🎯 2단계: 예약확정 또는 내원확정 조건 (내원완료 status 제거)
      const isQualified = 
        patient.status === '예약확정' || 
        patient.visitConfirmed === true;
      
      if (isQualified) {
        console.log('✅ 이번달 예약/내원 환자:', patient.name, '상태:', patient.status, '내원확정:', patient.visitConfirmed, '문의일:', patient.callInDate);
      }
      
      return isQualified;
    }).length;

      console.log('📊 계산 결과 (월별 필터링 적용):');
      console.log('   - 신규 환자:', newPatientsThisMonth, '명');
      console.log('   - 예약/내원:', appointmentsThisMonth, '건 (이번달 등록 환자 중)');

      // 상태 업데이트
      state.currentMonth.newPatients.current = newPatientsThisMonth;
      state.currentMonth.appointments.current = appointmentsThisMonth;

      // 달성률 재계산
      state.currentMonth.newPatients.percentage = calculatePercentage(
        newPatientsThisMonth,
        state.currentMonth.newPatients.target
      );
      state.currentMonth.appointments.percentage = calculatePercentage(
        appointmentsThisMonth,
        state.currentMonth.appointments.target
      );

      console.log('📈 최종 달성률:');
      console.log('   - 신규 환자:', state.currentMonth.newPatients.percentage + '%');
      console.log('   - 예약 건수:', state.currentMonth.appointments.percentage + '%');
    },
    
    // 로딩 상태 관리
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    // 에러 상태 관리
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    // 목표 초기화 (새 달 시작시)
    resetMonthlyGoals: (state) => {
      state.currentMonth.newPatients.current = 0;
      state.currentMonth.appointments.current = 0;
      state.currentMonth.newPatients.percentage = 0;
      state.currentMonth.appointments.percentage = 0;
    },

    // 에러 클리어
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // 서버에서 목표 불러오기
    builder
      .addCase(loadGoalsFromServer.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadGoalsFromServer.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentMonth.newPatients.target = action.payload.newPatientsTarget;
        state.currentMonth.appointments.target = action.payload.appointmentsTarget;
        state.lastUpdated = action.payload.updatedAt;
        
        // 달성률 재계산
        state.currentMonth.newPatients.percentage = calculatePercentage(
          state.currentMonth.newPatients.current,
          action.payload.newPatientsTarget
        );
        state.currentMonth.appointments.percentage = calculatePercentage(
          state.currentMonth.appointments.current,
          action.payload.appointmentsTarget
        );
      })
      .addCase(loadGoalsFromServer.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // 서버에 목표 저장하기
    builder
      .addCase(saveGoalsToServer.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveGoalsToServer.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentMonth.newPatients.target = action.payload.newPatientsTarget;
        state.currentMonth.appointments.target = action.payload.appointmentsTarget;
        state.lastUpdated = action.payload.updatedAt;
        
        // 달성률 재계산
        state.currentMonth.newPatients.percentage = calculatePercentage(
          state.currentMonth.newPatients.current,
          action.payload.newPatientsTarget
        );
        state.currentMonth.appointments.percentage = calculatePercentage(
          state.currentMonth.appointments.current,
          action.payload.appointmentsTarget
        );
      })
      .addCase(saveGoalsToServer.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  calculateCurrentProgress,
  setLoading,
  setError,
  resetMonthlyGoals,
  clearError,
} = goalsSlice.actions;

export default goalsSlice.reducer;