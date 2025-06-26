// src/app/api/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value ||
                  request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];

    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.decode(token) as any;
    if (!decoded) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    // 현재 날짜 기준 통계 계산
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // 이번달 범위
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    
    // 환자 컬렉션에서 통계 데이터 조회
    const patientsCollection = db.collection('patients');
    
    // 이번달 신규 환자 수
    const thisMonthPatients = await patientsCollection.countDocuments({
      callInDate: {
        $gte: firstDayOfMonth.toISOString().split('T')[0],
        $lte: today.toISOString().split('T')[0]
      }
    });

    // 예약 확정 환자 수
    const confirmedAppointments = await patientsCollection.countDocuments({
      callInDate: {
        $gte: firstDayOfMonth.toISOString().split('T')[0],
        $lte: today.toISOString().split('T')[0]
      },
      status: '예약확정'
    });

    // 내원 확정 환자 수
    const visitConfirmed = await patientsCollection.countDocuments({
      callInDate: {
        $gte: firstDayOfMonth.toISOString().split('T')[0],
        $lte: today.toISOString().split('T')[0]
      },
      visitConfirmed: true
    });

    // 치료 시작 환자 수
    const treatmentStarted = await patientsCollection.countDocuments({
      callInDate: {
        $gte: firstDayOfMonth.toISOString().split('T')[0],
        $lte: today.toISOString().split('T')[0]
      },
      visitConfirmed: true,
      postVisitStatus: '치료시작'
    });

    // 상태별 환자 수
    const statusCounts = await patientsCollection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const statusMap = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    // 통계 데이터 구성
    const statistics = {
      thisMonth: {
        newPatients: thisMonthPatients,
        confirmedAppointments,
        visitConfirmed,
        treatmentStarted,
        conversionRates: {
          appointment: thisMonthPatients > 0 ? (confirmedAppointments / thisMonthPatients * 100) : 0,
          visit: thisMonthPatients > 0 ? (visitConfirmed / thisMonthPatients * 100) : 0,
          treatment: thisMonthPatients > 0 ? (treatmentStarted / thisMonthPatients * 100) : 0
        }
      },
      statusCounts: {
        callbackNeeded: statusMap['콜백필요'] || 0,
        absent: statusMap['부재중'] || 0,
        confirmed: statusMap['예약확정'] || 0,
        completed: statusMap['완료'] || 0
      },
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      statistics
    });

  } catch (error) {
    console.error('통계 조회 오류:', error);
    return NextResponse.json(
      { message: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST 메서드 - 특정 기간 통계 조회
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value ||
                  request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];

    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.decode(token) as any;
    if (!decoded) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const { startDate, endDate } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json({ message: '시작일과 종료일이 필요합니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');

    // 지정 기간 통계 계산
    const periodStatistics = await patientsCollection.aggregate([
      {
        $match: {
          callInDate: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPatients: { $sum: 1 },
          confirmedAppointments: {
            $sum: { $cond: [{ $eq: ['$status', '예약확정'] }, 1, 0] }
          },
          visitConfirmed: {
            $sum: { $cond: [{ $eq: ['$visitConfirmed', true] }, 1, 0] }
          },
          treatmentStarted: {
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ['$visitConfirmed', true] },
                    { $eq: ['$postVisitStatus', '치료시작'] }
                  ]
                }, 
                1, 
                0
              ] 
            }
          }
        }
      }
    ]).toArray();

    const stats = periodStatistics[0] || {
      totalPatients: 0,
      confirmedAppointments: 0,
      visitConfirmed: 0,
      treatmentStarted: 0
    };

    return NextResponse.json({
      success: true,
      period: { startDate, endDate },
      statistics: {
        ...stats,
        conversionRates: {
          appointment: stats.totalPatients > 0 ? (stats.confirmedAppointments / stats.totalPatients * 100) : 0,
          visit: stats.totalPatients > 0 ? (stats.visitConfirmed / stats.totalPatients * 100) : 0,
          treatment: stats.totalPatients > 0 ? (stats.treatmentStarted / stats.totalPatients * 100) : 0
        }
      }
    });

  } catch (error) {
    console.error('기간별 통계 조회 오류:', error);
    return NextResponse.json(
      { message: '기간별 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}