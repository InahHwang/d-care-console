// src/app/api/v2/migrate/delete-coaching-backfill/route.ts
// [1회성] 부정확한 코칭 백필 감사 로그 삭제

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    const result = await db.collection('auditLogs_v2').deleteMany({
      action: { $in: ['coaching.run', 'coaching.apply'] },
      ipAddress: 'backfill',
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('[Migration] delete-coaching-backfill 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
