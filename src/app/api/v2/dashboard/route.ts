// src/app/api/v2/dashboard/route.ts
// CatchAll v2 대시보드 API - 성능 최적화

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

// GET: 대시보드 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 날짜 계산
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // 이번 달 시작/끝
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    // 지난 달 시작/끝
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    // 병렬 쿼리 실행 (성능 최적화)
    const [
      callStats,
      yesterdayCallStats,
      patientStatusCounts,
      alertPatients,
      todayCallbacks,
      recentPatients,
      analysisQueue,
      todayTasksStats,
      revenueStats
    ] = await Promise.all([
      // 1. 오늘의 통화 통계 (callLogs_v2 사용)
      db.collection('callLogs_v2').aggregate([
        {
          $match: {
            startedAt: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byDirection: [
              { $group: { _id: '$direction', count: { $sum: 1 } } }
            ],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } }
            ],
            newPatients: [
              { $match: { 'aiAnalysis.classification': '신환' } },
              { $count: 'count' }
            ]
          }
        }
      ]).toArray(),

      // 1-2. 어제의 통화 통계 (트렌드 계산용)
      db.collection('callLogs_v2').aggregate([
        {
          $match: {
            startedAt: { $gte: yesterday, $lt: today }
          }
        },
        {
          $facet: {
            total: [{ $count: 'count' }],
            newPatients: [
              { $match: { 'aiAnalysis.classification': '신환' } },
              { $count: 'count' }
            ]
          }
        }
      ]).toArray(),

      // 2. 환자 상태별 카운트
      db.collection('patients').aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray(),

      // 3. 주의 필요 환자 (병렬)
      Promise.all([
        // 내원완료 7일+ (치료 미결정)
        db.collection('patients').find({
          status: 'visited',
          visitConfirmedAt: { $lte: sevenDaysAgo }
        }, { projection: { name: 1 } }).limit(10).toArray(),

        // 전화상담 14일+ (장기 미진행)
        db.collection('patients').find({
          status: { $in: ['active', 'consulting'] },
          createdAt: { $lte: fourteenDaysAgo },
          visitConfirmed: { $ne: true }
        }, { projection: { name: 1 } }).limit(10).toArray(),

        // 예약 후 노쇼 위험 (예약일 지남)
        db.collection('patients').find({
          status: 'reserved',
          'appointmentDate': { $lt: today },
          visitConfirmed: { $ne: true }
        }, { projection: { name: 1 } }).limit(10).toArray(),
      ]),

      // 4. 오늘의 콜백
      db.collection('patients').aggregate([
        {
          $match: {
            'callbacks': {
              $elemMatch: {
                scheduledDate: { $gte: today, $lt: tomorrow },
                status: 'pending'
              }
            }
          }
        },
        { $limit: 10 },
        {
          $project: {
            name: 1,
            phoneNumber: 1,
            interestedServices: 1,
            temperature: 1, // 실제 온도 값
            callbacks: {
              $filter: {
                input: '$callbacks',
                as: 'cb',
                cond: {
                  $and: [
                    { $gte: ['$$cb.scheduledDate', today] },
                    { $lt: ['$$cb.scheduledDate', tomorrow] },
                    { $eq: ['$$cb.status', 'pending'] }
                  ]
                }
              }
            }
          }
        }
      ]).toArray(),

      // 5. 최근 등록 환자 (오늘)
      db.collection('patients')
        .find({ createdAt: { $gte: today } })
        .sort({ createdAt: -1 })
        .limit(5)
        .project({ name: 1, interestedServices: 1, createdAt: 1, source: 1, temperature: 1, aiRegistered: 1 })
        .toArray(),

      // 6. AI 분석 대기열 (callLogs_v2 사용)
      db.collection('callLogs_v2')
        .find({
          startedAt: { $gte: today },
          aiStatus: { $in: ['pending', 'processing'] }
        })
        .sort({ startedAt: -1 })
        .limit(5)
        .project({ phone: 1, startedAt: 1, direction: 1 })
        .toArray(),

      // 7. 오늘 할 일 통계 (patients_v2에서 집계)
      db.collection('patients_v2').aggregate([
        {
          $facet: {
            // 경과된 환자 (nextActionDate < today)
            overdue: [
              {
                $match: {
                  nextActionDate: { $lt: today },
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
                  nextActionDate: { $gte: today, $lt: tomorrow },
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
                  nextActionDate: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) },
                  status: { $nin: ['closed', 'completed'] }
                }
              },
              { $count: 'count' }
            ]
          }
        }
      ]).toArray(),

      // 8. 매출 통계 (patients_v2에서 집계)
      db.collection('patients_v2').aggregate([
        {
          $facet: {
            // 이번 달 매출
            thisMonth: [
              {
                $match: {
                  createdAt: { $gte: monthStart, $lte: monthEnd },
                  status: { $ne: 'closed' }
                }
              },
              {
                $group: {
                  _id: null,
                  totalEstimated: { $sum: { $ifNull: ['$estimatedAmount', 0] } },
                  totalActual: { $sum: { $ifNull: ['$actualAmount', 0] } },
                  patientCount: { $sum: 1 },
                  paidCount: {
                    $sum: {
                      $cond: [{ $gt: ['$actualAmount', 0] }, 1, 0]
                    }
                  }
                }
              }
            ],
            // 지난 달 매출
            lastMonth: [
              {
                $match: {
                  createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
                  status: { $ne: 'closed' }
                }
              },
              {
                $group: {
                  _id: null,
                  totalActual: { $sum: { $ifNull: ['$actualAmount', 0] } },
                  patientCount: { $sum: 1 }
                }
              }
            ],
            // 전체 매출 (종결 제외)
            total: [
              {
                $match: {
                  status: { $ne: 'closed' }
                }
              },
              {
                $group: {
                  _id: null,
                  totalEstimated: { $sum: { $ifNull: ['$estimatedAmount', 0] } },
                  totalActual: { $sum: { $ifNull: ['$actualAmount', 0] } },
                  patientCount: { $sum: 1 },
                  paidCount: {
                    $sum: {
                      $cond: [{ $gt: ['$actualAmount', 0] }, 1, 0]
                    }
                  }
                }
              }
            ]
          }
        }
      ]).toArray(),
    ]);

    // 데이터 가공
    const callStatsData = callStats[0] || {};
    const totalCalls = callStatsData.total?.[0]?.count || 0;
    const newPatients = callStatsData.newPatients?.[0]?.count || 0;

    // 어제 통화 통계 가공 (트렌드 계산용)
    const yesterdayCallStatsData = yesterdayCallStats[0] || {};
    const yesterdayTotalCalls = yesterdayCallStatsData.total?.[0]?.count || 0;
    const yesterdayNewPatients = yesterdayCallStatsData.newPatients?.[0]?.count || 0;

    // 상태별 카운트 변환
    const statusCounts: Record<string, number> = {};
    patientStatusCounts.forEach((item: any) => {
      statusCounts[item._id || 'unknown'] = item.count;
    });

    // 알림 환자 변환
    const [visitedLong, consultingLong, noshowRisk] = alertPatients;

    // 콜백 포맷팅
    const formattedCallbacks = todayCallbacks.map((p: any) => ({
      id: p._id.toString(),
      name: p.name,
      phone: p.phoneNumber,
      interest: p.interestedServices?.[0] || '',
      time: p.callbacks?.[0]?.scheduledDate
        ? new Date(p.callbacks[0].scheduledDate).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        : '',
      temperature: p.temperature || 'warm', // 실제 값 사용, 기본값 warm
    }));

    // 최근 환자 포맷팅 (오늘 등록된 환자이므로 기본 new, aiRegistered로 구분)
    const formattedRecentPatients = recentPatients.map((p: any) => ({
      id: p._id.toString(),
      name: p.name,
      interest: p.interestedServices?.[0] || '',
      time: new Date(p.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      temperature: p.temperature || 'warm', // 실제 값 사용
      status: p.aiRegistered !== false ? 'new' : 'existing', // AI 등록 또는 오늘 등록 = new
    }));

    // 분석 대기열 포맷팅
    const formattedQueue = analysisQueue.map((c: any) => ({
      id: c._id.toString(),
      phone: c.phone || '알 수 없음',
      time: new Date(c.startedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      status: 'analyzing', // 분석 중 상태 표시
    }));

    // 부재중 카운트 계산
    const missedCalls = callStatsData.byStatus?.find((s: any) => s._id === 'missed')?.count || 0;

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

    const todayTasks = {
      overdue: {
        callback: (overdueByStatus['consulting'] || 0) + (overdueByStatus['visited'] || 0),
        noShow: overdueByStatus['reserved'] || 0,
        treatmentNoShow: overdueByStatus['treatmentBooked'] || 0,
        total: Object.values(overdueByStatus).reduce((sum: number, count: number) => sum + count, 0),
      },
      today: {
        callback: (todayByStatus['consulting'] || 0) + (todayByStatus['visited'] || 0),
        appointment: todayByStatus['reserved'] || 0,
        treatment: todayByStatus['treatmentBooked'] || 0,
        total: Object.values(todayByStatus).reduce((sum: number, count: number) => sum + count, 0),
      },
      tomorrow: {
        total: todayTasksData.tomorrowScheduled?.[0]?.count || 0,
      },
    };

    // 매출 통계 가공
    const revenueData = revenueStats[0] || {};
    const thisMonthRevenue = revenueData.thisMonth?.[0] || {};
    const lastMonthRevenue = revenueData.lastMonth?.[0] || {};
    const totalRevenue = revenueData.total?.[0] || {};

    // 이번 달 매출 정보
    const thisMonthActual = thisMonthRevenue.totalActual || 0;
    const thisMonthEstimated = thisMonthRevenue.totalEstimated || 0;
    const thisMonthPatients = thisMonthRevenue.patientCount || 0;
    const thisMonthPaidCount = thisMonthRevenue.paidCount || 0;

    // 지난 달 매출 정보
    const lastMonthActual = lastMonthRevenue.totalActual || 0;

    // 평균 할인율 계산 (원래금액 대비 할인된 비율)
    const discountRate = thisMonthEstimated > 0
      ? Math.round((1 - thisMonthActual / thisMonthEstimated) * 100)
      : 0;

    // 평균 객단가 계산 (실제 결제한 환자 기준)
    const avgRevenue = thisMonthPaidCount > 0
      ? Math.round(thisMonthActual / thisMonthPaidCount)
      : 0;

    // 전월 대비 성장률
    const growthRate = lastMonthActual > 0
      ? Math.round(((thisMonthActual - lastMonthActual) / lastMonthActual) * 100)
      : (thisMonthActual > 0 ? 100 : 0);

    return NextResponse.json({
      success: true,
      data: {
        // 오늘 통계
        today: {
          totalCalls,
          analyzed: totalCalls - formattedQueue.length,
          analyzing: formattedQueue.length,
          newPatients,
          existingPatients: totalCalls - newPatients - missedCalls,
          missed: missedCalls,
          other: 0,
          // 어제 대비 트렌드
          trend: {
            totalCalls: totalCalls - yesterdayTotalCalls,
            newPatients: newPatients - yesterdayNewPatients,
          },
        },
        // 주의 필요 환자
        alerts: [
          {
            id: 'visited_long',
            type: 'visited_long',
            label: '내원완료 7일+',
            count: visitedLong.length,
            patients: visitedLong.map((p: any) => p.name),
            color: 'amber',
          },
          {
            id: 'consulting_long',
            type: 'consulting_long',
            label: '전화상담 14일+',
            count: consultingLong.length,
            patients: consultingLong.map((p: any) => p.name),
            color: 'red',
          },
          {
            id: 'noshow_risk',
            type: 'noshow_risk',
            label: '내원예약 노쇼 위험',
            count: noshowRisk.length,
            patients: noshowRisk.map((p: any) => p.name),
            color: 'orange',
          },
        ].filter(a => a.count > 0),
        // 분석 대기열
        analysisQueue: formattedQueue,
        // 오늘의 콜백
        callbacks: formattedCallbacks,
        // 최근 등록 환자
        recentPatients: formattedRecentPatients,
        // 환자 상태별 카운트
        patientCounts: statusCounts,
        // 오늘 할 일 통계
        todayTasks,
        // 매출 통계
        revenue: {
          thisMonth: {
            actual: thisMonthActual,           // 이번 달 실제 매출
            estimated: thisMonthEstimated,     // 이번 달 예상 매출
            patientCount: thisMonthPatients,   // 이번 달 환자 수
            paidCount: thisMonthPaidCount,     // 결제 완료 환자 수
          },
          lastMonth: {
            actual: lastMonthActual,           // 지난 달 실제 매출
          },
          total: {
            actual: totalRevenue.totalActual || 0,
            estimated: totalRevenue.totalEstimated || 0,
            patientCount: totalRevenue.patientCount || 0,
          },
          discountRate,     // 평균 할인율 %
          avgRevenue,       // 평균 객단가 (원)
          growthRate,       // 전월 대비 성장률 %
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
