// src/hooks/useGoalsCalculation.ts - 최종 완성 버전
import { useEffect, useMemo } from 'react';
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

interface PatientStatusCounts {
  callbackUnregistered: number;
  overdueCallbacks: number;
  callbackNeeded: number;
  absentCount: number;
  todayScheduled: number;
}

interface UseGoalsCalculationResult {
  newPatients: GoalData;
  appointments: GoalData;
  performance: PerformanceData;
  statusCounts: PatientStatusCounts;
  todayCalls: Call[];
}

export const useGoalsCalculation = (): UseGoalsCalculationResult => {
  const dispatch = useDispatch();
  const { currentMonth } = useSelector((state: RootState) => state.goals);
  const patientsState = useSelector((state: RootState) => state.patients);
  const patients = patientsState?.patients || [];

  useEffect(() => {
    dispatch(loadGoalsFromServer() as any);
  }, [dispatch]);

  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 useGoalsCalculation 상태 확인:', {
      patientsStateExists: !!patientsState,
      patientsLength: patients.length,
      currentMonthExists: !!currentMonth
    });
  }

  // 🔥 날짜 계산 - 로컬 날짜 기준으로 통일
  const dateRanges = useMemo(() => {
    const today = new Date();
    
    // 로컬 날짜를 정확히 계산 (타임존 상관없이)
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    
    console.log('🔥 날짜 계산 디버깅:', {
      originalDate: today,
      year, month, date,
      todayStr: todayStr,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
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
      firstDayOfPrevMonthStr,
      lastDayOfPrevMonthStr
    };
  }, []);

  const calculatePerformanceMetrics = useMemo(() => {
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 대시보드 디버깅 - 전체 환자 데이터:');
        patients.forEach((patient, index) => {
          if (index < 5) {
            console.log(`환자 ${index + 1}:`, {
              name: patient.name,
              callInDate: patient.callInDate,
              visitConfirmed: patient.visitConfirmed,
              postVisitStatus: patient.postVisitStatus,
              postVisitConsultation: patient.postVisitConsultation ? '있음' : '없음',
              discountPrice: patient.postVisitConsultation?.estimateInfo?.discountPrice || 0
            });
          }
        });
      }

      if (patients.length === 0) {
        return {
          performance: {
            totalInquiries: { count: 0, trend: 0, inboundChange: 0, outboundChange: 0, inboundCount: 0, outboundCount: 0 },
            appointmentRate: { value: 0, trend: 0, count: 0 },
            visitRate: { value: 0, trend: 0, count: 0 },
            paymentRate: { value: 0, trend: 0, count: 0 },
            totalTreatmentAmount: { amount: 0, count: 0, trend: 0 }
          },
          statusCounts: {
            callbackUnregistered: 0,
            overdueCallbacks: 0,
            callbackNeeded: 0,
            absentCount: 0,
            todayScheduled: 0
          },
          todayCalls: []
        };
      }
      
      const { firstDayOfMonthStr, todayStr, firstDayOfPrevMonthStr, lastDayOfPrevMonthStr } = dateRanges;
      
      // 월간 신규 문의 데이터 계산
      const currentMonthPatients = patients.filter(patient => {
        const callInDate = patient.callInDate;
        return callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
      });
      
      const prevMonthPatients = patients.filter(patient => {
        const callInDate = patient.callInDate;
        return callInDate >= firstDayOfPrevMonthStr && callInDate <= lastDayOfPrevMonthStr;
      });

      const currentMonthInquiries = currentMonthPatients.length;

      if (process.env.NODE_ENV === 'development') {
        console.log(`🗓️ 이번달 신규문의 (${firstDayOfMonthStr} ~ ${todayStr}): ${currentMonthInquiries}명`);
        console.log('🔍 치료시작 조건 체크:');
        currentMonthPatients.forEach((patient, index) => {
          if (index < 3) {
            const isVisitConfirmed = patient.visitConfirmed === true;
            const isTreatmentStarted = patient.postVisitStatus === '치료시작';
            
            console.log(`${patient.name}:`, {
              visitConfirmed: isVisitConfirmed,
              postVisitStatus: patient.postVisitStatus,
              isTreatmentStarted: isTreatmentStarted,
              bothConditions: isVisitConfirmed && isTreatmentStarted,
              discountPrice: patient.postVisitConsultation?.estimateInfo?.discountPrice || 0
            });
          }
        });
      }
      
      const currentMonthInbound = currentMonthPatients.filter(p => p.consultationType === 'inbound').length;
      const currentMonthOutbound = currentMonthPatients.filter(p => p.consultationType === 'outbound').length;
      const prevMonthInbound = prevMonthPatients.filter(p => p.consultationType === 'inbound').length;
      const prevMonthOutbound = prevMonthPatients.filter(p => p.consultationType === 'outbound').length;
      
      const prevMonthInquiries = prevMonthPatients.length;
      
      const inquiriesTrendCount = currentMonthInquiries - prevMonthInquiries;
      const inboundChange = currentMonthInbound - prevMonthInbound;
      const outboundChange = currentMonthOutbound - prevMonthOutbound;
      
      // 예약 전환율 계산
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
      
      // 내원 전환율 계산
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

      // 결제 전환율 계산
      let currentMonthTreatmentStarted = 0;
      let currentMonthTreatmentAmount = 0;
      
      const treatmentStartedPatients: string[] = [];
      
      patients.forEach(patient => {
        const callInDate = patient.callInDate;
        const isThisMonth = callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
        
        if (!isThisMonth) return;
        
        if (patient.visitConfirmed === true && patient.postVisitStatus === '치료시작') {
          currentMonthTreatmentStarted++;
          treatmentStartedPatients.push(patient.name);
          
          if (patient.postVisitConsultation && patient.postVisitConsultation.estimateInfo) {
            const estimate = patient.postVisitConsultation.estimateInfo;
            
            let finalAmount = 0;
            
            if (estimate.discountPrice && estimate.discountPrice > 0) {
              finalAmount = estimate.discountPrice;
              if (process.env.NODE_ENV === 'development') {
                console.log(`💰 ${patient.name} - 할인가 적용: ${finalAmount.toLocaleString()}원`);
              }
            } else if (estimate.regularPrice && estimate.regularPrice > 0) {
              finalAmount = estimate.regularPrice;
              if (process.env.NODE_ENV === 'development') {
                console.log(`💰 ${patient.name} - 정가 적용: ${finalAmount.toLocaleString()}원`);
              }
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log(`⚠️ ${patient.name} - 치료금액 정보 없음`);
              }
            }
            
            currentMonthTreatmentAmount += finalAmount;
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log(`⚠️ ${patient.name} - 견적 정보 없음`);
            }
          }
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`💰 실제 치료시작 환자 수: ${currentMonthTreatmentStarted}명`);
        console.log(`💰 치료시작 환자 목록:`, treatmentStartedPatients);
        console.log(`💵 총 치료금액: ${currentMonthTreatmentAmount.toLocaleString()}원`);
      }
      
      const paymentRate = currentMonthInquiries > 0 
        ? (currentMonthTreatmentStarted / currentMonthInquiries) * 100 
        : 0;

      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 결제 전환율: ${currentMonthInquiries > 0 ? (currentMonthTreatmentStarted / currentMonthInquiries * 100).toFixed(1) : 0}%`);
      }
      
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

      // 환자 상태별 카운트 계산
      const callbackUnregistered = patients.filter(patient => {
        return patient.status === '잠재고객' && 
               (!patient.callbackHistory || patient.callbackHistory.length === 0);
      }).length;

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const overdueCallbacks = patients.filter(patient => {
        if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
          return false;
        }
        
        return patient.callbackHistory.some(callback => {
          if (callback.status !== '예정') return false;
          
          const callbackDate = new Date(callback.date);
          callbackDate.setHours(0, 0, 0, 0);
          
          return callbackDate < todayStart;
        });
      }).length;

      const callbackNeededPatients = patients.filter(p => p.status === '콜백필요' || p.postVisitStatus === '재콜백필요');
      const callbackNeeded = callbackNeededPatients.length;
      const absentCount = patients.filter(p => p.status === '부재중').length;

      // 콜백 필요 환자 디버깅
      if (process.env.NODE_ENV === 'development') {
        console.log('🔥 콜백 필요 환자 12명 상세:', {
          총수: callbackNeededPatients.length,
          오늘날짜: todayStr,
          환자목록: callbackNeededPatients.map(p => ({
            이름: p.name,
            상태: p.status,
            내원후상태: p.postVisitStatus,
            콜백히스토리: p.callbackHistory || [],
            다음콜백날짜: p.nextCallbackDate,
            오늘콜백있음: p.callbackHistory?.some(cb => 
              cb.date === todayStr && cb.status === '예정'
            ) || false
          }))
        });
      }
      
      // 🔥 오늘 예정된 콜백 수 - 통일된 todayStr 사용
      const todayCallbacks = patients.filter(p => {
        if (p.callbackHistory && p.callbackHistory.length > 0) {
          return p.callbackHistory.some(callback => 
            callback.status === '예정' && callback.date === todayStr
          );
        }
        return p.nextCallbackDate === todayStr;
      }).length;

      // 🔥 오늘 예정된 콜 데이터 생성 - 통일된 todayStr 사용
      const todaysCallsData: Call[] = patients
        .filter(patient => {
          if (patient.callbackHistory && patient.callbackHistory.length > 0) {
            return patient.callbackHistory.some(callback => 
              callback.status === '예정' && callback.date === todayStr
            );
          }
          return patient.nextCallbackDate === todayStr;
        })
        .map((patient, index) => {
          let todayCallback = null;
          if (patient.callbackHistory) {
            todayCallback = patient.callbackHistory.find(cb => 
              cb.status === '예정' && cb.date === todayStr
            );
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
            updatedAt: patient.updatedAt || new Date().toISOString()
          };
        });

      // 디버깅 로그
      if (process.env.NODE_ENV === 'development') {
        console.log('🔥 오늘 예정된 콜 데이터 생성 완료:', {
          총환자수: patients.length,
          오늘날짜: todayStr,
          필터링조건확인: patients.map(patient => ({
            이름: patient.name,
            콜백히스토리: patient.callbackHistory || [],
            다음콜백날짜: patient.nextCallbackDate,
            오늘콜백있음: patient.callbackHistory?.some(callback => 
              callback.status === '예정' && callback.date === todayStr
            ) || false
          })).filter(p => p.오늘콜백있음 || p.다음콜백날짜 === todayStr),
          오늘예정된콜수: todaysCallsData.length,
          실제콜목록: todaysCallsData
        });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🔥 퍼널 기준 월별 성과 지표 계산 결과 (신규문의 기준):');
        console.log('   📊 이번달 전체 신규문의(분모):', currentMonthInquiries, '건 (전월 대비', inquiriesTrendCount, '건)');
        console.log('   📈 예약확정(분자):', currentMonthConfirmedAppointments.length, '→ 전환율:', Math.round(appointmentRate * 10) / 10, '% (전월 대비', appointmentRateTrendPp.toFixed(1), '%p)');
        console.log('   🏥 내원확정(분자):', currentMonthVisitedPatients.length, '→ 전환율:', Math.round(visitRate * 10) / 10, '% (전월 대비', visitRateTrendPp.toFixed(1), '%p)');
        console.log('   💰 치료시작(분자):', currentMonthTreatmentStarted, '→ 전환율:', Math.round(paymentRate * 10) / 10, '% (전월 대비', paymentRateTrendPp.toFixed(1), '%p)');
        console.log('   💵 이번달 치료금액 합계:', currentMonthTreatmentAmount.toLocaleString(), '원 (전월 대비', treatmentAmountTrendAmount.toLocaleString(), '원)');
        console.log('🚨 환자 상태 카운트:');
        console.log('   - 콜백 미등록:', callbackUnregistered, '명');
        console.log('   - 미처리 콜백:', overdueCallbacks, '건');
        console.log('   - 콜백 필요:', callbackNeeded, '명');
        console.log('   - 부재중:', absentCount, '명');
        console.log('   - 오늘 예정된 콜:', todayCallbacks, '건');
      }

      return {
        performance: {
          totalInquiries: {
            count: currentMonthInquiries,
            trend: inquiriesTrendCount,
            inboundChange: inboundChange,
            outboundChange: outboundChange,
            inboundCount: currentMonthInbound,
            outboundCount: currentMonthOutbound
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
          callbackUnregistered,
          overdueCallbacks,
          callbackNeeded,
          absentCount,
          todayScheduled: todayCallbacks
        },
        todayCalls: todaysCallsData
      };
    };
  }, [patients, dateRanges]);

  const metrics = calculatePerformanceMetrics();

  return useMemo(() => ({
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
    performance: metrics.performance,
    statusCounts: metrics.statusCounts,
    todayCalls: metrics.todayCalls
  }), [currentMonth, metrics]);
};