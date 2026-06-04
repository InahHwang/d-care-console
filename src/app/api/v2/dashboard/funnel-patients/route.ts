// src/app/api/v2/dashboard/funnel-patients/route.ts
// 퍼널 단계별 근거 환자 명단
// ConversionFunnelCard의 헤드라인 숫자(dashboard/route.ts 전환율 facet)와
// 정확히 동일한 필터(환자 단위 · 등록월 createdAt 코호트)를 사용해 명단을 반환한다.
// → 숫자와 명단이 항상 일치(근거 자료로 사용 가능)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import { RESERVED_OR_ABOVE, VISITED_OR_ABOVE } from '@/app/v2/reports/components/MonthlyReport-Types';

export const dynamic = 'force-dynamic';

type FunnelStage = 'new' | 'reserved' | 'visited' | 'paid';

const STAGE_LABEL: Record<FunnelStage, string> = {
  new: '신규 문의',
  reserved: '예약 전환',
  visited: '내원 전환',
  paid: '결제 전환',
};

export async function GET(request: NextRequest) {
  try {
    const authResult = verifyToken(request);
    if (authResult instanceof NextResponse) return authResult;

    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    const monthParam = request.nextUrl.searchParams.get('month');
    const stageParam = request.nextUrl.searchParams.get('stage') as FunnelStage | null;

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ success: false, error: 'Invalid month' }, { status: 400 });
    }
    if (!stageParam || !['new', 'reserved', 'visited', 'paid'].includes(stageParam)) {
      return NextResponse.json({ success: false, error: 'Invalid stage' }, { status: 400 });
    }

    const [y, m] = monthParam.split('-').map(Number);
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const monthStart = new Date(Date.UTC(y, m - 1, 1) - KST_OFFSET);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEnd = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999) - KST_OFFSET);

    // 헤드라인 숫자와 동일한 필터: createdAt 코호트 + 단계별 status/paymentStatus 조건
    const match: Record<string, unknown> = {
      clinicId,
      deletedAt: { $exists: false },
      createdAt: { $gte: monthStart, $lte: monthEnd },
    };
    if (stageParam === 'reserved') {
      match.status = { $in: RESERVED_OR_ABOVE };
    } else if (stageParam === 'visited') {
      match.status = { $in: VISITED_OR_ABOVE };
    } else if (stageParam === 'paid') {
      match.paymentStatus = { $in: ['partial', 'completed'] };
    }

    const rows = await db.collection('patients_v2')
      .find(match, {
        projection: {
          name: 1, phone: 1, source: 1, consultationType: 1,
          status: 1, paymentStatus: 1, actualAmount: 1, estimatedAmount: 1,
          createdAt: 1, createdByName: 1,
        },
      })
      .sort({ createdAt: -1 })
      .toArray();

    const patients = rows.map((r) => ({
      patientId: String(r._id),
      journeyId: null,
      name: r.name,
      phone: r.phone,
      source: r.source || '',
      consultationType: r.consultationType || '',
      // 코호트 기준이므로 날짜 컬럼은 등록일(createdAt)을 사용
      journeyStatus: r.status || '',
      journeyStartedAt: r.createdAt,
      paymentStatus: r.paymentStatus || 'none',
      actualAmount: r.actualAmount || 0,
      estimatedAmount: r.estimatedAmount || 0,
      consultantName: r.createdByName || '미지정',
    }));

    return NextResponse.json({
      success: true,
      data: { stage: stageParam, label: STAGE_LABEL[stageParam], patients },
    });
  } catch (error) {
    console.error('funnel-patients API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch funnel patients' },
      { status: 500 }
    );
  }
}
