// src/app/api/v2/marketing/channel-patients/route.ts
// 특정 채널(referralSource)로 유입된 월별 환자 리스트

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '0');
    const month = parseInt(searchParams.get('month') || '0');
    const channel = searchParams.get('channel');

    if (!year || !month || !channel) {
      return NextResponse.json({ success: false, message: 'year/month/channel 필요' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;
    const { start, end } = kstMonthRange(year, month);

    // '미지정' 검색: referralSource가 비어있거나 없음
    const filter: Record<string, unknown> = {
      clinicId,
      createdAt: { $gte: start, $lt: end },
      deletedAt: { $exists: false },
    };
    if (channel === '미지정') {
      filter.$or = [
        { referralSource: { $exists: false } },
        { referralSource: '' },
        { referralSource: null },
      ];
    } else {
      filter.referralSource = channel;
    }

    const patients = await db.collection('patients_v2')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const patientIds = patients.map((p) => p._id.toString());
    const consultations = patientIds.length > 0
      ? await db.collection('consultations_v2').find({
          clinicId,
          patientId: { $in: patientIds },
        }).toArray()
      : [];

    const finalByPatient = new Map<string, number>();
    const originalByPatient = new Map<string, number>();
    for (const c of consultations) {
      const pid = c.patientId;
      const finalAmt = c.finalAmount ?? (c.originalAmount && c.discountRate !== undefined
        ? Math.round(c.originalAmount * (1 - (c.discountRate || 0) / 100))
        : 0);
      if (finalAmt > 0) {
        finalByPatient.set(pid, Math.max(finalByPatient.get(pid) || 0, finalAmt));
      }
      if (c.originalAmount && c.originalAmount > 0) {
        originalByPatient.set(pid, Math.max(originalByPatient.get(pid) || 0, c.originalAmount));
      }
    }

    const data = patients.map((p) => {
      const pid = p._id.toString();
      const interests: string[] = Array.isArray(p.interestedServices) ? p.interestedServices : (p.interest ? [p.interest] : []);
      return {
        patientId: pid,
        name: p.name || '',
        phone: p.phoneNumber || p.phone || '',
        status: p.status || '-',
        registeredAt: typeof p.createdAt === 'string' ? p.createdAt : new Date(p.createdAt).toISOString(),
        estimatedAmount: originalByPatient.get(pid) || p.consultation?.estimatedAmount || 0,
        actualAmount: finalByPatient.get(pid) || 0,
        interests,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[marketing/channel-patients] error', error);
    return NextResponse.json({ success: false, message: '조회 실패' }, { status: 500 });
  }
}
