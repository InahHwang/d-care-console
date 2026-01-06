// src/app/api/statistics/daily-report/route.ts
// 일별 마감 보고서용 API - 동의/미동의/보류 기반 상담 결과 리포트

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

// 요일 계산
function getDayOfWeek(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

// 환자 상태 매핑 (동의/미동의/보류)
function mapPatientStatus(patient: any): 'agreed' | 'disagreed' | 'pending' {
  // 치료시작 또는 치료동의 → 동의
  if (patient.postVisitStatus === '치료시작' || patient.postVisitStatus === '치료동의') {
    return 'agreed';
  }

  // 예약확정 → 동의
  if (patient.status === '예약확정' || patient.status === '재예약확정') {
    return 'agreed';
  }

  // 종결 상태에서 estimateAgreed가 false이면 미동의
  if (patient.status === '종결' || patient.isCompleted) {
    if (patient.consultation?.estimateAgreed === false) {
      return 'disagreed';
    }
    // 종결했는데 치료시작이 아니면 미동의로 처리
    if (patient.postVisitStatus !== '치료시작') {
      return 'disagreed';
    }
    return 'agreed';
  }

  // 콜백필요, 잠재고객, 부재중 → 보류
  if (['콜백필요', '잠재고객', '부재중'].includes(patient.status)) {
    return 'pending';
  }

  // 내원완료 후 재콜백필요 → 보류
  if (patient.visitConfirmed && patient.postVisitStatus === '재콜백필요') {
    return 'pending';
  }

  // 내원완료 후 상태 미정 → 보류
  if (patient.visitConfirmed && !patient.postVisitStatus) {
    return 'pending';
  }

  // 기본값: 보류
  return 'pending';
}

// 미동의/보류 사유 추출
function extractDisagreeReasons(patient: any): string[] {
  const reasons: string[] = [];

  // 상담 메모에서 사유 추출 시도
  const notes = patient.consultation?.consultationNotes || '';
  const postVisitNotes = patient.postVisitConsultation?.firstVisitConsultationContent || '';
  const allNotes = `${notes} ${postVisitNotes}`.toLowerCase();

  // 가격/비용 관련
  if (allNotes.includes('예산') || allNotes.includes('비용') || allNotes.includes('비싸')) {
    reasons.push('예산 초과');
  }
  if (allNotes.includes('할부') || allNotes.includes('분납')) {
    reasons.push('분납/할부 조건 안 맞음');
  }
  if (allNotes.includes('여유') || allNotes.includes('나중에')) {
    reasons.push('당장 여유가 안 됨');
  }

  // 치료 계획 관련
  if (allNotes.includes('계획') && (allNotes.includes('다르') || allNotes.includes('이견'))) {
    reasons.push('치료 계획 이견');
  }
  if (allNotes.includes('거부') || allNotes.includes('안 하겠')) {
    reasons.push('제안 치료 거부');
  }
  if (allNotes.includes('기간') && (allNotes.includes('길') || allNotes.includes('오래'))) {
    reasons.push('치료 기간 부담');
  }

  // 결정 보류 관련
  if (allNotes.includes('가족') || allNotes.includes('상의')) {
    reasons.push('가족 상의 필요');
  }
  if (allNotes.includes('비교') || allNotes.includes('다른 병원') || allNotes.includes('타병원')) {
    reasons.push('타 병원 비교 중');
  }
  if (allNotes.includes('생각') || allNotes.includes('고민')) {
    reasons.push('추가 상담/정보 필요');
  }

  // 기타
  if (allNotes.includes('일정') || allNotes.includes('시간')) {
    reasons.push('일정 조율 어려움');
  }
  if (allNotes.includes('무서') || allNotes.includes('두려') || allNotes.includes('불안')) {
    reasons.push('치료 두려움/불안');
  }

  // 콜백 히스토리에서 사유 추출
  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
    patient.callbackHistory.forEach((callback: any) => {
      const callbackNotes = (callback.resultNotes || callback.notes || '').toLowerCase();

      if (callbackNotes.includes('예산') || callbackNotes.includes('비용')) {
        if (!reasons.includes('예산 초과')) reasons.push('예산 초과');
      }
      if (callbackNotes.includes('가족') || callbackNotes.includes('상의')) {
        if (!reasons.includes('가족 상의 필요')) reasons.push('가족 상의 필요');
      }
      if (callbackNotes.includes('부재') || callbackNotes.includes('안 받')) {
        if (!reasons.includes('부재중')) reasons.push('부재중');
      }
    });
  }

  return reasons;
}

// 시정 계획 추출
function extractCorrectionPlan(patient: any): string {
  // 콜백 히스토리에서 가장 최근 계획 추출
  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
    const sortedCallbacks = [...patient.callbackHistory]
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const callback of sortedCallbacks) {
      if (callback.notes && callback.notes.trim() !== '' && callback.notes !== 'undefined') {
        // 계획성 키워드가 있는지 확인
        const notes = callback.notes;
        if (notes.includes('예정') || notes.includes('안내') || notes.includes('콜백') || notes.includes('다시')) {
          return notes;
        }
      }
    }
  }

  // nextCallbackDate가 있으면 시정 계획으로 변환
  if (patient.nextCallbackDate) {
    return `${patient.nextCallbackDate} 콜백 예정`;
  }

  return '';
}

// 상담 시간 추출
function extractConsultationTime(patient: any): string {
  // createdAt 또는 updatedAt에서 시간 추출
  if (patient.createdAt) {
    const date = new Date(patient.createdAt);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  return '';
}

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

    console.log(`📊 일별 마감 보고서 조회: ${selectedDate}`);

    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');
    const settingsCollection = db.collection('settings');
    const usersCollection = db.collection('users');

    // 병원 이름 조회
    const settings = await settingsCollection.findOne({ type: 'clinic' });
    const clinicName = settings?.clinicName || '치과';

    // 사용자 목록 조회 (ID -> 이름 매핑)
    const users = await usersCollection.find({}, { projection: { _id: 1, name: 1, username: 1 } }).toArray();
    const userMap = new Map<string, string>();
    users.forEach(user => {
      userMap.set(user._id.toString(), user.name || user.username || '');
    });

    // 해당 날짜에 상담한 환자 조회
    const dailyPatients = await patientsCollection.find({
      $or: [
        { callInDate: selectedDate },     // 신규 등록된 환자
        { visitDate: selectedDate },       // 내원한 환자
        {
          callbackHistory: {
            $elemMatch: {
              date: selectedDate
            }
          }
        }
      ]
    }).toArray();

    console.log(`📊 ${selectedDate} 상담 환자 수: ${dailyPatients.length}명`);

    // 환자 데이터 변환
    const patients = dailyPatients.map(patient => {
      const status = mapPatientStatus(patient);
      const disagreeReasons = status !== 'agreed' ? extractDisagreeReasons(patient) : [];
      const correctionPlan = status !== 'agreed' ? extractCorrectionPlan(patient) : '';

      // 견적 금액 계산
      let originalAmount = 0;
      let discountRate = 0;
      let discountAmount = 0;
      let finalAmount = 0;
      let discountReason = '';

      // 내원 상담 견적 우선
      if (patient.postVisitConsultation?.estimateInfo) {
        const estimate = patient.postVisitConsultation.estimateInfo;
        originalAmount = Math.round((estimate.regularPrice || 0) / 10000); // 만원 단위
        finalAmount = Math.round((estimate.discountPrice || estimate.regularPrice || 0) / 10000);
        discountAmount = originalAmount - finalAmount;
        discountRate = originalAmount > 0 ? Math.round((discountAmount / originalAmount) * 100) : 0;
        discountReason = estimate.discountReason || '';
      }
      // 전화 상담 견적
      else if (patient.consultation?.estimatedAmount) {
        originalAmount = Math.round(patient.consultation.estimatedAmount / 10000);
        finalAmount = originalAmount;
      }

      // 상담 내용 조합
      let inquiry = '';
      if (patient.consultation?.treatmentPlan) {
        inquiry = patient.consultation.treatmentPlan;
      }

      let consultantMemo = '';
      if (patient.consultation?.consultationNotes) {
        consultantMemo = patient.consultation.consultationNotes;
      }
      if (patient.postVisitConsultation?.firstVisitConsultationContent) {
        if (consultantMemo) consultantMemo += '\n\n';
        consultantMemo += `[내원 상담]\n${patient.postVisitConsultation.firstVisitConsultationContent}`;
      }

      // 예약/콜백 날짜
      let appointmentDate = '';
      let callbackDate = '';

      if (status === 'agreed') {
        if (patient.reservationDate) {
          const resDate = new Date(patient.reservationDate);
          appointmentDate = `${resDate.getMonth() + 1}/${resDate.getDate()} ${patient.reservationTime || ''}`.trim();
        }
      } else if (status === 'pending') {
        if (patient.nextCallbackDate) {
          callbackDate = patient.nextCallbackDate;
        } else if (patient.callbackHistory && patient.callbackHistory.length > 0) {
          const scheduledCallback = patient.callbackHistory
            .filter((cb: any) => cb.status === '예정')
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
          if (scheduledCallback) {
            callbackDate = scheduledCallback.date;
          }
        }
      }

      // 치료 내용 - teethUnknown이면 "미확인", selectedTeeth 배열이 있으면 "#36, #37 (2본)" 형태로 표시
      let treatment = '상담';
      const teethUnknown = patient.consultation?.teethUnknown;
      const selectedTeeth = patient.consultation?.selectedTeeth;
      const interestedServices = patient.interestedServices?.join(', ');

      if (teethUnknown) {
        const treatmentType = interestedServices || '임플란트';
        treatment = `${treatmentType} (치아번호 미확인)`;
      } else if (selectedTeeth && Array.isArray(selectedTeeth) && selectedTeeth.length > 0) {
        const sortedTeeth = [...selectedTeeth].sort((a: number, b: number) => a - b);
        const teethStr = sortedTeeth.map((t: number) => `#${t}`).join(', ');
        const treatmentType = interestedServices || '임플란트';
        treatment = `${treatmentType} ${teethStr} (${selectedTeeth.length}본)`;
      } else if (interestedServices) {
        treatment = interestedServices;
      } else if (patient.consultation?.treatmentPlan) {
        treatment = patient.consultation.treatmentPlan.substring(0, 50);
      }

      return {
        id: patient._id.toString(),
        name: patient.name,
        gender: patient.gender || '',
        age: patient.age || null,
        phone: patient.phone || '',
        status,
        treatment,
        inquiry,
        consultantMemo,
        disagreeReasons,
        correctionPlan,
        appointmentDate,
        callbackDate,
        originalAmount,
        discountRate,
        discountAmount,
        finalAmount,
        discountReason,
        consultantName: userMap.get(patient.assignedTo) || userMap.get(patient.createdBy) || patient.assignedTo || patient.createdBy || '',
        time: extractConsultationTime(patient)
      };
    });

    // 요약 계산
    const agreed = patients.filter(p => p.status === 'agreed');
    const disagreed = patients.filter(p => p.status === 'disagreed');
    const pending = patients.filter(p => p.status === 'pending');

    const expectedRevenue = patients.reduce((sum, p) => sum + p.originalAmount, 0);
    const actualRevenue = patients.filter(p => p.status === 'agreed').reduce((sum, p) => sum + p.finalAmount, 0);
    const totalDiscount = patients.filter(p => p.status === 'agreed').reduce((sum, p) => sum + p.discountAmount, 0);
    const discountedPatients = patients.filter(p => p.discountRate > 0);
    const avgDiscountRate = discountedPatients.length > 0
      ? Math.round(discountedPatients.reduce((sum, p) => sum + p.discountRate, 0) / discountedPatients.length)
      : 0;

    const responseData = {
      date: selectedDate,
      dayOfWeek: getDayOfWeek(selectedDate),
      clinicName,
      summary: {
        total: patients.length,
        agreed: agreed.length,
        disagreed: disagreed.length,
        pending: pending.length,
        expectedRevenue,
        actualRevenue,
        totalDiscount,
        avgDiscountRate,
        callbackCount: pending.length
      },
      patients
    };

    console.log(`✅ 일별 마감 보고서 조회 완료: 동의 ${agreed.length}, 미동의 ${disagreed.length}, 보류 ${pending.length}`);

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ 일별 마감 보고서 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '일별 마감 보고서 조회 중 오류가 발생했습니다.',
        message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}
