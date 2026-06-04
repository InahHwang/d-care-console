// src/app/api/v2/dashboard/incentive-settlement/route.ts
// 인센티브 정산용 직원별 퍼널 전환율 + 결제월 기준 소급 명단
//
// 모델 (2026-06 확정):
// - 퍼널 전환율(예약/내원/결제): 여정 startedAt 코호트(=내원월) 기준. 비율은 코호트 유지(메모 방식 B)
// - 소급(retro): "결제(paidAt)가 이 달에 찍혔는데, 여정 시작(내원)은 이전 달(6개월 이내)" 인 건
//   → 인센은 결제된 달에 지급하므로, 늦은 결제는 '결제된 달' 화면에 별도 소급으로 표시
//   → 원래 여정 담당자(startedByName)에게 크레딧, 출처(내원)월 함께 표시
// - 6개월 초과 시차는 소급 제외 (사실상 새 결정으로 봄)
//
// 상담사 귀속: journeys.startedByName 우선, 없으면 createdByName (대시보드 route.ts와 동일)
// 주의: paidAt은 2026-06-04 도입 이후 결제건만 존재 → 그 이전 결제는 소급 판별 불가

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const RESERVED_OR_ABOVE = ['reserved', 'visited', 'treatmentBooked', 'treatment', 'completed', 'followup'];
const VISITED_OR_ABOVE = ['visited', 'treatmentBooked', 'treatment', 'completed', 'followup'];
const PAID_STATUSES = ['partial', 'completed'];
const RETRO_LOOKBACK_MONTHS = 6; // 소급 인정 기간: 내원~결제 시차 6개월 이내

interface ConsultantRow {
  name: string;
  registered: number;      // M월 코호트 여정 시작 수 (퍼널 1단계 = 문의)
  reserved: number;
  visited: number;
  paid: number;
  reservationRate: number; // 예약/문의
  visitRate: number;       // 내원/예약
  paymentRate: number;     // 결제/내원
  retroCount: number;      // 이번 달 소급 건수 (지난달 내원 → 이번달 결제, 이 담당자 크레딧)
  lowSample: boolean;
}

interface RetroPatient {
  consultant: string;
  patientId: string;
  journeyId: string | null;
  name: string;
  phone: string;
  journeyStartedAt: string | Date; // 내원(여정 시작) 시점 = 출처
  paidAt: string | Date | null;    // 결제 시점 (이번 달)
  paymentStatus: string;
  amount: number;
}

function rate(numer: number, denom: number) {
  return denom > 0 ? Math.round((numer / denom) * 100) : 0;
}

function monthKey(d: string | Date | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`;
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
    // 소급 인정 하한: M월 시작에서 6개월 전 달의 시작
    const retroFloor = new Date(Date.UTC(y, m - 1 - RETRO_LOOKBACK_MONTHS, 1) - KST_OFFSET);

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
        $addFields: {
          consultantName: consultantNameExpr,
          // startedAt이 Date/문자열 혼재 → Date로 정규화 (없으면 createdAt 폴백)
          startedAtDate: { $toDate: { $ifNull: ['$journeys.startedAt', '$createdAt'] } },
          isPaid: { $in: ['$journeys.paymentStatus', PAID_STATUSES] },
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
        },
      },
      {
        $facet: {
          // 퍼널: M월 코호트(내원월) 기준
          funnel: [
            { $match: { startedAtDate: { $gte: monthStart, $lte: monthEnd } } },
            {
              $group: {
                _id: '$consultantName',
                registered: { $sum: 1 },
                reserved: { $sum: { $cond: ['$hasReserved', 1, 0] } },
                visited: { $sum: { $cond: ['$hasVisited', 1, 0] } },
                paid: { $sum: { $cond: ['$isPaid', 1, 0] } },
              },
            },
            { $sort: { registered: -1 } },
          ],
          // 소급: 결제(paidAt)가 M월 + 내원(startedAt)은 M월 이전 6개월 이내
          retro: [
            {
              $match: {
                'journeys.paymentStatus': { $in: PAID_STATUSES },
                'journeys.paidAt': { $gte: monthStart, $lte: monthEnd },
                startedAtDate: { $gte: retroFloor, $lt: monthStart },
              },
            },
            {
              $project: {
                _id: 0,
                consultant: '$consultantName',
                patientId: { $toString: '$_id' },
                journeyId: { $ifNull: ['$journeys.id', null] },
                name: '$name',
                phone: '$phone',
                journeyStartedAt: '$startedAtDate',
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

    const rawFunnel = (result?.funnel || []) as Array<{
      _id: string; registered: number; reserved: number; visited: number; paid: number;
    }>;
    const retroPatients = (result?.retro || []) as RetroPatient[];

    // 소급 건수: 상담사별 집계
    const retroCountByConsultant: Record<string, number> = {};
    for (const r of retroPatients) {
      const key = r.consultant || '미지정';
      retroCountByConsultant[key] = (retroCountByConsultant[key] || 0) + 1;
    }

    // 퍼널 코호트 ∪ 소급 담당자 = 표시 대상 상담사
    const byName = new Map<string, ConsultantRow>();
    for (const c of rawFunnel) {
      const name = c._id || '미지정';
      byName.set(name, {
        name,
        registered: c.registered,
        reserved: c.reserved,
        visited: c.visited,
        paid: c.paid,
        reservationRate: rate(c.reserved, c.registered),
        visitRate: rate(c.visited, c.reserved),
        paymentRate: rate(c.paid, c.visited),
        retroCount: 0,
        lowSample: c.registered < 5,
      });
    }
    for (const [name, cnt] of Object.entries(retroCountByConsultant)) {
      const existing = byName.get(name);
      if (existing) {
        existing.retroCount = cnt;
      } else {
        // 이번 달 코호트는 없지만 소급만 있는 상담사도 표시
        byName.set(name, {
          name, registered: 0, reserved: 0, visited: 0, paid: 0,
          reservationRate: 0, visitRate: 0, paymentRate: 0,
          retroCount: cnt, lowSample: true,
        });
      }
    }

    const consultants = Array.from(byName.values()).sort(
      (a, b) => b.registered - a.registered || b.retroCount - a.retroCount
    );

    const totals = consultants.reduce(
      (acc, c) => ({
        registered: acc.registered + c.registered,
        reserved: acc.reserved + c.reserved,
        visited: acc.visited + c.visited,
        paid: acc.paid + c.paid,
        retroCount: acc.retroCount + c.retroCount,
      }),
      { registered: 0, reserved: 0, visited: 0, paid: 0, retroCount: 0 }
    );

    // 소급 명단에 출처(내원)월 라벨 부여
    const retroPatientsOut = retroPatients.map((r) => ({
      ...r,
      originMonth: monthKey(r.journeyStartedAt),
    }));

    return NextResponse.json({
      success: true,
      data: {
        month: monthParam,
        consultants,
        retroPatients: retroPatientsOut,
        totals: {
          ...totals,
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
