// src/app/api/report/mobile/[date]/route.ts
// 모바일 일별 마감 리포트 API

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

// 리포트용 토큰 생성 (관리자 페이지에서 사용)
function generateReportToken(date: string): string {
  const secret = process.env.JWT_SECRET || 'default-secret-key';
  // 24시간 후 만료
  const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
  return jwt.sign(
    { type: 'daily_report', date, createdAt: new Date().toISOString(), exp: expiresAt },
    secret
  );
}

// 토큰 검증 함수
function verifyReportToken(token: string): { valid: boolean; date?: string; error?: string } {
  try {
    const secret = process.env.JWT_SECRET || 'default-secret-key';
    const decoded = jwt.verify(token, secret) as any;

    if (decoded.type !== 'daily_report') {
      return { valid: false, error: '유효하지 않은 토큰 타입입니다.' };
    }

    return { valid: true, date: decoded.date };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: '토큰이 만료되었습니다.' };
    }
    return { valid: false, error: '유효하지 않은 토큰입니다.' };
  }
}

// 미동의 사유 카테고리 정의
const disagreeReasonCategories = {
  price: {
    label: '가격/비용',
    reasons: ['예산 초과', '타 병원 대비 비쌈', '분납/할부 조건 안 맞음', '당장 여유가 안 됨']
  },
  treatment: {
    label: '치료 계획',
    reasons: ['치료 계획 이견', '제안 치료 거부', '치료 범위 과다', '치료 기간 부담']
  },
  decision: {
    label: '결정 보류',
    reasons: ['가족 상의 필요', '타 병원 비교 중', '추가 상담/정보 필요', '단순 정보 문의']
  },
  other: {
    label: '기타',
    reasons: ['일정 조율 어려움', '치료 두려움/불안', '기타']
  }
};

// 환자 상태 결정 함수
function determinePatientStatus(patient: any): 'agreed' | 'disagreed' | 'pending' {
  // 내원 후 상담 정보가 있는 경우
  if (patient.postVisitConsultation?.estimateInfo) {
    const reaction = patient.postVisitConsultation.estimateInfo.patientReaction;
    if (reaction === '동의해요(적당)' || reaction === '생각보다 저렴해요') {
      return 'agreed';
    }
    if (reaction === '비싸요') {
      return 'disagreed';
    }
  }

  // 최초 상담의 견적 동의 여부
  if (patient.consultation?.estimateAgreed === true) {
    return 'agreed';
  }
  if (patient.consultation?.estimateAgreed === false) {
    return 'disagreed';
  }

  // 예약 확정된 경우
  if (patient.status === '예약확정' || patient.status === '재예약확정') {
    return 'agreed';
  }

  // 내원 확정된 경우
  if (patient.visitConfirmed === true) {
    return 'agreed';
  }

  // 종결된 경우
  if (patient.isCompleted || patient.status === '종결') {
    return 'disagreed';
  }

  // 그 외는 보류
  return 'pending';
}

// 미동의 사유 추출 함수
function extractDisagreeReasons(patient: any): string[] {
  const reasons: string[] = [];

  // 내원 후 상담의 환자 반응
  if (patient.postVisitConsultation?.estimateInfo?.patientReaction === '비싸요') {
    reasons.push('예산 초과');
  }

  // 종결 사유
  if (patient.completedReason) {
    reasons.push(patient.completedReason);
  }

  // 콜백 히스토리에서 사유 추출
  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
    const latestCallback = patient.callbackHistory[patient.callbackHistory.length - 1];
    if (latestCallback.notes) {
      // 미동의 사유 키워드 매칭
      const allReasons = Object.values(disagreeReasonCategories).flatMap(cat => cat.reasons);
      allReasons.forEach(reason => {
        if (latestCallback.notes.includes(reason) && !reasons.includes(reason)) {
          reasons.push(reason);
        }
      });
    }
  }

  return reasons;
}

// 시정 계획 추출 함수
function extractCorrectionPlan(patient: any): string {
  // 콜백 히스토리에서 다음 계획 추출
  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
    const pendingCallbacks = patient.callbackHistory.filter((cb: any) => cb.status === '예정');
    if (pendingCallbacks.length > 0) {
      const nextCallback = pendingCallbacks[0];
      return `${nextCallback.date} ${nextCallback.type} 예정${nextCallback.notes ? ` - ${nextCallback.notes}` : ''}`;
    }
  }

  // 다음 콜백 날짜가 있는 경우
  if (patient.nextCallbackDate) {
    return `${patient.nextCallbackDate} 콜백 예정`;
  }

  return '';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const selectedDate = params.date;

    // 토큰 검증
    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const tokenResult = verifyReportToken(token);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { success: false, error: tokenResult.error },
        { status: 401 }
      );
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 날짜 형식입니다. (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    console.log(`[MobileReport] ${selectedDate} 일별 마감 리포트 조회`);

    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');

    // 해당 날짜에 상담이 있는 환자들 조회
    const dailyPatients = await patientsCollection.find({
      $or: [
        { callInDate: selectedDate },      // 신규 등록된 환자
        { visitDate: selectedDate },        // 내원한 환자
        { firstConsultDate: selectedDate }, // 첫 상담 날짜
        {
          callbackHistory: {
            $elemMatch: {
              date: selectedDate,
              status: { $in: ['완료', '예약확정'] }
            }
          }
        }
      ]
    }).toArray();

    console.log(`[MobileReport] ${selectedDate} 관련 환자 수: ${dailyPatients.length}명`);

    // 환자별 데이터 변환
    const patients = dailyPatients.map((patient, index) => {
      const status = determinePatientStatus(patient);
      const disagreeReasons = status === 'disagreed' || status === 'pending'
        ? extractDisagreeReasons(patient)
        : [];
      const correctionPlan = status === 'disagreed' || status === 'pending'
        ? extractCorrectionPlan(patient)
        : '';

      // 금액 정보
      let originalAmount = 0;
      let discountRate = 0;
      let discountAmount = 0;
      let finalAmount = 0;
      let discountReason = '';

      // 내원 후 상담 견적 우선
      if (patient.postVisitConsultation?.estimateInfo) {
        const estimate = patient.postVisitConsultation.estimateInfo;
        originalAmount = estimate.regularPrice || 0;
        finalAmount = estimate.discountPrice || originalAmount;
        discountAmount = originalAmount - finalAmount;
        discountRate = originalAmount > 0 ? Math.round((discountAmount / originalAmount) * 100) : 0;
        discountReason = estimate.discountEvent || '';
      }
      // 최초 상담 견적
      else if (patient.consultation?.estimatedAmount) {
        originalAmount = patient.consultation.estimatedAmount;
        finalAmount = originalAmount;
      }

      // 상담사 정보
      const consultantName = patient.lastModifiedByName || patient.createdByName || '담당자 미지정';

      // 상담 시간 추출
      let consultTime = '';
      if (patient.callbackHistory && patient.callbackHistory.length > 0) {
        const todayCallback = patient.callbackHistory.find((cb: any) =>
          cb.date === selectedDate && cb.actualCompletedTime
        );
        if (todayCallback) {
          consultTime = todayCallback.actualCompletedTime;
        }
      }
      if (!consultTime && patient.createdAt) {
        const createdDate = new Date(patient.createdAt);
        consultTime = `${createdDate.getHours().toString().padStart(2, '0')}:${createdDate.getMinutes().toString().padStart(2, '0')}`;
      }

      // 예약 정보
      const appointmentDate = patient.reservationDate
        ? `${patient.reservationDate}${patient.reservationTime ? ' ' + patient.reservationTime : ''}`
        : undefined;

      // 콜백 예정일
      const callbackDate = patient.nextCallbackDate || undefined;

      return {
        id: patient._id.toString(),
        name: patient.name,
        gender: '', // DB에 성별 정보가 없으면 빈 문자열
        age: patient.age || null,
        phone: patient.phoneNumber,
        status,
        treatment: patient.interestedServices?.join(', ') || '미지정',
        inquiry: patient.consultation?.treatmentPlan || '',
        consultantMemo: patient.consultation?.consultationNotes || patient.postVisitConsultation?.consultationContent || '',
        disagreeReasons,
        correctionPlan,
        appointmentDate,
        callbackDate,
        originalAmount: Math.round(originalAmount / 10000), // 만원 단위
        discountRate,
        discountAmount: Math.round(discountAmount / 10000),
        finalAmount: Math.round(finalAmount / 10000),
        discountReason,
        consultantName,
        time: consultTime
      };
    });

    // 통계 계산
    const agreed = patients.filter(p => p.status === 'agreed');
    const disagreed = patients.filter(p => p.status === 'disagreed');
    const pending = patients.filter(p => p.status === 'pending');

    const expectedRevenue = patients.reduce((sum, p) => sum + p.originalAmount, 0);
    const actualRevenue = patients.reduce((sum, p) => sum + p.finalAmount, 0);
    const totalDiscount = expectedRevenue - actualRevenue;
    const avgDiscountRate = expectedRevenue > 0
      ? Math.round((totalDiscount / expectedRevenue) * 100)
      : 0;

    // 콜백 예정 건수
    const callbackCount = patients.filter(p => p.callbackDate).length;

    // 요일 계산
    const dateObj = new Date(selectedDate);
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];

    const reportData = {
      date: selectedDate,
      dayOfWeek,
      clinicName: process.env.CLINIC_NAME || '치과',
      summary: {
        total: patients.length,
        agreed: agreed.length,
        disagreed: disagreed.length,
        pending: pending.length,
        expectedRevenue,
        actualRevenue,
        totalDiscount,
        avgDiscountRate,
        callbackCount
      },
      patients
    };

    return NextResponse.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('[MobileReport] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '리포트 조회 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// POST: 리포트 토큰 생성 (관리자 전용)
export async function POST(request: NextRequest) {
  try {
    // 일반 인증 확인 (쿠키 기반)
    const authToken = request.cookies.get('token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { success: false, error: '관리자 인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json(
        { success: false, error: '날짜가 필요합니다.' },
        { status: 400 }
      );
    }

    const reportToken = generateReportToken(date);
    const reportUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/report/daily/${date}?token=${reportToken}`;

    return NextResponse.json({
      success: true,
      token: reportToken,
      url: reportUrl,
      expiresIn: '24h'
    });

  } catch (error) {
    console.error('[MobileReport] 토큰 생성 오류:', error);
    return NextResponse.json(
      { success: false, error: '토큰 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
