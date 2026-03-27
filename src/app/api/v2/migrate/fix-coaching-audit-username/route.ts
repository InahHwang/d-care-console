// src/app/api/v2/migrate/fix-coaching-audit-username/route.ts
// [1회성] 시스템 백필된 코칭 감사 로그의 userName을 실제 상담사 이름으로 수정
// 배포 후 GET 호출로 실행

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // 시스템 백필로 기록된 코칭 감사 로그 조회
    const backfillLogs = await db.collection('auditLogs_v2').find({
      userName: '시스템 백필',
      action: { $in: ['coaching.run', 'coaching.apply'] },
    }).toArray();

    const fixes: Array<{ callLogId: string; patientName: string; updatedUserName: string }> = [];

    for (const log of backfillLogs) {
      // 해당 통화기록에서 상담사 이름 가져오기
      const callLog = await db.collection('callLogs_v2').findOne(
        { _id: new ObjectId(log.documentId) },
        { projection: { consultantName: 1, patientName: 1 } }
      );

      const userName = callLog?.consultantName || '알 수 없음';

      await db.collection('auditLogs_v2').updateOne(
        { _id: log._id },
        { $set: { userName, userId: userName, userRole: 'staff' } }
      );

      fixes.push({
        callLogId: log.documentId,
        patientName: callLog?.patientName || '(이름없음)',
        updatedUserName: userName,
      });
    }

    return NextResponse.json({
      success: true,
      totalFixed: fixes.length,
      fixes,
    });
  } catch (error) {
    console.error('[Migration] fix-coaching-audit-username 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
