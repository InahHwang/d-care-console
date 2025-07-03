// src/app/page.tsx - 탭 시스템 통합된 버전

'use client'

import AuthGuard from '@/components/auth/AuthGuard';
import React, { useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import PerformanceTabs from '@/components/dashboard/PerformanceTabs'; // 🔥 새로 추가
import PatientStatusCards from '@/components/dashboard/PatientStatusCards';
import TodaysCallsTable from '@/components/dashboard/TodaysCallsTable';
import ProgressGoals from '@/components/dashboard/ProgressGoals';
import QuickActions from '@/components/dashboard/QuickActions';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { setCurrentMenuItem } from '@/store/slices/uiSlice';
import { fetchPatients } from '@/store/slices/patientsSlice';
import { fetchMessageLogs } from '@/store/slices/messageLogsSlice';
import { useGoalsCalculation } from '@/hooks/useGoalsCalculation';
import GoalsInitializer from '@/components/common/GoalsInitializer';
import PatientDetailModal from '@/components/management/PatientDetailModal';

export default function Home() {
  const dispatch = useAppDispatch();
  
  // 안전한 patients 상태 접근
  const patientsState = useAppSelector((state) => state.patients);
  const isLoading = patientsState?.isLoading || false;
  const selectedPatient = patientsState?.selectedPatient || null;
  
  // 확장된 useGoalsCalculation 훅에서 모든 데이터 가져오기
  const {
    // 기존 목표 관련 (기존 기능 유지)
    newPatients,
    appointments,
    
    // 성과 지표
    performance,
    
    // 환자 상태 카운트
    statusCounts,
    
    // 오늘 예정된 콜
    todayCalls
  } = useGoalsCalculation();

  // 🔥 임시 디버깅 로그 추가
  console.log('🔥 대시보드 페이지 디버깅:', {
    todayCalls: todayCalls,
    todayCallsLength: todayCalls?.length || 0,
    todayCallsType: typeof todayCalls,
    isArray: Array.isArray(todayCalls),
    statusCounts: statusCounts,
    첫번째콜: todayCalls?.[0] || null
  });

  // 컴포넌트 마운트 시 기본 데이터 로드
  useEffect(() => {
    dispatch(setCurrentMenuItem('대시보드'));
    dispatch(fetchPatients());
    dispatch(fetchMessageLogs());
  }, [dispatch]);

  return (
    <AuthGuard>
      <AppLayout currentPage="dashboard">
        <div>
          {/* GoalsInitializer 컴포넌트 */}
          <GoalsInitializer />
          
          {/* 페이지 제목 */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-text-primary">대시보드</h1>
            <div className="text-sm text-text-secondary">
              {isLoading ? '데이터 로딩 중...' : `마지막 업데이트: ${new Date().toLocaleString()}`}
            </div>
          </div>

          {/* 🔥 기존 PerformanceCards를 PerformanceTabs로 교체 */}
          <div className="mb-6">
            <PerformanceTabs performance={performance as any} />
          </div>

          {/* 환자 상태 카드 (기존 유지) */}
          <div className="mb-6">
            <PatientStatusCards statusCounts={statusCounts} />
          </div>

          {/* 2단 레이아웃 (기존 유지) */}
          <div className="flex flex-col lg:flex-row gap-6 mb-6">
            {/* 왼쪽: 오늘의 콜 테이블 */}
            <div className="flex-1">
              <TodaysCallsTable calls={todayCalls} />
            </div>

            {/* 오른쪽: 목표 진행률 & 빠른 액션 */}
            <div className="lg:w-80">
              <div className="mb-6">
                <ProgressGoals />
              </div>
              <QuickActions />
            </div>
          </div>
        </div>

        {/* 환자 상세보기 모달 (기존 유지) */}
        {selectedPatient && <PatientDetailModal />}
        
      </AppLayout>
    </AuthGuard>
  );
}