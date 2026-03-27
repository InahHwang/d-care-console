// src/app/api/v2/migrate/backfill-coaching-audit/route.ts
// [1회성] 어제/오늘 AI 코칭 기록을 감사 로그에 백필
// 배포 후 GET 호출로 실행

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // 어제 00:00 기준
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // aiCoaching.generatedAt이 어제 이후인 통화기록 조회
    const callLogs = await db.collection('callLogs_v2').find({
      'aiCoaching.generatedAt': { $gte: yesterday.toISOString() },
    }, {
      projection: {
        _id: 1,
        patientId: 1,
        patientName: 1,
        'aiCoaching.overallScore': 1,
        'aiCoaching.generatedAt': 1,
      },
    }).toArray();

    const inserted: Array<{
      callLogId: string;
      patientName: string;
      score: number;
      generatedAt: string;
    }> = [];

    for (const log of callLogs) {
      const coaching = log.aiCoaching;
      if (!coaching?.generatedAt) continue;

      // 이미 백필된 기록이 있는지 확인
      const existing = await db.collection('auditLogs_v2').findOne({
        action: { $in: ['coaching.run', 'coaching.apply'] },
        documentId: log._id.toString(),
      });
      if (existing) continue;

      await db.collection('auditLogs_v2').insertOne({
        userId: 'backfill',
        userName: '시스템 백필',
        userRole: 'system',
        action: 'coaching.run',
        collection: 'callLogs_v2',
        documentId: log._id.toString(),
        documentName: log.patientName || log._id.toString(),
        changes: [
          { field: 'aiCoaching.overallScore', oldValue: null, newValue: coaching.overallScore },
        ],
        reason: '어제/오늘 코칭 기록 백필',
        ipAddress: 'backfill',
        userAgent: 'migration',
        timestamp: new Date(coaching.generatedAt),
      });

      inserted.push({
        callLogId: log._id.toString(),
        patientName: log.patientName || '(이름없음)',
        score: coaching.overallScore,
        generatedAt: coaching.generatedAt,
      });
    }

    return NextResponse.json({
      success: true,
      totalFound: callLogs.length,
      totalInserted: inserted.length,
      inserted,
    });
  } catch (error) {
    console.error('[Migration] backfill-coaching-audit 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
