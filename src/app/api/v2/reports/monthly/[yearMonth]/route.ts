// src/app/api/v2/reports/monthly/[yearMonth]/route.ts
// v2 월별 리포트 API

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import type { PatientV2, CallLogV2, ConsultationV2 } from '@/types/v2';

interface MonthlyStats {
  // 통화 통계
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  avgCallDuration: number;

  // 환자 통계
  newPatients: number;
  existingPatients: number;
  conversionRate: number;

  // 퍼널 통계
  funnel: {
    consulting: number;
    reserved: number;
    visited: number;
    treatmentBooked: number;
    treatment: number;
    completed: number;
    followup: number;
  };

  // 매출 통계
  expectedRevenue: number;
  actualRevenue: number;
  avgDealSize: number;

  // 상담 통계
  totalConsultations: number;
  agreed: number;
  disagreed: number;
  pending: number;
  agreementRate: number;

  // 일별 추이
  dailyTrends: Array<{
    date: string;
    calls: number;
    newPatients: number;
    agreed: number;
    revenue: number;
  }>;

  // 관심분야별 통계
  interestBreakdown: Array<{
    interest: string;
    count: number;
    agreed: number;
    revenue: number;
  }>;

  // 미동의 사유 분석
  disagreeReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { yearMonth: string } }
) {
  try {
    const yearMonth = params.yearMonth; // YYYY-MM 형식

    // 형식 검증
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 날짜 형식입니다. (YYYY-MM)' },
        { status: 400 }
      );
    }

    console.log(`[Report v2] ${yearMonth} 월별 리포트 조회`);

    const { db } = await connectToDatabase();

    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // 병렬 쿼리 실행
    const [callLogs, patients, consultations] = await Promise.all([
      // 통화 기록
      db.collection<CallLogV2>('callLogs_v2').find({
        createdAt: { $gte: startDateStr, $lte: endDateStr },
      }).toArray(),

      // 해당 월에 생성된 환자
      db.collection<PatientV2>('patients_v2').find({
        createdAt: { $gte: startDateStr, $lte: endDateStr },
      }).toArray(),

      // 상담 기록
      db.collection<ConsultationV2>('consultations_v2').find({
        date: { $gte: startDate, $lte: endDate },
      }).toArray(),
    ]);

    // 통화 통계
    const connectedCalls = callLogs.filter((c) => c.status === 'connected');
    const missedCalls = callLogs.filter((c) => c.status === 'missed');
    const totalDuration = connectedCalls.reduce((sum, c) => sum + (c.duration || 0), 0);

    // 신규/기존 환자 (신환, 구신환을 신규로 카운트)
    const newPatientCalls = callLogs.filter(
      (c) => c.aiAnalysis?.classification === '신환' || c.aiAnalysis?.classification === '구신환'
    );
    const existingPatientCalls = callLogs.filter(
      (c) => c.aiAnalysis?.classification === '구환'
    );

    // 퍼널 통계 (현재 상태 기준)
    const allPatients = await db.collection<PatientV2>('patients_v2').find({}).toArray();
    const funnel = {
      consulting: allPatients.filter((p) => p.status === 'consulting').length,
      reserved: allPatients.filter((p) => p.status === 'reserved').length,
      visited: allPatients.filter((p) => p.status === 'visited').length,
      treatmentBooked: allPatients.filter((p) => p.status === 'treatmentBooked').length,
      treatment: allPatients.filter((p) => p.status === 'treatment').length,
      completed: allPatients.filter((p) => p.status === 'completed').length,
      followup: allPatients.filter((p) => p.status === 'followup').length,
    };

    // 상담 통계
    const agreedConsults = consultations.filter((c) => c.status === 'agreed');
    const disagreedConsults = consultations.filter((c) => c.status === 'disagreed');
    const pendingConsults = consultations.filter((c) => c.status === 'pending');

    const expectedRevenue = consultations.reduce((sum, c) => sum + c.originalAmount, 0);
    const actualRevenue = agreedConsults.reduce((sum, c) => sum + c.finalAmount, 0);

    // 일별 추이
    const dailyMap = new Map<string, { calls: number; newPatients: number; agreed: number; revenue: number }>();

    // 해당 월의 모든 날짜 초기화
    for (let d = 1; d <= endDate.getDate(); d++) {
      const dateStr = `${yearMonth}-${d.toString().padStart(2, '0')}`;
      dailyMap.set(dateStr, { calls: 0, newPatients: 0, agreed: 0, revenue: 0 });
    }

    // 통화 집계
    callLogs.forEach((call) => {
      const createdAt = typeof call.createdAt === 'string'
        ? call.createdAt
        : call.createdAt.toISOString();
      const dateStr = createdAt.split('T')[0];
      const daily = dailyMap.get(dateStr);
      if (daily) {
        daily.calls++;
        if (call.aiAnalysis?.classification === '신환' || call.aiAnalysis?.classification === '구신환') {
          daily.newPatients++;
        }
      }
    });

    // 상담 집계
    consultations.forEach((consult) => {
      const dateStr = new Date(consult.date).toISOString().split('T')[0];
      const daily = dailyMap.get(dateStr);
      if (daily) {
        if (consult.status === 'agreed') {
          daily.agreed++;
          daily.revenue += consult.finalAmount;
        }
      }
    });

    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 관심분야별 통계
    const interestMap = new Map<string, { count: number; agreed: number; revenue: number }>();
    consultations.forEach((consult) => {
      const interest = consult.treatment || '기타';
      const existing = interestMap.get(interest) || { count: 0, agreed: 0, revenue: 0 };
      existing.count++;
      if (consult.status === 'agreed') {
        existing.agreed++;
        existing.revenue += consult.finalAmount;
      }
      interestMap.set(interest, existing);
    });

    const interestBreakdown = Array.from(interestMap.entries())
      .map(([interest, data]) => ({ interest, ...data }))
      .sort((a, b) => b.count - a.count);

    // 미동의 사유 분석
    const reasonMap = new Map<string, number>();
    disagreedConsults.forEach((consult) => {
      consult.disagreeReasons?.forEach((reason) => {
        reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
      });
    });

    const totalDisagreeReasons = Array.from(reasonMap.values()).reduce((a, b) => a + b, 0);
    const disagreeReasons = Array.from(reasonMap.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: totalDisagreeReasons > 0
          ? Math.round((count / totalDisagreeReasons) * 100)
          : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const stats: MonthlyStats = {
      totalCalls: callLogs.length,
      connectedCalls: connectedCalls.length,
      missedCalls: missedCalls.length,
      avgCallDuration: connectedCalls.length > 0
        ? Math.round(totalDuration / connectedCalls.length)
        : 0,

      newPatients: newPatientCalls.length,
      existingPatients: existingPatientCalls.length,
      conversionRate: newPatientCalls.length > 0
        ? Math.round((agreedConsults.length / newPatientCalls.length) * 100)
        : 0,

      funnel,

      expectedRevenue: Math.round(expectedRevenue / 10000),
      actualRevenue: Math.round(actualRevenue / 10000),
      avgDealSize: agreedConsults.length > 0
        ? Math.round(actualRevenue / agreedConsults.length / 10000)
        : 0,

      totalConsultations: consultations.length,
      agreed: agreedConsults.length,
      disagreed: disagreedConsults.length,
      pending: pendingConsults.length,
      agreementRate: consultations.length > 0
        ? Math.round((agreedConsults.length / consultations.length) * 100)
        : 0,

      dailyTrends,
      interestBreakdown: interestBreakdown.map((i) => ({
        ...i,
        revenue: Math.round(i.revenue / 10000),
      })),
      disagreeReasons,
    };

    return NextResponse.json({
      success: true,
      data: {
        yearMonth,
        year,
        month,
        stats,
      },
    });
  } catch (error) {
    console.error('[Report v2] monthly 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
