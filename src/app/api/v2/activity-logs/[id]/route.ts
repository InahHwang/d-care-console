// src/app/api/v2/activity-logs/[id]/route.ts
// 개별 활동 로그 삭제 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const COLLECTION = 'activityLogs_v2';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { db } = await connectToDatabase();

    let filter: Record<string, unknown>;
    try {
      filter = { _id: new ObjectId(id) };
    } catch {
      filter = { _id: id };
    }

    const result = await db.collection(COLLECTION).deleteOne(filter);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { message: '로그를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const remainingCount = await db.collection(COLLECTION).countDocuments();

    return NextResponse.json({
      success: true,
      message: '로그가 삭제되었습니다.',
      remainingCount,
    });
  } catch (error) {
    console.error('[ActivityLogs] DELETE 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
