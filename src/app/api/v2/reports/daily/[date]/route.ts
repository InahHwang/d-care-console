// src/app/api/v2/reports/daily/[date]/route.ts
// v2 일별 마감 리포트 API

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import type { ConsultationV2, PatientV2, CallLogV2 } from '@/types/v2';

interface DailyReportPatient {
  id: string;
  patientId: string;  // 환자 상세 페이지 링크용
  name: string;
  phone: string;
  status: 'agreed' | 'disagreed' | 'pending';
  type: 'phone' | 'visit';  // 상담 유형
  treatment: string;
  originalAmount: number;
  discountRate: number;
  discountAmount: number;
  finalAmount: number;
  discountReason?: string;
  disagreeReasons: string[];
  correctionPlan?: string;
  appointmentDate?: string;
  callbackDate?: string;
  consultantName: string;
  time: string;  // 통화 시작 시간
  duration?: number;  // 통화 시간 (초)
  aiSummary?: string;
  // 환자 추가 정보
  gender?: '남' | '여';
  age?: number;
  memo?: string;
  inquiry?: string;
  // 상담 회차 정보
  consultationNumber?: number;  // 1차, 2차, 3차...
}

interface DailyReportSummary {
  total: number;
  agreed: number;
  disagreed: number;
  pending: number;
  expectedRevenue: number;
  actualRevenue: number;
  totalDiscount: number;
  avgDiscountRate: number;
  callbackCount: number;
  newPatients: number;
  existingPatients: number;
  // 상담 유형별 통계
  phoneConsultations: number;
  visitConsultations: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const selectedDate = params.date;

    // 날짜 형식 검증
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 날짜 형식입니다. (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    console.log(`[Report v2] ${selectedDate} 일별 리포트 조회`);

    const { db } = await connectToDatabase();

    // 해당 날짜의 상담 기록 조회
    const startOfDay = `${selectedDate}T00:00:00.000Z`;
    const endOfDay = `${selectedDate}T23:59:59.999Z`;

    const consultations = await db.collection<ConsultationV2>('consultations_v2').find({
      date: {
        $gte: new Date(startOfDay),
        $lte: new Date(endOfDay),
      },
    }).toArray();

    // 해당 날짜 통화 기록 조회 (상담 기록이 없는 경우 통화 기반으로)
    // createdAt이 Date 객체이므로 Date로 변환하여 비교
    const callLogs = await db.collection<CallLogV2>('callLogs_v2').find({
      createdAt: {
        $gte: new Date(startOfDay),
        $lte: new Date(endOfDay),
      },
      aiStatus: 'completed',
    }).toArray();

    // 환자 ID 수집
    const patientIds = new Set<string>();
    consultations.forEach((c) => patientIds.add(c.patientId));
    callLogs.forEach((c) => {
      if (c.patientId) patientIds.add(c.patientId);
    });

    // 환자 정보 조회
    const patients = await db.collection<PatientV2>('patients_v2').find({
      _id: { $in: Array.from(patientIds).map((id) => new (require('mongodb').ObjectId)(id)) },
    }).toArray();

    const patientMap = new Map(patients.map((p) => [p._id?.toString(), p]));

    // 상담 회차 계산: 각 환자별 "오늘 이전" 상담 수 조회
    const consultationPatientIdList = Array.from(new Set(consultations.map((c) => c.patientId)));
    const previousConsultationCounts = consultationPatientIdList.length > 0
      ? await db.collection('consultations_v2')
          .aggregate([
            {
              $match: {
                patientId: { $in: consultationPatientIdList },
                date: { $lt: new Date(startOfDay) },
              },
            },
            {
              $group: {
                _id: '$patientId',
                count: { $sum: 1 },
              },
            },
          ])
          .toArray()
      : [];
    const prevCountMap = new Map(
      previousConsultationCounts.map((p) => [p._id as string, p.count as number])
    );

    // callLogs를 patientId로 매핑 (duration 조회용)
    const callLogByPatientMap = new Map(
      callLogs.map((c) => [c.patientId, c])
    );
    // callLogs를 _id로도 매핑 (callLogId로 직접 찾기 위함)
    const callLogByIdMap = new Map(
      callLogs.map((c) => [c._id?.toString(), c])
    );

    // 상담 기록 기반 리포트 데이터 생성
    const reportPatients: DailyReportPatient[] = consultations.map((consultation) => {
      const patient = patientMap.get(consultation.patientId);
      // callLogId가 있으면 그걸로 찾고, 없으면 patientId로 찾기
      const callLog = consultation.callLogId
        ? callLogByIdMap.get(consultation.callLogId)
        : callLogByPatientMap.get(consultation.patientId);

      return {
        id: consultation._id?.toString() || '',
        patientId: consultation.patientId,
        name: patient?.name || '미확인',
        phone: patient?.phone || '',
        status: consultation.status,
        type: consultation.type || 'phone',  // 상담 유형
        treatment: consultation.treatment,
        originalAmount: Math.round(consultation.originalAmount / 10000),
        discountRate: consultation.discountRate,
        discountAmount: Math.round(consultation.discountAmount / 10000),
        finalAmount: Math.round(consultation.finalAmount / 10000),
        discountReason: consultation.discountReason,
        disagreeReasons: consultation.disagreeReasons || [],
        correctionPlan: consultation.correctionPlan,
        appointmentDate: consultation.appointmentDate
          ? new Date(consultation.appointmentDate).toISOString().split('T')[0]
          : undefined,
        callbackDate: consultation.callbackDate
          ? new Date(consultation.callbackDate).toISOString().split('T')[0]
          : undefined,
        consultantName: consultation.consultantName,
        time: new Date(consultation.createdAt).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        duration: callLog?.duration,  // 통화 시간 (초)
        aiSummary: consultation.aiSummary || callLog?.aiAnalysis?.summary,
        // 환자 추가 정보
        gender: patient?.gender,
        age: patient?.age,
        memo: consultation.memo,
        inquiry: consultation.inquiry,
        // 상담 회차: 이전 상담 수 + 1
        consultationNumber: (prevCountMap.get(consultation.patientId) || 0) + 1,
      };
    });

    // 상담 기록이 없는 통화만 추가
    const consultationPatientIds = new Set(consultations.map((c) => c.patientId));
    callLogs.forEach((call) => {
      if (call.patientId && !consultationPatientIds.has(call.patientId)) {
        const patient = patientMap.get(call.patientId);
        if (patient) {
          reportPatients.push({
            id: call._id?.toString() || '',
            patientId: call.patientId,  // 환자 상세 페이지 링크용
            name: patient.name,
            phone: patient.phone,
            status: 'pending',
            type: 'phone',  // 통화 기록은 전화상담
            treatment: patient.interest || '미정',
            originalAmount: 0,
            discountRate: 0,
            discountAmount: 0,
            finalAmount: 0,
            disagreeReasons: [],
            consultantName: '자동등록',
            time: new Date(call.createdAt).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            duration: call.duration,  // 통화 시간 (초)
            aiSummary: call.aiAnalysis?.summary,
            // 환자 추가 정보
            gender: patient.gender,
            age: patient.age,
            memo: patient.memo,
          });
        }
      }
    });

    // 통계 계산
    const agreed = reportPatients.filter((p) => p.status === 'agreed');
    const disagreed = reportPatients.filter((p) => p.status === 'disagreed');
    const pending = reportPatients.filter((p) => p.status === 'pending');

    const expectedRevenue = reportPatients.reduce((sum, p) => sum + p.originalAmount, 0);
    const actualRevenue = agreed.reduce((sum, p) => sum + p.finalAmount, 0);
    const totalDiscount = reportPatients.reduce((sum, p) => sum + p.discountAmount, 0);

    // 신규/기존 환자 통계 (통화 기록 기반)
    // 신환, 구신환을 신규로 카운트
    const newPatientCount = callLogs.filter(
      (c) => c.aiAnalysis?.classification === '신환' || c.aiAnalysis?.classification === '구신환'
    ).length;

    // 상담 유형별 통계
    const phoneConsultations = reportPatients.filter((p) => p.type === 'phone').length;
    const visitConsultations = reportPatients.filter((p) => p.type === 'visit').length;

    const summary: DailyReportSummary = {
      total: reportPatients.length,
      agreed: agreed.length,
      disagreed: disagreed.length,
      pending: pending.length,
      expectedRevenue,
      actualRevenue,
      totalDiscount,
      avgDiscountRate: expectedRevenue > 0
        ? Math.round((totalDiscount / expectedRevenue) * 100)
        : 0,
      callbackCount: reportPatients.filter((p) => p.callbackDate).length,
      newPatients: newPatientCount,
      existingPatients: callLogs.length - newPatientCount,
      phoneConsultations,
      visitConsultations,
    };

    // 요일 계산
    const dateObj = new Date(selectedDate);
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];

    return NextResponse.json({
      success: true,
      data: {
        date: selectedDate,
        dayOfWeek,
        summary,
        patients: reportPatients,
      },
    });
  } catch (error) {
    console.error('[Report v2] daily 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
