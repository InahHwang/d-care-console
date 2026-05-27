// src/app/api/v2/deletion-requests/ack/route.ts
// 요청자가 자신의 삭제 요청 결과(승인/반려)를 "확인함" 처리.
// 확인하면 결과 알림 팝업이 다시 뜨지 않는다. (영구 기록)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const COLLECTION = 'deletionRequests_v2';

export async function POST(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { db } = await connectToDatabase();

    // 본인이 올린 + 처리완료 + 아직 확인 안 한 요청 일괄 확인 처리
    const result = await db.collection(COLLECTION).updateMany(
      {
        clinicId: auth.user.clinicId,
        requestedBy: auth.user.id,
        status: { $in: ['approved', 'rejected'] },
        requesterAckAt: { $exists: false },
      },
      { $set: { requesterAckAt: new Date() } }
    );

    return NextResponse.json({ success: true, acknowledged: result.modifiedCount });
  } catch (error) {
    console.error('[DeletionRequests ack] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
