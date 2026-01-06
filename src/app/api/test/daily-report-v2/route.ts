// src/app/api/test/daily-report-v2/route.ts
// 테스트용 일별 보고서 API (v2 구조)

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import {
  PatientV2,
  DailyReportPatientV2,
  DailyReportSummaryV2,
  DailyReportResponseV2,
  CallbackRecord
} from '@/types/patientV2';

const TEST_COLLECTION = 'patients_v2_test';

function verifyToken(token: string) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }
    return jwt.verify(token, process.env.JWT_SECRET) as any;
  } catch (error) {
    return jwt.decode(token) as any;
  }
}

function getTokenFromRequest(request: NextRequest): string | null {
  return request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.cookies.get('token')?.value ||
    request.headers.get('cookie')?.split('token=')[1]?.split(';')[0] ||
    null;
}

function getDayOfWeek(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

// 치료 내용 포맷팅
function formatTreatment(patient: PatientV2): string {
  const services = patient.consultation?.interestedServices?.join(', ') || '상담';
  const teethUnknown = patient.consultation?.teethUnknown;
  const selectedTeeth = patient.consultation?.selectedTeeth || [];

  if (teethUnknown) {
    return `${services} (치아번호 미확인)`;
  }

  if (selectedTeeth.length > 0) {
    const sortedTeeth = [...selectedTeeth].sort((a, b) => a - b);
    const teethStr = sortedTeeth.map(t => `#${t}`).join(', ');
    return `${services} ${teethStr} (${selectedTeeth.length}본)`;
  }

  return services;
}

// 환자 데이터를 보고서용으로 변환
function transformPatientForReport(
  patient: any,
  userMap: Map<string, string>
): DailyReportPatientV2 {
  const preVisitCallbacks = patient.preVisitCallbacks || [];
  const postVisitCallbacks = patient.postVisitCallbacks || [];

  // 마지막 콜백
  const lastPreVisit = preVisitCallbacks.length > 0
    ? preVisitCallbacks[preVisitCallbacks.length - 1]
    : null;
  const lastPostVisit = postVisitCallbacks.length > 0
    ? postVisitCallbacks[postVisitCallbacks.length - 1]
    : null;

  // 견적 정보
  let originalAmount = 0;
  let discountRate = 0;
  let discountAmount = 0;
  let finalAmount = 0;
  let discountReason = '';

  if (patient.postVisitConsultation?.estimateInfo) {
    const estimate = patient.postVisitConsultation.estimateInfo;
    originalAmount = Math.round((estimate.regularPrice || 0) / 10000);
    finalAmount = Math.round((estimate.discountPrice || estimate.regularPrice || 0) / 10000);
    discountAmount = originalAmount - finalAmount;
    discountRate = estimate.discountRate || 0;
    discountReason = estimate.discountReason || '';
  } else if (patient.consultation?.estimatedAmount) {
    originalAmount = Math.round(patient.consultation.estimatedAmount / 10000);
    finalAmount = originalAmount;
  }

  return {
    id: patient._id.toString(),
    name: patient.name,
    gender: patient.gender || '',
    age: patient.age,
    phone: patient.phone || '',

    // 상태
    phase: patient.phase,
    currentStatus: patient.currentStatus,
    result: patient.result,
    resultReason: patient.resultReason,

    // 치료 정보
    treatment: formatTreatment(patient),
    selectedTeeth: patient.consultation?.selectedTeeth || [],
    teethUnknown: patient.consultation?.teethUnknown || false,

    // 콜백 정보 (상담관리)
    preVisitCallbackCount: preVisitCallbacks.length,
    lastPreVisitCallback: lastPreVisit ? {
      ...lastPreVisit,
      counselorName: userMap.get(lastPreVisit.counselorId) || lastPreVisit.counselorId
    } : null,
    nextPreVisitCallbackDate: patient.nextCallbackDate || null,

    // 콜백 정보 (내원관리)
    postVisitCallbackCount: postVisitCallbacks.length,
    lastPostVisitCallback: lastPostVisit ? {
      ...lastPostVisit,
      counselorName: userMap.get(lastPostVisit.counselorId) || lastPostVisit.counselorId
    } : null,
    nextPostVisitCallbackDate: null,

    // 견적 정보
    originalAmount,
    discountRate,
    discountAmount,
    finalAmount,
    discountReason,

    // 예약 정보
    appointmentDate: patient.reservation?.date || '',
    appointmentTime: patient.reservation?.time || '',

    // 담당자
    counselorName: userMap.get(patient.assignedTo) || patient.assignedTo || '',
    counselorId: patient.assignedTo || '',

    // 상담 메모
    consultationNotes: patient.consultation?.consultationNotes || '',
    postVisitNotes: patient.postVisitConsultation?.diagnosisNotes || '',

    // 시정 계획
    correctionPlan: extractCorrectionPlan(patient),

    // 시간
    time: patient.createdAt ? patient.createdAt.split('T')[1]?.substring(0, 5) || '' : ''
  };
}

// 시정 계획 추출
function extractCorrectionPlan(patient: any): string {
  // 최근 콜백에서 계획 추출
  const allCallbacks = [
    ...(patient.preVisitCallbacks || []),
    ...(patient.postVisitCallbacks || [])
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const callback of allCallbacks) {
    if (callback.notes && callback.notes.includes('예정')) {
      return callback.notes;
    }
  }

  if (patient.nextCallbackDate) {
    return `${patient.nextCallbackDate} 콜백 예정`;
  }

  return '';
}

export async function GET(request: NextRequest) {
  try {
    // 테스트 API - 인증 생략
    const { searchParams } = new URL(request.url);
    const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    console.log(`📊 [V2] 일별 보고서 조회: ${selectedDate}`);

    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);
    const settingsCollection = db.collection('settings');
    const usersCollection = db.collection('users');

    // 병원 이름
    const settings = await settingsCollection.findOne({ type: 'clinic' });
    const clinicName = settings?.clinicName || '치과';

    // 사용자 맵
    const users = await usersCollection.find({}).toArray();
    const userMap = new Map<string, string>();
    users.forEach(user => {
      userMap.set(user._id.toString(), user.name || user.username || '');
    });

    // 해당 날짜에 활동이 있는 환자 조회
    const dailyPatients = await collection.find({
      isDeleted: { $ne: true },
      $or: [
        { callInDate: selectedDate },
        { firstVisitDate: selectedDate },
        { 'reservation.date': selectedDate },
        { 'preVisitCallbacks.date': selectedDate },
        { 'postVisitCallbacks.date': selectedDate }
      ]
    }).toArray();

    console.log(`📊 [V2] ${selectedDate} 환자 수: ${dailyPatients.length}명`);

    // 상담관리 / 내원관리 분리
    const consultationPatients: DailyReportPatientV2[] = [];
    const visitPatients: DailyReportPatientV2[] = [];

    for (const patient of dailyPatients) {
      const reportPatient = transformPatientForReport(patient, userMap);

      if (patient.visitConfirmed) {
        visitPatients.push(reportPatient);
      } else {
        consultationPatients.push(reportPatient);
      }
    }

    // 요약 계산
    const summary: DailyReportSummaryV2 = {
      total: dailyPatients.length,

      consultation: {
        total: consultationPatients.length,
        newPatients: consultationPatients.filter(p => p.currentStatus === '신규').length,
        callbackNeeded: consultationPatients.filter(p =>
          p.currentStatus === '콜백필요' || p.currentStatus === '부재중'
        ).length,
        reservationConfirmed: consultationPatients.filter(p => p.phase === '예약확정').length,
        potential: consultationPatients.filter(p => p.currentStatus === '잠재고객').length
      },

      visit: {
        total: visitPatients.length,
        visited: visitPatients.filter(p => p.phase === '내원완료').length,
        reCallbackNeeded: visitPatients.filter(p => p.currentStatus === '재콜백필요').length,
        agreed: visitPatients.filter(p => p.result === '동의').length,
        disagreed: visitPatients.filter(p => p.result === '미동의').length,
        pending: visitPatients.filter(p => p.result === '보류').length
      },

      expectedRevenue: [...consultationPatients, ...visitPatients].reduce((sum, p) => sum + p.originalAmount, 0),
      actualRevenue: visitPatients.filter(p => p.result === '동의').reduce((sum, p) => sum + p.finalAmount, 0),
      totalDiscount: visitPatients.filter(p => p.result === '동의').reduce((sum, p) => sum + p.discountAmount, 0),
      avgDiscountRate: (() => {
        const discounted = visitPatients.filter(p => p.discountRate > 0);
        return discounted.length > 0
          ? Math.round(discounted.reduce((sum, p) => sum + p.discountRate, 0) / discounted.length)
          : 0;
      })(),

      preVisitCallbackCount: consultationPatients.reduce((sum, p) => sum + p.preVisitCallbackCount, 0),
      postVisitCallbackCount: visitPatients.reduce((sum, p) => sum + p.postVisitCallbackCount, 0)
    };

    const responseData: DailyReportResponseV2 = {
      date: selectedDate,
      dayOfWeek: getDayOfWeek(selectedDate),
      clinicName,
      summary,
      consultationPatients,
      visitPatients
    };

    console.log(`✅ [V2] 보고서 완료: 상담관리 ${consultationPatients.length}명, 내원관리 ${visitPatients.length}명`);

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ [V2] 일별 보고서 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '일별 보고서 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
