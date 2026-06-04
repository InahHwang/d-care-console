// src/app/api/v2/dashboard/incentive-settlement/route.ts
// 인센티브 정산용 직원별 퍼널 전환율 + 월경계 소급분 분리
//
// 목적: 직원 인센티브를 내원/결제 전환율로 줄 때, "그 달에 등록(여정시작)한 환자가
//       다음 달 이후 결제(소급)"한 실적을 한눈에 보여줘 인센 지급 후 누락분을 소급해 주기 위함.
//
// 코호트 기준: 여정 startedAt 월 (대시보드 route.ts의 '이번달 성과'와 동일한 여정 단위)
// 상담사 귀속: journeys.startedByName 우선, 없으면 createdByName (대시보드와 동일)
// 소급 판별: 결제(partial/completed) && journeys.paidAt 존재 && paidAt > 코호트 월말
//   → paidAt이 없던 과거 결제건은 소급 분리 불가(이번 paidAt 도입 이후 데이터부터 정확)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const RESERVED_OR_ABOVE = ['reserved', 'visited', 'treatmentBooked', 'treatment', 'completed', 'followup'];
const VISITED_OR_ABOVE = ['visited', 'treatmentBooked', 'treatment', 'completed', 'followup'];
const PAID_STATUSES = ['partial', 'completed'];

interface ConsultantRow {
  name: string;
  registered: number;   // 여정 시작 수 (퍼널 1단계 = 문의)
  reserved: number;
  visited: number;
  paid: number;
  retroPaid: number;    // 소급 결제 (월 이후 결제)
  currentPaid: number;  // 당월 반영 결제 (paid - retroPaid)
  reservationRate: number; // 예약/문의
  visitRate: number;       // 내원/예약
  paymentRate: number;     // 결제/내원
  lowSample: boolean;
}

interface RetroPatient {
  consultant: string;
  patientId: string;
  journeyId: string | null;
  name: string;
  phone: string;
  journeyStartedAt: string | Date;
  paidAt: string | Date | null;
  paymentStatus: string;
  amount: number;
}

function rate(numer: number, denom: number) {
  return denom > 0 ? Math.round((numer / denom) * 100) : 0;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    const monthParam = request.nextUrl.searchParams.get('month');
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ success: false, error: 'Invalid month' }, { status: 400 });
    }

    const [y, m] = monthParam.split('-').map(Number);
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const monthStart = new Date(Date.UTC(y, m - 1, 1) - KST_OFFSET);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEnd = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999) - KST_OFFSET);
    const startISO = monthStart.toISOString();
    const endISO = monthEnd.toISOString();

    // 상담사 이름 표현식 (대시보드 route.ts와 동일)
    const consultantNameExpr = {
      $cond: [
        {
          $or: [
            { $eq: [{ $ifNull: ['$journeys.startedByName', null] }, null] },
            { $eq: ['$journeys.startedByName', ''] },
          ],
        },
        {
          $cond: [
            {
              $or: [
                { $eq: [{ $ifNull: ['$createdByName', null] }, null] },
                { $eq: ['$createdByName', ''] },
              ],
            },
            '미지정',
            '$createdByName',
          ],
        },
        '$journeys.startedByName',
      ],
    };

    const pipeline = [
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
          consultantName: consultantNameExpr,
          // 도달 여부: 현재 status + statusHistory 둘 다 확인 (대시보드와 동일)
          hasReserved: {
            $or: [
              { $in: ['$journeys.status', RESERVED_OR_ABOVE] },
              {
                $anyElementTrue: {
                  $map: {
                    input: { $ifNull: ['$journeys.statusHistory', []] },
                    as: 'h',
                    in: { $in: ['$$h.to', RESERVED_OR_ABOVE] },
                  },
                },
              },
            ],
          },
          hasVisited: {
            $or: [
              { $in: ['$journeys.status', VISITED_OR_ABOVE] },
              {
                $anyElementTrue: {
                  $map: {
                    input: { $ifNull: ['$journeys.statusHistory', []] },
                    as: 'h',
                    in: { $in: ['$$h.to', VISITED_OR_ABOVE] },
                  },
                },
              },
            ],
          },
          isPaid: { $in: ['$journeys.paymentStatus', PAID_STATUSES] },
          // 소급: 결제됐고 paidAt가 코호트 월말 이후 (그 달 인센 지급 후 들어온 결제)
          isRetroPaid: {
            $and: [
              { $in: ['$journeys.paymentStatus', PAID_STATUSES] },
              { $ne: [{ $ifNull: ['$journeys.paidAt', null] }, null] },
              { $gt: ['$journeys.paidAt', monthEnd] },
            ],
          },
        },
      },
      {
        $facet: {
          byConsultant: [
            {
              $group: {
                _id: '$consultantName',
                registered: { $sum: 1 },
                reserved: { $sum: { $cond: ['$hasReserved', 1, 0] } },
                visited: { $sum: { $cond: ['$hasVisited', 1, 0] } },
                paid: { $sum: { $cond: ['$isPaid', 1, 0] } },
                retroPaid: { $sum: { $cond: ['$isRetroPaid', 1, 0] } },
              },
            },
            { $sort: { registered: -1 } },
          ],
          retroPatients: [
            { $match: { isRetroPaid: true } },
            {
              $project: {
                _id: 0,
                consultant: '$consultantName',
                patientId: { $toString: '$_id' },
                journeyId: { $ifNull: ['$journeys.id', null] },
                name: '$name',
                phone: '$phone',
                journeyStartedAt: '$journeys.startedAt',
                paidAt: '$journeys.paidAt',
                paymentStatus: '$journeys.paymentStatus',
                amount: {
                  $ifNull: ['$journeys.actualAmount', { $ifNull: ['$journeys.estimatedAmount', 0] }],
                },
              },
            },
            { $sort: { paidAt: -1 } },
          ],
        },
      },
    ];

    const [result] = await db.collection('patients_v2').aggregate(pipeline).toArray();

    const rawConsultants = (result?.byConsultant || []) as Array<{
      _id: string;
      registered: number;
      reserved: number;
      visited: number;
      paid: number;
      retroPaid: number;
    }>;

    const consultants: ConsultantRow[] = rawConsultants.map((c) => ({
      name: c._id || '미지정',
      registered: c.registered,
      reserved: c.reserved,
      visited: c.visited,
      paid: c.paid,
      retroPaid: c.retroPaid,
      currentPaid: c.paid - c.retroPaid,
      reservationRate: rate(c.reserved, c.registered), // 예약/문의
      visitRate: rate(c.visited, c.reserved),          // 내원/예약
      paymentRate: rate(c.paid, c.visited),            // 결제/내원
      lowSample: c.registered < 5,
    }));

    const retroPatients = (result?.retroPatients || []) as RetroPatient[];

    // 합계
    const totals = consultants.reduce(
      (acc, c) => ({
        registered: acc.registered + c.registered,
        reserved: acc.reserved + c.reserved,
        visited: acc.visited + c.visited,
        paid: acc.paid + c.paid,
        retroPaid: acc.retroPaid + c.retroPaid,
      }),
      { registered: 0, reserved: 0, visited: 0, paid: 0, retroPaid: 0 }
    );

    return NextResponse.json({
      success: true,
      data: {
        month: monthParam,
        consultants,
        retroPatients,
        totals: {
          ...totals,
          currentPaid: totals.paid - totals.retroPaid,
          reservationRate: rate(totals.reserved, totals.registered),
          visitRate: rate(totals.visited, totals.reserved),
          paymentRate: rate(totals.paid, totals.visited),
        },
      },
    });
  } catch (error) {
    console.error('incentive-settlement API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch incentive settlement' },
      { status: 500 }
    );
  }
}
