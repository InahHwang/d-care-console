// src/app/api/v2/webhooks/instagram/send/route.ts
// 인스타그램 DM 발송 API
// API 문서: https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import Pusher from 'pusher';

export const dynamic = 'force-dynamic';

// Instagram Graph API 엔드포인트
const INSTAGRAM_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

// Pusher 클라이언트
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// ============================================
// 메시지 발송 API
// ============================================

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
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: '대화방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (chat.channel !== 'instagram') {
      return NextResponse.json(
        { success: false, error: '인스타그램 대화방이 아닙니다.' },
        { status: 400 }
      );
    }

    if (!chat.channelUserKey) {
      return NextResponse.json(
        { success: false, error: '사용자 식별키가 없습니다.' },
        { status: 400 }
      );
    }

    // 24시간 윈도우 확인
    const now = new Date();
    if (chat.messageWindowExpiresAt && new Date(chat.messageWindowExpiresAt) < now) {
      return NextResponse.json(
        {
          success: false,
          error: '24시간 응답 시간이 초과되었습니다. 고객이 다시 메시지를 보내야 응답할 수 있습니다.',
          code: 'WINDOW_EXPIRED',
        },
        { status: 400 }
      );
    }

    // 환경변수 확인
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const pageId = process.env.INSTAGRAM_PAGE_ID || chat.channelPageId;

    if (!accessToken) {
      console.error('[인스타그램 발송] INSTAGRAM_ACCESS_TOKEN 환경변수 없음');
      return NextResponse.json(
        { success: false, error: '인스타그램 액세스 토큰이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    if (!pageId) {
      console.error('[인스타그램 발송] Page ID 없음');
      return NextResponse.json(
        { success: false, error: '인스타그램 페이지 ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 메시지 요청 구성
    const messageRequest: any = {
      recipient: { id: chat.channelUserKey },
    };

    if (messageType === 'image' && imageUrl) {
      messageRequest.message = {
        attachment: {
          type: 'image',
          payload: { url: imageUrl, is_reusable: true },
        },
      };
    } else {
      messageRequest.message = { text: content };
    }

    console.log('[인스타그램 발송] 요청:', JSON.stringify(messageRequest, null, 2));

    // Instagram Graph API 호출
    const response = await fetch(`${INSTAGRAM_GRAPH_API_URL}/${pageId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(messageRequest),
    });

    const result = await response.json();
    console.log('[인스타그램 발송] 응답:', JSON.stringify(result, null, 2));

    // 발송 결과 확인
    if (!response.ok || result.error) {
      const errorMessage = getInstagramErrorMessage(result.error);
      console.error('[인스타그램 발송] 실패:', errorMessage);

      // 발송 실패해도 메시지는 DB에 저장 (실패 상태로)
      const failedMessage = {
        chatId,
        direction: 'outgoing',
        messageType,
        content: content || '[이미지]',
        fileUrl: imageUrl,
        senderType: 'agent',
        senderName: senderName || '상담사',
        senderId,
        status: 'failed',
        errorCode: result.error?.code,
        errorMessage,
        createdAt: now,
      };

      await db.collection('channelMessages_v2').insertOne(failedMessage);

      return NextResponse.json(
        { success: false, error: errorMessage, code: result.error?.code },
        { status: 400 }
      );
    }

    // 성공 - 메시지 저장
    const message = {
      chatId,
      direction: 'outgoing',
      messageType,
      content: content || '[이미지]',
      fileUrl: imageUrl,
      senderType: 'agent',
      senderName: senderName || '상담사',
      senderId,
      status: 'sent',
      metadata: {
        messageId: result.message_id,
        recipientId: result.recipient_id,
      },
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

    // Pusher로 실시간 이벤트 발송
    await pusher.trigger('channel-chat-v2', 'new-message', {
      chatId,
      message: savedMessage,
      chat: {
        _id: chat._id,
        lastMessageAt: now,
        lastMessagePreview: (content || '[이미지]').substring(0, 50),
      },
    });

    console.log('[인스타그램 발송] 성공:', messageResult.insertedId.toString());

    return NextResponse.json({
      success: true,
      data: savedMessage,
    });
  } catch (error) {
    console.error('[인스타그램 발송] 오류:', error);
    return NextResponse.json(
      { success: false, error: '메시지 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ============================================
// 에러 메시지 매핑
// ============================================

function getInstagramErrorMessage(error: any): string {
  if (!error) return '알 수 없는 오류';

  const errorCode = error.code;
  const errorSubcode = error.error_subcode;

  // 일반적인 에러 코드
  const errorMessages: Record<number, string> = {
    10: '권한이 없습니다. 앱 권한을 확인해주세요.',
    100: '잘못된 파라미터입니다.',
    190: '액세스 토큰이 만료되었거나 유효하지 않습니다.',
    200: '권한이 부족합니다.',
    551: '이 사용자에게 메시지를 보낼 수 없습니다.',
    613: '요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.',
  };

  // 메시징 관련 서브코드
  if (errorCode === 10 || errorCode === 200) {
    if (errorSubcode === 2018278) {
      return '24시간 응답 시간이 초과되었습니다.';
    }
    if (errorSubcode === 2018065) {
      return '이 사용자에게 메시지를 보낼 수 없습니다. (차단 또는 제한)';
    }
  }

  return errorMessages[errorCode] || error.message || `오류 발생 (코드: ${errorCode})`;
}
