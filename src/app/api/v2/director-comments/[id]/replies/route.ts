// src/app/api/v2/director-comments/[id]/replies/route.ts
// 원장 코멘트에 답글 작성 (모든 staff 가능)

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const replySchema = z.object({
  text: z.string().min(1, '답글 내용은 필수입니다.').max(2000, '답글은 2000자 이내로 작성해주세요.'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, error: '잘못된 코멘트 ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const reply = {
      id: new ObjectId().toString(),
      text: parsed.data.text,
      createdBy: auth.user.id,
      createdByName: auth.user.name,
      createdAt: new Date(),
    };

    // 답글 추가 + 원장 코멘트 작성자(createdBy)는 readBy에서 제거
    // (답글이 달리면 원장이 다시 확인할 수 있도록 unread 처리)
    const target = await db.collection('directorComments_v2').findOne({
      _id: new ObjectId(params.id),
      clinicId,
    });
    if (!target) {
      return NextResponse.json({ success: false, error: '코멘트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 답글 작성자 본인은 readBy에 남기고, 코멘트 원작자는 제거 (답글 추가됨을 알림)
    const newReadBy = (target.readBy || []).filter(
      (uid: string) => uid !== target.createdBy
    );
    if (!newReadBy.includes(auth.user.id)) {
      newReadBy.push(auth.user.id);
    }

    await db.collection('directorComments_v2').updateOne(
      { _id: new ObjectId(params.id), clinicId },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $push: { replies: reply } as any,
        $set: { readBy: newReadBy },
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        ...reply,
        createdAt: reply.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[DirectorComments Replies POST] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
