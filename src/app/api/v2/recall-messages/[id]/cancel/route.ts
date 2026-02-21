// src/app/api/v2/recall-messages/[id]/cancel/route.ts
// 리콜 메시지 취소 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

// POST - 발송 취소
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 메시지가 pending 상태인지 확인
    const message = await db.collection('recall_messages').findOne({
      _id: new ObjectId(id),
      clinicId,
      status: 'pending',
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found or already processed' },
        { status: 404 }
      );
    }

    // 삭제 대신 상태를 cancelled로 변경
    await db.collection('recall_messages').updateOne(
      { _id: new ObjectId(id), clinicId },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: '발송이 취소되었습니다',
    });
  } catch (error) {
    console.error('[Recall Cancel API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
