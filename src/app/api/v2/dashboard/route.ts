// src/app/api/v2/dashboard/route.ts
// V2 대시보드 API - patients_v2 전용

import { NextRequest, NextResponse } from 'next/server';

// 캐싱 방지: 항상 최신 데이터 반환 (설정 변경 즉시 반영)
export const dynamic = 'force-dynamic';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

// GET: 대시보드 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { db } = await connectToDatabase();

    // KST(UTC+9) 기준 날짜 계산 (Vercel 서버는 UTC이므로 보정 필요)
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const kstNow = new Date(Date.now() + KST_OFFSET);
    const kstYear = kstNow.getUTCFullYear();
    const kstMonth = kstNow.getUTCMonth();
    const kstDate = kstNow.getUTCDate();

    // KST 기준 오늘/내일 자정 (UTC Date로 표현)
    const today = new Date(Date.UTC(kstYear, kstMonth, kstDate) - KST_OFFSET);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // 이번 달 시작/끝 (KST 기준)
    const monthStart = new Date(Date.UTC(kstYear, kstMonth, 1) - KST_OFFSET);
    const lastDayOfMonth = new Date(Date.UTC(kstYear, kstMonth + 1, 0)).getUTCDate();
    const monthEnd = new Date(Date.UTC(kstYear, kstMonth, lastDayOfMonth, 23, 59, 59, 999) - KST_OFFSET);
    // 지난 달 시작/끝 (KST 기준)
    const lastMonthStart = new Date(Date.UTC(kstYear, kstMonth - 1, 1) - KST_OFFSET);
    const lastDayOfLastMonth = new Date(Date.UTC(kstYear, kstMonth, 0)).getUTCDate();
    const lastMonthEnd = new Date(Date.UTC(kstYear, kstMonth - 1, lastDayOfLastMonth, 23, 59, 59, 999) - KST_OFFSET);

    // nextActionDate 비교용 ISO 문자열 (Date/String 혼재 대응)
    const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
    const todayISO = today.toISOString();
    const tomorrowISO = tomorrow.toISOString();
    const dayAfterTomorrowISO = dayAfterTomorrow.toISOString();
    // KST 날짜 문자열 (YYYY-MM-DD 형식 대응)
    const kstTodayStr = `${kstYear}-${String(kstMonth + 1).padStart(2, '0')}-${String(kstDate).padStart(2, '0')}`;
    const kstTmrDate = new Date(Date.UTC(kstYear, kstMonth, kstDate + 1));
    const kstTomorrowStr = `${kstTmrDate.getUTCFullYear()}-${String(kstTmrDate.getUTCMonth() + 1).padStart(2, '0')}-${String(kstTmrDate.getUTCDate()).padStart(2, '0')}`;

    // 병렬 쿼리 실행 (성능 최적화) - V2 전용
    const [
      todayTasksStats,
      revenueStats,
      conversionStats,
      settingsDoc
    ] = await Promise.all([
      // 1. 오늘 할 일 통계 (patients_v2에서 집계)
      // nextActionDate가 Date 객체 또는 문자열로 저장될 수 있어 $or로 처리
      db.collection('patients_v2').aggregate([
        { $match: { clinicId } },
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
        { $match: { clinicId } },
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
        { $match: { clinicId } },
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

      // 4. 설정에서 목표매출 조회
      db.collection('settings_v2').findOne({ clinicId }),
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

    // 할인율: 결제 환자의 정가 대비 실결제 비율
    const discountRate = thisMonthPaidEstimated > 0
      ? Math.round((1 - thisMonthConfirmed / thisMonthPaidEstimated) * 100)
      : 0;

    // 평균 객단가: 확정매출 / 결제 환자 수
    const avgRevenue = thisMonthPaidCount > 0
      ? Math.round(thisMonthConfirmed / thisMonthPaidCount)
      : 0;

    // 성장률: 이번달 확정매출 vs 지난달 확정매출
    const growthRate = lastMonthConfirmed > 0
      ? Math.round(((thisMonthConfirmed - lastMonthConfirmed) / lastMonthConfirmed) * 100)
      : (thisMonthConfirmed > 0 ? 100 : 0);

    // 전환율 통계 가공
    const conversionData = conversionStats[0] || {};

    // 이번 달 수치
    const thisMonthTotal = conversionData.thisMonthTotal?.[0]?.count || 0;
    const thisMonthReserved = conversionData.thisMonthReserved?.[0]?.count || 0;
    const thisMonthVisited = conversionData.thisMonthVisited?.[0]?.count || 0;
    const thisMonthPaid = conversionData.thisMonthPaid?.[0]?.count || 0;

    // 지난 달 수치
    const lastMonthTotal = conversionData.lastMonthTotal?.[0]?.count || 0;
    const lastMonthReserved = conversionData.lastMonthReserved?.[0]?.count || 0;
    const lastMonthVisited = conversionData.lastMonthVisited?.[0]?.count || 0;
    const lastMonthPaid = conversionData.lastMonthPaid?.[0]?.count || 0;

    // 전환율 계산 (%)
    const reservationRate = thisMonthTotal > 0 ? Math.round((thisMonthReserved / thisMonthTotal) * 100) : 0;
    const visitRate = thisMonthTotal > 0 ? Math.round((thisMonthVisited / thisMonthTotal) * 100) : 0;
    const paymentRate = thisMonthTotal > 0 ? Math.round((thisMonthPaid / thisMonthTotal) * 100) : 0;

    // 지난 달 전환율
    const lastReservationRate = lastMonthTotal > 0 ? Math.round((lastMonthReserved / lastMonthTotal) * 100) : 0;
    const lastVisitRate = lastMonthTotal > 0 ? Math.round((lastMonthVisited / lastMonthTotal) * 100) : 0;
    const lastPaymentRate = lastMonthTotal > 0 ? Math.round((lastMonthPaid / lastMonthTotal) * 100) : 0;

    // 전월 대비 트렌드 (%p)
    const reservationRateTrend = reservationRate - lastReservationRate;
    const visitRateTrend = visitRate - lastVisitRate;
    const paymentRateTrend = paymentRate - lastPaymentRate;
    const inquiryTrend = thisMonthTotal - lastMonthTotal;

    return NextResponse.json({
      success: true,
      data: {
        // 전환율 통계 (신규)
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
        },
        // 오늘 할 일 통계
        todayTasks,
        // 매출 통계
        revenue: {
          thisMonth: {
            confirmed: thisMonthConfirmed,
            missed: thisMonthMissed,
            missedCount: thisMonthMissedCount,
            patientCount: thisMonthPatients,
            paidCount: thisMonthPaidCount,
          },
          lastMonth: {
            confirmed: lastMonthConfirmed,
          },
          discountRate,
          avgRevenue,
          growthRate,
          monthlyTarget: monthlyRevenueTarget,
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
