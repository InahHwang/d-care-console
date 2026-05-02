// src/app/api/v2/director-comments/route.ts
// 원장 코멘트 — 직원이 로그인했을 때 환자별 피드백을 보기 위한 API

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  patientId: z.string().min(1, '환자 ID는 필수입니다.'),
  patientName: z.string().min(1, '환자 이름은 필수입니다.'),
  text: z.string().min(1, '코멘트 내용은 필수입니다.').max(2000, '코멘트는 2000자 이내로 작성해주세요.'),
  context: z.string().max(100).optional(),
});

interface DirectorCommentDoc {
  _id?: ObjectId;
  clinicId: string;
  patientId: string;
  patientName: string;
  context?: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  readBy: string[];
}

function isMasterRole(role: string) {
  return role === 'master' || role === 'admin';
}

// GET: 코멘트 조회
//   ?patientId=xxx     → 특정 환자의 전체 코멘트 (환자 상세용)
//   (param 없음)       → 최근 7일치 코멘트 (대시보드용)
export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;
    const userId = auth.user.id;

    const patientId = request.nextUrl.searchParams.get('patientId');

    const filter: Record<string, unknown> = { clinicId };

    if (patientId) {
      filter.patientId = patientId;
    } else {
      // 대시보드용: 최근 7일
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: sevenDaysAgo };
    }

    const docs = await db
      .collection<DirectorCommentDoc>('directorComments_v2')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    const comments = docs.map(doc => ({
      id: doc._id!.toString(),
      patientId: doc.patientId,
      patientName: doc.patientName,
      context: doc.context || '',
      text: doc.text,
      createdBy: doc.createdBy,
      createdByName: doc.createdByName,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
      isUnread: !(doc.readBy || []).includes(userId),
    }));

    const unreadCount = comments.filter(c => c.isUnread).length;

    return NextResponse.json({
      success: true,
      data: { comments, unreadCount },
    });
  } catch (error) {
    console.error('[DirectorComments GET] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 코멘트 작성 (master/admin 전용)
export async function POST(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    if (!isMasterRole(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: '원장 코멘트 작성 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const doc: DirectorCommentDoc = {
      clinicId,
      patientId: parsed.data.patientId,
      patientName: parsed.data.patientName,
      context: parsed.data.context,
      text: parsed.data.text,
      createdBy: auth.user.id,
      createdByName: auth.user.name,
      createdAt: new Date(),
      // 작성자 본인은 자동으로 읽음 처리
      readBy: [auth.user.id],
    };

    const result = await db.collection<DirectorCommentDoc>('directorComments_v2').insertOne(doc);

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...doc,
        createdAt: doc.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[DirectorComments POST] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
