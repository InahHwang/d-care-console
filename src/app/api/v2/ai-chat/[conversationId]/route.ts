// src/app/api/v2/ai-chat/[conversationId]/route.ts
// AI 채팅 대화 상세 조회

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { extractUserFromRequest } from '@/utils/auditLog';

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

    const conversation = await db.collection('ai_chats_v2').findOne(query);

    if (!conversation) {
      return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      conversation: { ...conversation, _id: conversation._id.toString() },
    });
  } catch (error) {
    console.error('[AI Chat] 상세 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '대화 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
