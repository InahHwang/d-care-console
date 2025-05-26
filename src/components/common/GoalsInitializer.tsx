// src/components/common/GoalsInitializer.tsx
import React from 'react';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { loadGoalsFromServer } from '@/store/slices/goalsSlice'; // 🔧 수정됨

/**
 * 앱 시작시 서버에서 목표 설정을 불러오는 컴포넌트
 */
const GoalsInitializer: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // 🔧 서버에서 목표 불러오기로 변경
    dispatch(loadGoalsFromServer() as any);
  }, [dispatch]);

  return null; // UI를 렌더링하지 않는 컴포넌트
};

export default GoalsInitializer;