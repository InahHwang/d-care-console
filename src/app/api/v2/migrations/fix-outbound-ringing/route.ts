// src/app/api/v2/migrations/fix-outbound-ringing/route.ts
// 일회성 마이그레이션: 발신 부재중인데 ringing으로 남아있는 통화기록을 missed로 수정

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    // 10분 이상 전에 생성된 ringing 상태의 발신 통화 = 부재중 확정
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // === V2 callLogs_v2 수정 ===
    const v2Filter = {
      direction: 'outbound',
      status: 'ringing',
      createdAt: { $lt: tenMinutesAgo }
    };

    // 수정 전 대상 조회
    const v2Targets = await db.collection('callLogs_v2').find(v2Filter).toArray();
    console.log(`[Migration] V2 대상: ${v2Targets.length}건`);

    const v2Result = await db.collection('callLogs_v2').updateMany(
      v2Filter,
      {
        $set: {
          status: 'missed',
          duration: 0,
          aiStatus: 'completed',
          aiAnalysis: {
            classification: '부재중',
            summary: '발신 부재중 통화',
            interest: '',
            temperature: '',
            followUp: '재통화 필요'
          },
          updatedAt: new Date()
        }
      }
    );

    // === V1 callLogs 수정 ===
    const v1Filter = {
      callDirection: 'outbound',
      callStatus: 'ringing',
      createdAt: { $lt: tenMinutesAgo.toISOString() }
    };

    const v1Targets = await db.collection('callLogs').find(v1Filter).toArray();
    console.log(`[Migration] V1 대상: ${v1Targets.length}건`);

    const v1Result = await db.collection('callLogs').updateMany(
      v1Filter,
      {
        $set: {
          callStatus: 'missed',
          isMissed: true,
          updatedAt: new Date().toISOString()
        }
      }
    );

    const summary = {
      v2: {
        matched: v2Result.matchedCount,
        modified: v2Result.modifiedCount,
        targets: v2Targets.map(t => ({
          id: t._id.toString(),
          phone: t.phone,
          createdAt: t.createdAt,
        }))
      },
      v1: {
        matched: v1Result.matchedCount,
        modified: v1Result.modifiedCount,
        targets: v1Targets.map(t => ({
          id: t._id.toString(),
          phone: t.phoneNumber || t.callerNumber,
          createdAt: t.createdAt,
        }))
      }
    };

    console.log('[Migration] 완료:', JSON.stringify(summary, null, 2));

    return NextResponse.json({
      success: true,
      message: `V2: ${v2Result.modifiedCount}건, V1: ${v1Result.modifiedCount}건 수정 완료`,
      ...summary
    });

  } catch (error) {
    console.error('[Migration] 오류:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
