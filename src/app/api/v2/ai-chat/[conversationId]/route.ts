// src/app/api/v2/ai-chat/[conversationId]/route.ts
// AI 채팅 대화 상세 조회 (페이지네이션 지원)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { extractUserFromRequest } from '@/utils/auditLog';

const DEFAULT_LIMIT = 30; // 한 번에 가져올 메시지 수

// GET: 대화 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { conversationId } = await params;
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT));
    const before = parseInt(searchParams.get('before') || '0'); // 끝에서부터 before개 건너뛰고 limit개 가져오기

    if (!conversationId || !ObjectId.isValid(conversationId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 대화 ID입니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const isAdmin = user.userRole === 'admin' || user.userRole === 'master';

    // 관리자는 모든 대화 조회 가능, 일반 사용자는 본인 대화만
    const query: Record<string, unknown> = { _id: new ObjectId(conversationId) };
    if (!isAdmin) {
      query.userId = user.userId;
    }

    // 전체 메시지 수 먼저 확인 (메타데이터만)
    const meta = await db.collection('ai_chats_v2').findOne(query, {
      projection: {
        userId: 1, userName: 1, title: 1, pageContext: 1, pageTitle: 1,
        createdAt: 1, updatedAt: 1,
        totalMessages: { $size: { $ifNull: ['$messages', []] } },
      },
    });

    if (!meta) {
      return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다.' }, { status: 404 });
    }

    const totalMessages = meta.totalMessages || 0;

    // $slice로 최근 메시지만 가져오기 (뒤에서부터)
    // before=0이면 최근 limit개, before=30이면 최근 31~60번째
    const sliceStart = before > 0 ? -(before + limit) : -limit;
    const sliceCount = before > 0 ? limit : limit;

    const conversation = await db.collection('ai_chats_v2').findOne(query, {
      projection: {
        userId: 1, userName: 1, title: 1, pageContext: 1, pageTitle: 1,
        createdAt: 1, updatedAt: 1,
        messages: before > 0
          ? { $slice: [sliceStart, sliceCount] }
          : { $slice: -limit },
      },
    });

    const hasMore = totalMessages > before + limit;

    return NextResponse.json({
      success: true,
      conversation: { ...conversation, _id: conversation!._id.toString() },
      totalMessages,
      hasMore,
    });
  } catch (error) {
    console.error('[AI Chat] 상세 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '대화 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
