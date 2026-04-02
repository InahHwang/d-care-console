// src/app/api/v2/activity-logs/cleanup/route.ts
// 날짜 기준 활동 로그 정리 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

const COLLECTION = 'activityLogs_v2';

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const days = parseInt(searchParams.get('days') || '30');
    const actions = searchParams.get('actions');

    if (type !== 'older-than') {
      return NextResponse.json(
        { message: '지원하지 않는 삭제 타입입니다.' },
        { status: 400 }
      );
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const filter: Record<string, unknown> = {
      timestamp: { $lt: cutoffDate },
    };

    if (actions) {
      const actionList = actions.split(',').map(a => a.trim());
      filter.action = { $in: actionList };
    }

    const { db } = await connectToDatabase();

    const result = await db.collection(COLLECTION).deleteMany(filter);
    const remainingCount = await db.collection(COLLECTION).countDocuments();

    return NextResponse.json({
      success: true,
      message: `${result.deletedCount}개의 로그가 삭제되었습니다.`,
      deletedCount: result.deletedCount,
      remainingCount,
    });
  } catch (error) {
    console.error('[ActivityLogs] Cleanup 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
