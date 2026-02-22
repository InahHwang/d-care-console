// src/app/api/dashboard/stats/route.ts
// 대시보드 통계 전용 API - 서버사이드 집계로 성능 최적화

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { withDeprecation } from '@/lib/deprecation';

async function _GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 🔥 MongoDB Aggregation Pipeline으로 서버에서 직접 집계
    const statsResult = await db.collection('patients').aggregate([
      {
        $facet: {
          // 전체 환자 수
          totalCount: [{ $count: 'count' }],

          // 미처리 콜백 - 상담환자 (visitConfirmed가 아니고, 콜백필요 상태, 과거 예정 콜백 있음)
          overdueCallbackConsultation: [
            {
              $match: {
                visitConfirmed: { $ne: true },
                status: '콜백필요',
                'callbackHistory': {
                  $elemMatch: {
                    status: '예정',
                    isVisitManagementCallback: { $ne: true },
                    date: { $lt: todayStr }
                  }
                }
              }
            },
            { $count: 'count' }
          ],

          // 미처리 콜백 - 내원환자 (visitConfirmed이고, 치료시작 아님, 과거 예정 콜백 있음)
          overdueCallbackVisit: [
            {
              $match: {
                visitConfirmed: true,
                postVisitStatus: { $ne: '치료시작' },
                'callbackHistory': {
                  $elemMatch: {
                    status: '예정',
                    isVisitManagementCallback: true,
                    date: { $lt: todayStr }
                  }
                }
              }
            },
            { $count: 'count' }
          ],

          // 오늘 예정된 콜백 - 상담환자
          todayScheduledConsultation: [
            {
              $match: {
                visitConfirmed: { $ne: true },
                status: { $nin: ['예약확정', '재예약확정'] },
                'callbackHistory': {
                  $elemMatch: {
                    status: '예정',
                    isVisitManagementCallback: { $ne: true },
                    date: todayStr
                  }
                }
              }
            },
            { $count: 'count' }
          ],

          // 오늘 예정된 콜백 - 내원환자
          todayScheduledVisit: [
            {
              $match: {
                visitConfirmed: true,
                postVisitStatus: '재콜백필요',
                'callbackHistory': {
                  $elemMatch: {
                    status: '예정',
                    isVisitManagementCallback: true,
                    date: todayStr
                  }
                }
              }
            },
            { $count: 'count' }
          ],

          // 콜백 미등록 - 상담환자 (부재중/잠재고객 중 예정 콜백 없음)
          callbackUnregisteredConsultation: [
            {
              $match: {
                visitConfirmed: { $ne: true },
                status: { $in: ['부재중', '잠재고객'] },
                $or: [
                  { callbackHistory: { $exists: false } },
                  { callbackHistory: { $size: 0 } },
                  {
                    callbackHistory: {
                      $not: { $elemMatch: { status: '예정' } }
                    }
                  }
                ]
              }
            },
            { $count: 'count' }
          ],

          // 콜백 미등록 - 내원환자 (상태미설정)
          callbackUnregisteredVisit: [
            {
              $match: {
                $and: [
                  { visitConfirmed: true },
                  {
                    $or: [
                      { postVisitStatus: { $exists: false } },
                      { postVisitStatus: null },
                      { postVisitStatus: '' }
                    ]
                  },
                  {
                    $or: [
                      { callbackHistory: { $exists: false } },
                      { callbackHistory: { $size: 0 } },
                      {
                        callbackHistory: {
                          $not: {
                            $elemMatch: {
                              status: '예정',
                              isVisitManagementCallback: true
                            }
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            },
            { $count: 'count' }
          ],

          // 리마인더 콜백 (치료동의 + 치료시작일 지남)
          reminderCallbacks: [
            {
              $match: {
                visitConfirmed: true,
                postVisitStatus: '치료동의',
                'postVisitConsultation.treatmentConsentInfo.treatmentStartDate': { $lt: todayStr }
              }
            },
            { $count: 'count' }
          ],

          // 오늘 콜 목록 (상담환자 + 내원환자)
          todayCalls: [
            {
              $match: {
                $or: [
                  // 상담환자 오늘 콜백
                  {
                    visitConfirmed: { $ne: true },
                    status: { $nin: ['예약확정', '재예약확정'] },
                    'callbackHistory': {
                      $elemMatch: {
                        status: '예정',
                        isVisitManagementCallback: { $ne: true },
                        date: todayStr
                      }
                    }
                  },
                  // 내원환자 오늘 콜백
                  {
                    visitConfirmed: true,
                    'callbackHistory': {
                      $elemMatch: {
                        status: '예정',
                        isVisitManagementCallback: true,
                        date: todayStr
                      }
                    }
                  }
                ]
              }
            },
            {
              $project: {
                _id: 1,
                id: 1,
                patientId: 1,
                name: 1,
                phoneNumber: 1,
                status: 1,
                visitConfirmed: 1,
                postVisitStatus: 1,
                interestedServices: 1,
                callbackHistory: 1
              }
            },
            { $limit: 50 }
          ]
        }
      }
    ]).toArray();

    const stats = statsResult[0];

    // 결과 정리
    const response = {
      statusCounts: {
        overdueCallbacks: {
          consultation: stats.overdueCallbackConsultation[0]?.count || 0,
          visit: stats.overdueCallbackVisit[0]?.count || 0
        },
        todayScheduled: {
          consultation: stats.todayScheduledConsultation[0]?.count || 0,
          visit: stats.todayScheduledVisit[0]?.count || 0
        },
        callbackUnregistered: {
          consultation: stats.callbackUnregisteredConsultation[0]?.count || 0,
          visit: stats.callbackUnregisteredVisit[0]?.count || 0
        },
        reminderCallbacks: {
          registrationNeeded: stats.reminderCallbacks[0]?.count || 0
        }
      },
      todayCalls: stats.todayCalls.map((patient: any) => ({
        ...patient,
        _id: patient._id.toString(),
        id: patient.id || patient._id.toString()
      })),
      totalPatients: stats.totalCount[0]?.count || 0,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('🚨 Dashboard stats API error:', error);
    return NextResponse.json(
      { error: '대시보드 통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export const GET = withDeprecation(_GET, { v1Route: '/api/dashboard/stats', v2Route: '/api/v2/dashboard' });
