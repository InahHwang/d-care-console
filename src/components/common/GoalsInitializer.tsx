// src/components/common/GoalsInitializer.tsx
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { calculateCurrentProgress, loadGoalsFromServer } from '@/store/slices/goalsSlice';

const GoalsInitializer: React.FC = () => {
  const dispatch = useDispatch();
  const patients = useSelector((state: RootState) => state.patients.patients);
  const goalsLoaded = useSelector((state: RootState) => state.goals.lastUpdated !== null);

  // 1️⃣ 앱 시작시 서버에서 목표 불러오기 (기존 기능 유지)
  useEffect(() => {
    if (!goalsLoaded) {
      dispatch(loadGoalsFromServer() as any);
    }
  }, [dispatch, goalsLoaded]);

  // 2️⃣ 환자 데이터가 변경될 때마다 목표 달성률 재계산 (새로 추가)
  useEffect(() => {
    if (patients && patients.length >= 0) {
      console.log('🎯 목표 달성률 재계산 시작 - 환자 수:', patients.length);
      dispatch(calculateCurrentProgress({ patients }));
    }
  }, [dispatch, patients]);

  return null; // UI 렌더링 없음
};

export default GoalsInitializer;