// src/hooks/useGoalsCalculation.ts - 에러 수정된 버전
import { useEffect, useMemo } from 'react';
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

// 🔥 수정: 성과 지표 타입 - 건수/포인트/원 단위 증감으로 변경
interface PerformanceData {
  totalInquiries: {
    count: number;
    trend: number;          // 🔥 건수 증감
    inboundChange: number;  // 🔥 인바운드 건수 증감
    outboundChange: number; // 🔥 아웃바운드 건수 증감
    inboundCount: number;   // 🔥 이번달 인바운드 실제 건수
    outboundCount: number;  // 🔥 이번달 아웃바운드 실제 건수
  };
  appointmentRate: {
    value: number;
    trend: number;          // 🔥 %p 증감
    count: number;          // 🔥 예약전환 환자수
  };
  visitRate: {
    value: number;
    trend: number;          // 🔥 %p 증감
    count: number;          // 🔥 내원완료 환자수
  };
  paymentRate: {
    value: number;
    trend: number;          // 🔥 %p 증감
    count: number;          // 🔥 치료시작 환자수
  };
  // 🔥 치료금액 데이터 - 원 단위 증감으로 변경
  totalTreatmentAmount: {
    amount: number;         // 이번달 치료금액 합계
    count: number;          // 치료시작 환자 수
    trend: number;          // 🔥 원 단위 증감 (금액)
  };
}

// 🎯 환자 상태 카운트 타입 - 🔥 callbackUnregistered 추가
interface PatientStatusCounts {
  callbackUnregistered: number;  // 🔥 새로 추가: 콜백 미등록 (잠재고객 + 콜백 없음)
  overdueCallbacks: number;      // 미처리 콜백
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

  // 🔥 디버깅용 로그 추가 - 개발환경에서만
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 useGoalsCalculation 상태 확인:', {
      patientsStateExists: !!patientsState,
      patientsLength: patients.length,
      currentMonthExists: !!currentMonth
    });
  }

  // 🔥 최적화: 날짜 계산 메모이제이션
  const dateRanges = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // 🔥 이번달 범위 (문자열)
    const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const todayStr = today.toISOString().split('T')[0];
    
    // 🔥 지난달 범위 (문자열)
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 12 : currentMonth;
    const firstDayOfPrevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    
    // 지난달 마지막날 계산
    const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0);
    const lastDayOfPrevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayOfPrevMonth.getDate()).padStart(2, '0')}`;
    
    return {
      firstDayOfMonthStr,
      todayStr,
      firstDayOfPrevMonthStr,
      lastDayOfPrevMonthStr
    };
  }, []); // 의존성 없음 - 컴포넌트 생성 시 한 번만 계산

  // 🎯 수정된 계산 로직: 인바운드+아웃바운드 합계 계산
  const calculatePerformanceMetrics = useMemo(() => {
    return () => {
      // 🔍 대시보드 디버깅용 임시 코드 - 개발환경에서만
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 대시보드 디버깅 - 전체 환자 데이터:');
        patients.forEach((patient, index) => {
          if (index < 5) { // 처음 5명만 로그
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

      // 🔥 수정: 빈 데이터일 때 callbackUnregistered도 포함
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
            callbackUnregistered: 0,  // 🔥 수정: 누락된 필드 추가
            overdueCallbacks: 0,
            callbackNeeded: 0,
            absentCount: 0,
            todayScheduled: 0
          },
          todayCalls: []
        };
      }
      
      const { firstDayOfMonthStr, todayStr, firstDayOfPrevMonthStr, lastDayOfPrevMonthStr } = dateRanges;
      
      // 🔥 1. 월간 신규 문의 데이터 계산 (인바운드 + 아웃바운드 합계) - 문자열 비교로 수정
      const currentMonthPatients = patients.filter(patient => {
        const callInDate = patient.callInDate; // 문자열 그대로 사용
        return callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
      });
      
      const prevMonthPatients = patients.filter(patient => {
        const callInDate = patient.callInDate;
        return callInDate >= firstDayOfPrevMonthStr && callInDate <= lastDayOfPrevMonthStr;
      });

      const currentMonthInquiries = currentMonthPatients.length;

      // 🔍 이번달 신규문의 필터링 후 디버깅 - 개발환경에서만
      if (process.env.NODE_ENV === 'development') {
        console.log(`🗓️ 이번달 신규문의 (${firstDayOfMonthStr} ~ ${todayStr}): ${currentMonthInquiries}명`);

        // 🔍 치료시작 조건 체크
        console.log('🔍 치료시작 조건 체크:');
        currentMonthPatients.forEach((patient, index) => {
          if (index < 3) { // 처음 3명만
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
      
      // 🔥 인바운드/아웃바운드 구분 계산
      const currentMonthInbound = currentMonthPatients.filter(p => p.consultationType === 'inbound').length;
      const currentMonthOutbound = currentMonthPatients.filter(p => p.consultationType === 'outbound').length;
      const prevMonthInbound = prevMonthPatients.filter(p => p.consultationType === 'inbound').length;
      const prevMonthOutbound = prevMonthPatients.filter(p => p.consultationType === 'outbound').length;
      
      // 1.2 지난달 전체 신규 문의 수 계산 - 문자열 비교로 수정
      const prevMonthInquiries = prevMonthPatients.length;
      
      // 🔥 1.3 건수 증감 계산 (% 대신 건수로 변경)
      const inquiriesTrendCount = currentMonthInquiries - prevMonthInquiries;
      const inboundChange = currentMonthInbound - prevMonthInbound;
      const outboundChange = currentMonthOutbound - prevMonthOutbound;
      
      // 🔥 2. 예약 전환율 계산 - 퍼널 기준 (이번달 신규문의 → 예약확정) - 문자열 비교로 수정
      const currentMonthConfirmedAppointments = patients.filter(patient => {
        const callInDate = patient.callInDate;
        return callInDate >= firstDayOfMonthStr && 
               callInDate <= todayStr && 
               patient.status === '예약확정';
      });
      
      // 2.2 이번달 예약 전환율 계산 (퍼널: 신규문의 → 예약확정)
      const appointmentRate = currentMonthInquiries > 0 
        ? (currentMonthConfirmedAppointments.length / currentMonthInquiries) * 100 
        : 0;
      
      // 2.3 지난달 예약 전환율 계산 (전월 대비 트렌드용) - 문자열 비교로 수정
      const prevMonthConfirmedAppointments = patients.filter(patient => {
        const callInDate = patient.callInDate;
        return callInDate >= firstDayOfPrevMonthStr && 
               callInDate <= lastDayOfPrevMonthStr && 
               patient.status === '예약확정';
      });
      
      const prevMonthAppointmentRate = prevMonthInquiries > 0 
        ? (prevMonthConfirmedAppointments.length / prevMonthInquiries) * 100 
        : 0;

      // 🔥 2.4 예약 전환율 %p 증감 계산 (% 증감률 대신 %p 차이로 변경)
      const appointmentRateTrendPp = appointmentRate - prevMonthAppointmentRate;
      
      // 🔥 3. 내원 전환율 계산 - 퍼널 기준으로 수정 (신규문의 → 내원확정) - 문자열 비교로 수정
      const currentMonthVisitedPatients = patients.filter(patient => {
        const callInDate = patient.callInDate;
        return patient.visitConfirmed === true && 
               callInDate >= firstDayOfMonthStr && 
               callInDate <= todayStr;
      });
      
      // 3.2 이번달 내원 전환율 계산 (퍼널: 신규문의 → 내원확정)
      const visitRate = currentMonthInquiries > 0 
        ? (currentMonthVisitedPatients.length / currentMonthInquiries) * 100 
        : 0;
      
      // 3.3 지난달 내원 전환율 계산 - 문자열 비교로 수정
      const prevMonthVisitedPatients = patients.filter(patient => {
        const callInDate = patient.callInDate;
        return patient.visitConfirmed === true && 
               callInDate >= firstDayOfPrevMonthStr && 
               callInDate <= lastDayOfPrevMonthStr;
      });
      
      const prevMonthVisitRate = prevMonthInquiries > 0
        ? (prevMonthVisitedPatients.length / prevMonthInquiries) * 100
        : 0;
      
      // 🔥 3.4 내원 전환율 %p 증감 계산 (% 증감률 대신 %p 차이로 변경)
      const visitRateTrendPp = visitRate - prevMonthVisitRate;

      // 🔥 4. 결제 전환율 계산 - 수정된 버전 (내원 후 상태 "치료시작" 기준) - 문자열 비교로 수정
      let currentMonthTreatmentStarted = 0;
      let currentMonthTreatmentAmount = 0;
      
      const treatmentStartedPatients: string[] = []; // 🔍 디버깅용
      
      patients.forEach(patient => {
        const callInDate = patient.callInDate;
        const isThisMonth = callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
        
        if (!isThisMonth) return;
        
        // 🔥 내원 후 상태가 "치료시작"인 환자만 포함
        if (patient.visitConfirmed === true && patient.postVisitStatus === '치료시작') {
          currentMonthTreatmentStarted++;
          treatmentStartedPatients.push(patient.name); // 🔍 디버깅용
          
          // 🔥 🔥 🔥 치료금액 계산 로직 수정 - 정가와 할인가 우선순위 적용
          if (patient.postVisitConsultation && patient.postVisitConsultation.estimateInfo) {
            const estimate = patient.postVisitConsultation.estimateInfo;
            
            // 🔥 할인가 > 정가 > 0 순서로 우선순위 적용
            let finalAmount = 0;
            
            if (estimate.discountPrice && estimate.discountPrice > 0) {
              // 할인가가 있으면 할인가 사용
              finalAmount = estimate.discountPrice;
              if (process.env.NODE_ENV === 'development') {
                console.log(`💰 ${patient.name} - 할인가 적용: ${finalAmount.toLocaleString()}원`);
              }
            } else if (estimate.regularPrice && estimate.regularPrice > 0) {
              // 할인가가 없고 정가가 있으면 정가 사용
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

      // 🔍 실제 치료시작 환자 수 계산 디버깅 - 개발환경에서만
      if (process.env.NODE_ENV === 'development') {
        console.log(`💰 실제 치료시작 환자 수: ${currentMonthTreatmentStarted}명`);
        console.log(`💰 치료시작 환자 목록:`, treatmentStartedPatients);
        console.log(`💵 총 치료금액: ${currentMonthTreatmentAmount.toLocaleString()}원`);
      }
      
      // 4.2 이번달 결제 전환율 계산 (퍼널: 신규문의 → 치료시작)
      const paymentRate = currentMonthInquiries > 0 
        ? (currentMonthTreatmentStarted / currentMonthInquiries) * 100 
        : 0;

      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 결제 전환율: ${currentMonthInquiries > 0 ? (currentMonthTreatmentStarted / currentMonthInquiries * 100).toFixed(1) : 0}%`);
      }
      
      // 4.3 지난달 치료시작 환자 수 및 금액 계산 - 문자열 비교로 수정
      let prevMonthTreatmentStarted = 0;
      let prevMonthTreatmentAmount = 0;
      
      patients.forEach(patient => {
        const callInDate = patient.callInDate;
        const isPrevMonth = callInDate >= firstDayOfPrevMonthStr && callInDate <= lastDayOfPrevMonthStr;
        
        if (!isPrevMonth) return;
        
        // 내원 후 상태가 "치료시작"인 환자만 포함
        if (patient.visitConfirmed === true && patient.postVisitStatus === '치료시작') {
          prevMonthTreatmentStarted++;
          
          // 🔥 🔥 🔥 지난달 치료금액도 동일한 로직 적용
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
      
      // 🔥 4.4 결제 전환율 %p 증감 계산 (% 증감률 대신 %p 차이로 변경)
      const paymentRateTrendPp = paymentRate - prevMonthPaymentRate;

      // 🔥 4.5 치료금액 원 단위 증감 계산 (% 증감률 대신 원 단위 차이로 변경)
      const treatmentAmountTrendAmount = currentMonthTreatmentAmount - prevMonthTreatmentAmount;

      // 🔥 5. 환자 상태별 카운트 계산 - callbackUnregistered 추가
      // 5.1 콜백 미등록 계산 (새로 추가)
      const callbackUnregistered = patients.filter(patient => {
        // 잠재고객 상태이면서 콜백이 등록되지 않은 환자
        return patient.status === '잠재고객' && 
               (!patient.callbackHistory || patient.callbackHistory.length === 0);
      }).length;

      // 5.2 미처리 콜백 계산
      const today = new Date();
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

      // 5.3 기존 상태별 카운트
      const callbackNeeded = patients.filter(p => p.status === '콜백필요'|| p.postVisitStatus === '재콜백필요' ).length;
      const absentCount = patients.filter(p => p.status === '부재중').length;
      
      // 5.4 오늘 예정된 콜백 수 - 🔥 수정: todayStr 변수명 충돌 해결
      const todayDateStr = today.toISOString().split('T')[0]; // 🔥 변수명 변경
      const todayCallbacks = patients.filter(p => {
        if (p.callbackHistory && p.callbackHistory.length > 0) {
          return p.callbackHistory.some(callback => 
            callback.status === '예정' && callback.date === todayDateStr // 🔥 변수명 변경
          );
        }
        return p.nextCallbackDate === todayDateStr; // 🔥 변수명 변경
      }).length;

      // 6. 오늘 예정된 콜 데이터 (기존 로직 유지) - 🔥 수정: todayStr 변수명 충돌 해결
      const todaysCallsData = patients
        .filter(p => {
          if (p.callbackHistory && p.callbackHistory.length > 0) {
            return p.callbackHistory.some(callback => 
              callback.status === '예정' && callback.date === todayDateStr // 🔥 변수명 변경
            );
          }
          return p.nextCallbackDate === todayDateStr; // 🔥 변수명 변경
        })
        .slice(0, 5)
        .map((patient, index) => {
          let scheduledTime = `${todayDateStr}T09:00:00`; // 🔥 변수명 변경
          
          if (patient.callbackHistory) {
            const todayCallback = patient.callbackHistory.find(cb => 
              cb.status === '예정' && cb.date === todayDateStr // 🔥 변수명 변경
            );
            
            if (todayCallback && todayCallback.time) {
              scheduledTime = `${todayDateStr}T${todayCallback.time}:00`; // 🔥 변수명 변경
            } else {
              const hours = 9 + Math.floor(index / 2);
              const minutes = (index % 2) * 30;
              scheduledTime = `${todayDateStr}T${hours}:${minutes === 0 ? '00' : minutes}:00`; // 🔥 변수명 변경
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

      // 🔥 로그 메시지 업데이트 - 치료시작 기준으로 수정 - 개발환경에서만
      if (process.env.NODE_ENV === 'development') {
        console.log('🔥 퍼널 기준 월별 성과 지표 계산 결과 (신규문의 기준):');
        console.log('   📊 이번달 전체 신규문의(분모):', currentMonthInquiries, '건 (전월 대비', inquiriesTrendCount, '건)');
        console.log('   📈 예약확정(분자):', currentMonthConfirmedAppointments.length, '→ 전환율:', Math.round(appointmentRate * 10) / 10, '% (전월 대비', appointmentRateTrendPp.toFixed(1), '%p)');
        console.log('   🏥 내원확정(분자):', currentMonthVisitedPatients.length, '→ 전환율:', Math.round(visitRate * 10) / 10, '% (전월 대비', visitRateTrendPp.toFixed(1), '%p)');
        console.log('   💰 치료시작(분자):', currentMonthTreatmentStarted, '→ 전환율:', Math.round(paymentRate * 10) / 10, '% (전월 대비', paymentRateTrendPp.toFixed(1), '%p)');
        console.log('   💵 이번달 치료금액 합계:', currentMonthTreatmentAmount.toLocaleString(), '원 (전월 대비', treatmentAmountTrendAmount.toLocaleString(), '원)');
        console.log('🚨 환자 상태 카운트:');
        console.log('   - 콜백 미등록:', callbackUnregistered, '명');  // 🔥 새로 추가
        console.log('   - 미처리 콜백:', overdueCallbacks, '건');
        console.log('   - 콜백 필요:', callbackNeeded, '명');
        console.log('   - 부재중:', absentCount, '명');
        console.log('   - 오늘 예정된 콜:', todayCallbacks, '건');
      }

      return {
        performance: {
          totalInquiries: {  // 🔥 변경: outboundCalls → totalInquiries
            count: currentMonthInquiries,
            trend: inquiriesTrendCount,      // 🔥 건수 증감
            inboundChange: inboundChange,    // 🔥 인바운드 건수 증감
            outboundChange: outboundChange,  // 🔥 아웃바운드 건수 증감
            inboundCount: currentMonthInbound,   // 🔥 이번달 인바운드 실제 건수
            outboundCount: currentMonthOutbound  // 🔥 이번달 아웃바운드 실제 건수
          },
          appointmentRate: {
            value: Math.round(appointmentRate * 10) / 10,
            trend: appointmentRateTrendPp,   // 🔥 %p 증감
            count: currentMonthConfirmedAppointments.length  // 🔥 예약전환 환자수
          },
          visitRate: {
            value: Math.round(visitRate * 10) / 10,
            trend: visitRateTrendPp,         // 🔥 %p 증감
            count: currentMonthVisitedPatients.length  // 🔥 내원완료 환자수
          },
          // 🔥 수정된 결제 전환율 (치료시작 기준)
          paymentRate: {
            value: Math.round(paymentRate * 10) / 10,
            trend: paymentRateTrendPp,       // 🔥 %p 증감
            count: currentMonthTreatmentStarted  // 🔥 치료시작 환자수
          },
          // 🔥 새로 추가: 이번달 전체 치료금액
          totalTreatmentAmount: {
            amount: currentMonthTreatmentAmount,
            count: currentMonthTreatmentStarted,
            trend: treatmentAmountTrendAmount  // 🔥 원 단위 증감
          }
        },
        statusCounts: {
          callbackUnregistered,      // 🔥 새로 추가: 콜백 미등록
          overdueCallbacks,          // 미처리 콜백
          callbackNeeded,
          absentCount,
          todayScheduled: todayCallbacks
        },
        todayCalls: todaysCallsData
      };
    };
  }, [patients, dateRanges]); // 🔥 최적화: 환자 데이터와 날짜 범위가 변경될 때만 재계산

  // 🎯 계산 실행
  const metrics = calculatePerformanceMetrics();

  // 🎯 기존 목표 데이터 + 새로운 성과 지표 반환 - 메모이제이션 적용
  return useMemo(() => ({
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
  }), [currentMonth, metrics]);
};