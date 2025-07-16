// src/hooks/useGoalsCalculation.ts - 내원환자 콜백 미등록 로직 수정
import { useEffect, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { loadGoalsFromServer } from '@/store/slices/goalsSlice';
import { Call } from '@/store/slices/callsSlice';

interface GoalData {
  current: number;
  target: number;
  percentage: number;
}

interface CurrentMonthGoals {
  newPatients: GoalData;
  appointments: GoalData;
}

interface PerformanceData {
  totalInquiries: {
    count: number;
    trend: number;
    inboundChange: number;
    outboundChange: number;
    inboundCount: number;
    outboundCount: number;
    returningChange: number;
    returningCount: number;
  };
  appointmentRate: {
    value: number;
    trend: number;
    count: number;
  };
  visitRate: {
    value: number;
    trend: number;
    count: number;
  };
  paymentRate: {
    value: number;
    trend: number;
    count: number;
  };
  totalTreatmentAmount: {
    amount: number;
    count: number;
    trend: number;
  };
}

// 🔥 새로운 PatientStatusCounts 구조
interface StatusCardData {
  consultation: number;  // 상담환자
  visit: number;        // 내원환자
}

interface ReminderCardData {
  scheduled: number;       // 예정
  registrationNeeded: number; // 등록필요
}

interface NewPatientStatusCounts {
  overdueCallbacks: StatusCardData;      // 미처리 콜백
  todayScheduled: StatusCardData;        // 오늘 예정된 콜백  
  callbackUnregistered: StatusCardData;  // 콜백 미등록
  reminderCallbacks: ReminderCardData;   // 리마인더 콜백
}

interface UseGoalsCalculationResult {
  newPatients: GoalData;
  appointments: GoalData;
  performance: PerformanceData;
  statusCounts: NewPatientStatusCounts; // 🔥 새로운 구조
  todayCalls: Call[];
}

export const useGoalsCalculation = (): UseGoalsCalculationResult => {
  const dispatch = useDispatch();
  const { currentMonth } = useSelector((state: RootState) => state.goals);
  const patientsState = useSelector((state: RootState) => state.patients);
  const patients = patientsState?.patients || [];

  useEffect(() => {
    if (!currentMonth || (!currentMonth.newPatients && !currentMonth.appointments)) {
      dispatch(loadGoalsFromServer() as any);
    }
  }, [dispatch]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && patients.length > 0) {
      console.log('🎯 목표 달성률 재계산 시작 - 환자 수:', patients.length);
    }
  }, [patients.length]);

  const dateRanges = useMemo(() => {
    const today = new Date();
    
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    
    // 3일 후 날짜 계산 (리마인더용)
    const threeDaysLater = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));
    const threeDaysLaterStr = `${threeDaysLater.getFullYear()}-${String(threeDaysLater.getMonth() + 1).padStart(2, '0')}-${String(threeDaysLater.getDate()).padStart(2, '0')}`;
    
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 12 : currentMonth;
    const firstDayOfPrevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    
    const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0);
    const lastDayOfPrevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayOfPrevMonth.getDate()).padStart(2, '0')}`;
    
    return {
      firstDayOfMonthStr,
      todayStr,
      threeDaysLaterStr, // 🔥 추가
      firstDayOfPrevMonthStr,
      lastDayOfPrevMonthStr
    };
  }, []);

  const calculatePerformanceMetrics = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 목표 달성률 계산 시작:', patients?.length || 0, '명의 환자 데이터');
    }

    if (patients.length === 0) {
      return {
        performance: {
          totalInquiries: { count: 0, trend: 0, inboundChange: 0, outboundChange: 0, inboundCount: 0, outboundCount: 0, returningChange: 0, returningCount: 0},
          appointmentRate: { value: 0, trend: 0, count: 0 },
          visitRate: { value: 0, trend: 0, count: 0 },
          paymentRate: { value: 0, trend: 0, count: 0 },
          totalTreatmentAmount: { amount: 0, count: 0, trend: 0 }
        },
        statusCounts: {
          overdueCallbacks: { consultation: 0, visit: 0 },
          todayScheduled: { consultation: 0, visit: 0 },
          callbackUnregistered: { consultation: 0, visit: 0 },
          reminderCallbacks: { scheduled: 0, registrationNeeded: 0 }
        },
        todayCalls: []
      };
    }
    
    const { firstDayOfMonthStr, todayStr, threeDaysLaterStr, firstDayOfPrevMonthStr, lastDayOfPrevMonthStr } = dateRanges;
    
    // 기존 성과 지표 계산 (변경 없음)
    const currentMonthPatients = patients.filter(patient => {
      const callInDate = patient.callInDate;
      return callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
    });
    
    const prevMonthPatients = patients.filter(patient => {
      const callInDate = patient.callInDate;
      return callInDate >= firstDayOfPrevMonthStr && callInDate <= lastDayOfPrevMonthStr;
    });

    const currentMonthInquiries = currentMonthPatients.length;
    const currentMonthInbound = currentMonthPatients.filter(p => p.consultationType === 'inbound').length;
    const currentMonthOutbound = currentMonthPatients.filter(p => p.consultationType === 'outbound').length;
    const prevMonthInbound = prevMonthPatients.filter(p => p.consultationType === 'inbound').length;
    const prevMonthOutbound = prevMonthPatients.filter(p => p.consultationType === 'outbound').length;
    const prevMonthInquiries = prevMonthPatients.length;
    
    const inquiriesTrendCount = currentMonthInquiries - prevMonthInquiries;
    const inboundChange = currentMonthInbound - prevMonthInbound;
    const outboundChange = currentMonthOutbound - prevMonthOutbound;
    // 🔥 구신환 계산 추가 (여기에 추가!)
    const currentMonthReturning = currentMonthPatients.filter(p => 
      p.consultationType === 'returning'
    ).length;

    const prevMonthReturning = prevMonthPatients.filter(p => 
      p.consultationType === 'returning'
    ).length;

    const returningChange = currentMonthReturning - prevMonthReturning;
    
    // 예약 전환율 계산 (기존 로직 유지)
    const currentMonthConfirmedAppointments = patients.filter(patient => {
      const callInDate = patient.callInDate;
      const isThisMonth = callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
      
      if (!isThisMonth) return false;
      
      return patient.status === '예약확정' || patient.visitConfirmed === true;
    });

    const appointmentRate = currentMonthInquiries > 0 
      ? (currentMonthConfirmedAppointments.length / currentMonthInquiries) * 100 
      : 0;

    const prevMonthConfirmedAppointments = patients.filter(patient => {
      const callInDate = patient.callInDate;
      const isPrevMonth = callInDate >= firstDayOfPrevMonthStr && callInDate <= lastDayOfPrevMonthStr;
      
      if (!isPrevMonth) return false;
      
      return patient.status === '예약확정' || patient.visitConfirmed === true;
    });
    
    const prevMonthAppointmentRate = prevMonthInquiries > 0 
      ? (prevMonthConfirmedAppointments.length / prevMonthInquiries) * 100 
      : 0;

    const appointmentRateTrendPp = appointmentRate - prevMonthAppointmentRate;
    
    // 내원 전환율 계산 (기존 로직 유지)
    const currentMonthVisitedPatients = patients.filter(patient => {
      const callInDate = patient.callInDate;
      return patient.visitConfirmed === true && 
             callInDate >= firstDayOfMonthStr && 
             callInDate <= todayStr;
    });
    
    const visitRate = currentMonthInquiries > 0 
      ? (currentMonthVisitedPatients.length / currentMonthInquiries) * 100 
      : 0;
    
    const prevMonthVisitedPatients = patients.filter(patient => {
      const callInDate = patient.callInDate;
      return patient.visitConfirmed === true && 
             callInDate >= firstDayOfPrevMonthStr && 
             callInDate <= lastDayOfPrevMonthStr;
    });
    
    const prevMonthVisitRate = prevMonthInquiries > 0
      ? (prevMonthVisitedPatients.length / prevMonthInquiries) * 100
      : 0;
    
    const visitRateTrendPp = visitRate - prevMonthVisitRate;

    // 결제 전환율 계산 (기존 로직 유지)
    let currentMonthTreatmentStarted = 0;
    let currentMonthTreatmentAmount = 0;
    
    patients.forEach(patient => {
      const callInDate = patient.callInDate;
      const isThisMonth = callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
      
      if (!isThisMonth) return;
      
      if (patient.visitConfirmed === true && patient.postVisitStatus === '치료시작') {
        currentMonthTreatmentStarted++;
        
        if (patient.postVisitConsultation && patient.postVisitConsultation.estimateInfo) {
          const estimate = patient.postVisitConsultation.estimateInfo;
          
          let finalAmount = 0;
          
          if (estimate.discountPrice && estimate.discountPrice > 0) {
            finalAmount = estimate.discountPrice;
          } else if (estimate.regularPrice && estimate.regularPrice > 0) {
            finalAmount = estimate.regularPrice;
          }
          
          currentMonthTreatmentAmount += finalAmount;
        }
      }
    });
    
    const paymentRate = currentMonthInquiries > 0 
      ? (currentMonthTreatmentStarted / currentMonthInquiries) * 100 
      : 0;
    
    let prevMonthTreatmentStarted = 0;
    let prevMonthTreatmentAmount = 0;
    
    patients.forEach(patient => {
      const callInDate = patient.callInDate;
      const isPrevMonth = callInDate >= firstDayOfPrevMonthStr && callInDate <= lastDayOfPrevMonthStr;
      
      if (!isPrevMonth) return;
      
      if (patient.visitConfirmed === true && patient.postVisitStatus === '치료시작') {
        prevMonthTreatmentStarted++;
        
        if (patient.postVisitConsultation && patient.postVisitConsultation.estimateInfo) {
          const estimate = patient.postVisitConsultation.estimateInfo;
          
          let finalAmount = 0;
          
          if (estimate.discountPrice && estimate.discountPrice > 0) {
            finalAmount = estimate.discountPrice;
          } else if (estimate.regularPrice && estimate.regularPrice > 0) {
            finalAmount = estimate.regularPrice;
          }
          
          prevMonthTreatmentAmount += finalAmount;
        }
      }
    });
    
    const prevMonthPaymentRate = prevMonthInquiries > 0 
      ? (prevMonthTreatmentStarted / prevMonthInquiries) * 100 
      : 0;
    
    const paymentRateTrendPp = paymentRate - prevMonthPaymentRate;
    const treatmentAmountTrendAmount = currentMonthTreatmentAmount - prevMonthTreatmentAmount;

    // 🔥 새로운 환자 상태별 카운트 계산
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 1. 미처리 콜백 계산
    const overdueCallbacks_consultation = patients.filter(patient => {
      // 내원확정된 환자는 제외 (상담환자만)
      if (patient.visitConfirmed === true) return false;
      
      // 🔥 예약확정/재예약확정 상태인 환자도 제외
      if (patient.status === '예약확정' || patient.status === '재예약확정') return false;
      
      // 환자상태가 "콜백필요"이고 콜백 예정 날짜가 오늘 이전인 경우
      if (patient.status !== '콜백필요') return false;
      
      if (!patient.callbackHistory || patient.callbackHistory.length === 0) return false;
      
      return patient.callbackHistory.some((callback: any) => {
        if (callback.status !== '예정') return false;
        const callbackDate = new Date(callback.date);
        callbackDate.setHours(0, 0, 0, 0);
        return callbackDate < todayStart;
      });
    }).length;

    const overdueCallbacks_visit = patients.filter(patient => {
      // 내원 후 상태가 "재콜백필요"인 경우
      if (!(patient.visitConfirmed === true && patient.postVisitStatus === '재콜백필요')) {
        return false;
      }
      
      if (!patient.callbackHistory || patient.callbackHistory.length === 0) return false;
      
      return patient.callbackHistory.some((callback: any) => {
        if (callback.status !== '예정') return false;
        const callbackDate = new Date(callback.date);
        callbackDate.setHours(0, 0, 0, 0);
        return callbackDate < todayStart;
      });
    }).length;

    // 2. 오늘 예정된 콜백 계산
    // 🔥 수정된 부분: "오늘 예정된 콜백 - 상담환자" 로직
    const todayScheduled_consultation = patients.filter(patient => {
      // 내원확정된 환자는 제외 (상담환자만)
      if (patient.visitConfirmed === true) return false;
      
      // 🔥 예약확정 상태인 환자도 제외 (이미 최종 상태)
      if (patient.status === '예약확정') return false;
      
      // 🔥 재예약확정 상태인 환자도 제외 (이미 최종 상태)
      if (patient.status === '재예약확정') return false;
      
      // 🔧 수정: nextCallbackDate 조건 제거
      return patient.callbackHistory?.some((callback: any) => 
        callback.status === '예정' && callback.date === todayStr
      );
    }).length;

    const todayScheduled_visit = patients.filter(patient => {
      // 내원환자만 (재콜백필요 상태)
      if (!(patient.visitConfirmed === true && patient.postVisitStatus === '재콜백필요')) {
        return false;
      }
      
      return patient.callbackHistory?.some((callback: any) => 
        callback.status === '예정' && callback.date === todayStr
      );
    }).length;

    // 🔥 3. 콜백 미등록 계산 - 핵심 수정 부분!
    const callbackUnregistered_consultation = patients.filter(patient => {
      // 내원확정된 환자는 제외
      if (patient.visitConfirmed === true) return false;
      
      // 🔥 예약확정/재예약확정 상태인 환자도 제외 (이미 최종 상태)
      if (patient.status === '예약확정' || patient.status === '재예약확정') return false;
      
      // 예약 후 미내원, 부재중, 잠재고객 상태
      const isTargetStatus = patient.status === '부재중' || 
                          patient.status === '잠재고객' || 
                          patient.isPostReservationPatient === true;
      
      if (!isTargetStatus) return false;
      
      // callbackHistory가 없거나 빈 배열이거나, 예정된 콜백이 없는 환자들
      if (!patient.callbackHistory || patient.callbackHistory.length === 0) return true;
      
      const hasScheduledCallback = patient.callbackHistory.some((callback: any) => 
        callback.status === '예정'
      );
      
      return !hasScheduledCallback;
    }).length;

    // 🔥 여기가 핵심 수정 부분! 내원환자의 콜백 미등록 로직
    const callbackUnregistered_visit = patients.filter(patient => {
      // 내원환자 중 상태미설정 (postVisitStatus가 없거나 undefined인 경우)
      if (!(patient.visitConfirmed === true && !patient.postVisitStatus)) {
        return false;
      }
      
      // 🔥 핵심: 내원관리 콜백만 체크! 상담관리 콜백은 이미 소용없으므로 무시
      if (!patient.callbackHistory || patient.callbackHistory.length === 0) return true;
      
      const hasVisitManagementCallback = patient.callbackHistory.some((callback: any) => 
        callback.status === '예정' && 
        callback.isVisitManagementCallback === true  // 🔥 내원관리 콜백만 체크
      );
      
      return !hasVisitManagementCallback;
    }).length;

    // 4. 리마인더 콜백 계산
    const reminderCallbacks_scheduled = patients.filter(patient => {
      // 치료동의 상태이고 치료시작예정일이 3일 이내
      if (!(patient.visitConfirmed === true && patient.postVisitStatus === '치료동의')) {
        return false;
      }
      
      const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
      if (!treatmentStartDate) return false;
      
      const isWithinThreeDays = treatmentStartDate >= todayStr && treatmentStartDate <= threeDaysLaterStr;
      if (!isWithinThreeDays) return false;
      
      // 이미 리마인더 콜백이 등록된 환자들은 제외
      if (patient.callbackHistory && patient.callbackHistory.length > 0) {
        const hasReminderCallback = patient.callbackHistory.some((callback: any) => 
          callback.notes && callback.notes.includes('리마인더')
        );
        if (hasReminderCallback) return false;
      }
      
      return true;
    }).length;

    const reminderCallbacks_registrationNeeded = patients.filter(patient => {
      // 치료동의 상태이고 치료시작예정일이 오늘보다 이전
      if (!(patient.visitConfirmed === true && patient.postVisitStatus === '치료동의')) {
        return false;
      }
      
      const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
      if (!treatmentStartDate) return false;
      
      return treatmentStartDate < todayStr;
    }).length;

    // 🔥 기존 todayCalls 로직 유지 (변경 없음)
    const todaysCallsData: Call[] = patients
      .filter(patient => {
        const hasManagementCallback = (() => {
          if (patient.visitConfirmed === true && patient.postVisitStatus !== '재콜백필요') {
            return false;
          }
          
          // 🔥 예약확정/재예약확정 상태인 환자도 제외
          if (patient.status === '예약확정' || patient.status === '재예약확정') {
            return false;
          }
          
          return patient.callbackHistory?.some((callback: any) => 
            callback.status === '예정' && callback.date === todayStr
          );
        })();

        const hasPostVisitCallback = patient.visitConfirmed === true && 
                                    patient.postVisitStatus === '재콜백필요' &&
                                    patient.callbackHistory?.some((callback: any) => 
                                      callback.status === '예정' && callback.date === todayStr
                                    );

        return hasManagementCallback || hasPostVisitCallback;
      })
      .map((patient, index) => {
        let todayCallback = null;
        let callSource = 'management';

        if (patient.callbackHistory) {
          todayCallback = patient.callbackHistory.find(cb => 
            cb.status === '예정' && cb.date === todayStr
          );
        }

        if (patient.visitConfirmed === true && patient.postVisitStatus === '재콜백필요') {
          callSource = 'postVisit';
        }

        let scheduledTime = '';
        if (todayCallback && todayCallback.time) {
          scheduledTime = `${todayStr}T${todayCallback.time}:00`;
        } else {
          const hours = 9 + Math.floor(index / 2);
          const minutes = (index % 2) * 30;
          const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          scheduledTime = `${todayStr}T${timeStr}:00`;
        }

        return {
          id: `call-${patient.id}-${todayStr}-${index}`,
          patientId: patient.id,
          patientName: patient.name,
          phoneNumber: patient.phoneNumber,
          scheduledTime: scheduledTime,
          status: '예정' as const,
          attemptCount: patient.reminderStatus === '초기' ? 0 : 
                      patient.reminderStatus === '1차' ? 1 :
                      patient.reminderStatus === '2차' ? 2 :
                      patient.reminderStatus === '3차' ? 3 : 0,
          notes: todayCallback?.notes || patient.notes || '',
          createdAt: patient.createdAt || new Date().toISOString(),
          updatedAt: patient.updatedAt || new Date().toISOString(),
          callSource: callSource as 'management' | 'postVisit',
          postVisitInfo: callSource === 'postVisit' ? {
            visitConfirmed: patient.visitConfirmed || false,
            postVisitStatus: String(patient.postVisitStatus || ''),
            hasPostVisitConsultation: !!patient.postVisitConsultation
          } : undefined
        };
      });

    if (process.env.NODE_ENV === 'development') {
      console.log('🔥 새로운 상태 카운트 계산 결과 (콜백 미등록 내원환자 로직 수정):', {
        overdueCallbacks: { consultation: overdueCallbacks_consultation, visit: overdueCallbacks_visit },
        todayScheduled: { consultation: todayScheduled_consultation, visit: todayScheduled_visit },
        callbackUnregistered: { 
          consultation: callbackUnregistered_consultation, 
          visit: callbackUnregistered_visit  // 🔥 이제 내원관리 콜백만 체크하므로 정확해짐
        },
        reminderCallbacks: { scheduled: reminderCallbacks_scheduled, registrationNeeded: reminderCallbacks_registrationNeeded }
      });
    }

    return {
      performance: {
        totalInquiries: {
          count: currentMonthInquiries,
          trend: inquiriesTrendCount,
          inboundChange: inboundChange,
          outboundChange: outboundChange,
          inboundCount: currentMonthInbound,
          outboundCount: currentMonthOutbound,
          returningChange: returningChange,
          returningCount: currentMonthReturning
        },
        appointmentRate: {
          value: Math.round(appointmentRate * 10) / 10,
          trend: appointmentRateTrendPp,
          count: currentMonthConfirmedAppointments.length
        },
        visitRate: {
          value: Math.round(visitRate * 10) / 10,
          trend: visitRateTrendPp,
          count: currentMonthVisitedPatients.length
        },
        paymentRate: {
          value: Math.round(paymentRate * 10) / 10,
          trend: paymentRateTrendPp,
          count: currentMonthTreatmentStarted
        },
        totalTreatmentAmount: {
          amount: currentMonthTreatmentAmount,
          count: currentMonthTreatmentStarted,
          trend: treatmentAmountTrendAmount
        }
      },
      statusCounts: {
        overdueCallbacks: { consultation: overdueCallbacks_consultation, visit: overdueCallbacks_visit },
        todayScheduled: { consultation: todayScheduled_consultation, visit: todayScheduled_visit },
        callbackUnregistered: { 
          consultation: callbackUnregistered_consultation, 
          visit: callbackUnregistered_visit  // 🔥 수정된 로직 적용
        },
        reminderCallbacks: { scheduled: reminderCallbacks_scheduled, registrationNeeded: reminderCallbacks_registrationNeeded }
      },
      todayCalls: todaysCallsData
    };
  }, [patients, dateRanges]);

  const metrics = useMemo(() => {
    return calculatePerformanceMetrics();
  }, [calculatePerformanceMetrics]);

  return useMemo(() => {
    const safeCurrentMonth = currentMonth || {
      newPatients: { current: 0, target: 100, percentage: 0 },
      appointments: { current: 0, target: 70, percentage: 0 }
    };

    return {
      newPatients: {
        current: safeCurrentMonth.newPatients.current,
        target: safeCurrentMonth.newPatients.target,
        percentage: safeCurrentMonth.newPatients.percentage,
      },
      appointments: {
        current: safeCurrentMonth.appointments.current,
        target: safeCurrentMonth.appointments.target,
        percentage: safeCurrentMonth.appointments.percentage,
      },
      performance: metrics.performance,
      statusCounts: metrics.statusCounts, // 🔥 새로운 구조
      todayCalls: metrics.todayCalls
    };
  }, [currentMonth, metrics]);
};