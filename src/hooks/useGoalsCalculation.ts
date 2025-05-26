// src/hooks/useGoalsCalculation.ts
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

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
  const { currentMonth } = useSelector((state: RootState) => state.goals);
  const [localTargets, setLocalTargets] = useState({
    newPatients: currentMonth.newPatients.target,
    appointments: currentMonth.appointments.target,
  });
  const [isClient, setIsClient] = useState(false);

  // 클라이언트 사이드 확인
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 현재 월 키 생성 함수
  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // localStorage에서 목표값 불러오기 (클라이언트에서만)
  useEffect(() => {
    if (!isClient) return;

    const loadTargetsFromStorage = () => {
      try {
        const savedGoals = localStorage.getItem('monthlyGoals');
        if (savedGoals) {
          const parsedGoals = JSON.parse(savedGoals);
          const currentMonthKey = getCurrentMonthKey();
          
          if (parsedGoals[currentMonthKey]) {
            const monthlyGoals = parsedGoals[currentMonthKey];
            setLocalTargets({
              newPatients: monthlyGoals.newPatients || currentMonth.newPatients.target,
              appointments: monthlyGoals.appointments || currentMonth.appointments.target,
            });
          }
        }
      } catch (error) {
        console.error('목표 불러오기 중 오류:', error);
        // 오류 발생 시 Redux 스토어의 기본값 사용
        setLocalTargets({
          newPatients: currentMonth.newPatients.target,
          appointments: currentMonth.appointments.target,
        });
      }
    };

    loadTargetsFromStorage();
  }, [isClient, currentMonth.newPatients.target, currentMonth.appointments.target]);

  // Redux 스토어 변경 감지하여 localStorage와 동기화
  useEffect(() => {
    setLocalTargets({
      newPatients: currentMonth.newPatients.target,
      appointments: currentMonth.appointments.target,
    });
  }, [currentMonth.newPatients.target, currentMonth.appointments.target]);

  // 달성률 계산 함수
  const calculatePercentage = (current: number, target: number): number => {
    if (target === 0) return 0;
    return Math.round((current / target) * 100);
  };

  return {
    newPatients: {
      current: currentMonth.newPatients.current,
      target: localTargets.newPatients,
      percentage: calculatePercentage(currentMonth.newPatients.current, localTargets.newPatients),
    },
    appointments: {
      current: currentMonth.appointments.current,
      target: localTargets.appointments,
      percentage: calculatePercentage(currentMonth.appointments.current, localTargets.appointments),
    },
  };
};