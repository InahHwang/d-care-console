// src/app/api/v2/director-comments/[id]/route.ts
// 원장 코멘트 개별 처리 — 읽음 표시 / 삭제

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function isMasterRole(role: string) {
  return role === 'master' || role === 'admin';
}

// PATCH: 본인을 readBy에 추가 (읽음 처리, 멱등)
export async function PATCH(
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

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;
    const userId = auth.user.id;

    const result = await db.collection('directorComments_v2').updateOne(
      { _id: new ObjectId(params.id), clinicId },
      { $addToSet: { readBy: userId } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: '코멘트를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DirectorComments PATCH] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: 코멘트 삭제 (작성자 본인 또는 master)
export async function DELETE(
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

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const doc = await db.collection('directorComments_v2').findOne({
      _id: new ObjectId(params.id),
      clinicId,
    });
    if (!doc) {
      return NextResponse.json({ success: false, error: '코멘트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isOwner = doc.createdBy === auth.user.id;
    if (!isOwner && !isMasterRole(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    await db.collection('directorComments_v2').deleteOne({ _id: new ObjectId(params.id), clinicId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DirectorComments DELETE] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
