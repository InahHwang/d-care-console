// src/app/page.tsx 

'use client'

import AuthGuard from '@/components/auth/AuthGuard';
import React, { useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import PerformanceCards from '@/components/dashboard/PerformanceCards';
import PatientStatusCards from '@/components/dashboard/PatientStatusCards';
import TodaysCallsTable from '@/components/dashboard/TodaysCallsTable';
import ProgressGoals from '@/components/dashboard/ProgressGoals';
import QuickActions from '@/components/dashboard/QuickActions';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { setCurrentMenuItem } from '@/store/slices/uiSlice';
import { fetchPatients } from '@/store/slices/patientsSlice';
import { fetchMessageLogs } from '@/store/slices/messageLogsSlice';
// 🎯 수정: 확장된 useGoalsCalculation 훅 사용
import { useGoalsCalculation } from '@/hooks/useGoalsCalculation';
import GoalsInitializer from '@/components/common/GoalsInitializer';
import PatientDetailModal from '@/components/management/PatientDetailModal';

export default function Home() {
  const dispatch = useAppDispatch();
  
  // 🔧 수정: 안전한 patients 상태 접근
  const patientsState = useAppSelector((state) => state.patients);
  const isLoading = patientsState?.isLoading || false;
  const selectedPatient = patientsState?.selectedPatient || null;
  
  // 🎯 새로운 방식: 확장된 useGoalsCalculation 훅에서 모든 데이터 가져오기
  const {
    // 기존 목표 관련 (기존 기능 유지)
    newPatients,
    appointments,
    
    // 🎯 새로 추가: 성과 지표
    performance,
    
    // 🎯 새로 추가: 환자 상태 카운트
    statusCounts,
    
    // 🎯 새로 추가: 오늘 예정된 콜
    todayCalls
  } = useGoalsCalculation();

  // 🎯 간소화: 컴포넌트 마운트 시 기본 데이터 로드만
  useEffect(() => {
    dispatch(setCurrentMenuItem('대시보드'));
    dispatch(fetchPatients());
    dispatch(fetchMessageLogs());
  }, [dispatch]);

  /* 
  🎯 제거된 코드: 아래 200줄짜리 복잡한 useEffect는 이제 useGoalsCalculation 훅에서 처리
  
  // 기존 복잡한 계산 로직들이 모두 제거됨:
  // - monthlyPerformance 계산
  // - patientStatusCounts 계산  
  // - todayCalls 계산
  // - 복잡한 필터링 및 상태 업데이트
  
  혹시 문제가 생기면 git에서 이전 버전 복구 가능!
  */

  return (
    <AuthGuard>
      <AppLayout currentPage="dashboard">
        <div>
          {/* 🎯 기존 그대로: GoalsInitializer 컴포넌트 */}
          <GoalsInitializer />
          
          {/* 🎯 기존 그대로: 페이지 제목 */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-text-primary">대시보드</h1>
            <div className="text-sm text-text-secondary">
              {isLoading ? '데이터 로딩 중...' : `마지막 업데이트: ${new Date().toLocaleString()}`}
            </div>
          </div>

          {/* 🎯 수정: 새로운 훅에서 가져온 performance 데이터 사용 */}
          <div className="mb-6">
            <PerformanceCards performance={performance} />
          </div>

          {/* 🎯 수정: 새로운 훅에서 가져온 statusCounts 데이터 사용 */}
          <div className="mb-6">
            <PatientStatusCards statusCounts={statusCounts} />
          </div>

          {/* 🎯 기존 그대로: 2단 레이아웃 */}
          <div className="flex flex-col lg:flex-row gap-6 mb-6">
            {/* 🎯 수정: 새로운 훅에서 가져온 todayCalls 데이터 사용 */}
            <div className="flex-1">
              <TodaysCallsTable calls={todayCalls} />
            </div>

            {/* 🎯 기존 그대로: 오른쪽 칼럼 */}
            <div className="lg:w-80">
              <div className="mb-6">
                {/* 🎯 기존 그대로: ProgressGoals는 Redux에서 데이터 가져옴 */}
                <ProgressGoals />
              </div>
              <QuickActions />
            </div>
          </div>
        </div>

        {/* 🎯 기존 그대로: 환자 상세보기 모달 */}
        {selectedPatient && <PatientDetailModal />}
        
      </AppLayout>
    </AuthGuard>
  );
}