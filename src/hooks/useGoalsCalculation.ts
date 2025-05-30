// src/hooks/useGoalsCalculation.ts
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { loadGoalsFromServer } from '@/store/slices/goalsSlice';

interface GoalData {
  current: number;
  target: number;
  percentage: number;
}

interface CurrentMonthGoals {
  newPatients: GoalData;
  appointments: GoalData;
}

// 🎯 새로 추가: 성과 지표 타입
interface PerformanceData {
  outboundCalls: {
    count: number;
    trend: number;
  };
  appointmentRate: {
    value: number;
    trend: number;
  };
  visitRate: {
    value: number;
    trend: number;
  };
}

// 🎯 새로 추가: 환자 상태 카운트 타입
interface PatientStatusCounts {
  callbackNeeded: number;
  absentCount: number;
  todayScheduled: number;
  newPatients: number;
}

// 🎯 새로 추가: 오늘 콜 데이터 타입
interface TodayCall {
  id: string;
  patientId: string;
  patientName: string;
  phoneNumber: string;
  scheduledTime: string;
  status: '예정' | '완료' | '부재중' | '일정변경';
  attemptCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// 🎯 확장된 반환 타입
interface UseGoalsCalculationResult {
  // 기존 목표 관련 (그대로 유지)
  newPatients: GoalData;
  appointments: GoalData;
  
  // 🎯 새로 추가: 성과 지표
  performance: PerformanceData;
  
  // 🎯 새로 추가: 환자 상태 카운트
  statusCounts: PatientStatusCounts;
  
  // 🎯 새로 추가: 오늘 예정된 콜
  todayCalls: TodayCall[];
}

export const useGoalsCalculation = (): UseGoalsCalculationResult => {
  const dispatch = useDispatch();
  const { currentMonth } = useSelector((state: RootState) => state.goals);
  const { patients } = useSelector((state: RootState) => state.patients);

  // 🎯 기존 로직: 컴포넌트 마운트 시 서버에서 목표 불러오기
  useEffect(() => {
    dispatch(loadGoalsFromServer() as any);
  }, [dispatch]);

  // 🎯 새로 추가: page.tsx의 계산 로직을 그대로 복사
  const calculatePerformanceMetrics = () => {
    if (patients.length === 0) {
      return {
        performance: {
          outboundCalls: { count: 0, trend: 0 },
          appointmentRate: { value: 0, trend: 0 },
          visitRate: { value: 0, trend: 0 }
        },
        statusCounts: {
          callbackNeeded: 0,
          absentCount: 0,
          todayScheduled: 0,
          newPatients: 0
        },
        todayCalls: []
      };
    }

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
    
    // 2. 예약 전환율 계산 - 🎯 수정: 전체 환자 기준으로 계산
    // 2.1 총 신규환자수 (등록된 모든 환자)
    const totalNewPatients = patients.length;
    
    // 2.2 총 예약완료수 (상태가 '예약확정'인 모든 환자)
    const confirmedAppointments = patients.filter(p => p.status === '예약확정').length;
    
    // 2.3 예약 전환율 계산 - 🎯 수정: 전체 환자 기준
    const appointmentRate = totalNewPatients > 0 
      ? (confirmedAppointments / totalNewPatients) * 100 
      : 0;
    
    // 2.4 지난달 예약 전환율 계산 (전월 대비 트렌드용)
    // 🎯 간소화: 현재는 트렌드 계산 없이 0으로 설정 (선택적 구현)
    const prevMonthAppointmentRate = 0;

    // 2.5 예약 전환율 증감률 계산
    let appointmentRateTrend = 0;
    // 🎯 간소화: 트렌드 계산 비활성화 (필요시 나중에 구현)
    // if (prevMonthAppointmentRate > 0) {
    //   appointmentRateTrend = Math.round(((appointmentRate - prevMonthAppointmentRate) / prevMonthAppointmentRate) * 100);
    // }
    
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
    
    const prevMonthVisitRate = confirmedAppointments > 0
      ? (prevMonthVisitedPatients / confirmedAppointments) * 100
      : 0;
    
    // 3.4 내원 전환율 증감률 계산
    let visitRateTrend = 0;
    if (prevMonthVisitRate > 0) {
      visitRateTrend = Math.round(((visitRate - prevMonthVisitRate) / prevMonthVisitRate) * 100);
    }

    // 4. 환자 상태별 카운트 계산
    const callbackNeeded = patients.filter(p => p.status === '콜백필요').length;
    const absentCount = patients.filter(p => p.status === '부재중').length;
    
    // 4.3 오늘 예정된 콜백 수
    const todayStr = today.toISOString().split('T')[0];
    const todayCallbacks = patients.filter(p => {
      if (p.callbackHistory && p.callbackHistory.length > 0) {
        return p.callbackHistory.some(callback => 
          callback.status === '예정' && callback.date === todayStr
        );
      }
      return p.nextCallbackDate === todayStr;
    }).length;
    
    // 4.4 이번달 신규 환자 수
    const newPatientsThisMonth = patients.filter(p => {
      const callInDate = new Date(p.callInDate);
      return callInDate >= firstDayOfMonth;
    }).length;

    // 5. 오늘 예정된 콜 데이터
    const todaysCallsData = patients
      .filter(p => {
        if (p.callbackHistory && p.callbackHistory.length > 0) {
          return p.callbackHistory.some(callback => 
            callback.status === '예정' && callback.date === todayStr
          );
        }
        return p.nextCallbackDate === todayStr;
      })
      .slice(0, 5)
      .map((patient, index) => {
        let scheduledTime = `${todayStr}T09:00:00`;
        
        if (patient.callbackHistory) {
          const todayCallback = patient.callbackHistory.find(cb => 
            cb.status === '예정' && cb.date === todayStr
          );
          
          if (todayCallback && todayCallback.time) {
            scheduledTime = `${todayStr}T${todayCallback.time}:00`;
          } else {
            const hours = 9 + Math.floor(index / 2);
            const minutes = (index % 2) * 30;
            scheduledTime = `${todayStr}T${hours}:${minutes === 0 ? '00' : minutes}:00`;
          }
        }
        
        return {
          id: `call-${patient.id}-${Date.now()}-${index}`,
          patientId: patient.id,
          patientName: patient.name,
          phoneNumber: patient.phoneNumber,
          scheduledTime: scheduledTime,
          status: '예정' as const,
          attemptCount: patient.reminderStatus === '초기' ? 0 : 
                      patient.reminderStatus === '1차' ? 1 :
                      patient.reminderStatus === '2차' ? 2 :
                      patient.reminderStatus === '3차' ? 3 : 0,
          notes: patient.notes || '',
          createdAt: patient.createdAt || new Date().toISOString(),
          updatedAt: patient.updatedAt || new Date().toISOString()
        };
      });

    return {
      performance: {
        outboundCalls: {
          count: currentMonthCalls,
          trend: callsTrend,
        },
        appointmentRate: {
          value: Math.round(appointmentRate * 10) / 10,
          trend: appointmentRateTrend,
        },
        visitRate: {
          value: Math.round(visitRate * 10) / 10,
          trend: visitRateTrend,
        }
      },
      statusCounts: {
        callbackNeeded,
        absentCount,
        todayScheduled: todayCallbacks,
        newPatients: newPatientsThisMonth
      },
      todayCalls: todaysCallsData
    };
  };

  // 🎯 계산 실행
  const metrics = calculatePerformanceMetrics();

  // 🎯 기존 목표 데이터 + 새로운 성과 지표 반환
  return {
    // 기존 목표 관련 (100% 그대로 유지)
    newPatients: {
      current: currentMonth.newPatients.current,
      target: currentMonth.newPatients.target,
      percentage: currentMonth.newPatients.percentage,
    },
    appointments: {
      current: currentMonth.appointments.current,
      target: currentMonth.appointments.target,
      percentage: currentMonth.appointments.percentage,
    },
    
    // 🎯 새로 추가된 성과 지표들
    performance: metrics.performance,
    statusCounts: metrics.statusCounts,
    todayCalls: metrics.todayCalls
  };
};