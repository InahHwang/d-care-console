// src/store/slices/goalsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
}

// 목표 달성률 계산 함수
const calculatePercentage = (current: number, target: number): number => {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
};

// localStorage에서 초기 목표값 가져오기
const getInitialTargets = () => {
  if (typeof window === 'undefined') {
    return { newPatients: 30, appointments: 50 }; // SSR 기본값
  }

  try {
    const savedGoals = localStorage.getItem('monthlyGoals');
    if (savedGoals) {
      const parsedGoals = JSON.parse(savedGoals);
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      if (parsedGoals[currentMonthKey]) {
        return {
          newPatients: parsedGoals[currentMonthKey].newPatients || 30,
          appointments: parsedGoals[currentMonthKey].appointments || 50,
        };
      }
    }
  } catch (error) {
    console.error('목표 불러오기 오류:', error);
  }

  return { newPatients: 30, appointments: 50 }; // 기본값
};

const initialTargets = getInitialTargets();

const initialState: GoalsState = {
  currentMonth: {
    newPatients: {
      current: 0, // 실제 데이터에서 계산될 예정
      target: initialTargets.newPatients,
      percentage: 0,
    },
    appointments: {
      current: 0, // 실제 데이터에서 계산될 예정
      target: initialTargets.appointments,
      percentage: 0,
    },
  },
  isLoading: false,
  error: null,
};

// localStorage에 목표 저장하는 헬퍼 함수
const saveTargetsToStorage = (newPatientsTarget: number, appointmentsTarget: number) => {
  if (typeof window === 'undefined') return;
  
  try {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const existingGoals = JSON.parse(localStorage.getItem('monthlyGoals') || '{}');
    
    existingGoals[currentMonthKey] = {
      newPatients: newPatientsTarget,
      appointments: appointmentsTarget,
      updatedAt: new Date().toISOString(),
    };
    
    localStorage.setItem('monthlyGoals', JSON.stringify(existingGoals));
  } catch (error) {
    console.error('목표 저장 중 오류:', error);
  }
};

const goalsSlice = createSlice({
  name: 'goals',
  initialState,
  reducers: {
    // 목표 설정
    setGoalTargets: (state, action: PayloadAction<{ newPatientsTarget: number; appointmentsTarget: number }>) => {
      const { newPatientsTarget, appointmentsTarget } = action.payload;
      
      state.currentMonth.newPatients.target = newPatientsTarget;
      state.currentMonth.appointments.target = appointmentsTarget;
      
      // localStorage에 저장
      saveTargetsToStorage(newPatientsTarget, appointmentsTarget);
      
      // 달성률 재계산
      state.currentMonth.newPatients.percentage = calculatePercentage(
        state.currentMonth.newPatients.current,
        newPatientsTarget
      );
      state.currentMonth.appointments.percentage = calculatePercentage(
        state.currentMonth.appointments.current,
        appointmentsTarget
      );
    },
    
    // 실제 환자 데이터 기반으로 현재 달성률 계산
    calculateCurrentProgress: (state, action: PayloadAction<{ patients: any[] }>) => {
      const { patients } = action.payload;
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      console.log('목표 달성률 계산 시작:', patients.length, '명의 환자 데이터');

      // 이번 달 신규 환자 수 계산 (createdAt 기준)
      const newPatientsThisMonth = patients.filter(patient => {
        if (!patient.createdAt) return false;
        const createdDate = new Date(patient.createdAt);
        const isThisMonth = createdDate.getMonth() === currentMonth && 
                           createdDate.getFullYear() === currentYear;
        
        if (isThisMonth) {
          console.log('신규 환자 발견:', patient.name, '등록일:', patient.createdAt);
        }
        return isThisMonth;
      }).length;

      // 이번 달 예약 건수 계산 (예약확정 상태 + 내원확정 포함)
      const appointmentsThisMonth = patients.filter(patient => {
        // 예약확정 상태이거나 내원확정된 환자
        if (patient.status === '예약확정' || patient.visitConfirmed) {
          console.log('예약/내원확정 환자 발견:', patient.name, '상태:', patient.status, '내원확정:', patient.visitConfirmed);
          return true;
        }
        return false;
      }).length;

      console.log('계산 결과 - 신규 환자:', newPatientsThisMonth, '명, 예약:', appointmentsThisMonth, '건');

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

      console.log('최종 달성률 - 신규 환자:', state.currentMonth.newPatients.percentage + '%', '예약:', state.currentMonth.appointments.percentage + '%');
    },
    
    // localStorage에서 목표를 불러와서 Redux 스토어에 반영
    loadGoalsFromStorage: (state) => {
      if (typeof window === 'undefined') return;
      
      try {
        const savedGoals = localStorage.getItem('monthlyGoals');
        if (savedGoals) {
          const parsedGoals = JSON.parse(savedGoals);
          const now = new Date();
          const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          
          if (parsedGoals[currentMonthKey]) {
            const monthlyGoals = parsedGoals[currentMonthKey];
            state.currentMonth.newPatients.target = monthlyGoals.newPatients || 30;
            state.currentMonth.appointments.target = monthlyGoals.appointments || 50;
            
            // 달성률 재계산
            state.currentMonth.newPatients.percentage = calculatePercentage(
              state.currentMonth.newPatients.current,
              state.currentMonth.newPatients.target
            );
            state.currentMonth.appointments.percentage = calculatePercentage(
              state.currentMonth.appointments.current,
              state.currentMonth.appointments.target
            );
          }
        }
      } catch (error) {
        console.error('목표 불러오기 오류:', error);
      }
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
  },
});

export const {
  setGoalTargets,
  calculateCurrentProgress,
  loadGoalsFromStorage,
  setLoading,
  setError,
  resetMonthlyGoals,
} = goalsSlice.actions;

export default goalsSlice.reducer;