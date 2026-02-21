// src/app/api/v2/recall-messages/[id]/complete/route.ts
// 리콜 메시지 전화 완료 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

// POST - 전화 완료 처리
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { result, bookedAt } = body; // result: 'booked' | 'contacted' | 'no-answer'

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      status: 'completed',
      completedAt: now,
      completionResult: result || 'contacted',
      updatedAt: now,
    };

    if (bookedAt) {
      updateData.bookedAt = new Date(bookedAt);
      updateData.status = 'booked';
    }

    const resultDoc = await db.collection('recall_messages').findOneAndUpdate(
      { _id: new ObjectId(id), clinicId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!resultDoc) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '처리가 완료되었습니다',
      data: resultDoc,
    });
  } catch (error) {
    console.error('[Recall Complete API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
