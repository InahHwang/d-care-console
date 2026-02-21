// src/app/api/v2/webhooks/kakao/send/route.ts
// 카카오 비즈니스 채널 메시지 발송 API
//
// 카카오 채널 메시지 발송 방식:
// 1. 챗봇 스킬 응답: 사용자가 메시지를 보낼 때 웹훅 응답으로 전송 (기본)
// 2. 상담톡 API: 별도 계약 필요, 직접 발송 가능
//
// 이 API는 메시지를 pending_send 상태로 저장하고,
// 다음 사용자 메시지 수신 시 웹훅 응답으로 전송합니다.

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import Pusher from 'pusher';

export const dynamic = 'force-dynamic';

const CLINIC_ID = process.env.DEFAULT_CLINIC_ID || 'default';

// Pusher 클라이언트
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// 카카오 상담톡 API (별도 계약 필요)
const KAKAO_CONSULTALK_API_URL = 'https://api.business.kakao.com/v1/message/send';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, content, messageType = 'text', imageUrl, senderName, senderId } = body;

    // 유효성 검사
    if (!chatId || !ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채팅 ID입니다.' },
        { status: 400 }
      );
    }

    if (!content && !imageUrl) {
      return NextResponse.json(
        { success: false, error: '메시지 내용 또는 이미지 URL이 필요합니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 대화방 조회
    const chat = await db.collection('channelChats_v2').findOne({
      _id: new ObjectId(chatId),
      clinicId: CLINIC_ID,
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: '대화방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (chat.channel !== 'kakao') {
      return NextResponse.json(
        { success: false, error: '카카오 대화방이 아닙니다.' },
        { status: 400 }
      );
    }

    const now = new Date();

    // 상담톡 API 토큰이 있는 경우 직접 발송 시도
    const consultalkToken = process.env.KAKAO_CONSULTALK_API_TOKEN;
    let sendResult: { success: boolean; error?: string; method: string } = {
      success: false,
      method: 'pending',
    };

    if (consultalkToken && chat.channelUserKey) {
      // 상담톡 API로 직접 발송 시도
      sendResult = await sendViaConsultalkAPI(
        consultalkToken,
        chat.channelUserKey,
        content,
        messageType,
        imageUrl
      );
    }

    // 상담톡 API 발송 실패 또는 미설정 시 pending_send로 저장
    const messageStatus = sendResult.success ? 'sent' : 'pending_send';

    // 메시지 저장
    const message = {
      clinicId: CLINIC_ID,
      chatId,
      direction: 'outgoing',
      messageType,
      content: content || '[이미지]',
      fileUrl: imageUrl,
      senderType: 'agent',
      senderName: senderName || '상담사',
      senderId,
      status: messageStatus,
      sendMethod: sendResult.method,
      createdAt: now,
    };

    const messageResult = await db.collection('channelMessages_v2').insertOne(message);

    // 대화방 업데이트
    await db.collection('channelChats_v2').updateOne(
      { _id: new ObjectId(chatId) },
      {
        $set: {
          lastMessageAt: now,
          lastMessagePreview: (content || '[이미지]').substring(0, 50),
          lastMessageBy: 'agent',
          status: 'active',
          updatedAt: now,
        },
      }
    );

    const savedMessage = {
      ...message,
      _id: messageResult.insertedId,
      id: messageResult.insertedId.toString(),
    };

    // Pusher로 실시간 이벤트 발송 (상담사 UI용)
    await pusher.trigger('channel-chat-v2', 'new-message', {
      chatId,
      message: savedMessage,
      chat: {
        _id: chat._id,
        lastMessageAt: now,
        lastMessagePreview: (content || '[이미지]').substring(0, 50),
      },
    });

    console.log('[카카오 발송] 메시지 저장:', {
      id: messageResult.insertedId.toString(),
      status: messageStatus,
      method: sendResult.method,
    });

    // 응답
    if (sendResult.success) {
      return NextResponse.json({
        success: true,
        data: savedMessage,
        message: '메시지가 발송되었습니다.',
      });
    } else {
      return NextResponse.json({
        success: true,
        data: savedMessage,
        message: '메시지가 대기열에 추가되었습니다. 고객이 다음 메시지를 보낼 때 전송됩니다.',
        pending: true,
      });
    }
  } catch (error) {
    console.error('[카카오 발송] 오류:', error);
    return NextResponse.json(
      { success: false, error: '메시지 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ============================================
// 상담톡 API 발송 (별도 계약 필요)
// ============================================

async function sendViaConsultalkAPI(
  token: string,
  userKey: string,
  content: string,
  messageType: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string; method: string }> {
  try {
    const requestBody: any = {
      user_key: userKey,
      message_type: messageType === 'image' ? 'IM' : 'TX',
    };

    if (messageType === 'image' && imageUrl) {
      requestBody.image_url = imageUrl;
    } else {
      requestBody.message = content;
    }

    console.log('[카카오 상담톡] 발송 요청:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(KAKAO_CONSULTALK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log('[카카오 상담톡] 응답:', JSON.stringify(result, null, 2));

    if (response.ok && result.success) {
      return { success: true, method: 'consultalk_api' };
    } else {
      return {
        success: false,
        error: result.message || '상담톡 API 발송 실패',
        method: 'consultalk_api_failed',
      };
    }
  } catch (error) {
    console.error('[카카오 상담톡] 오류:', error);
    return {
      success: false,
      error: '상담톡 API 호출 중 오류',
      method: 'consultalk_api_error',
    };
  }
}
