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

// 🎯 수정: 성과 지표 타입 - totalInquiries로 변경
interface PerformanceData {
  totalInquiries: {  // 🔥 변경: outboundCalls → totalInquiries
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

// 🎯 환자 상태 카운트 타입
interface PatientStatusCounts {
  callbackNeeded: number;
  absentCount: number;
  todayScheduled: number;
  newPatients: number;
}

// 🎯 오늘 콜 데이터 타입
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
  
  // 🎯 수정된 성과 지표
  performance: PerformanceData;
  
  // 🎯 환자 상태 카운트
  statusCounts: PatientStatusCounts;
  
  // 🎯 오늘 예정된 콜
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

  // 🎯 수정된 계산 로직: 인바운드+아웃바운드 합계 계산
  const calculatePerformanceMetrics = () => {
  if (patients.length === 0) {
    return {
      performance: {
        totalInquiries: { count: 0, trend: 0 },  // 🔥 변경
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
  
  // 🔥 1. 월간 신규 문의 데이터 계산 (인바운드 + 아웃바운드 합계)
  // 1.1 이번달 전체 신규 문의 수 (상담관리에 등록된 모든 환자)
  const currentMonthInquiries = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfMonth && callInDate <= today;
    // 🔥 consultationType 필터 제거 - 인바운드+아웃바운드 모두 포함
  }).length;
  
  // 1.2 지난달 전체 신규 문의 수 계산
  const prevMonthInquiries = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfPrevMonth && callInDate < firstDayOfMonth;
    // 🔥 consultationType 필터 제거 - 인바운드+아웃바운드 모두 포함
  }).length;
  
  // 1.3 전월 대비 증감률 계산
  let inquiriesTrend = 0;
  if (prevMonthInquiries > 0) {
    inquiriesTrend = Math.round(((currentMonthInquiries - prevMonthInquiries) / prevMonthInquiries) * 100);
  }
  
  // 🔥 2. 예약 전환율 계산 - 월별 기준으로 수정
  // 2.1 이번달 신규환자수 (callInDate 기준으로 이번 달에 등록된 환자)
  const currentMonthNewPatients = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfMonth && callInDate <= today;
  }).length;
  
  // 2.2 이번달 예약완료수 (이번 달 등록된 환자 중 예약확정 상태)
  const currentMonthConfirmedAppointments = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfMonth && 
           callInDate <= today && 
           patient.status === '예약확정';
  }).length;
  
  // 2.3 이번달 예약 전환율 계산
  const appointmentRate = currentMonthNewPatients > 0 
    ? (currentMonthConfirmedAppointments / currentMonthNewPatients) * 100 
    : 0;
  
  // 2.4 지난달 예약 전환율 계산 (전월 대비 트렌드용)
  const prevMonthNewPatients = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfPrevMonth && callInDate < firstDayOfMonth;
  }).length;
  
  const prevMonthConfirmedAppointments = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfPrevMonth && 
           callInDate < firstDayOfMonth && 
           patient.status === '예약확정';
  }).length;
  
  const prevMonthAppointmentRate = prevMonthNewPatients > 0 
    ? (prevMonthConfirmedAppointments / prevMonthNewPatients) * 100 
    : 0;

  // 2.5 예약 전환율 증감률 계산
  let appointmentRateTrend = 0;
  if (prevMonthAppointmentRate > 0) {
    appointmentRateTrend = Math.round(((appointmentRate - prevMonthAppointmentRate) / prevMonthAppointmentRate) * 100);
  }
  
  // 🔥 3. 내원 전환율 계산 - 월별 기준으로 수정
  // 3.1 이번달 내원 확정 환자 수
  const currentMonthVisitedPatients = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return patient.visitConfirmed === true && 
           callInDate >= firstDayOfMonth && 
           callInDate <= today;
  }).length;
  
  // 3.2 이번달 내원 전환율 계산 (이번 달 예약확정 환자 중 내원확정 비율)
  const visitRate = currentMonthConfirmedAppointments > 0 
    ? (currentMonthVisitedPatients / currentMonthConfirmedAppointments) * 100 
    : 0;
  
  // 3.3 지난달 내원 전환율 계산
  const prevMonthVisitedPatients = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return patient.visitConfirmed === true && 
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

  // 4. 환자 상태별 카운트 계산 (전체 환자 기준 - 유지)
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
  
  // 4.4 이번달 신규 환자 수 (위에서 이미 계산함)
  const newPatientsThisMonth = currentMonthNewPatients;

  // 5. 오늘 예정된 콜 데이터 (기존 로직 유지)
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

  // 🔥 로그 메시지 업데이트
  console.log('🔥 월별 성과 지표 계산 결과 (인바운드+아웃바운드 합계):');
  console.log('   - 이번달 전체 신규문의:', currentMonthInquiries, '건');
  console.log('   - 이번달 신규환자:', currentMonthNewPatients);
  console.log('   - 이번달 예약확정:', currentMonthConfirmedAppointments);
  console.log('   - 이번달 예약전환율:', Math.round(appointmentRate * 10) / 10, '%');
  console.log('   - 이번달 내원확정:', currentMonthVisitedPatients);
  console.log('   - 이번달 내원전환율:', Math.round(visitRate * 10) / 10, '%');

  return {
    performance: {
      totalInquiries: {  // 🔥 변경: outboundCalls → totalInquiries
        count: currentMonthInquiries,
        trend: inquiriesTrend,
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
    
    // 🎯 수정된 성과 지표들
    performance: metrics.performance,
    statusCounts: metrics.statusCounts,
    todayCalls: metrics.todayCalls
  };
};