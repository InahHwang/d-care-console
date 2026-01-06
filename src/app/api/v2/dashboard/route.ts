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
      patientStatusCounts,
      alertPatients,
      todayCallbacks,
      recentPatients,
      analysisQueue,
      revenueStats
    ] = await Promise.all([
      // 1. 오늘의 통화 통계
      db.collection('callLogs').aggregate([
        {
          $match: {
            callStartTime: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byDirection: [
              { $group: { _id: '$callDirection', count: { $sum: 1 } } }
            ],
            byStatus: [
              { $group: { _id: '$callStatus', count: { $sum: 1 } } }
            ],
            newPatients: [
              { $match: { isNewPatient: true } },
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
        .project({ name: 1, interestedServices: 1, createdAt: 1, source: 1 })
        .toArray(),

      // 6. AI 분석 대기열 (기존 callLogs 사용)
      db.collection('callLogs')
        .find({
          callStartTime: { $gte: today },
          $or: [
            { aiAnalyzed: { $exists: false } },
            { aiAnalyzed: false }
          ]
        })
        .sort({ callStartTime: -1 })
        .limit(5)
        .project({ callerNumber: 1, callStartTime: 1, callDirection: 1 })
        .toArray(),

      // 7. 매출 통계 (patients_v2에서 집계)
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
      temperature: 'warm', // 기본값
    }));

    // 최근 환자 포맷팅
    const formattedRecentPatients = recentPatients.map((p: any) => ({
      id: p._id.toString(),
      name: p.name,
      interest: p.interestedServices?.[0] || '',
      time: new Date(p.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      temperature: 'warm',
      status: 'new',
    }));

    // 분석 대기열 포맷팅
    const formattedQueue = analysisQueue.map((c: any, index: number) => ({
      id: c._id.toString(),
      phone: c.callerNumber || c.phoneNumber || '알 수 없음',
      time: new Date(c.callStartTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      progress: Math.max(10, 100 - (index * 20)), // 가상 진행률
    }));

    // 부재중 카운트 계산
    const missedCalls = callStatsData.byStatus?.find((s: any) => s._id === 'missed')?.count || 0;

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

    // 전환율 계산 (예상 → 실제)
    const conversionRate = thisMonthEstimated > 0
      ? Math.round((thisMonthActual / thisMonthEstimated) * 100)
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
          conversionRate,   // 전환율 (예상 → 실제) %
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
