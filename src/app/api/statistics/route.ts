// src/app/api/statistics/route.ts - 간단한 버전
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Statistics API 호출됨 - 간단 모드');
    
    // 🔥 임시로 기본 응답만 반환
    const statistics = {
      thisMonth: {
        newPatients: 0,
        confirmedAppointments: 0,
        visitConfirmed: 0,
        treatmentStarted: 0,
        conversionRates: {
          appointment: 0,
          visit: 0,
          treatment: 0
        }
      },
      statusCounts: {
        callbackNeeded: 0,
        absent: 0,
        confirmed: 0,
        completed: 0
      },
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      statistics
    });

  } catch (error) {
    console.error('Statistics API 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { message: 'Statistics 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST 메서드도 간단하게
export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate } = await request.json();

    // 기본 응답 반환
    const stats = {
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
          appointment: 0,
          visit: 0,
          treatment: 0
        }
      }
    });

  } catch (error) {
    console.error('기간별 통계 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { message: '기간별 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}