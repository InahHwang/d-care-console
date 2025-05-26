// src/components/dashboard/ProgressGoals.tsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { loadGoalsFromServer } from '@/store/slices/goalsSlice';
import { useGoalsCalculation } from '@/hooks/useGoalsCalculation';
import { HiOutlineAdjustments, HiOutlineRefresh } from 'react-icons/hi';
import { Icon } from '@/components/common/Icon';
import Link from 'next/link';

const ProgressGoals: React.FC = () => {
  const dispatch = useDispatch();
  const { currentMonth, isLoading, error } = useSelector((state: RootState) => state.goals);
  const [isClient, setIsClient] = useState(false);

  // 클라이언트 사이드에서만 렌더링하도록 설정
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 컴포넌트 마운트 시 서버에서 목표 불러오기
  useEffect(() => {
    if (isClient) {
      dispatch(loadGoalsFromServer() as any);
    }
  }, [dispatch, isClient]);

  const handleRefresh = () => {
    dispatch(loadGoalsFromServer() as any);
  };

  // 서버 사이드 렌더링 중에는 로딩 상태 표시
  if (!isClient) {
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
          {/* 로딩 스켈레톤 */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
              <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="flex justify-between items-center mt-1">
              <div className="h-3 bg-gray-200 rounded w-12 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-8 animate-pulse"></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="flex justify-between items-center mt-1">
              <div className="h-3 bg-gray-200 rounded w-12 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-8 animate-pulse"></div>
            </div>
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
            {isLoading && (
              <div className="ml-2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </h3>
          
          <div className="flex items-center gap-2">
            {/* 새로고침 버튼 */}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
              title="목표 데이터 새로고침"
            >
              <Icon icon={HiOutlineRefresh} size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            
            {/* 목표 설정 버튼 */}
            <Link href="/settings?tab=goals">
              <button className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary hover:bg-gray-50 rounded transition-colors">
                <Icon icon={HiOutlineAdjustments} size={14} />
                목표 수정
              </button>
            </Link>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {/* 에러 표시 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-800">
              목표 데이터를 불러오는 중 오류가 발생했습니다.
            </div>
            <div className="text-xs text-red-600 mt-1">{error}</div>
          </div>
        )}

        {/* 신규 환자 목표 */}
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
            <span className={`text-xs font-medium ${
              currentMonth.newPatients.percentage >= 100 
                ? 'text-green-600' 
                : currentMonth.newPatients.percentage >= 80 
                ? 'text-yellow-600' 
                : 'text-green-600'
            }`}>
              {currentMonth.newPatients.percentage}%
            </span>
          </div>
        </div>
        
        {/* 예약 목표 */}
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
            <span className={`text-xs font-medium ${
              currentMonth.appointments.percentage >= 100 
                ? 'text-blue-600' 
                : currentMonth.appointments.percentage >= 80 
                ? 'text-yellow-600' 
                : 'text-blue-600'
            }`}>
              {currentMonth.appointments.percentage}%
            </span>
          </div>
        </div>

        {/* 서버 연동 상태 표시 */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>서버 동기화 상태</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-400' : 'bg-green-400'}`}></div>
              <span>{error ? '오류' : '정상'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressGoals;