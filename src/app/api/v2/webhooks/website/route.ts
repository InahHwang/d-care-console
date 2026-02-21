// src/app/api/v2/webhooks/website/route.ts
// 홈페이지 채팅 위젯 웹훅 API

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import Pusher from 'pusher';

export const dynamic = 'force-dynamic';

const CLINIC_ID = process.env.DEFAULT_CLINIC_ID || 'default';

// 허용된 Origin 목록 (환경변수에서 로드)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Pusher 클라이언트 (서버사이드)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// CORS Preflight 처리
export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'));
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// 상태 확인
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'));
  return NextResponse.json({ status: 'ok', channel: 'website' }, { headers: corsHeaders });
}

// 홈페이지 웹훅 처리
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'));
  try {
    const body = await request.json();
    console.log('[홈페이지 웹훅] 수신:', JSON.stringify(body, null, 2));

    const { type, sessionId, chatId, customerName, customerPhone, content, messageType = 'text' } = body;

    // 레거시 호환 (type 없이 content만 있는 경우)
    const requestType = type || (content ? 'message' : 'start');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId가 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date();

    // ============================================
    // 채팅 시작 (start)
    // ============================================
    if (requestType === 'start') {
      // 기존 대화방 확인
      let chat = await db.collection('channelChats_v2').findOne({
        clinicId: CLINIC_ID,
        channel: 'website',
        channelRoomId: sessionId,
        status: { $ne: 'closed' },
      });

      if (chat) {
        // 기존 대화방 반환
        return NextResponse.json(
          { success: true, chatId: chat._id.toString(), isExisting: true },
          { headers: corsHeaders }
        );
      }

      // 전화번호로 환자 자동 매칭 시도
      let patientId: string | undefined;
      let patientName: string | undefined;
      const phone = customerPhone?.replace(/-/g, '');

      if (phone) {
        const patient = await db.collection('patients_v2').findOne({
          clinicId: CLINIC_ID,
          $or: [
            { phone },
            { phone: { $regex: phone.slice(-8) + '$' } },
          ],
        });

        if (patient) {
          patientId = patient._id.toString();
          patientName = patient.name;
        }
      }

      // 새 대화방 생성
      const newChat = {
        clinicId: CLINIC_ID,
        channel: 'website',
        channelRoomId: sessionId,
        channelUserKey: sessionId,
        phone,
        patientId,
        patientName: patientName || customerName || '웹 방문자',
        customerName: customerName || '웹 방문자',
        status: 'active',
        unreadCount: 0,
        lastMessageAt: now,
        lastMessagePreview: '',
        lastMessageBy: 'system',
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.collection('channelChats_v2').insertOne(newChat);
      const chatIdStr = result.insertedId.toString();

      // 실시간 이벤트 - 새 대화방
      await pusher.trigger('channel-chat-v2', 'new-chat', {
        chat: { ...newChat, _id: result.insertedId },
      });

      return NextResponse.json(
        { success: true, chatId: chatIdStr, isExisting: false, patientMatched: !!patientId },
        { headers: corsHeaders }
      );
    }

    // ============================================
    // 메시지 전송 (message)
    // ============================================
    if (requestType === 'message') {
      if (!content) {
        return NextResponse.json(
          { success: false, error: '메시지 내용이 필요합니다.' },
          { status: 400, headers: corsHeaders }
        );
      }

      // chatId로 대화방 찾기, 없으면 sessionId로 찾기
      let chat;
      if (chatId && ObjectId.isValid(chatId)) {
        chat = await db.collection('channelChats_v2').findOne({
          _id: new ObjectId(chatId),
          clinicId: CLINIC_ID,
        });
      }

      if (!chat) {
        chat = await db.collection('channelChats_v2').findOne({
          clinicId: CLINIC_ID,
          channel: 'website',
          channelRoomId: sessionId,
        });
      }

      if (!chat) {
        return NextResponse.json(
          { success: false, error: '대화방을 찾을 수 없습니다.' },
          { status: 404, headers: corsHeaders }
        );
      }

      // 메시지 저장
      const message = {
        clinicId: CLINIC_ID,
        chatId: chat._id.toString(),
        direction: 'incoming',
        messageType,
        content,
        senderType: 'customer',
        senderName: chat.customerName || chat.patientName || '방문자',
        status: 'delivered',
        createdAt: now,
      };

      const messageResult = await db.collection('channelMessages_v2').insertOne(message);

      // 대화방 업데이트
      await db.collection('channelChats_v2').updateOne(
        { _id: chat._id },
        {
          $set: {
            lastMessageAt: now,
            lastMessagePreview: content.substring(0, 50),
            lastMessageBy: 'customer',
            status: 'active',
            updatedAt: now,
          },
          $inc: { unreadCount: 1 },
        }
      );

      const savedMessage = {
        id: messageResult.insertedId.toString(),
        ...message,
      };

      // 실시간 이벤트 - 새 메시지
      await pusher.trigger('channel-chat-v2', 'new-message', {
        chatId: chat._id.toString(),
        message: savedMessage,
        chat: {
          _id: chat._id,
          lastMessageAt: now,
          lastMessagePreview: content.substring(0, 50),
          unreadCount: (chat.unreadCount || 0) + 1,
        },
      });

      return NextResponse.json(
        { success: true, chatId: chat._id.toString(), message: savedMessage },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: false, error: '알 수 없는 요청 타입입니다.' },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[홈페이지 웹훅] 오류:', error);
    return NextResponse.json(
      { success: false, error: '웹훅 처리 중 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
