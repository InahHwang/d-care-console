// src/app/api/v2/call-logs/fix-missed/route.ts
// 기존 부재중 통화들을 "부재중"으로 분류 수정 (수신/발신 모두)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { db } = await connectToDatabase();

    // duration=0인데 분류가 없거나 unknown인 통화 찾기 (수신/발신 모두)
    const missedCalls = await db.collection('callLogs_v2').find({
      duration: 0,
      $or: [
        { 'aiAnalysis.classification': 'unknown' },
        { 'aiAnalysis.classification': { $exists: false } },
        { 'aiAnalysis.classification': null },
        { aiAnalysis: null },
        { aiAnalysis: { $exists: false } }
      ]
    }).toArray();

    console.log(`[Fix Missed] 수정할 통화: ${missedCalls.length}건`);

    if (missedCalls.length === 0) {
      return NextResponse.json({
        success: true,
        message: '수정할 부재중 통화가 없습니다.',
        fixed: 0
      });
    }

    // 일괄 업데이트
    const result = await db.collection('callLogs_v2').updateMany(
      {
        duration: 0,
        $or: [
          { 'aiAnalysis.classification': 'unknown' },
          { 'aiAnalysis.classification': { $exists: false } },
          { 'aiAnalysis.classification': null },
          { aiAnalysis: null },
          { aiAnalysis: { $exists: false } }
        ]
      },
      [
        {
          $set: {
            aiStatus: 'completed',
            aiAnalysis: {
              $mergeObjects: [
                { $ifNull: ['$aiAnalysis', {}] },
                { classification: '부재중', summary: '부재중 통화' }
              ]
            },
            updatedAt: new Date().toISOString()
          }
        }
      ]
    );

    console.log(`[Fix Missed] ${result.modifiedCount}건 수정됨`);

    return NextResponse.json({
      success: true,
      message: `${result.modifiedCount}건의 부재중 통화가 수정되었습니다.`,
      fixed: result.modifiedCount,
      found: missedCalls.length
    });

  } catch (error) {
    console.error('[Fix Missed] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET으로 현재 상태 확인
export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { db } = await connectToDatabase();

    // duration=0인 통화 통계
    const stats = await db.collection('callLogs_v2').aggregate([
      { $match: { duration: 0 } },
      { $group: { _id: '$aiAnalysis.classification', count: { $sum: 1 } } }
    ]).toArray();

    // duration=0인데 분류가 없거나 unknown인 통화 수
    const needsFix = await db.collection('callLogs_v2').countDocuments({
      duration: 0,
      $or: [
        { 'aiAnalysis.classification': 'unknown' },
        { 'aiAnalysis.classification': { $exists: false } },
        { 'aiAnalysis.classification': null },
        { aiAnalysis: null },
        { aiAnalysis: { $exists: false } }
      ]
    });

    return NextResponse.json({
      missedCallStats: stats,
      needsFix
    });

  } catch (error) {
    console.error('[Fix Missed GET] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
