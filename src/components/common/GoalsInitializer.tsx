// src/components/common/GoalsInitializer.tsx
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { loadGoalsFromStorage } from '@/store/slices/goalsSlice';

/**
 * 앱 시작시 localStorage에서 목표 설정을 불러오는 컴포넌트
 * 최상위 레이아웃에서 사용하여 새로고침 시에도 목표가 유지되도록 함
 */
const GoalsInitializer: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window !== 'undefined') {
      dispatch(loadGoalsFromStorage());
    }
  }, [dispatch]);

  return null; // UI를 렌더링하지 않음
};

export default GoalsInitializer;