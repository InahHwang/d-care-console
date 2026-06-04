// src/app/api/v2/dashboard/journey-patients/route.ts
// 이번달 시작 여정 명단 (신환 / 구신환 재유치)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    const monthParam = request.nextUrl.searchParams.get('month');
    const typeParam = request.nextUrl.searchParams.get('type');

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ success: false, error: 'Invalid month' }, { status: 400 });
    }
    if (typeParam !== 'new' && typeParam !== 'returning') {
      return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
    }

    const [y, m] = monthParam.split('-').map(Number);
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const monthStart = new Date(Date.UTC(y, m - 1, 1) - KST_OFFSET);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEnd = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999) - KST_OFFSET);
    const startISO = monthStart.toISOString();
    const endISO = monthEnd.toISOString();

    const isNewType = typeParam === 'new';

    const pipeline: Array<Record<string, unknown>> = [
      { $match: { clinicId, deletedAt: { $exists: false } } },
      { $unwind: '$journeys' },
      {
        $match: {
          $or: [
            { 'journeys.startedAt': { $gte: monthStart, $lte: monthEnd } },
            { 'journeys.startedAt': { $gte: startISO, $lte: endISO } },
          ],
        },
      },
      {
        $addFields: {
          isNewPatient: {
            $or: [
              { $and: [{ $gte: ['$createdAt', monthStart] }, { $lte: ['$createdAt', monthEnd] }] },
              { $and: [{ $gte: ['$createdAt', startISO] }, { $lte: ['$createdAt', endISO] }] },
            ],
          },
        },
      },
      { $match: { isNewPatient: isNewType } },
      {
        $project: {
          _id: 1,
          name: 1,
          phone: 1,
          source: 1,
          consultationType: 1,
          createdAt: 1,
          journeyId: '$journeys._id',
          journeyStatus: '$journeys.status',
          journeyStartedAt: '$journeys.startedAt',
          journeyPaymentStatus: '$journeys.paymentStatus',
          journeyActualAmount: { $ifNull: ['$journeys.actualAmount', 0] },
          journeyEstimatedAmount: { $ifNull: ['$journeys.estimatedAmount', 0] },
          startedByName: '$journeys.startedByName',
          createdByName: 1,
        },
      },
      { $sort: { journeyStartedAt: -1 } },
    ];

    const rows = await db.collection('patients_v2').aggregate(pipeline).toArray();

    const patients = rows.map((r) => ({
      patientId: String(r._id),
      journeyId: r.journeyId ? String(r.journeyId) : null,
      name: r.name,
      phone: r.phone,
      source: r.source || '',
      consultationType: r.consultationType || '',
      journeyStatus: r.journeyStatus || '',
      journeyStartedAt: r.journeyStartedAt,
      paymentStatus: r.journeyPaymentStatus || 'none',
      actualAmount: r.journeyActualAmount || 0,
      estimatedAmount: r.journeyEstimatedAmount || 0,
      consultantName: r.startedByName || r.createdByName || '미지정',
    }));

    return NextResponse.json({ success: true, data: { patients } });
  } catch (error) {
    console.error('journey-patients API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch journey patients' },
      { status: 500 }
    );
  }
}
