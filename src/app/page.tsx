// src/app/page.tsx

'use client'

import React, { useEffect, useState, useMemo } from 'react';
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

export default function Home() {
  const dispatch = useAppDispatch();
  const { patients, isLoading } = useAppSelector((state) => state.patients);
  const messageLogs = useAppSelector((state) => state.messageLogs.logs);
  
  // 월간 성과 데이터
  const [monthlyPerformance, setMonthlyPerformance] = useState({
    outboundCalls: {
      count: 0,
      trend: 0, // 전월 대비 증감률
    },
    appointmentRate: {
      value: 0, // 예약 전환율 (%)
      trend: 0, // 전월 대비 증감률
    },
    visitRate: {
      value: 0, // 내원 전환율 (%)
      trend: 0, // 전월 대비 증감률
    }
  });
  
  // 환자 상태별 카운트 - noResponse를 absentCount로 변경
  const [patientStatusCounts, setPatientStatusCounts] = useState({
    callbackNeeded: 0, // 콜백 필요 환자 수
    absentCount: 0,   // 부재중 환자 수 (미응답에서 변경)
    todayScheduled: 0, // 오늘 예정된 콜백 수
    newPatients: 0    // 이번달 신규 환자 수
  });
  
  // 목표 달성률
  const [goalProgress, setGoalProgress] = useState({
    newPatients: {
      current: 0,
      target: 30, // 예시 목표값
      percentage: 0
    },
    appointments: {
      current: 0,
      target: 20, // 예시 목표값
      percentage: 0
    }
  });
  
  // 오늘 예정된 콜 데이터
  const [todayCalls, setTodayCalls] = useState<any[]>([]);
  
  // 컴포넌트 마운트 시 현재 메뉴 아이템 설정 및 데이터 로드
  useEffect(() => {
    dispatch(setCurrentMenuItem('대시보드'));
    dispatch(fetchPatients());
    dispatch(fetchMessageLogs());
  }, [dispatch]);
  
  // 환자 데이터와 메시지 로그가 변경될 때마다 대시보드 데이터 업데이트
  useEffect(() => {
    if (patients.length === 0) return;
    
    // 현재 날짜 정보
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // 지난 달의 첫날과 마지막 날 계산
    const firstDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayOfPrevMonth = new Date(firstDayOfMonth);
    lastDayOfPrevMonth.setDate(lastDayOfPrevMonth.getDate() - 1);
    
    // 1. 월간 성과 데이터 계산
    // 1.1 이번달 아웃바운드 콜 수 (환자의 콜인 날짜 기준으로 계산)
    const currentMonthCalls = patients.filter(patient => {
      const callInDate = new Date(patient.callInDate);
      return callInDate >= firstDayOfMonth && callInDate <= today;
    }).length;
    
    // 1.2 지난달 아웃바운드 콜 수 계산
    const prevMonthCalls = patients.filter(patient => {
      const callInDate = new Date(patient.callInDate);
      return callInDate >= firstDayOfPrevMonth && callInDate < firstDayOfMonth;
    }).length;
    
    // 1.3 전월 대비 증감률 계산
    let callsTrend = 0;
    if (prevMonthCalls > 0) {
      callsTrend = Math.round(((currentMonthCalls - prevMonthCalls) / prevMonthCalls) * 100);
    }
    
    // 2. 예약 전환율 계산
    // 2.1 이번달 잠재적 환자 수 (설정한 모든 상태의 환자)
    const totalPotentialPatients = patients.filter(p => {
      const callInDate = new Date(p.callInDate);
      return (p.status === '잠재고객' || 
              p.status === '활성고객' || 
              p.status === '콜백필요' || 
              p.status === '부재중' || // 미응답 -> 부재중으로 변경
              p.status === '예약확정') && 
             callInDate >= firstDayOfMonth;
    }).length;
    
    // 2.2 이번달 예약 확정 환자 수
    const confirmedAppointments = patients.filter(p => {
      const callInDate = new Date(p.callInDate);
      return p.status === '예약확정' && callInDate >= firstDayOfMonth;
    }).length;
    
    // 2.3 예약 전환율 계산
    const appointmentRate = totalPotentialPatients > 0 
      ? (confirmedAppointments / totalPotentialPatients) * 100 
      : 0;
    
    // 2.4 지난달 예약 전환율 계산
    const prevMonthTotalPotentialPatients = patients.filter(p => {
      const callInDate = new Date(p.callInDate);
      return (p.status === '잠재고객' || 
              p.status === '활성고객' || 
              p.status === '콜백필요' || 
              p.status === '부재중' || // 미응답 -> 부재중으로 변경
              p.status === '예약확정') && 
             callInDate >= firstDayOfPrevMonth && 
             callInDate < firstDayOfMonth;
    }).length;

    const prevMonthConfirmedAppointments = patients.filter(p => {
      const callInDate = new Date(p.callInDate);
      return p.status === '예약확정' && 
             callInDate >= firstDayOfPrevMonth && 
             callInDate < firstDayOfMonth;
    }).length;

    const prevMonthAppointmentRate = prevMonthTotalPotentialPatients > 0
      ? (prevMonthConfirmedAppointments / prevMonthTotalPotentialPatients) * 100
      : 0;

    // 2.5 예약 전환율 증감률 계산
    let appointmentRateTrend = 0;
    if (prevMonthAppointmentRate > 0) {
      appointmentRateTrend = Math.round(((appointmentRate - prevMonthAppointmentRate) / prevMonthAppointmentRate) * 100);
    }
    
    // 3. 내원 전환율 계산
    // 3.1 이번달 내원 확정 환자 수 - 실제 데이터 기반으로 계산
    const visitedPatients = patients.filter(p => {
      const callInDate = new Date(p.callInDate);
      return p.visitConfirmed === true && callInDate >= firstDayOfMonth;
    }).length;
    
    // 3.2 내원 전환율 계산
    const visitRate = confirmedAppointments > 0 
      ? (visitedPatients / confirmedAppointments) * 100 
      : 0;
    
    // 3.3 지난달 내원 전환율 계산
    const prevMonthVisitedPatients = patients.filter(p => {
      const callInDate = new Date(p.callInDate);
      return p.visitConfirmed === true && 
             callInDate >= firstDayOfPrevMonth && 
             callInDate < firstDayOfMonth;
    }).length;
    
    const prevMonthVisitRate = prevMonthConfirmedAppointments > 0
      ? (prevMonthVisitedPatients / prevMonthConfirmedAppointments) * 100
      : 0;
    
    // 3.4 내원 전환율 증감률 계산
    let visitRateTrend = 0;
    if (prevMonthVisitRate > 0) {
      visitRateTrend = Math.round(((visitRate - prevMonthVisitRate) / prevMonthVisitRate) * 100);
    }
    
    // 성과 데이터 상태 업데이트
    setMonthlyPerformance({
      outboundCalls: {
        count: currentMonthCalls,
        trend: callsTrend,
      },
      appointmentRate: {
        value: Math.round(appointmentRate * 10) / 10, // 소수점 첫째자리까지
        trend: appointmentRateTrend,
      },
      visitRate: {
        value: Math.round(visitRate * 10) / 10, // 소수점 첫째자리까지
        trend: visitRateTrend,
      }
    });
    
    // 4. 환자 상태별 카운트 계산 - 실제 데이터 기반으로 계산
    // 4.1 콜백 필요 환자 수
    const callbackNeeded = patients.filter(p => p.status === '콜백필요').length;
    
    // 4.2 부재중 환자 수 (이전의 미응답)
    const absentCount = patients.filter(p => p.status === '부재중').length;
    
    // 4.3 오늘 예정된 콜백 수 - 실제 데이터 기반으로 계산
    const todayStr = today.toISOString().split('T')[0];
    const todayCallbacks = patients.filter(p => {
      // 콜백 이력에서 오늘 예정된 콜백 확인
      if (p.callbackHistory && p.callbackHistory.length > 0) {
        return p.callbackHistory.some(callback => 
          callback.status === '예정' && callback.date === todayStr
        );
      }
      // 또는 nextCallbackDate가 오늘인 경우
      return p.nextCallbackDate === todayStr;
    }).length;
    
    // 4.4 이번달 신규 환자 수
    const newPatientsThisMonth = patients.filter(p => {
      const callInDate = new Date(p.callInDate);
      return callInDate >= firstDayOfMonth;
    }).length;
    
    // 수정: noResponse → absentCount로 변경
    setPatientStatusCounts({
      callbackNeeded,
      absentCount, // noResponse → absentCount로 변경
      todayScheduled: todayCallbacks,
      newPatients: newPatientsThisMonth
    });
    
    // 5. 목표 달성률 계산
    setGoalProgress({
      newPatients: {
        current: newPatientsThisMonth,
        target: 30, // 예시 목표값
        percentage: Math.min(Math.round((newPatientsThisMonth / 30) * 100), 100)
      },
      appointments: {
        current: confirmedAppointments,
        target: 20, // 예시 목표값
        percentage: Math.min(Math.round((confirmedAppointments / 20) * 100), 100)
      }
    });
    
    // 6. 오늘 예정된 콜 데이터 - 실제 예정된 콜백을 기반으로 처리
    const todaysCallsData = patients
      .filter(p => {
        // 오늘 예정된 콜백이 있는 환자 필터링
        if (p.callbackHistory && p.callbackHistory.length > 0) {
          return p.callbackHistory.some(callback => 
            callback.status === '예정' && callback.date === todayStr
          );
        }
        // 또는 nextCallbackDate가 오늘인 환자
        return p.nextCallbackDate === todayStr;
      })
      .slice(0, 5) // 상위 5개만 표시
      .map((patient, index) => {
        // 콜백 시간 정보 찾기
        let scheduledTime = `${todayStr}T09:00:00`; // 기본값
        
        if (patient.callbackHistory) {
          const todayCallback = patient.callbackHistory.find(cb => 
            cb.status === '예정' && cb.date === todayStr
          );
          
          if (todayCallback && todayCallback.time) {
            scheduledTime = `${todayStr}T${todayCallback.time}:00`;
          } else {
            // 시간 정보가 없는 경우 간단한 시간 패턴 생성
            const hours = 9 + Math.floor(index / 2);
            const minutes = (index % 2) * 30;
            scheduledTime = `${todayStr}T${hours}:${minutes === 0 ? '00' : minutes}:00`;
          }
        }
        
        return {
          id: patient.id,
          patientName: patient.name,
          phoneNumber: patient.phoneNumber,
          scheduledTime: scheduledTime,
          status: patient.status,
          reminderStatus: patient.reminderStatus || '초기',
          interestedServices: patient.interestedServices?.join(', ') || '-'
        };
      });
    
    setTodayCalls(todaysCallsData);
    
  }, [patients, messageLogs]);

  return (
    <AppLayout currentPage="dashboard">
      <div>
        {/* 페이지 제목 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">대시보드</h1>
          <div className="text-sm text-text-secondary">
            {isLoading ? '데이터 로딩 중...' : `마지막 업데이트: ${new Date().toLocaleString()}`}
          </div>
        </div>

        {/* 월간 성과 지표 */}
        <div className="mb-6">
          <PerformanceCards performance={monthlyPerformance} />
        </div>

        {/* 환자 상태별 카운트 */}
        <div className="mb-6">
          <PatientStatusCards statusCounts={patientStatusCounts} />
        </div>

        {/* 2단 레이아웃 */}
        <div className="flex flex-col lg:flex-row gap-6 mb-6">
          {/* 왼쪽 칼럼 (오늘 예정된 통화) */}
          <div className="flex-1">
            <TodaysCallsTable calls={todayCalls} />
          </div>

          {/* 오른쪽 칼럼 (목표 달성률 및 빠른 액션) */}
          <div className="lg:w-80">
            <div className="mb-6">
              <ProgressGoals goals={goalProgress} />
            </div>
            <QuickActions />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}