// src/app/api/v2/migration/fix-string-dates/route.ts
// 문자열로 저장된 날짜를 Date 객체로 변환 (UI 날짜 필터에 보이도록)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dryRun = true } = body;

    const { db } = await connectToDatabase();

    // 모든 callLogs_v2에서 createdAt이 string인 것 찾기
    const allLogs = await db.collection('callLogs_v2').find({}).toArray();

    const stringDateLogs = allLogs.filter(log => typeof log.createdAt === 'string');

    console.log(`[FixDates] 문자열 날짜 callLog: ${stringDateLogs.length}건 (전체: ${allLogs.length}건)`);

    let fixedCount = 0;

    if (!dryRun) {
      for (const log of stringDateLogs) {
        const updates: Record<string, Date> = {};

        if (typeof log.createdAt === 'string') {
          updates.createdAt = new Date(log.createdAt);
        }
        if (typeof log.startedAt === 'string') {
          updates.startedAt = new Date(log.startedAt);
        }
        if (typeof log.endedAt === 'string') {
          updates.endedAt = new Date(log.endedAt);
        }
        if (typeof log.updatedAt === 'string') {
          updates.updatedAt = new Date(log.updatedAt);
        }

        if (Object.keys(updates).length > 0) {
          await db.collection('callLogs_v2').updateOne(
            { _id: log._id },
            { $set: updates }
          );
          fixedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      total: allLogs.length,
      stringDateCount: stringDateLogs.length,
      fixed: dryRun ? 0 : fixedCount,
      samples: stringDateLogs.slice(0, 5).map(l => ({
        id: l._id.toString(),
        phone: l.phone,
        createdAt: l.createdAt,
        createdAtType: typeof l.createdAt,
      })),
    });
  } catch (error) {
    console.error('[FixDates] 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
