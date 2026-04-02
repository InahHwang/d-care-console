// src/app/api/v2/activity-logs/target/[targetId]/route.ts
// 특정 대상의 활동 로그 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

const COLLECTION = 'activityLogs_v2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ targetId: string }> }
) {
  try {
    const { targetId } = await params;
    const target = request.nextUrl.searchParams.get('target');

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = { targetId };
    if (target) filter.target = target;

    const logs = await db.collection(COLLECTION)
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json(
      logs.map(log => ({
        _id: log._id.toString(),
        userId: log.userId,
        userName: log.userName,
        userRole: log.userRole,
        action: log.action,
        target: log.target,
        targetId: log.targetId,
        targetName: log.targetName,
        details: log.details || {},
        timestamp: log.timestamp,
      }))
    );
  } catch (error) {
    console.error('[ActivityLogs] Target GET 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
