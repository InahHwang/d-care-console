// src/app/api/v2/dashboard/route.ts
// V2 대시보드 API - patients_v2 전용

import { NextRequest, NextResponse } from 'next/server';

// 캐싱 방지: 항상 최신 데이터 반환 (설정 변경 즉시 반영)
export const dynamic = 'force-dynamic';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

// GET: 대시보드 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const authResult = verifyToken(request);
    if (authResult instanceof NextResponse) return authResult;

    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    // KST(UTC+9) 기준 날짜 계산 (Vercel 서버는 UTC이므로 보정 필요)
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const kstNow = new Date(Date.now() + KST_OFFSET);
    // 오늘 기준 (오늘 할 일은 월 선택과 무관하게 항상 현재 시점)
    const todayKstYear = kstNow.getUTCFullYear();
    const todayKstMonth = kstNow.getUTCMonth();
    const todayKstDate = kstNow.getUTCDate();

    // 선택된 월 (?month=YYYY-MM, 미지정 또는 미래월은 현재 월로 폴백)
    const monthParam = request.nextUrl.searchParams.get('month');
    let targetYear = todayKstYear;
    let targetMonth = todayKstMonth;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number);
      const requestedMonthTime = Date.UTC(y, m - 1, 1);
      const currentMonthTime = Date.UTC(todayKstYear, todayKstMonth, 1);
      if (requestedMonthTime <= currentMonthTime) {
        targetYear = y;
        targetMonth = m - 1;
      }
    }

    // KST 기준 오늘/내일 자정 (UTC Date로 표현) - 오늘 할 일용
    const today = new Date(Date.UTC(todayKstYear, todayKstMonth, todayKstDate) - KST_OFFSET);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // 선택된 월의 시작/끝 (KST 기준)
    const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1) - KST_OFFSET);
    const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const monthEnd = new Date(Date.UTC(targetYear, targetMonth, lastDayOfMonth, 23, 59, 59, 999) - KST_OFFSET);
    // 선택된 월의 전월 시작/끝 (KST 기준)
    const lastMonthStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1) - KST_OFFSET);
    const lastDayOfLastMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const lastMonthEnd = new Date(Date.UTC(targetYear, targetMonth - 1, lastDayOfLastMonth, 23, 59, 59, 999) - KST_OFFSET);

    // nextActionDate 비교용 ISO 문자열 (Date/String 혼재 대응)
    const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
    const todayISO = today.toISOString();
    const tomorrowISO = tomorrow.toISOString();
    const dayAfterTomorrowISO = dayAfterTomorrow.toISOString();
    // KST 날짜 문자열 (YYYY-MM-DD 형식 대응)
    const kstTodayStr = `${todayKstYear}-${String(todayKstMonth + 1).padStart(2, '0')}-${String(todayKstDate).padStart(2, '0')}`;
    const kstTmrDate = new Date(Date.UTC(todayKstYear, todayKstMonth, todayKstDate + 1));
    const kstTomorrowStr = `${kstTmrDate.getUTCFullYear()}-${String(kstTmrDate.getUTCMonth() + 1).padStart(2, '0')}-${String(kstTmrDate.getUTCDate()).padStart(2, '0')}`;

    // 여정 기준 통합 통계용 공통 파이프라인 (이번달 / 지난달 시작 여정 unwind)
    const buildJourneyPipeline = (startDate: Date, endDate: Date) => {
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();
      return [
        { $match: { clinicId, deletedAt: { $exists: false } } },
        { $unwind: '$journeys' },
        {
          $match: {
            $or: [
              { 'journeys.startedAt': { $gte: startDate, $lte: endDate } },
              { 'journeys.startedAt': { $gte: startISO, $lte: endISO } },
            ],
          },
        },
        {
          $addFields: {
            // 신환/구신환 구분: 환자 createdAt이 같은 달이면 신환
            isNewPatient: {
              $or: [
                { $and: [{ $gte: ['$createdAt', startDate] }, { $lte: ['$createdAt', endDate] }] },
                { $and: [{ $gte: ['$createdAt', startISO] }, { $lte: ['$createdAt', endISO] }] },
              ],
            },
            // 도달 단계 판정: 현재 status + statusHistory 모두 확인
            hasReserved: {
              $or: [
                { $in: ['$journeys.status', ['reserved', 'visited', 'treatmentBooked', 'treatment', 'completed', 'followup']] },
                {
                  $anyElementTrue: {
                    $map: {
                      input: { $ifNull: ['$journeys.statusHistory', []] },
                      as: 'h',
                      in: { $in: ['$$h.to', ['reserved', 'visited', 'treatmentBooked', 'treatment', 'completed', 'followup']] },
                    },
                  },
                },
              ],
            },
            hasVisited: {
              $or: [
                { $in: ['$journeys.status', ['visited', 'treatmentBooked', 'treatment', 'completed', 'followup']] },
                {
                  $anyElementTrue: {
                    $map: {
                      input: { $ifNull: ['$journeys.statusHistory', []] },
                      as: 'h',
                      in: { $in: ['$$h.to', ['visited', 'treatmentBooked', 'treatment', 'completed', 'followup']] },
                    },
                  },
                },
              ],
            },
            isPaid: { $in: ['$journeys.paymentStatus', ['partial', 'completed']] },
            // 상담사 이름: journey.startedByName 우선, 없으면 createdByName 폴백
            consultantName: {
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
            },
          },
        },
      ];
    };

    const journeyFacet = {
      total: [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            reserved: { $sum: { $cond: ['$hasReserved', 1, 0] } },
            visited: { $sum: { $cond: ['$hasVisited', 1, 0] } },
            paid: { $sum: { $cond: ['$isPaid', 1, 0] } },
            confirmedRevenue: { $sum: { $cond: ['$isPaid', { $ifNull: ['$journeys.actualAmount', 0] }, 0] } },
            paidEstimated: { $sum: { $cond: ['$isPaid', { $ifNull: ['$journeys.estimatedAmount', 0] }, 0] } },
            missedRevenue: { $sum: { $cond: ['$isPaid', 0, { $ifNull: ['$journeys.estimatedAmount', 0] }] } },
            missedCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $not: '$isPaid' },
                      { $gt: [{ $ifNull: ['$journeys.estimatedAmount', 0] }, 0] },
                    ],
                  },
                  1, 0,
                ],
              },
            },
          },
        },
      ],
      newOnly: [
        { $match: { isNewPatient: true } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            reserved: { $sum: { $cond: ['$hasReserved', 1, 0] } },
            visited: { $sum: { $cond: ['$hasVisited', 1, 0] } },
            paid: { $sum: { $cond: ['$isPaid', 1, 0] } },
            confirmedRevenue: { $sum: { $cond: ['$isPaid', { $ifNull: ['$journeys.actualAmount', 0] }, 0] } },
          },
        },
      ],
      returningOnly: [
        { $match: { isNewPatient: false } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            reserved: { $sum: { $cond: ['$hasReserved', 1, 0] } },
            visited: { $sum: { $cond: ['$hasVisited', 1, 0] } },
            paid: { $sum: { $cond: ['$isPaid', 1, 0] } },
            confirmedRevenue: { $sum: { $cond: ['$isPaid', { $ifNull: ['$journeys.actualAmount', 0] }, 0] } },
          },
        },
      ],
      byConsultant: [
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
    };

    // 병렬 쿼리 실행 (성능 최적화) - V2 전용
    const [
      todayTasksStats,
      revenueStats,
      conversionStats,
      consultantStatsRaw,
      settingsDoc,
      journeyStatsThisMonth,
      journeyStatsLastMonth,
    ] = await Promise.all([
      // 1. 오늘 할 일 통계 (patients_v2에서 집계)
      // nextActionDate가 Date 객체 또는 문자열로 저장될 수 있어 $or로 처리
      db.collection('patients_v2').aggregate([
        { $match: { clinicId, deletedAt: { $exists: false } } },
        {
          $facet: {
            // 경과된 환자 (nextActionDate < today)
            overdue: [
              {
                $match: {
                  $or: [
                    { nextActionDate: { $lt: today, $type: 'date' } },
                    { nextActionDate: { $lt: todayISO, $type: 'string' } },
                  ],
                  status: { $nin: ['closed', 'completed'] }
                }
              },
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 }
                }
              }
            ],
            // 오늘 예정 환자
            todayScheduled: [
              {
                $match: {
                  $or: [
                    { nextActionDate: { $gte: today, $lt: tomorrow } },
                    { nextActionDate: { $gte: todayISO, $lt: tomorrowISO, $type: 'string' } },
                    { nextActionDate: { $regex: `^${kstTodayStr}` } },
                  ],
                  status: { $nin: ['closed', 'completed'] }
                }
              },
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 }
                }
              }
            ],
            // 내일 예정 환자
            tomorrowScheduled: [
              {
                $match: {
                  $or: [
                    { nextActionDate: { $gte: tomorrow, $lt: dayAfterTomorrow } },
                    { nextActionDate: { $gte: tomorrowISO, $lt: dayAfterTomorrowISO, $type: 'string' } },
                    { nextActionDate: { $regex: `^${kstTomorrowStr}` } },
                  ],
                  status: { $nin: ['closed', 'completed'] }
                }
              },
              { $count: 'count' }
            ]
          }
        }
      ]).toArray(),

      // 2. 매출 통계 (patients_v2에서 집계)
      db.collection('patients_v2').aggregate([
        { $match: { clinicId, deletedAt: { $exists: false } } },
        {
          $facet: {
            // 이번 달 매출
            thisMonth: [
              {
                $match: {
                  createdAt: { $gte: monthStart, $lte: monthEnd }
                }
              },
              {
                $group: {
                  _id: null,
                  // 확정 매출: 결제 환자(partial/completed)의 actualAmount 합
                  confirmedRevenue: {
                    $sum: {
                      $cond: [{ $in: ['$paymentStatus', ['partial', 'completed']] }, { $ifNull: ['$actualAmount', 0] }, 0]
                    }
                  },
                  // 놓친 매출: 미결제 환자의 estimatedAmount 합
                  missedRevenue: {
                    $sum: {
                      $cond: [{ $in: ['$paymentStatus', ['partial', 'completed']] }, 0, { $ifNull: ['$estimatedAmount', 0] }]
                    }
                  },
                  // 놓친 매출 환자 수 (estimatedAmount > 0인 미결제 환자)
                  missedCount: {
                    $sum: {
                      $cond: [
                        { $and: [
                          { $not: [{ $in: ['$paymentStatus', ['partial', 'completed']] }] },
                          { $gt: [{ $ifNull: ['$estimatedAmount', 0] }, 0] }
                        ]},
                        1, 0
                      ]
                    }
                  },
                  // 결제 환자의 정가 합 (할인율 계산용)
                  paidEstimated: {
                    $sum: {
                      $cond: [{ $in: ['$paymentStatus', ['partial', 'completed']] }, { $ifNull: ['$estimatedAmount', 0] }, 0]
                    }
                  },
                  patientCount: { $sum: 1 },
                  paidCount: {
                    $sum: {
                      $cond: [{ $in: ['$paymentStatus', ['partial', 'completed']] }, 1, 0]
                    }
                  }
                }
              }
            ],
            // 지난 달 매출
            lastMonth: [
              {
                $match: {
                  createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
                }
              },
              {
                $group: {
                  _id: null,
                  // 지난 달 확정 매출
                  confirmedRevenue: {
                    $sum: {
                      $cond: [{ $in: ['$paymentStatus', ['partial', 'completed']] }, { $ifNull: ['$actualAmount', 0] }, 0]
                    }
                  },
                  patientCount: { $sum: 1 }
                }
              }
            ]
          }
        }
      ]).toArray(),

      // 3. 전환율 통계 (patients_v2에서 집계)
      db.collection('patients_v2').aggregate([
        { $match: { clinicId, deletedAt: { $exists: false } } },
        {
          $facet: {
            // 이번 달 신규 등록 (전체)
            thisMonthTotal: [
              {
                $match: {
                  createdAt: { $gte: monthStart, $lte: monthEnd }
                }
              },
              { $count: 'count' }
            ],
            // 이번 달 예약전환 (reserved 이상 상태)
            thisMonthReserved: [
              {
                $match: {
                  createdAt: { $gte: monthStart, $lte: monthEnd },
                  status: { $in: ['reserved', 'visited', 'treatmentBooked', 'treatment', 'completed', 'followup'] }
                }
              },
              { $count: 'count' }
            ],
            // 이번 달 내원전환 (visited 이상 상태)
            thisMonthVisited: [
              {
                $match: {
                  createdAt: { $gte: monthStart, $lte: monthEnd },
                  status: { $in: ['visited', 'treatmentBooked', 'treatment', 'completed', 'followup'] }
                }
              },
              { $count: 'count' }
            ],
            // 이번 달 결제전환 (actualAmount > 0 또는 paymentStatus가 partial/completed)
            thisMonthPaid: [
              {
                $match: {
                  createdAt: { $gte: monthStart, $lte: monthEnd },
                  paymentStatus: { $in: ['partial', 'completed'] }
                }
              },
              { $count: 'count' }
            ],
            // 지난 달 신규 등록
            lastMonthTotal: [
              {
                $match: {
                  createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
                }
              },
              { $count: 'count' }
            ],
            // 지난 달 예약전환
            lastMonthReserved: [
              {
                $match: {
                  createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
                  status: { $in: ['reserved', 'visited', 'treatmentBooked', 'treatment', 'completed', 'followup'] }
                }
              },
              { $count: 'count' }
            ],
            // 지난 달 내원전환
            lastMonthVisited: [
              {
                $match: {
                  createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
                  status: { $in: ['visited', 'treatmentBooked', 'treatment', 'completed', 'followup'] }
                }
              },
              { $count: 'count' }
            ],
            // 지난 달 결제전환
            lastMonthPaid: [
              {
                $match: {
                  createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
                  paymentStatus: { $in: ['partial', 'completed'] }
                }
              },
              { $count: 'count' }
            ]
          }
        }
      ]).toArray(),

      // 4. 상담사별 실적 집계 (이번 달 등록자 기준)
      db.collection('patients_v2').aggregate([
        {
          $match: {
            clinicId,
            deletedAt: { $exists: false },
            createdAt: { $gte: monthStart, $lte: monthEnd }
          }
        },
        {
          $group: {
            _id: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $ifNull: ['$createdByName', null] }, null] },
                    { $eq: ['$createdByName', ''] }
                  ]
                },
                '미지정',
                '$createdByName'
              ]
            },
            registered: { $sum: 1 },
            reserved: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['reserved', 'visited', 'treatmentBooked', 'treatment', 'completed', 'followup']] },
                  1, 0
                ]
              }
            },
            visited: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['visited', 'treatmentBooked', 'treatment', 'completed', 'followup']] },
                  1, 0
                ]
              }
            },
            paid: {
              $sum: {
                $cond: [
                  { $in: ['$paymentStatus', ['partial', 'completed']] },
                  1, 0
                ]
              }
            }
          }
        },
        { $sort: { registered: -1 } }
      ]).toArray(),

      // 5. 설정에서 목표매출 조회
      db.collection('settings_v2').findOne({ clinicId }),

      // 6. 이번달 시작 여정 기준 통합 통계 (신환+구신환 합산 + breakdown)
      db.collection('patients_v2').aggregate([
        ...buildJourneyPipeline(monthStart, monthEnd),
        { $facet: journeyFacet },
      ]).toArray(),

      // 7. 지난달 시작 여정 기준 통계 (전월 대비 트렌드용)
      db.collection('patients_v2').aggregate([
        ...buildJourneyPipeline(lastMonthStart, lastMonthEnd),
        { $facet: { total: journeyFacet.total } },
      ]).toArray(),
    ]);

    // 목표매출 (만원 → 원 변환)
    const monthlyRevenueTarget = (settingsDoc?.targets?.monthlyRevenue || 0) * 10000;

    // 오늘 할 일 통계 가공
    const todayTasksData = todayTasksStats[0] || {};
    const overdueByStatus: Record<string, number> = {};
    const todayByStatus: Record<string, number> = {};

    (todayTasksData.overdue || []).forEach((item: any) => {
      overdueByStatus[item._id] = item.count;
    });
    (todayTasksData.todayScheduled || []).forEach((item: any) => {
      todayByStatus[item._id] = item.count;
    });

    // 개별 항목 계산
    const overdueCallback = (overdueByStatus['consulting'] || 0) + (overdueByStatus['visited'] || 0);
    const overdueNoShow = overdueByStatus['reserved'] || 0;
    const overdueTreatmentNoShow = overdueByStatus['treatmentBooked'] || 0;

    const todayCallback = (todayByStatus['consulting'] || 0) + (todayByStatus['visited'] || 0);
    const todayAppointment = todayByStatus['reserved'] || 0;
    const todayTreatment = todayByStatus['treatmentBooked'] || 0;

    const todayTasks = {
      overdue: {
        callback: overdueCallback,
        noShow: overdueNoShow,
        treatmentNoShow: overdueTreatmentNoShow,
        total: overdueCallback + overdueNoShow + overdueTreatmentNoShow,
      },
      today: {
        callback: todayCallback,
        appointment: todayAppointment,
        treatment: todayTreatment,
        total: todayCallback + todayAppointment + todayTreatment,
      },
      tomorrow: {
        total: todayTasksData.tomorrowScheduled?.[0]?.count || 0,
      },
    };

    // 매출 통계 가공
    const revenueData = revenueStats[0] || {};
    const thisMonthRevenue = revenueData.thisMonth?.[0] || {};
    const lastMonthRevenue = revenueData.lastMonth?.[0] || {};

    const thisMonthConfirmed = thisMonthRevenue.confirmedRevenue || 0;
    const thisMonthMissed = thisMonthRevenue.missedRevenue || 0;
    const thisMonthMissedCount = thisMonthRevenue.missedCount || 0;
    const thisMonthPaidEstimated = thisMonthRevenue.paidEstimated || 0;
    const thisMonthPatients = thisMonthRevenue.patientCount || 0;
    const thisMonthPaidCount = thisMonthRevenue.paidCount || 0;
    const lastMonthConfirmed = lastMonthRevenue.confirmedRevenue || 0;

    // 할인율: 결제 환자의 정가 대비 최종금액 비율
    const discountRate = thisMonthPaidEstimated > 0
      ? Math.round((1 - thisMonthConfirmed / thisMonthPaidEstimated) * 100)
      : 0;

    // ============================================
    // 여정 기준 통합 통계 (이번달 시작 여정)
    // - 메인 카드: 통합 (신환+구신환 합산)
    // - 보조 라인: 신환/구신환 breakdown
    // - 상담사별: journey.startedByName 기준
    // ============================================
    const jStatsThisMonth = (journeyStatsThisMonth[0] || {}) as {
      total?: Array<{ count: number; reserved: number; visited: number; paid: number; confirmedRevenue: number; paidEstimated: number; missedRevenue: number; missedCount: number }>;
      newOnly?: Array<{ count: number; reserved: number; visited: number; paid: number; confirmedRevenue: number }>;
      returningOnly?: Array<{ count: number; reserved: number; visited: number; paid: number; confirmedRevenue: number }>;
      byConsultant?: Array<{ _id: string; registered: number; reserved: number; visited: number; paid: number }>;
    };
    const jStatsLastMonth = (journeyStatsLastMonth[0] || {}) as {
      total?: Array<{ count: number; reserved: number; visited: number; paid: number; confirmedRevenue: number }>;
    };

    const jTotal = jStatsThisMonth.total?.[0] || { count: 0, reserved: 0, visited: 0, paid: 0, confirmedRevenue: 0, paidEstimated: 0, missedRevenue: 0, missedCount: 0 };
    const jNew = jStatsThisMonth.newOnly?.[0] || { count: 0, reserved: 0, visited: 0, paid: 0, confirmedRevenue: 0 };
    const jReturning = jStatsThisMonth.returningOnly?.[0] || { count: 0, reserved: 0, visited: 0, paid: 0, confirmedRevenue: 0 };
    const jLastTotal = jStatsLastMonth.total?.[0] || { count: 0, reserved: 0, visited: 0, paid: 0, confirmedRevenue: 0 };

    // 매출 (통합 = 이번달 시작 여정 중 결제된 여정의 actualAmount 합)
    const thisMonthConfirmedJ = jTotal.confirmedRevenue;
    const thisMonthMissedJ = jTotal.missedRevenue;
    const thisMonthMissedCountJ = jTotal.missedCount;
    const thisMonthPaidEstimatedJ = jTotal.paidEstimated;
    const lastMonthConfirmedJ = jLastTotal.confirmedRevenue;

    // 할인율: 결제 여정의 정가 대비 최종금액
    const discountRateJ = thisMonthPaidEstimatedJ > 0
      ? Math.round((1 - thisMonthConfirmedJ / thisMonthPaidEstimatedJ) * 100)
      : 0;
    // 평균 객단가: 확정매출 / 결제 여정 수
    const avgRevenueJ = jTotal.paid > 0 ? Math.round(thisMonthConfirmedJ / jTotal.paid) : 0;
    // 성장률: 이번달 확정매출 vs 지난달 확정매출
    const growthRateJ = lastMonthConfirmedJ > 0
      ? Math.round(((thisMonthConfirmedJ - lastMonthConfirmedJ) / lastMonthConfirmedJ) * 100)
      : (thisMonthConfirmedJ > 0 ? 100 : 0);

    // 전환율 (통합 기준)
    const thisMonthTotal = jTotal.count;
    const thisMonthReserved = jTotal.reserved;
    const thisMonthVisited = jTotal.visited;
    const thisMonthPaid = jTotal.paid;
    const lastMonthTotal = jLastTotal.count;
    const lastMonthReserved = jLastTotal.reserved;
    const lastMonthVisited = jLastTotal.visited;
    const lastMonthPaid = jLastTotal.paid;

    const reservationRate = thisMonthTotal > 0 ? Math.round((thisMonthReserved / thisMonthTotal) * 100) : 0;
    const visitRate = thisMonthTotal > 0 ? Math.round((thisMonthVisited / thisMonthTotal) * 100) : 0;
    const paymentRate = thisMonthVisited > 0 ? Math.round((thisMonthPaid / thisMonthVisited) * 100) : 0;

    const lastReservationRate = lastMonthTotal > 0 ? Math.round((lastMonthReserved / lastMonthTotal) * 100) : 0;
    const lastVisitRate = lastMonthTotal > 0 ? Math.round((lastMonthVisited / lastMonthTotal) * 100) : 0;
    const lastPaymentRate = lastMonthVisited > 0 ? Math.round((lastMonthPaid / lastMonthVisited) * 100) : 0;

    const reservationRateTrend = reservationRate - lastReservationRate;
    const visitRateTrend = visitRate - lastVisitRate;
    const paymentRateTrend = paymentRate - lastPaymentRate;
    const inquiryTrend = thisMonthTotal - lastMonthTotal;

    // 상담사별 실적 (여정 시작자 기준, 통합)
    const consultantStats = (jStatsThisMonth.byConsultant || []).map(row => ({
      name: row._id || '미지정',
      registered: row.registered,
      contributionRate: thisMonthTotal > 0 ? Math.round((row.registered / thisMonthTotal) * 100) : 0,
      reserved: row.reserved,
      reservationRate: row.registered > 0 ? Math.round((row.reserved / row.registered) * 100) : 0,
      visited: row.visited,
      visitRate: row.registered > 0 ? Math.round((row.visited / row.registered) * 100) : 0,
      paid: row.paid,
      // 결제달성률은 '이번달 성과' 결제전환율과 동일하게 내원(visited) 대비로 계산 (등록 대비 아님)
      paymentRate: row.visited > 0 ? Math.round((row.paid / row.visited) * 100) : 0,
      lowSample: row.registered < 5,
    }));

    // 기존 환자 createdAt 기준 변수는 응답에서 사용하지 않음 (unused 경고 회피)
    void thisMonthConfirmed; void thisMonthMissed; void thisMonthMissedCount; void thisMonthPatients;
    void thisMonthPaidCount; void lastMonthConfirmed; void discountRate; void consultantStatsRaw;

    return NextResponse.json({
      success: true,
      data: {
        // 전환율 통계 (통합 = 이번달 시작된 여정 기준)
        conversionRates: {
          newInquiries: {
            count: thisMonthTotal,
            trend: inquiryTrend,
          },
          reservationRate: {
            value: reservationRate,
            trend: reservationRateTrend,
            count: thisMonthReserved,
          },
          visitRate: {
            value: visitRate,
            trend: visitRateTrend,
            count: thisMonthVisited,
          },
          paymentRate: {
            value: paymentRate,
            trend: paymentRateTrend,
            count: thisMonthPaid,
          },
          // 신환/구신환 breakdown (하단 보조 라인 표시용)
          breakdown: {
            newPatient: {
              count: jNew.count,
              reserved: jNew.reserved,
              visited: jNew.visited,
              paid: jNew.paid,
              revenue: jNew.confirmedRevenue,
            },
            returningPatient: {
              count: jReturning.count,
              reserved: jReturning.reserved,
              visited: jReturning.visited,
              paid: jReturning.paid,
              revenue: jReturning.confirmedRevenue,
            },
          },
        },
        // 상담사별 실적 (여정 시작자 기준)
        consultantStats,
        // 오늘 할 일 통계
        todayTasks,
        // 매출 통계 (통합 = 이번달 시작 여정 중 결제된 여정 합산)
        revenue: {
          thisMonth: {
            confirmed: thisMonthConfirmedJ,
            missed: thisMonthMissedJ,
            missedCount: thisMonthMissedCountJ,
            patientCount: thisMonthTotal,
            paidCount: thisMonthPaid,
          },
          lastMonth: {
            confirmed: lastMonthConfirmedJ,
          },
          discountRate: discountRateJ,
          avgRevenue: avgRevenueJ,
          growthRate: growthRateJ,
          monthlyTarget: monthlyRevenueTarget,
          // 구신환 기여 (하단 보조 라인 표시용)
          returningContribution: jReturning.confirmedRevenue,
        },
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
