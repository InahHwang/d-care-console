// src/app/api/v2/migration/sync-coaching/route.ts
// 기존 AI 코칭 데이터를 patients_v2에 동기화하는 일회성 마이그레이션

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { db } = await connectToDatabase();

    // aiCoaching이 있고 patientId가 있는 통화기록 조회
    const callLogs = await db.collection('callLogs_v2').find(
      {
        aiCoaching: { $exists: true },
        patientId: { $exists: true, $ne: null },
      },
      {
        projection: {
          patientId: 1,
          'aiCoaching.overallScore': 1,
          'aiCoaching.generatedAt': 1,
        },
      }
    ).toArray();

    if (callLogs.length === 0) {
      return NextResponse.json({
        success: true,
        message: '동기화할 코칭 데이터가 없습니다.',
        updated: 0,
      });
    }

    // 환자별 가장 최신 코칭 결과만 수집
    const patientCoachingMap = new Map<string, { score: number; at: string }>();

    for (const log of callLogs) {
      const pid = log.patientId;
      const score = log.aiCoaching?.overallScore;
      const at = log.aiCoaching?.generatedAt;
      if (!pid || score == null || !at) continue;

      const existing = patientCoachingMap.get(pid);
      if (!existing || at > existing.at) {
        patientCoachingMap.set(pid, { score, at });
      }
    }

    // patients_v2 업데이트
    let updated = 0;
    const entries = Array.from(patientCoachingMap.entries());
    for (const [patientId, coaching] of entries) {
      if (!ObjectId.isValid(patientId)) continue;

      const result = await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(patientId) },
        {
          $set: {
            lastCoachingScore: coaching.score,
            lastCoachingAt: coaching.at,
          },
        }
      );

      if (result.modifiedCount > 0) updated++;
    }

    return NextResponse.json({
      success: true,
      message: `코칭 데이터 동기화 완료`,
      totalCallLogs: callLogs.length,
      uniquePatients: patientCoachingMap.size,
      updated,
    });
  } catch (error) {
    console.error('[Migration] sync-coaching 오류:', error);
    return NextResponse.json(
      { success: false, error: '마이그레이션 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
