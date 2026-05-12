// src/app/api/v2/marketing/analytics/route.ts
// 마케팅 분석 API — ROAS / CAC / 채널별 성과 / 월별 추이

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import type { MarketingCostV2 } from '@/types/marketingCost';

export const dynamic = 'force-dynamic';

interface ChannelRow {
  channel: string;
  cost: number;
  newPatients: number;
  estimatedRevenue: number; // 견적 매출
  actualRevenue: number; // 수납 매출
  roas: number; // 견적 기준 ROAS (%)
  actualRoas: number; // 수납 기준 ROAS (%)
  cac: number; // 환자 1명당 획득비용
}

interface MonthlyAnalytics {
  year: number;
  month: number;
  totalCost: number;
  totalNewPatients: number;
  totalEstimatedRevenue: number;
  totalActualRevenue: number;
  roas: number;
  actualRoas: number;
  cac: number;
  channels: ChannelRow[];
}

// KST 보정
const KST_OFFSET = 9 * 60 * 60 * 1000;
function kstMonthRange(year: number, month: number): { start: Date; end: Date } {
  const startStr = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
  const start = new Date(new Date(startStr).getTime() - KST_OFFSET);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`;
  const end = new Date(new Date(endStr).getTime() - KST_OFFSET);
  return { start, end };
}

async function calculateMonth(
  db: import('mongodb').Db,
  clinicId: string,
  year: number,
  month: number
): Promise<MonthlyAnalytics> {
  const { start, end } = kstMonthRange(year, month);

  // 1) 광고비
  const costs = await db.collection<MarketingCostV2>('marketing_costs_v2')
    .find({ clinicId, year, month })
    .toArray();

  const costByChannel = new Map<string, number>();
  let totalCost = 0;
  for (const c of costs) {
    costByChannel.set(c.channel, (costByChannel.get(c.channel) || 0) + c.amount);
    totalCost += c.amount;
  }

  // 2) 해당 월에 등록된 환자 (createdAt 기준)
  // 매출 집계: 대시보드/월보고서와 동일한 로직
  //   - estimatedAmount: 활성 journey > patient.estimatedAmount
  //   - actualAmount: paymentStatus in (partial, completed)일 때만 patient.actualAmount
  const patients = await db.collection('patients_v2').aggregate([
    {
      $match: {
        clinicId,
        createdAt: { $gte: start, $lt: end },
        deletedAt: { $exists: false },
      },
    },
    {
      $project: {
        _id: 1,
        referralSource: 1,
        estimatedAmount: 1,
        actualAmount: 1,
        paymentStatus: 1,
        journeys: 1,
        activeJourneyId: 1,
      },
    },
  ]).toArray();

  // 3) 채널별 환자/매출 집계
  const channelMap = new Map<string, { count: number; estimated: number; actual: number }>();
  let totalEstimated = 0;
  let totalActual = 0;

  for (const p of patients) {
    const channel = (p.referralSource && p.referralSource !== '') ? p.referralSource : '미지정';

    // 활성 journey 또는 patient 직접 필드
    const activeJourney = Array.isArray(p.journeys)
      ? p.journeys.find((j: { isActive?: boolean; id?: string }) =>
          j.isActive || j.id === p.activeJourneyId)
      : null;

    const estimated = activeJourney?.estimatedAmount || p.estimatedAmount || 0;
    const isPaid = p.paymentStatus === 'partial' || p.paymentStatus === 'completed';
    const actual = isPaid ? (activeJourney?.actualAmount || p.actualAmount || 0) : 0;

    const row = channelMap.get(channel) || { count: 0, estimated: 0, actual: 0 };
    row.count += 1;
    row.estimated += estimated;
    row.actual += actual;
    channelMap.set(channel, row);

    totalEstimated += estimated;
    totalActual += actual;
  }

  // 5) 광고비가 있지만 환자가 없는 채널도 포함
  Array.from(costByChannel.keys()).forEach((channel) => {
    if (!channelMap.has(channel)) {
      channelMap.set(channel, { count: 0, estimated: 0, actual: 0 });
    }
  });

  const channels: ChannelRow[] = Array.from(channelMap.entries()).map(([channel, row]) => {
    const cost = costByChannel.get(channel) || 0;
    const roas = cost > 0 ? Math.round((row.estimated / cost) * 100) : 0;
    const actualRoas = cost > 0 ? Math.round((row.actual / cost) * 100) : 0;
    const cac = row.count > 0 ? Math.round(cost / row.count) : 0;
    return {
      channel,
      cost,
      newPatients: row.count,
      estimatedRevenue: row.estimated,
      actualRevenue: row.actual,
      roas,
      actualRoas,
      cac,
    };
  });

  // 정렬: 광고비 큰 순 → 매출 큰 순
  channels.sort((a, b) => b.cost - a.cost || b.actualRevenue - a.actualRevenue);

  return {
    year,
    month,
    totalCost,
    totalNewPatients: patients.length,
    totalEstimatedRevenue: totalEstimated,
    totalActualRevenue: totalActual,
    roas: totalCost > 0 ? Math.round((totalEstimated / totalCost) * 100) : 0,
    actualRoas: totalCost > 0 ? Math.round((totalActual / totalCost) * 100) : 0,
    cac: patients.length > 0 ? Math.round(totalCost / patients.length) : 0,
    channels,
  };
}

// GET ?year=2026&month=5            → 단일 월
// GET ?year=2026&months=6           → 최근 N개월 추이 (default month: 현재 월)
// GET ?year=2026 (월 미지정, months 미지정) → 해당 년도 1~12월
export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const monthsParam = searchParams.get('months');

    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    // 단일 월
    if (monthParam) {
      const month = parseInt(monthParam);
      const data = await calculateMonth(db, clinicId, year, month);
      return NextResponse.json({ success: true, data });
    }

    // 최근 N개월 추이
    if (monthsParam) {
      const months = Math.min(Math.max(parseInt(monthsParam), 1), 24);
      const results: MonthlyAnalytics[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = await calculateMonth(db, clinicId, d.getFullYear(), d.getMonth() + 1);
        results.push(m);
      }
      return NextResponse.json({ success: true, data: results });
    }

    // 년도 전체 (1~12월)
    const results: MonthlyAnalytics[] = [];
    for (let m = 1; m <= 12; m++) {
      results.push(await calculateMonth(db, clinicId, year, m));
    }
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('[marketing/analytics GET] error', error);
    return NextResponse.json({ success: false, message: '마케팅 분석 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
