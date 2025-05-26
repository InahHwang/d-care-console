// src/components/dashboard/ProgressGoals.tsx
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { loadGoalsFromServer } from '@/store/slices/goalsSlice';
import { HiOutlineAdjustments } from 'react-icons/hi';
import { Icon } from '@/components/common/Icon';

const ProgressGoals: React.FC = () => {
  const dispatch = useDispatch();
  const { currentMonth, isLoading } = useSelector((state: RootState) => state.goals);

  // 컴포넌트 마운트 시 서버에서 목표 불러오기
  useEffect(() => {
    dispatch(loadGoalsFromServer() as any);
  }, [dispatch]);

  // 로딩 중일 때 표시할 컴포넌트
  if (isLoading) {
    return (
      <div className="card">
        <div className="p-4 border-b border-border">
          <h3 className="text-md font-semibold text-text-primary flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            이번달 목표 달성률
          </h3>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-center h-32">
            <div className="text-text-muted">목표 데이터 로딩 중...</div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-semibold text-text-primary flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            이번달 목표 달성률
          </h3>
          
          <Link href="/settings?tab=goals">
            <button className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary hover:bg-gray-50 rounded transition-colors">
              <Icon icon={HiOutlineAdjustments} size={14} />
              목표 수정
            </button>
          </Link>
        </div>
      </div>
      
      <div className="p-4">
        {/* 신규 환자 목표 - Redux 상태 사용 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-text-primary">신규 환자 목표</span>
            <span className="text-sm text-text-primary font-semibold">
              {currentMonth.newPatients.current}/{currentMonth.newPatients.target}명
            </span>
          </div>
          
          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-green-500 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(currentMonth.newPatients.percentage, 100)}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-text-muted">달성률</span>
            <span className="text-xs font-medium text-green-600">
              {currentMonth.newPatients.percentage}%
            </span>
          </div>
        </div>
        
        {/* 예약 목표 - Redux 상태 사용 */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-text-primary">예약 목표</span>
            <span className="text-sm text-text-primary font-semibold">
              {currentMonth.appointments.current}/{currentMonth.appointments.target}건
            </span>
          </div>
          
          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(currentMonth.appointments.percentage, 100)}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-text-muted">달성률</span>
            <span className="text-xs font-medium text-blue-600">
              {currentMonth.appointments.percentage}%
            </span>
          </div>
        </div>
        
        {/* 상태 표시 */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="text-xs text-text-muted text-center">
            목표: {currentMonth.newPatients.target}명 신규환자, {currentMonth.appointments.target}건 예약
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressGoals;