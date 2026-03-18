// src/app/api/v2/audit/setup-indexes/route.ts
// auditLogs_v2 인덱스 생성 (1회 실행)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { extractUserFromRequest } from '@/utils/auditLog';

export async function POST(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user || user.userRole !== 'master') {
    return NextResponse.json({ error: '관리자만 실행 가능합니다.' }, { status: 403 });
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection('auditLogs_v2');

    await Promise.all([
      col.createIndex({ userId: 1, timestamp: -1 }),
      col.createIndex({ collection: 1, documentId: 1 }),
      col.createIndex({ action: 1, timestamp: -1 }),
      col.createIndex({ timestamp: -1 }),
      // 90일 TTL — 자동 삭제
      col.createIndex({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }),
    ]);

    // patients_v2에 deletedAt 인덱스 (soft delete 성능)
    await db.collection('patients_v2').createIndex(
      { deletedAt: 1 },
      { sparse: true }
    );

    return NextResponse.json({
      success: true,
      message: 'auditLogs_v2 인덱스 4개 + TTL 인덱스 생성 완료, patients_v2 deletedAt 인덱스 생성 완료',
    });
  } catch (error) {
    console.error('[Audit Setup] 인덱스 생성 실패:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
