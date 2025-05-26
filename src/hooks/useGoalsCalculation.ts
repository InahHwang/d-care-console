// src/hooks/useGoalsCalculation.ts
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { loadGoalsFromServer } from '@/store/slices/goalsSlice';

interface GoalData {
  current: number;
  target: number;
  percentage: number;
}

interface CurrentMonthGoals {
  newPatients: GoalData;
  appointments: GoalData;
}

export const useGoalsCalculation = (): CurrentMonthGoals => {
  const dispatch = useDispatch();
  const { currentMonth } = useSelector((state: RootState) => state.goals);

  // 🎯 컴포넌트 마운트 시 서버에서 목표 불러오기
  useEffect(() => {
    dispatch(loadGoalsFromServer() as any);
  }, [dispatch]);

  // 🎯 Redux 상태를 그대로 반환 (localStorage 제거!)
  return {
    newPatients: {
      current: currentMonth.newPatients.current,
      target: currentMonth.newPatients.target, // Redux 상태 직접 사용
      percentage: currentMonth.newPatients.percentage, // Redux에서 이미 계산됨
    },
    appointments: {
      current: currentMonth.appointments.current,
      target: currentMonth.appointments.target, // Redux 상태 직접 사용
      percentage: currentMonth.appointments.percentage, // Redux에서 이미 계산됨
    },
  };
};