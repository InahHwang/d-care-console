// src/app/api/v2/director-comments/[id]/replies/[replyId]/route.ts
// 원장 코멘트 답글 삭제 (작성자 본인 또는 master)

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function isMasterRole(role: string) {
  return role === 'master' || role === 'admin';
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; replyId: string } }
) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, error: '잘못된 코멘트 ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const doc = await db.collection('directorComments_v2').findOne({
      _id: new ObjectId(params.id),
      clinicId,
    });
    if (!doc) {
      return NextResponse.json({ success: false, error: '코멘트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const reply = (doc.replies || []).find((r: { id: string }) => r.id === params.replyId);
    if (!reply) {
      return NextResponse.json({ success: false, error: '답글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isOwner = reply.createdBy === auth.user.id;
    if (!isOwner && !isMasterRole(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    await db.collection('directorComments_v2').updateOne(
      { _id: new ObjectId(params.id), clinicId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { $pull: { replies: { id: params.replyId } } as any }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DirectorComments Replies DELETE] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
