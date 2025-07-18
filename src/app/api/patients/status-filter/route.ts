// src/app/api/patients/status-filter/route.ts - 완전한 수정된 버전

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('type');

    if (!filterType) {
      return NextResponse.json(
        { error: '필터 타입이 필요합니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    
    // 현재 날짜 계산
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // 🔥 이번 달 시작/끝 날짜 계산
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    
    // 🔥 오늘 날짜 문자열 (YYYY-MM-DD 형식)
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // 3일 후 날짜 계산 (리마인더용)
    const threeDaysLater = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));
    const threeDaysLaterStr = `${threeDaysLater.getFullYear()}-${String(threeDaysLater.getMonth() + 1).padStart(2, '0')}-${String(threeDaysLater.getDate()).padStart(2, '0')}`;

    // 🔥 예약 후 미내원 환자 판별 헬퍼 함수 (patients API와 동일)
    const calculatePostReservationStatus = (patient: any): boolean => {
      if (patient.status === '예약확정' && 
          !patient.visitConfirmed && 
          patient.reservationDate) {
        
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        const reservationDate = patient.reservationDate;
        
        return reservationDate < todayString;
      }
      
      return false;
    };

    let patients = [];
    
    switch (filterType) {
      // 🔥 새로 추가된 내원관리 필터들
      case 'unprocessed_callback': {
        // 미처리 콜백 - 내원관리 콜백 예정일이 지났는데 아직 처리되지 않은 환자
        const allPatients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
            return false;
          }
          
          // 내원 관리 콜백 중 예정인 것들만 체크
          const visitCallbacks = patient.callbackHistory.filter((cb: any) => 
            cb.isVisitManagementCallback === true && cb.status === '예정'
          );
          
          if (visitCallbacks.length === 0) {
            return false;
          }
          
          // 예정일이 지났는지 확인
          return visitCallbacks.some((callback: any) => {
            return callback.date < todayStr;
          });
        });
        
        console.log(`[API] 미처리 콜백 환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'treatment_consent_not_started': {
        // 치료동의 후 미시작 - 치료동의 상태이고 치료 시작 예정일이 지났는데 팔로업이 안 된 환자
        patients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            postVisitStatus: '치료동의',
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = patients.filter((patient: any) => {
          const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
          if (!treatmentStartDate) {
            return false;
          }
          
          // 치료 시작 예정일이 지났는지 확인
          return treatmentStartDate < todayStr;
        });
        
        console.log(`[API] 치료동의 후 미시작 환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'needs_callback_visit': {
        // 재콜백 필요 - 내원관리 (기존 로직과 동일하지만 명확히 구분)
        patients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            postVisitStatus: '재콜백필요',
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .sort({ createdAt: -1 })
          .toArray();
        
        console.log(`[API] 재콜백 필요 - 내원환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'no_status_visit': {
        // 상태 미설정 - 내원관리 (내원확정되었지만 postVisitStatus가 없는 환자)
        patients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            $or: [
              { postVisitStatus: { $exists: false } },
              { postVisitStatus: null },
              { postVisitStatus: '' }
            ],
            $and: [
              {
                $or: [
                  { isCompleted: { $ne: true } },
                  { isCompleted: { $exists: false } }
                ]
              }
            ]
          })
          .sort({ createdAt: -1 })
          .toArray();
        
        console.log(`[API] 상태 미설정 - 내원환자 ${patients.length}명 조회 완료`);
        break;
      }

      // 🔥 새로 추가: "잠재고객" 필터 케이스
      case 'potential_customer': {
        // 잠재고객 상태인 환자들만 필터링
        patients = await db.collection('patients')
          .find({
            status: '잠재고객',
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .sort({ createdAt: -1 })
          .toArray();
        
        console.log(`[API] 잠재고객 환자 ${patients.length}명 조회 완료`);
        break;
      }

      // 🔥 대시보드 필터 타입들 추가
      case 'new_inquiry': {
        // 🔥 SummaryCards.tsx와 동일한 로직 적용
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // 이번달 범위 (SummaryCards.tsx와 동일)
        const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const todayStr = now.toISOString().split('T')[0];
        
        console.log(`[API] 이번달 신규 문의 필터링 범위: ${firstDayOfMonthStr} ~ ${todayStr}`);
        
        // 🔥 핵심 수정: callInDate 기준으로 필터링 (createdAt이 아닌!)
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } },
              { isCompleted: true } // 종결된 환자도 포함 (신규 문의이므로)
            ]
          })
          .sort({ createdAt: -1 })
          .toArray();
        
        // 🔥 SummaryCards.tsx와 동일한 필터링 로직 적용
        patients = allPatients.filter((patient: any) => {
          const callInDate = patient.callInDate;
          if (!callInDate) return false;
          
          return callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
        });
        
        console.log(`[API] 이번달 신규 문의 환자 ${patients.length}명 조회 완료 (callInDate 기준)`);
        break;
      }

      case 'reservation_rate': {
        // 🔥 SummaryCards.tsx와 동일한 로직 적용
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const todayStr = now.toISOString().split('T')[0];
        
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } },
              { isCompleted: true }
            ]
          })
          .sort({ createdAt: -1 })
          .toArray();
        
        // 🔥 이번달 신규 환자 중 예약확정 상태인 환자들
        patients = allPatients.filter((patient: any) => {
          const callInDate = patient.callInDate;
          if (!callInDate) return false;
          
          // 이번달 신규 환자인지 확인
          const isThisMonth = callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
          if (!isThisMonth) return false;
          
          // 예약확정 상태인지 확인
          return patient.status === '예약확정' || patient.visitConfirmed === true;
        });
        
        console.log(`[API] 예약전환율 환자 ${patients.length}명 조회 완료 (callInDate 기준)`);
        break;
      }

      case 'visit_rate': {
        // 🔥 SummaryCards.tsx와 동일한 로직 적용
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const todayStr = now.toISOString().split('T')[0];
        
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } },
              { isCompleted: true }
            ]
          })
          .sort({ createdAt: -1 })
          .toArray();
        
        // 🔥 이번달 신규 환자 중 내원확정된 환자들
        patients = allPatients.filter((patient: any) => {
          const callInDate = patient.callInDate;
          if (!callInDate) return false;
          
          // 이번달 신규 환자인지 확인
          const isThisMonth = callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
          if (!isThisMonth) return false;
          
          // 내원확정된 환자인지 확인
          return patient.visitConfirmed === true;
        });
        
        console.log(`[API] 내원전환율 환자 ${patients.length}명 조회 완료 (callInDate 기준)`);
        break;
      }

      case 'treatment_rate': {
        // 🔥 SummaryCards.tsx와 동일한 로직 적용
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const todayStr = now.toISOString().split('T')[0];
        
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } },
              { isCompleted: true }
            ]
          })
          .sort({ createdAt: -1 })
          .toArray();
        
        // 🔥 이번달 신규 환자 중 치료시작 상태인 환자들
        patients = allPatients.filter((patient: any) => {
          const callInDate = patient.callInDate;
          if (!callInDate) return false;
          
          // 이번달 신규 환자인지 확인
          const isThisMonth = callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
          if (!isThisMonth) return false;
          
          // 치료시작 상태인지 확인
          return patient.postVisitStatus === '치료시작';
        });
        
        console.log(`[API] 결제전환율(treatment_rate) 환자 ${patients.length}명 조회 완료 (callInDate 기준)`);
        break;
      }

      case 'payment_rate': {
        // 결제전환율 - 이번달 신규 환자 중 결제 정보가 있는 환자들
        // postVisitConsultation.estimateInfo.regularPrice 또는 treatmentCost가 있는 환자들
        patients = await db.collection('patients')
          .find({
            createdAt: {
              $gte: thisMonthStart.toISOString(),
              $lte: thisMonthEnd.toISOString()
            },
            $and: [
              {
                $or: [
                  { 'postVisitConsultation.estimateInfo.regularPrice': { $gt: 0 } },
                  { 'postVisitConsultation.estimateInfo.discountPrice': { $gt: 0 } },
                  { treatmentCost: { $gt: 0 } },
                  { paymentAmount: { $gt: 0 } }
                ]
              },
              {
                $or: [
                  { isCompleted: { $ne: true } },
                  { isCompleted: { $exists: false } },
                  { isCompleted: true } // 종결된 환자도 포함
                ]
              }
            ]
          })
          .sort({ createdAt: -1 })
          .toArray();
        
        console.log(`[API] 결제전환율 환자 ${patients.length}명 조회 완료`);
        break;
      }

      // 🔥 새로운 필터 타입들 (대시보드 로직과 동기화)
      case 'overdueCallbacks_consultation': {
        // 미처리 콜백 - 상담환자
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          // 내원확정된 환자는 제외 (상담환자만)
          if (patient.visitConfirmed === true) {
            return false;
          }
          
          // 🔥 예약확정/재예약확정 상태인 환자도 제외
          if (patient.status === '예약확정' || patient.status === '재예약확정') {
            return false;
          }
          
          // 환자상태가 "콜백필요"이고 콜백 예정 날짜가 오늘 이전인 경우
          if (patient.status !== '콜백필요') {
            return false;
          }
          
          if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
            return false;
          }
          
          return patient.callbackHistory.some((callback: any) => {
            if (callback.status !== '예정') return false;
            const callbackDate = new Date(callback.date);
            callbackDate.setHours(0, 0, 0, 0);
            return callbackDate < todayStart;
          });
        });
        
        console.log(`[API] 미처리 콜백 - 상담환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'overdueCallbacks_visit': {
        // 미처리 콜백 - 내원환자 (내원 후 상태가 "재콜백필요"인 경우)
        const allPatients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            postVisitStatus: '재콜백필요',
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
            return false;
          }
          
          return patient.callbackHistory.some((callback: any) => {
            if (callback.status !== '예정') return false;
            const callbackDate = new Date(callback.date);
            callbackDate.setHours(0, 0, 0, 0);
            return callbackDate < todayStart;
          });
        });
        
        console.log(`[API] 미처리 콜백 - 내원환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'todayScheduled_consultation': {
        // 오늘 예정된 콜백 - 상담환자
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          // 내원확정된 환자는 제외 (상담환자만)
          if (patient.visitConfirmed === true) {
            return false;
          }
          
          // 🔥 예약확정 상태인 환자도 제외 (이미 최종 상태)
          if (patient.status === '예약확정') {
            return false;
          }
          
          // 🔥 재예약확정 상태인 환자도 제외 (이미 최종 상태)
          if (patient.status === '재예약확정') {
            return false;
          }
          
          return patient.callbackHistory?.some((callback: any) => 
            callback.status === '예정' && callback.date === todayStr
          ) || patient.nextCallbackDate === todayStr;
        });
        
        console.log(`[API] 오늘 예정된 콜백 - 상담환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'todayScheduled_visit': {
        // 오늘 예정된 콜백 - 내원환자
        patients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            postVisitStatus: '재콜백필요',
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = patients.filter((patient: any) => {
          return patient.callbackHistory?.some((callback: any) => 
            callback.status === '예정' && callback.date === todayStr
          );
        });
        
        console.log(`[API] 오늘 예정된 콜백 - 내원환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'callbackUnregistered_consultation': {
        // 🔥 콜백 미등록 - 상담환자 (수정된 로직)
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          // 🔥 예약 후 미내원 상태 동적 계산
          const calculatedIsPostReservationPatient = calculatePostReservationStatus(patient);
          
          // 내원확정된 환자는 제외
          if (patient.visitConfirmed === true) {
            return false;
          }
          
          // 🔥 예약확정/재예약확정 상태인 환자도 제외 (이미 최종 상태)
          if (patient.status === '예약확정' || patient.status === '재예약확정') {
            return false;
          }
          
          // 🔥 계산된 값 사용: 예약 후 미내원, 부재중, 잠재고객 상태
          const isTargetStatus = patient.status === '부재중' || 
                              patient.status === '잠재고객' || 
                              calculatedIsPostReservationPatient === true;
          
          if (!isTargetStatus) {
            return false;
          }
          
          // 🔥 callbackHistory가 undefined, null, 빈 배열인 경우 모두 처리
          if (!patient.callbackHistory || 
              patient.callbackHistory === null || 
              patient.callbackHistory === undefined ||
              (Array.isArray(patient.callbackHistory) && patient.callbackHistory.length === 0)) {
            return true;
          }
          
          // 예정된 콜백이 없는 경우
          const hasScheduledCallback = patient.callbackHistory.some((callback: any) => 
            callback.status === '예정'
          );
          
          return !hasScheduledCallback;
        });
        
        console.log(`[API] 콜백 미등록 - 상담환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'callbackUnregistered_visit': {
        // 🔥 콜백 미등록 - 내원환자 (핵심 수정 부분!)
        console.log('🔥 [API] 콜백 미등록 - 내원환자 필터링 시작 (수정된 로직)');
        
        const allPatients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        console.log(`🔥 [API] 전체 내원환자 ${allPatients.length}명 조회됨`);
        
        patients = allPatients.filter((patient: any) => {
          // 🔥 대시보드와 동일한 조건: postVisitStatus가 없거나 undefined인 경우
          if (patient.postVisitStatus) {
            return false; // postVisitStatus가 있으면 제외
          }
          
          console.log(`🔥 [API] 상태미설정 환자 발견: ${patient.name} (postVisitStatus: ${patient.postVisitStatus})`);
          
          // 🔥 핵심 수정: 내원관리 콜백만 체크! 상담관리 콜백은 무시
          if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
            console.log(`🔥 [API] ${patient.name}: 콜백 히스토리 없음 → 콜백 미등록으로 분류`);
            return true;
          }
          
          // 🔥 내원관리 콜백만 체크 (isVisitManagementCallback === true)
          const hasVisitManagementCallback = patient.callbackHistory.some((callback: any) => 
            callback.status === '예정' && 
            callback.isVisitManagementCallback === true  // 🔥 핵심!
          );
          
          if (hasVisitManagementCallback) {
            console.log(`🔥 [API] ${patient.name}: 내원관리 콜백 있음 → 제외`);
            return false;
          } else {
            console.log(`🔥 [API] ${patient.name}: 내원관리 콜백 없음 → 콜백 미등록으로 분류`);
            
            // 🔥 디버깅: 어떤 콜백들이 있는지 확인
            const callbackTypes = patient.callbackHistory
              .filter((cb: any) => cb.status === '예정')
              .map((cb: any) => ({
                type: cb.type,
                isVisitManagement: cb.isVisitManagementCallback,
                date: cb.date
              }));
            
            if (callbackTypes.length > 0) {
              console.log(`🔥 [API] ${patient.name}의 예정된 콜백들:`, callbackTypes);
            }
            
            return true;
          }
        });
        
        console.log(`🔥 [API] 콜백 미등록 - 내원환자 ${patients.length}명 조회 완료 (수정된 로직)`);
        break;
      }

      case 'reminderCallbacks_scheduled': {
        // 리마인더 콜백 - 예정 (리마인더 콜백 예정일 3일 전에 다다른 환자)
        patients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            postVisitStatus: '치료동의',
            'postVisitConsultation.treatmentConsentInfo.treatmentStartDate': { 
              $gte: todayStr,
              $lte: threeDaysLaterStr 
            },
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        // 이미 리마인더 콜백이 등록된 환자들은 제외
        patients = patients.filter((patient: any) => {
          if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
            return true;
          }
          
          // 리마인더 관련 콜백이 이미 있는지 확인
          const hasReminderCallback = patient.callbackHistory.some((callback: any) => 
            callback.notes && callback.notes.includes('리마인더')
          );
          
          return !hasReminderCallback;
        });
        
        console.log(`[API] 리마인더 콜백 - 예정 ${patients.length}명 조회 완료`);
        break;
      }

      case 'reminderCallbacks_registrationNeeded': {
        // 🔥 기존 코드 (문제가 있던 부분)
        /*
        patients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            postVisitStatus: '치료동의',
            'postVisitConsultation.treatmentConsentInfo.treatmentStartDate': { 
              $lt: todayStr 
            },
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        */

        // 🔥 새로운 수정된 코드
        // MongoDB 쿼리 대신 JavaScript 필터링으로 변경
        const allPatients = await db.collection('patients')
          .find({
            visitConfirmed: true,
            postVisitStatus: '치료동의',
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        // JavaScript로 직접 필터링
        patients = allPatients.filter((patient: any) => {
          const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
          if (!treatmentStartDate) {
            console.log(`[DEBUG] ${patient.name}: treatmentStartDate 없음`);
            return false;
          }
          
          // 치료 시작 예정일이 오늘보다 이전인지 확인
          const isBeforeToday = treatmentStartDate < todayStr;
          console.log(`[DEBUG] ${patient.name}: treatmentStartDate=${treatmentStartDate}, today=${todayStr}, 조건만족=${isBeforeToday}`);
          
          return isBeforeToday;
        });
        
        console.log(`[API] 리마인더 콜백 - 등록필요 ${patients.length}명 조회 완료`);
        break;
      }

      // 🔥 기존 필터 타입들 (호환성 유지)
      case 'callbackUnregistered': {
        const allPatients = await db.collection('patients')
          .find({
            status: '잠재고객',
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          return !patient.callbackHistory || patient.callbackHistory.length === 0;
        });
        
        console.log(`[API] 콜백 미등록 환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'overdueCallbacks': {
        // 🔥 미처리 콜백 - 대시보드 로직과 완전 동기화
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
            return false;
          }
          
          // 🔥 대시보드와 동일한 로직: 상담환자와 내원환자 구분
          
          // 상담환자 (내원확정되지 않은 환자)
          if (patient.visitConfirmed !== true) {
            // 예약확정/재예약확정 상태인 환자는 제외
            if (patient.status === '예약확정' || patient.status === '재예약확정') {
              return false;
            }
            
            // 환자상태가 "콜백필요"이고 콜백 예정 날짜가 오늘 이전인 경우
            if (patient.status !== '콜백필요') {
              return false;
            }
            
            return patient.callbackHistory.some((callback: any) => {
              if (callback.status !== '예정') return false;
              const callbackDate = new Date(callback.date);
              callbackDate.setHours(0, 0, 0, 0);
              return callbackDate < todayStart;
            });
          }
          
          // 내원환자 (내원확정된 환자)
          if (patient.visitConfirmed === true) {
            // 내원 후 상태가 "재콜백필요"인 경우만
            if (patient.postVisitStatus !== '재콜백필요') {
              return false;
            }
            
            return patient.callbackHistory.some((callback: any) => {
              if (callback.status !== '예정') return false;
              const callbackDate = new Date(callback.date);
              callbackDate.setHours(0, 0, 0, 0);
              return callbackDate < todayStart;
            });
          }
          
          return false;
        });
        
        console.log(`[API] 미처리 콜백 환자 ${patients.length}명 조회 완료 (수정된 로직)`);
        break;
      }
      
      case 'callbackNeeded':
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          return patient.status === '콜백필요' || 
                patient.postVisitStatus === '재콜백필요';
        });
        
        patients.sort((a: any, b: any) => {
          const dateA = new Date(a.updatedAt || a.createdAt);
          const dateB = new Date(b.updatedAt || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        console.log(`[API] 콜백 필요 환자 ${patients.length}명 조회 완료 (상담관리 + 내원관리)`);
        break;
        
      case 'absent':
        patients = await db.collection('patients')
          .find({
            status: '부재중',
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .sort({ updatedAt: -1 })
          .toArray();
        break;
        
      case 'todayScheduled': {
        // 🔥 오늘 예정된 콜백 - 대시보드 로직과 완전 동기화
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          // 상담관리 콜백
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
            ) || patient.nextCallbackDate === todayStr;
          })();

          // 내원관리 콜백
          const hasPostVisitCallback = (() => {
            if (patient.visitConfirmed !== true) {
              return false;
            }
            
            if (patient.postVisitStatus !== '재콜백필요') {
              return false;
            }
            
            if (patient.callbackHistory && patient.callbackHistory.length > 0) {
              return patient.callbackHistory.some((callback: any) => {
                return callback.status === '예정' && callback.date === todayStr;
              });
            }
            
            return false;
          })();

          return hasManagementCallback || hasPostVisitCallback;
        });
        
        console.log(`[API] 오늘 예정된 콜백 환자 ${patients.length}명 조회 완료 (수정된 로직)`);
        break;
      }
        
      default: {
        // 🔥 유효한 필터 타입들 목록
        const validFilters = [
          'potential_customer',
          'new_inquiry',
          'reservation_rate',
          'visit_rate',
          'treatment_rate',
          'payment_rate',
          'overdueCallbacks_consultation',
          'overdueCallbacks_visit',
          'todayScheduled_consultation',
          'todayScheduled_visit',
          'callbackUnregistered_consultation',
          'callbackUnregistered_visit',
          'reminderCallbacks_scheduled',
          'reminderCallbacks_registrationNeeded',
          'callbackUnregistered',
          'overdueCallbacks',
          'callbackNeeded',
          'absent',
          'todayScheduled',
          // 🔥 새로운 내원관리 필터들
          'unprocessed_callback',
          'treatment_consent_not_started',
          'needs_callback_visit',
          'no_status_visit'
        ];
        
        if (!validFilters.includes(filterType)) {
          return NextResponse.json(
            { error: `유효하지 않은 필터 타입입니다: ${filterType}` },
            { status: 400 }
          );
        }
        
        // 이 시점에서는 도달하지 않아야 함
        return NextResponse.json(
          { error: '필터 처리 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    }

    // MongoDB ObjectId를 문자열로 변환
    const processedPatients = patients.map((patient: { _id: { toString: () => any; }; }) => ({
      ...patient,
      _id: patient._id.toString(),
      id: patient._id.toString()
    }));

    console.log(`[API] ${filterType} 필터로 ${processedPatients.length}명의 환자를 조회했습니다.`);

    return NextResponse.json(processedPatients);

  } catch (error) {
    console.error('[API] 환자 상태별 필터링 오류:', error);
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}