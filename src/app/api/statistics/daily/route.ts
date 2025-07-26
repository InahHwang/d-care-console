// src/app/api/statistics/daily/route.ts - 🔥 콜백 처리 추적 로직 수정

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

// JWT 검증 함수
function verifyToken(token: string) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }
    return jwt.verify(token, process.env.JWT_SECRET) as any;
  } catch (error) {
    console.warn('JWT 검증 실패, decode로 폴백:', error);
    return jwt.decode(token) as any;
  }
}

// 🔥 어제 자정 시점에 환자가 처리되지 않은 상태였는지 확인하는 헬퍼 함수
const isPatientProcessedBeforeDate = (patient: any, targetDate: string): boolean => {
  if (!patient.lastModifiedAt) {
    return false;
  }
  
  const modifiedDate = new Date(patient.lastModifiedAt).toISOString().split('T')[0];
  return modifiedDate === targetDate;
};

// 🔥 어제 자정 기준으로 콜백 미등록 상태였는지 확인하는 함수
const wasCallbackUnregisteredYesterday = (patient: any, targetDate: string): boolean => {
  // 예약 후 미내원 상태 계산 (targetDate 기준)
  const calculatePostReservationStatus = (p: any): boolean => {
    if (p.status === '예약확정' && 
        !p.visitConfirmed && 
        p.reservationDate) {
      return p.reservationDate < targetDate;
    }
    return false;
  };

  // 상담환자 콜백 미등록 체크
  if (patient.visitConfirmed !== true) {
    // 🔥 오늘 예약확정으로 변경되었다면, 어제는 미등록 상태였을 수 있음
    const wasProcessedToday = isPatientProcessedBeforeDate(patient, targetDate);
    if (wasProcessedToday && ['예약확정', '재예약확정'].includes(patient.status)) {
      // 어제 자정 시점에는 다른 상태였다고 가정
      const yesterdayStatus = getYesterdayStatus(patient);
      const isPostReservationPatient = calculatePostReservationStatus(patient);
      
      const wasTargetStatus = yesterdayStatus === '부재중' || 
                            yesterdayStatus === '잠재고객' || 
                            isPostReservationPatient === true;
      
      if (wasTargetStatus) {
        // 어제 자정에 콜백이 있었는지 확인
        const hadScheduledCallback = patient.callbackHistory?.some((callback: any) => {
          // 어제 자정 이전에 생성된 예정 콜백이 있었는지
          if (callback.status === '예정' && callback.createdAt) {
            const callbackCreatedDate = new Date(callback.createdAt).toISOString().split('T')[0];
            return callbackCreatedDate < targetDate;
          }
          return false;
        });
        
        return !hadScheduledCallback;
      }
    }
    
    // 현재도 미등록 상태인 경우
    const isPostReservationPatient = calculatePostReservationStatus(patient);
    const isTargetStatus = patient.status === '부재중' || 
                          patient.status === '잠재고객' || 
                          isPostReservationPatient === true;
    
    if (!isTargetStatus) {
      return false;
    }
    
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
      return true;
    }
    
    const hasScheduledCallback = patient.callbackHistory.some((callback: any) => 
      callback.status === '예정'
    );
    
    return !hasScheduledCallback;
  }
  
  // 내원환자 콜백 미등록 체크
  if (patient.visitConfirmed === true) {
    // 🔥 오늘 postVisitStatus가 설정되었다면, 어제는 미설정 상태였을 수 있음
    const wasProcessedToday = isPatientProcessedBeforeDate(patient, targetDate);
    if (wasProcessedToday && patient.postVisitStatus) {
      // 어제 자정에는 postVisitStatus가 없었다고 가정하고 콜백 체크
      const hadVisitManagementCallback = patient.callbackHistory?.some((callback: any) => 
        callback.status === '예정' && 
        callback.isVisitManagementCallback === true &&
        callback.createdAt && 
        new Date(callback.createdAt).toISOString().split('T')[0] < targetDate
      );
      
      return !hadVisitManagementCallback;
    }
    
    // 현재도 미설정 상태인 경우
    if (!patient.postVisitStatus) {
      if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
        return true;
      }
      
      const hasVisitManagementCallback = patient.callbackHistory.some((callback: any) => 
        callback.status === '예정' && 
        callback.isVisitManagementCallback === true
      );
      
      return !hasVisitManagementCallback;
    }
  }
  
  return false;
};

// 🔥 어제 자정 시점의 환자 상태를 추정하는 함수 (간단한 버전)
const getYesterdayStatus = (patient: any): string => {
  // 실제로는 활동 로그를 확인해야 하지만, 간단히 처리
  // 오늘 변경되었다면 이전 상태를 추정
  if (patient.status === '예약확정') {
    return '콜백필요'; // 일반적으로 콜백필요 → 예약확정으로 진행
  }
  if (patient.status === '재예약확정') {
    return '부재중'; // 일반적으로 부재중 → 재예약확정으로 진행
  }
  return patient.status; // 기본적으로는 현재 상태와 동일하다고 가정
};
const isOverdueCallbackProcessedToday = (patient: any, selectedDate: string): boolean => {
  // 1. 오늘 콜백 완료 처리된 경우
  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
    const todayCompletedCallbacks = patient.callbackHistory.filter((callback: any) => {
      if (callback.actualCompletedDate === selectedDate && callback.status === '완료') {
        return true;
      }
      if (callback.completedAt) {
        const completedDate = new Date(callback.completedAt).toISOString().split('T')[0];
        return completedDate === selectedDate && callback.status === '완료';
      }
      return false;
    });
    
    if (todayCompletedCallbacks.length > 0) {
      return true;
    }
  }

  // 2. 상담환자: 예약확정/재예약확정으로 상태 변경된 경우
  if (patient.visitConfirmed !== true) {
    if (['예약확정', '재예약확정'].includes(patient.status)) {
      if (patient.lastModifiedAt) {
        const modifiedDate = new Date(patient.lastModifiedAt).toISOString().split('T')[0];
        return modifiedDate === selectedDate;
      }
    }
  }

  // 3. 내원환자: 치료시작으로 상태 변경된 경우
  if (patient.visitConfirmed === true) {
    if (patient.postVisitStatus === '치료시작') {
      if (patient.lastModifiedAt) {
        const modifiedDate = new Date(patient.lastModifiedAt).toISOString().split('T')[0];
        return modifiedDate === selectedDate;
      }
    }
  }

  return false;
};

const isTodayScheduledProcessedToday = (patient: any, selectedDate: string): boolean => {
  // 1. 오늘 콜백 완료 처리된 경우
  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
    const todayCompletedCallbacks = patient.callbackHistory.filter((callback: any) => {
      // 오늘 날짜에 예정되었던 콜백이 완료된 경우
      if (callback.date === selectedDate && callback.status === '완료') {
        if (callback.actualCompletedDate === selectedDate || 
            (callback.completedAt && new Date(callback.completedAt).toISOString().split('T')[0] === selectedDate)) {
          return true;
        }
      }
      return false;
    });
    
    if (todayCompletedCallbacks.length > 0) {
      return true;
    }
  }

  // 2. 상담환자: 예약확정으로 진행된 경우
  if (patient.visitConfirmed !== true) {
    if (['예약확정', '재예약확정'].includes(patient.status)) {
      if (patient.lastModifiedAt) {
        const modifiedDate = new Date(patient.lastModifiedAt).toISOString().split('T')[0];
        return modifiedDate === selectedDate;
      }
    }
  }

  // 3. 내원환자: 재콜백필요가 아닌 다른 상태로 변경된 경우
  if (patient.visitConfirmed === true) {
    if (patient.postVisitStatus && patient.postVisitStatus !== '재콜백필요') {
      if (patient.lastModifiedAt) {
        const modifiedDate = new Date(patient.lastModifiedAt).toISOString().split('T')[0];
        return modifiedDate === selectedDate;
      }
    }
  }

  return false;
};

const isCallbackUnregisteredProcessedToday = (patient: any, selectedDate: string): boolean => {
  // 1. 새로운 콜백 등록된 경우
  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
    const todayRegisteredCallbacks = patient.callbackHistory.filter((callback: any) => {
      if (callback.status === '예정') {
        // 오늘 생성된 콜백인지 확인
        if (callback.createdAt) {
          const createdDate = new Date(callback.createdAt).toISOString().split('T')[0];
          return createdDate === selectedDate;
        }
      }
      return false;
    });
    
    if (todayRegisteredCallbacks.length > 0) {
      return true;
    }
  }

  // 2. 상담환자: 예약확정으로 진행된 경우
  if (patient.visitConfirmed !== true) {
    if (['예약확정', '재예약확정', '종결'].includes(patient.status)) {
      if (patient.lastModifiedAt) {
        const modifiedDate = new Date(patient.lastModifiedAt).toISOString().split('T')[0];
        return modifiedDate === selectedDate;
      }
    }
  }

  // 3. 내원환자: postVisitStatus가 설정된 경우
  if (patient.visitConfirmed === true) {
    if (patient.postVisitStatus) {
      if (patient.lastModifiedAt) {
        const modifiedDate = new Date(patient.lastModifiedAt).toISOString().split('T')[0];
        return modifiedDate === selectedDate;
      }
    }
  }

  return false;
};

const isReminderCallbackProcessedToday = (patient: any, selectedDate: string): boolean => {
  // 1. 치료시작으로 상태 변경된 경우
  if (patient.postVisitStatus === '치료시작') {
    if (patient.lastModifiedAt) {
      const modifiedDate = new Date(patient.lastModifiedAt).toISOString().split('T')[0];
      return modifiedDate === selectedDate;
    }
  }

  // 2. 새로운 리마인더 콜백 등록된 경우
  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
    const todayReminderCallbacks = patient.callbackHistory.filter((callback: any) => {
      if (callback.status === '예정' && callback.notes && callback.notes.includes('리마인더')) {
        if (callback.createdAt) {
          const createdDate = new Date(callback.createdAt).toISOString().split('T')[0];
          return createdDate === selectedDate;
        }
      }
      return false;
    });
    
    if (todayReminderCallbacks.length > 0) {
      return true;
    }
  }

  // 3. 종결 처리된 경우
  if (patient.status === '종결') {
    if (patient.lastModifiedAt) {
      const modifiedDate = new Date(patient.lastModifiedAt).toISOString().split('T')[0];
      return modifiedDate === selectedDate;
    }
  }

  return false;
};

// 🔥 원래 예정되었던 콜백인지 확인하는 함수
const wasScheduledForDate = (patient: any, targetDate: string): boolean => {
  if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
    return false;
  }

  // 해당 날짜에 예정되었던 콜백이 있는지 확인
  const scheduledCallbacks = patient.callbackHistory.filter((callback: any) => {
    return callback.date === targetDate && 
           (callback.status === '예정' || callback.status === '완료' || callback.status === '예약확정');
  });

  return scheduledCallbacks.length > 0;
};



export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value ||
                  request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];

    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // URL에서 날짜 파라미터 추출
    const { searchParams } = new URL(request.url);
    const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    console.log(`📊 일별 업무 현황 조회 (콜백 처리 추적): ${selectedDate}`);

    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');

    // 모든 환자 데이터를 한 번만 가져오기
    const allPatients = await patientsCollection.find({
      $or: [
        { isCompleted: { $ne: true } },
        { isCompleted: { $exists: false } }
      ]
    }).toArray();

    console.log(`📊 전체 활성 환자 수: ${allPatients.length}명`);

    // 🔥 1. 미처리 콜백 - 어제 자정 기준으로 미처리였던 환자들
    const initialOverdueCallbacks = allPatients.filter((patient: any) => {
      if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
        return false;
      }
      
      // 🔥 어제 자정 시점의 상태로 판단
      const wasProcessedYesterday = isPatientProcessedBeforeDate(patient, selectedDate);
      
      // 상담환자 (내원확정되지 않은 환자)
      if (patient.visitConfirmed !== true) {
        // 🔥 어제 자정 시점에 예약확정이었다면 제외
        if (wasProcessedYesterday && ['예약확정', '재예약확정'].includes(patient.status)) {
          return false;
        }
        
        // 환자상태가 "콜백필요"이고 콜백 예정 날짜가 선택된 날짜 이전인 경우
        const hasOverdueCallback = patient.callbackHistory.some((callback: any) => {
          if (callback.status !== '예정') return false;
          return callback.date < selectedDate;
        });
        
        if (!hasOverdueCallback) {
          return false;
        }
        
        // 🔥 현재 상태가 콜백필요이거나, 오늘 다른 상태로 변경되었지만 어제까지는 콜백필요였던 경우
        return patient.status === '콜백필요' || 
               (wasProcessedYesterday && ['예약확정', '재예약확정'].includes(patient.status));
      }
      
      // 내원환자 (내원확정된 환자)
      if (patient.visitConfirmed === true) {
        const hasOverdueCallback = patient.callbackHistory.some((callback: any) => {
          if (callback.status !== '예정') return false;
          return callback.date < selectedDate;
        });
        
        if (!hasOverdueCallback) {
          return false;
        }
        
        // 🔥 현재 치료시작이거나, 오늘 치료시작으로 변경되었지만 어제까지는 치료시작이 아니었던 경우
        return patient.postVisitStatus !== '치료시작' || 
               (wasProcessedYesterday && patient.postVisitStatus === '치료시작');
      }
      
      return false;
    });

    // 🔥 2. 오늘 예정된 콜백 - 어제 자정에도 예정되어 있었던 콜백들
    const initialTodayScheduled = allPatients.filter((patient: any) => {
      // 🔥 해당 날짜에 원래 예정되었던 콜백이 있고, 어제 자정에도 해당 조건을 만족했던 환자들
      const hasScheduledCallbackForDate = wasScheduledForDate(patient, selectedDate);
      if (!hasScheduledCallbackForDate) {
        return false;
      }
      
      // 🔥 어제 자정 시점에도 이 조건을 만족했는지 확인
      const wasProcessedToday = isPatientProcessedBeforeDate(patient, selectedDate);
      
      // 상담환자
      if (patient.visitConfirmed !== true) {
        // 현재 예약확정 상태이지만 오늘 변경되었다면, 어제는 예정된 콜백이 있었음
        if (['예약확정', '재예약확정'].includes(patient.status)) {
          return wasProcessedToday; // 오늘 처리되었다면 어제는 예정되어 있었음
        }
        return true; // 현재도 미완료 상태라면 어제도 예정되어 있었음
      }
      
      // 내원환자  
      if (patient.visitConfirmed === true) {
        // 현재 재콜백필요가 아니지만 오늘 변경되었다면, 어제는 재콜백필요였을 수 있음
        if (patient.postVisitStatus !== '재콜백필요') {
          return wasProcessedToday; // 오늘 처리되었다면 어제는 예정되어 있었음
        }
        return true; // 현재도 재콜백필요 상태라면 어제도 예정되어 있었음
      }
      
      return false;
    });

    // 🔥 3. 콜백 미등록 - 어제 자정 기준으로 미등록이었던 환자들
    const initialCallbackUnregistered = allPatients.filter((patient: any) => {
      return wasCallbackUnregisteredYesterday(patient, selectedDate);
    });

    // 🔥 4. 리마인더 콜백 - 등록필요
    const initialReminderCallbacks = allPatients.filter((patient: any) => {
      if (patient.visitConfirmed !== true) {
        return false;
      }
      
      if (patient.postVisitStatus !== '치료동의') {
        return false;
      }
      
      const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
      if (!treatmentStartDate) {
        return false;
      }
      
      // 치료 시작 예정일이 오늘보다 이전인지 확인
      return treatmentStartDate < selectedDate;
    });

    // 🔥 각 카테고리별 처리율 계산 - 카테고리별 맞춤 로직 적용
    const overdueCallbacksStats = {
      total: initialOverdueCallbacks.length,
      processed: initialOverdueCallbacks.filter(patient => 
        isOverdueCallbackProcessedToday(patient, selectedDate)
      ).length,
      processingRate: 0
    };
    overdueCallbacksStats.processingRate = overdueCallbacksStats.total > 0 ? 
      Math.round((overdueCallbacksStats.processed / overdueCallbacksStats.total) * 100) : 0;

    const todayScheduledStats = {
      total: initialTodayScheduled.length,
      processed: initialTodayScheduled.filter(patient => 
        isTodayScheduledProcessedToday(patient, selectedDate)
      ).length,
      processingRate: 0
    };
    todayScheduledStats.processingRate = todayScheduledStats.total > 0 ? 
      Math.round((todayScheduledStats.processed / todayScheduledStats.total) * 100) : 0;

    const callbackUnregisteredStats = {
      total: initialCallbackUnregistered.length,
      processed: initialCallbackUnregistered.filter(patient => 
        isCallbackUnregisteredProcessedToday(patient, selectedDate)
      ).length,
      processingRate: 0
    };
    callbackUnregisteredStats.processingRate = callbackUnregisteredStats.total > 0 ? 
      Math.round((callbackUnregisteredStats.processed / callbackUnregisteredStats.total) * 100) : 0;

    const reminderCallbacksStats = {
      total: initialReminderCallbacks.length,
      processed: initialReminderCallbacks.filter(patient => 
        isReminderCallbackProcessedToday(patient, selectedDate)
      ).length,
      processingRate: 0
    };
    reminderCallbacksStats.processingRate = reminderCallbacksStats.total > 0 ? 
      Math.round((reminderCallbacksStats.processed / reminderCallbacksStats.total) * 100) : 0;

    // 🔥 기존 환자별 상담 내용 요약 로직 유지
    const dailyPatients = await patientsCollection.find({
      $or: [
        { callInDate: selectedDate }, // 신규 등록된 환자
        { visitDate: selectedDate }   // 내원한 환자
      ]
    }).toArray();

    // 환자별 상담 내용 요약 생성 (기존 로직 유지)
    const patientConsultations = dailyPatients
      .filter(patient => {
        const hasConsultation = patient.consultation && 
          (patient.consultation.treatmentPlan || patient.consultation.consultationNotes);
        
        const hasPostVisitConsultation = patient.postVisitConsultation && 
          patient.postVisitConsultation.firstVisitConsultationContent;

        const hasCallbackConsultation = patient.callbackHistory && 
          patient.callbackHistory.some((callback: any) => 
            (callback.resultNotes && callback.resultNotes.trim() !== '' && callback.resultNotes !== 'undefined') ||
            (callback.notes && callback.notes.trim() !== '' && callback.notes !== 'undefined')
          );

        return hasConsultation || hasPostVisitConsultation || hasCallbackConsultation;
      })
      .map(patient => {
        // 상담 내용 조합 로직 (기존 로직과 동일)
        const consultationContents: string[] = [];

        // 전화상담 내용
        const phoneContents: string[] = [];
        if (patient.consultation?.consultationNotes) {
          phoneContents.push(`[상담메모] ${patient.consultation.consultationNotes}`);
        }

        if (patient.callbackHistory && patient.callbackHistory.length > 0) {
          const phoneCallbacks = patient.callbackHistory
            .filter((callback: any) => 
              !callback.isVisitManagementCallback && 
              callback.notes && 
              callback.notes.trim() !== '' &&
              callback.notes !== 'undefined' &&
              callback.status === '완료'
            )
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          phoneCallbacks.forEach((callback: any, index: number) => {
            const callbackNum = index + 1;
            const callbackDate = new Date(callback.date).toLocaleDateString('ko-KR', {
              year: '2-digit',
              month: '2-digit', 
              day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, '');
            
            phoneContents.push(`[상담관리 ${callbackNum}차 - ${callbackDate}] ${callback.notes}`);
          });
        }

        if (phoneContents.length > 0) {
          consultationContents.push(`📞 전화상담:\n${phoneContents.join('\n')}`);
        }

        // 내원상담 내용
        const visitContents: string[] = [];
        if (patient.postVisitConsultation?.firstVisitConsultationContent) {
          visitContents.push(`[첫 상담] ${patient.postVisitConsultation.firstVisitConsultationContent}`);
        }

        if (patient.callbackHistory && patient.callbackHistory.length > 0) {
          const visitCallbacks = patient.callbackHistory
            .filter((callback: any) => 
              callback.isVisitManagementCallback && 
              callback.notes && 
              callback.notes.trim() !== '' &&
              callback.notes !== 'undefined' &&
              callback.status === '완료'
            )
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          visitCallbacks.forEach((callback: any, index: number) => {
            const callbackNum = index + 1;
            const callbackDate = new Date(callback.date).toLocaleDateString('ko-KR', {
              year: '2-digit',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, '');
            
            visitContents.push(`[내원관리 ${callbackNum}차 - ${callbackDate}] ${callback.notes}`);
          });
        }

        if (visitContents.length > 0) {
          consultationContents.push(`🏥 내원상담:\n${visitContents.join('\n')}`);
        }

        // 견적금액 계산 (기존 로직)
        let estimatedAmount = 0;
        let phoneAmount = 0;
        let visitAmount = 0;
        let hasPhoneConsultation = false;
        let hasVisitConsultation = false;

        if (patient.consultation?.estimatedAmount && patient.consultation.estimatedAmount > 0) {
          phoneAmount = patient.consultation.estimatedAmount;
          hasPhoneConsultation = true;
        }

        if (patient.postVisitConsultation?.estimateInfo) {
          const estimate = patient.postVisitConsultation.estimateInfo;
          visitAmount = estimate.discountPrice || estimate.regularPrice || 0;
          if (visitAmount > 0) {
            hasVisitConsultation = true;
          }
        }

        estimatedAmount = visitAmount > 0 ? visitAmount : phoneAmount;

        const visitConfirmed = patient.visitConfirmed === true;
        const isCompleted = patient.isCompleted === true || patient.status === '종결';

        const fullConsultation = consultationContents.length > 0 ? consultationContents.join('\n\n') : '상담내용 없음';
        const consultationSummary = fullConsultation.length > 200 ? 
          fullConsultation.substring(0, 200) + '...' : fullConsultation;

        const discomfort = patient.consultation?.treatmentPlan ? 
          patient.consultation.treatmentPlan.substring(0, 50) + 
          (patient.consultation.treatmentPlan.length > 50 ? '...' : '') : '';
        
        const fullDiscomfort = patient.consultation?.treatmentPlan || '';

        return {
          _id: patient._id.toString(),
          name: patient.name,
          age: patient.age,
          interestedServices: patient.interestedServices || [],
          discomfort,
          fullDiscomfort,
          consultationSummary,
          fullConsultation,
          estimatedAmount,
          estimateAgreed: patient.consultation?.estimateAgreed || false,
          callInDate: patient.callInDate,
          visitDate: patient.visitDate,
          hasPhoneConsultation,
          hasVisitConsultation,
          phoneAmount,
          visitAmount,
          status: patient.status,
          visitConfirmed,
          postVisitStatus: patient.postVisitStatus,
          isCompleted,
          consultationType: patient.consultationType || 'outbound' 
        };
      })
      .sort((a, b) => {
        return b.estimatedAmount - a.estimatedAmount;
      });

    // 견적금액 계산 (기존 로직 유지)
    const visitConsultationEstimate = dailyPatients
      .filter(p => {
        const isVisitCompleted = p.visitConfirmed === true;
        const hasVisitEstimate = p.postVisitConsultation?.estimateInfo;
        return isVisitCompleted && hasVisitEstimate;
      })
      .reduce((sum, p) => {
        const estimate = p.postVisitConsultation.estimateInfo;
        const amount = estimate.discountPrice || estimate.regularPrice || 0;
        return sum + amount;
      }, 0);

    const phoneConsultationEstimate = dailyPatients
      .filter(p => {
        const isNotVisitCompleted = p.visitConfirmed !== true;
        const hasPhoneEstimate = p.consultation?.estimatedAmount && p.consultation.estimatedAmount > 0;
        const isCallInToday = p.callInDate === selectedDate;
        return isNotVisitCompleted && hasPhoneEstimate && isCallInToday;
      })
      .reduce((sum, p) => {
        const amount = p.consultation.estimatedAmount || 0;
        return sum + amount;
      }, 0);

    // 치료 시작 견적 계산 (기존 로직 유지)
    const treatmentStartedEstimate = await patientsCollection.find({
      postVisitStatus: "치료시작",
      $or: [
        { treatmentStartDate: selectedDate },
        { 
          callbackHistory: {
            $elemMatch: {
              actualCompletedDate: selectedDate,
              status: "완료",
              type: { $regex: "치료시작" }
            }
          }
        },
        {
          lastModifiedAt: {
            $gte: new Date(selectedDate + 'T00:00:00.000Z'),
            $lt: new Date(selectedDate + 'T23:59:59.999Z')
          },
          postVisitStatus: "치료시작"
        }
      ]
    }).toArray();

    const treatmentStartedTotal = treatmentStartedEstimate.reduce((sum, p) => {
      if (p.postVisitConsultation?.estimateInfo) {
        const estimate = p.postVisitConsultation.estimateInfo;
        const amount = estimate.discountPrice || estimate.regularPrice || 0;
        return sum + amount;
      }
      return sum;
    }, 0);

    // 🔥 수정된 응답 데이터 구성
    const responseData = {
      selectedDate,
      callbackSummary: {
        overdueCallbacks: overdueCallbacksStats,
        todayScheduled: todayScheduledStats,
        callbackUnregistered: callbackUnregisteredStats,
        reminderCallbacks: reminderCallbacksStats
      },
      estimateSummary: {
        totalConsultationEstimate: visitConsultationEstimate + phoneConsultationEstimate,
        visitConsultationEstimate,
        phoneConsultationEstimate,
        treatmentStartedEstimate: treatmentStartedTotal
      },
      patientConsultations
    };

    console.log(`✅ 일별 업무 현황 조회 완료 (콜백 처리 추적): ${selectedDate}`);
    console.log(`📊 콜백 처리 요약:`, {
      미처리콜백: `${overdueCallbacksStats.processed}/${overdueCallbacksStats.total}건 (${overdueCallbacksStats.processingRate}%)`,
      오늘예정: `${todayScheduledStats.processed}/${todayScheduledStats.total}건 (${todayScheduledStats.processingRate}%)`,
      콜백미등록: `${callbackUnregisteredStats.processed}/${callbackUnregisteredStats.total}건 (${callbackUnregisteredStats.processingRate}%)`,
      리마인더: `${reminderCallbacksStats.processed}/${reminderCallbacksStats.total}건 (${reminderCallbacksStats.processingRate}%)`
    });

    return NextResponse.json({ 
      success: true, 
      data: responseData
    });

  } catch (error) {
    console.error('❌ 일별 업무 현황 조회 오류:', error);
    return NextResponse.json(
      { 
        message: '일별 업무 현황 조회 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}