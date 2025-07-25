// src/app/page.tsx - 미처리 콜백 로직 수정된 전체 코드

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

// 🔥 PatientStatusCards에 전달할 타입 정의
interface StatusCardData {
  consultation: number;  // 상담환자
  visit: number;        // 내원환자
}

interface ReminderCardData {
  registrationNeeded: number; // 등록필요
}

interface NewPatientStatusCounts {
  overdueCallbacks: StatusCardData;      // 미처리 콜백
  todayScheduled: StatusCardData;        // 오늘 예정된 콜백  
  callbackUnregistered: StatusCardData;  // 콜백 미등록
  reminderCallbacks: ReminderCardData;   // 리마인더 콜백
}

export default function Home() {
  const dispatch = useAppDispatch();
  
  // 안전한 patients 상태 접근
  const patientsState = useAppSelector((state) => state.patients);
  const isLoading = patientsState?.isLoading || false;
  const selectedPatient = patientsState?.selectedPatient || null;
  const patients = patientsState?.patients || [];
  
  // 확장된 useGoalsCalculation 훅에서 모든 데이터 가져오기
  const {
    // 기존 목표 관련 (기존 기능 유지)
    newPatients,
    appointments,
    
    // 성과 지표
    performance,
    
    // 환자 상태 카운트 (사용하지 않음 - 직접 계산)
    statusCounts: hookStatusCounts,
    
    // 오늘 예정된 콜
    todayCalls
  } = useGoalsCalculation();

  // 🔥 statusCounts 직접 계산 (미처리 콜백 로직 수정)
  const calculateStatusCounts = (): NewPatientStatusCounts => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayStr = today.toISOString().split('T')[0];
    
    let overdueCallbacks = { consultation: 0, visit: 0 };
    let todayScheduled = { consultation: 0, visit: 0 };
    let callbackUnregistered = { consultation: 0, visit: 0 };
    let reminderCallbacks = { registrationNeeded: 0 };
    
    patients.forEach((patient) => {
      // 미처리 콜백 계산
      if (patient.callbackHistory && patient.callbackHistory.length > 0) {
        // 상담환자
        if (patient.visitConfirmed !== true) {
          if (patient.status === '예약확정' || patient.status === '재예약확정') {
            return;
          }
          
          if (patient.status === '콜백필요') {
            const hasOverdueCallback = patient.callbackHistory.some((callback) => {
              if (callback.status !== '예정') return false;
              if (callback.isVisitManagementCallback === true) return false;
              
              const callbackDate = new Date(callback.date);
              callbackDate.setHours(0, 0, 0, 0);
              return callbackDate < todayStart;
            });
            
            if (hasOverdueCallback) {
              overdueCallbacks.consultation++;
            }
          }
          
          // 오늘 예정된 콜백 - 상담환자
          const hasTodayCallback = patient.callbackHistory.some((callback) => {
            return callback.status === '예정' && 
                   callback.date === todayStr &&
                   callback.isVisitManagementCallback !== true;
          });
          
          if (hasTodayCallback) {
            todayScheduled.consultation++;
          }
        }
        
        // 내원환자 - 🔥 핵심 수정: 치료시작 상태 제외
        if (patient.visitConfirmed === true) {
          // 치료시작 상태는 미처리 콜백에서 제외
          if (patient.postVisitStatus === '치료시작') {
            return;
          }
          
          const hasOverdueVisitCallback = patient.callbackHistory.some((callback) => {
            if (callback.status !== '예정') return false;
            if (callback.isVisitManagementCallback !== true) return false;
            
            const callbackDate = new Date(callback.date);
            callbackDate.setHours(0, 0, 0, 0);
            return callbackDate < todayStart;
          });
          
          if (hasOverdueVisitCallback) {
            overdueCallbacks.visit++;
          }
          
          // 오늘 예정된 콜백 - 내원환자
          if (patient.postVisitStatus === '재콜백필요') {
            const hasTodayVisitCallback = patient.callbackHistory.some((callback) => {
              return callback.status === '예정' && 
                     callback.date === todayStr &&
                     callback.isVisitManagementCallback === true;
            });
            
            if (hasTodayVisitCallback) {
              todayScheduled.visit++;
            }
          }
        }
      }
      
      // 콜백 미등록 계산
      // 상담환자
      if (patient.visitConfirmed !== true) {
        if (patient.status === '예약확정' || patient.status === '재예약확정') {
          return;
        }
        
        const isTargetStatus = patient.status === '부재중' || 
                              patient.status === '잠재고객' || 
                              patient.isPostReservationPatient === true;
        
        if (isTargetStatus) {
          const hasScheduledCallback = patient.callbackHistory?.some((callback) => 
            callback.status === '예정'
          );
          
          if (!hasScheduledCallback) {
            callbackUnregistered.consultation++;
          }
        }
      }
      
      // 내원환자 - 상태미설정
      if (patient.visitConfirmed === true && !patient.postVisitStatus) {
        const hasVisitManagementCallback = patient.callbackHistory?.some((callback) => 
          callback.status === '예정' && 
          callback.isVisitManagementCallback === true
        );
        
        if (!hasVisitManagementCallback) {
          callbackUnregistered.visit++;
        }
      }
      
      // 리마인더 콜백 계산
      if (patient.visitConfirmed === true && patient.postVisitStatus === '치료동의') {
        const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
        if (treatmentStartDate && treatmentStartDate < todayStr) {
          reminderCallbacks.registrationNeeded++;
        }
      }
    });
    
    return {
      overdueCallbacks,
      todayScheduled,
      callbackUnregistered,
      reminderCallbacks
    };
  };

  // 🔥 계산된 statusCounts 사용
  const statusCounts = calculateStatusCounts();

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

          {/* 환자 상태 카드 (기존 유지) - 계산된 statusCounts 전달 */}
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