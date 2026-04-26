// src/app/api/v2/webhooks/website/messages/route.ts
// 홈페이지 채팅 위젯 전용 공개 메시지 조회 API
// 위젯이 인증 없이 자기 sessionId로 자기 대화 이력을 가져올 때 사용
//
// 보안: sessionId(클라가 생성한 랜덤 문자열) + chatId 둘 다 일치해야 메시지 반환
// → 외부에서 chatId만 안다고 메시지 못 봄

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const chatId = searchParams.get('chatId');

    if (!sessionId || !chatId) {
      return NextResponse.json(
        { success: false, error: 'sessionId와 chatId가 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 chatId입니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    // sessionId와 chatId 둘 다 일치하는 website 대화방만 조회
    const chat = await db.collection('channelChats_v2').findOne({
      _id: new ObjectId(chatId),
      clinicId,
      channel: 'website',
      channelRoomId: sessionId,
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: '대화방을 찾을 수 없습니다.' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 메시지 조회 (시간 순)
    const messages = await db
      .collection('channelMessages_v2')
      .find({ chatId })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();

    // 위젯이 사용하는 필드만 추려서 반환
    const data = messages.map((msg) => ({
      id: msg._id.toString(),
      content: msg.content,
      senderType: msg.senderType,
      messageType: msg.messageType,
      fileUrl: msg.fileUrl,
      createdAt: msg.createdAt,
    }));

    return NextResponse.json(
      { success: true, data },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[위젯 메시지 조회] 오류:', error);
    return NextResponse.json(
      { success: false, error: '메시지 조회 중 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
