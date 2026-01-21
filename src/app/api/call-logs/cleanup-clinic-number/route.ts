// src/app/api/call-logs/cleanup-clinic-number/route.ts
// 치과 대표번호(031-567-2278)가 환자번호로 잘못 기록된 통화기록 삭제 API
// 일회성 정리 작업용

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

// 삭제 대상 전화번호 (치과 대표번호)
const CLINIC_NUMBERS = [
  '031-567-2278',
  '0315672278',
  '31-567-2278',
  '315672278',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // YYYY-MM-DD 형식

    const { db } = await connectToDatabase();

    // 날짜 범위 설정 (기본: 어제)
    let startDate: Date;
    let endDate: Date;

    if (dateParam) {
      startDate = new Date(dateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dateParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // 기본값: 어제
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(yesterday);
      endDate.setHours(23, 59, 59, 999);
    }

    console.log(`[Cleanup] 조회 날짜: ${startDate.toISOString()} ~ ${endDate.toISOString()}`);

    // V1 callLogs 컬렉션에서 해당 번호 조회
    const v1Filter = {
      $or: [
        { callerNumber: { $in: CLINIC_NUMBERS } },
        { phoneNumber: { $in: CLINIC_NUMBERS } },
      ],
      $and: [
        {
          $or: [
            { ringTime: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
            { callStartTime: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
            { createdAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
          ]
        }
      ]
    };

    const v1Count = await db.collection('callLogs').countDocuments(v1Filter);
    const v1Samples = await db.collection('callLogs').find(v1Filter).limit(10).toArray();

    // V2 callLogs_v2 컬렉션에서 해당 번호 조회
    const v2Filter = {
      phone: { $in: CLINIC_NUMBERS },
      createdAt: { $gte: startDate, $lte: endDate }
    };

    const v2Count = await db.collection('callLogs_v2').countDocuments(v2Filter);
    const v2Samples = await db.collection('callLogs_v2').find(v2Filter).limit(10).toArray();

    return NextResponse.json({
      success: true,
      message: '삭제 대상 통화기록 조회 완료 (삭제하려면 POST 요청)',
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      targetNumbers: CLINIC_NUMBERS,
      v1: {
        collection: 'callLogs',
        count: v1Count,
        samples: v1Samples.map(log => ({
          _id: log._id,
          callerNumber: log.callerNumber,
          phoneNumber: log.phoneNumber,
          callDirection: log.callDirection,
          callStatus: log.callStatus,
          ringTime: log.ringTime,
          createdAt: log.createdAt,
        })),
      },
      v2: {
        collection: 'callLogs_v2',
        count: v2Count,
        samples: v2Samples.map(log => ({
          _id: log._id,
          phone: log.phone,
          direction: log.direction,
          status: log.status,
          createdAt: log.createdAt,
        })),
      },
      totalToDelete: v1Count + v2Count,
    });
  } catch (error) {
    console.error('[Cleanup API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // YYYY-MM-DD 형식
    const confirmParam = searchParams.get('confirm');

    if (confirmParam !== 'true') {
      return NextResponse.json({
        success: false,
        error: '삭제를 확인하려면 ?confirm=true 파라미터를 추가하세요',
        usage: 'POST /api/call-logs/cleanup-clinic-number?date=2025-01-15&confirm=true',
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 날짜 범위 설정
    let startDate: Date;
    let endDate: Date;

    if (dateParam) {
      startDate = new Date(dateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dateParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // 기본값: 어제
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(yesterday);
      endDate.setHours(23, 59, 59, 999);
    }

    console.log(`[Cleanup] 삭제 시작: ${startDate.toISOString()} ~ ${endDate.toISOString()}`);

    // V1 callLogs 삭제
    const v1Filter = {
      $or: [
        { callerNumber: { $in: CLINIC_NUMBERS } },
        { phoneNumber: { $in: CLINIC_NUMBERS } },
      ],
      $and: [
        {
          $or: [
            { ringTime: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
            { callStartTime: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
            { createdAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
          ]
        }
      ]
    };

    const v1Result = await db.collection('callLogs').deleteMany(v1Filter);
    console.log(`[Cleanup] V1 callLogs 삭제: ${v1Result.deletedCount}건`);

    // V2 callLogs_v2 삭제
    const v2Filter = {
      phone: { $in: CLINIC_NUMBERS },
      createdAt: { $gte: startDate, $lte: endDate }
    };

    const v2Result = await db.collection('callLogs_v2').deleteMany(v2Filter);
    console.log(`[Cleanup] V2 callLogs_v2 삭제: ${v2Result.deletedCount}건`);

    return NextResponse.json({
      success: true,
      message: '통화기록 삭제 완료',
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      deleted: {
        v1_callLogs: v1Result.deletedCount,
        v2_callLogs_v2: v2Result.deletedCount,
        total: v1Result.deletedCount + v2Result.deletedCount,
      },
    });
  } catch (error) {
    console.error('[Cleanup API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
