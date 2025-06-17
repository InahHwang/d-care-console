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
  paymentRate: {
    value: number;
    trend: number;
  };
}

// 🎯 환자 상태 카운트 타입 - 🔥 수정: newPatients 제거, overdueCallbacks 추가
interface PatientStatusCounts {
  overdueCallbacks: number;  // 🔥 새로 추가: 미처리 콜백
  callbackNeeded: number;
  absentCount: number;
  todayScheduled: number;
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
  const patientsState = useSelector((state: RootState) => state.patients);
  const patients = patientsState?.patients || []; // 🔥 안전한 접근으로 수정

  // 🎯 기존 로직: 컴포넌트 마운트 시 서버에서 목표 불러오기
  useEffect(() => {
    dispatch(loadGoalsFromServer() as any);
  }, [dispatch]);

  // 🔥 디버깅용 로그 추가
  console.log('🔍 useGoalsCalculation 상태 확인:', {
    patientsStateExists: !!patientsState,
    patientsLength: patients.length,
    currentMonthExists: !!currentMonth
  });

  // 🎯 수정된 계산 로직: 인바운드+아웃바운드 합계 계산
  const calculatePerformanceMetrics = () => {
  if (patients.length === 0) {
    return {
      performance: {
        totalInquiries: { count: 0, trend: 0 },  // 🔥 변경
        appointmentRate: { value: 0, trend: 0 },
        visitRate: { value: 0, trend: 0 },
        paymentRate: { value: 0, trend: 0 }
      },
      statusCounts: {
        overdueCallbacks: 0,  // 🔥 새로 추가
        callbackNeeded: 0,
        absentCount: 0,
        todayScheduled: 0
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
  
  // 🔥 2. 예약 전환율 계산 - 퍼널 기준 (이번달 신규문의 → 예약확정)
  // 2.1 이번달 신규문의 중 예약완료수
  const currentMonthConfirmedAppointments = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfMonth && 
           callInDate <= today && 
           patient.status === '예약확정';
  }).length;
  
  // 2.2 이번달 예약 전환율 계산 (퍼널: 신규문의 → 예약확정)
  const appointmentRate = currentMonthInquiries > 0 
    ? (currentMonthConfirmedAppointments / currentMonthInquiries) * 100 
    : 0;
  
  // 2.3 지난달 예약 전환율 계산 (전월 대비 트렌드용)
  const prevMonthConfirmedAppointments = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfPrevMonth && 
           callInDate < firstDayOfMonth && 
           patient.status === '예약확정';
  }).length;
  
  const prevMonthAppointmentRate = prevMonthInquiries > 0 
    ? (prevMonthConfirmedAppointments / prevMonthInquiries) * 100 
    : 0;

  // 2.4 예약 전환율 증감률 계산
  let appointmentRateTrend = 0;
  if (prevMonthAppointmentRate > 0) {
    appointmentRateTrend = Math.round(((appointmentRate - prevMonthAppointmentRate) / prevMonthAppointmentRate) * 100);
  }
  
  // 🔥 🔥 3. 내원 전환율 계산 - 퍼널 기준으로 수정 (신규문의 → 내원확정)
  // 3.1 이번달 신규문의 중 내원 확정 환자 수
  const currentMonthVisitedPatients = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return patient.visitConfirmed === true && 
           callInDate >= firstDayOfMonth && 
           callInDate <= today;
  }).length;
  
  // 3.2 이번달 내원 전환율 계산 (퍼널: 신규문의 → 내원확정)
  const visitRate = currentMonthInquiries > 0 
    ? (currentMonthVisitedPatients / currentMonthInquiries) * 100 
    : 0;
  
  // 3.3 지난달 내원 전환율 계산
  const prevMonthVisitedPatients = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return patient.visitConfirmed === true && 
           callInDate >= firstDayOfPrevMonth && 
           callInDate < firstDayOfMonth;
  }).length;
  
  const prevMonthVisitRate = prevMonthInquiries > 0
    ? (prevMonthVisitedPatients / prevMonthInquiries) * 100
    : 0;
  
  // 3.4 내원 전환율 증감률 계산
  let visitRateTrend = 0;
  if (prevMonthVisitRate > 0) {
    visitRateTrend = Math.round(((visitRate - prevMonthVisitRate) / prevMonthVisitRate) * 100);
  }

  // 🔥 4. 결제 전환율 계산 - 퍼널 기준 (신규문의 → 견적동의)
  // 4.1 이번달 신규문의 중 견적 동의 환자 수
  const currentMonthAgreedPatients = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfMonth && 
           callInDate <= today && 
           patient.consultation && 
           patient.consultation.estimateAgreed === true;
  }).length;
  
  // 4.2 이번달 결제 전환율 계산 (퍼널: 신규문의 → 견적동의)
  const paymentRate = currentMonthInquiries > 0 
    ? (currentMonthAgreedPatients / currentMonthInquiries) * 100 
    : 0;
  
  // 4.3 지난달 결제 전환율 계산
  const prevMonthAgreedPatients = patients.filter(patient => {
    const callInDate = new Date(patient.callInDate);
    return callInDate >= firstDayOfPrevMonth && 
           callInDate < firstDayOfMonth && 
           patient.consultation && 
           patient.consultation.estimateAgreed === true;
  }).length;
  
  const prevMonthPaymentRate = prevMonthInquiries > 0 
    ? (prevMonthAgreedPatients / prevMonthInquiries) * 100 
    : 0;
  
  // 4.4 결제 전환율 증감률 계산
  let paymentRateTrend = 0;
  if (prevMonthPaymentRate > 0) {
    paymentRateTrend = Math.round(((paymentRate - prevMonthPaymentRate) / prevMonthPaymentRate) * 100);
  } else if (paymentRate > 0) {
    paymentRateTrend = 100; // 이전 달이 0이고 이번 달이 0보다 크면 100% 증가
  }

  // 🔥 5. 환자 상태별 카운트 계산 - overdueCallbacks 추가
  // 5.1 미처리 콜백 계산 (새로 추가)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const overdueCallbacks = patients.filter(patient => {
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
      return false;
    }
    
    // 예정된 콜백 중에서 날짜가 지난 것이 있는지 확인
    return patient.callbackHistory.some(callback => {
      if (callback.status !== '예정') return false;
      
      const callbackDate = new Date(callback.date);
      callbackDate.setHours(0, 0, 0, 0);
      
      return callbackDate < todayStart; // 오늘보다 이전 날짜
    });
  }).length;

  // 5.2 기존 상태별 카운트
  const callbackNeeded = patients.filter(p => p.status === '콜백필요').length;
  const absentCount = patients.filter(p => p.status === '부재중').length;
  
  // 5.3 오늘 예정된 콜백 수
  const todayStr = today.toISOString().split('T')[0];
  const todayCallbacks = patients.filter(p => {
    if (p.callbackHistory && p.callbackHistory.length > 0) {
      return p.callbackHistory.some(callback => 
        callback.status === '예정' && callback.date === todayStr
      );
    }
    return p.nextCallbackDate === todayStr;
  }).length;

  // 6. 오늘 예정된 콜 데이터 (기존 로직 유지)
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

  // 🔥 로그 메시지 업데이트 - 퍼널 기준으로 수정
  console.log('🔥 퍼널 기준 월별 성과 지표 계산 결과 (신규문의 기준):');
  console.log('   📊 이번달 전체 신규문의(분모):', currentMonthInquiries, '건');
  console.log('   📈 예약확정(분자):', currentMonthConfirmedAppointments, '→ 전환율:', Math.round(appointmentRate * 10) / 10, '%');
  console.log('   🏥 내원확정(분자):', currentMonthVisitedPatients, '→ 전환율:', Math.round(visitRate * 10) / 10, '%');
  console.log('   💰 견적동의(분자):', currentMonthAgreedPatients, '→ 전환율:', Math.round(paymentRate * 10) / 10, '%');
  console.log('🚨 환자 상태 카운트:');
  console.log('   - 미처리 콜백:', overdueCallbacks, '건');
  console.log('   - 콜백 필요:', callbackNeeded, '명');
  console.log('   - 부재중:', absentCount, '명');
  console.log('   - 오늘 예정된 콜:', todayCallbacks, '건');

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
      },
      // 🔥 새로 추가: 결제 전환율
      paymentRate: {
        value: Math.round(paymentRate * 10) / 10,
        trend: paymentRateTrend,
      }
    },
    statusCounts: {
      overdueCallbacks,      // 🔥 새로 추가: 미처리 콜백
      callbackNeeded,
      absentCount,
      todayScheduled: todayCallbacks
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