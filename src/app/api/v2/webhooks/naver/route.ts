// src/app/api/v2/webhooks/naver/route.ts
// 네이버 톡톡 웹훅 API
// API 문서: https://github.com/navertalk/chatbot-api

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import Pusher from 'pusher';

export const dynamic = 'force-dynamic';

// Pusher 클라이언트 (서버사이드)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// ============================================
// 네이버톡톡 웹훅 이벤트 타입 정의
// ============================================

interface NaverWebhookBase {
  event: 'send' | 'open' | 'leave' | 'friend' | 'profile' | 'echo';
  user: string; // 사용자 식별값
  options?: {
    inflow?: 'list' | 'button' | 'none';
    referer?: string;
    friend?: boolean;
    under14?: boolean;
    notification?: boolean;
  };
}

interface NaverSendEvent extends NaverWebhookBase {
  event: 'send';
  textContent?: {
    text: string;
    inputType?: 'typing' | 'button' | 'sticker';
    code?: string;
  };
  imageContent?: {
    imageUrl: string;
  };
  compositeContent?: {
    compositeList: Array<{
      title?: string;
      description?: string;
      image?: { imageUrl: string };
      buttonList?: Array<{
        type: 'TEXT' | 'LINK' | 'OPTION' | 'PAY';
        data: { title: string };
      }>;
    }>;
  };
}

interface NaverOpenEvent extends NaverWebhookBase {
  event: 'open';
}

interface NaverLeaveEvent extends NaverWebhookBase {
  event: 'leave';
}

type NaverWebhookEvent = NaverSendEvent | NaverOpenEvent | NaverLeaveEvent | NaverWebhookBase;

// ============================================
// 웹훅 핸들러
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: NaverWebhookEvent = await request.json();
    console.log('[네이버 웹훅] 수신:', JSON.stringify(body, null, 2));

    const { event, user } = body;

    if (!user) {
      console.error('[네이버 웹훅] user 식별값 없음');
      return NextResponse.json({ success: true }); // 네이버는 200 응답 필요
    }

    const { db } = await connectToDatabase();
    const now = new Date();

    // ============================================
    // 이벤트별 처리
    // ============================================

    switch (event) {
      case 'open': {
        // 채팅창 진입 - 대화방 생성 또는 활성화
        await handleOpenEvent(db, user, body as NaverOpenEvent, now);
        break;
      }

      case 'send': {
        // 메시지 수신
        await handleSendEvent(db, user, body as NaverSendEvent, now);
        break;
      }

      case 'leave': {
        // 채팅창 나감 - 로그만 기록
        console.log('[네이버 웹훅] 사용자 채팅창 나감:', user);
        break;
      }

      case 'friend': {
        // 친구 추가 - 필요시 처리
        console.log('[네이버 웹훅] 친구 추가:', user);
        break;
      }

      case 'echo': {
        // 에코 이벤트 (발송 메시지 확인) - 무시
        break;
      }

      default:
        console.log('[네이버 웹훅] 알 수 없는 이벤트:', event);
    }

    // 네이버톡톡은 200 응답 필요
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[네이버 웹훅] 오류:', error);
    // 오류가 발생해도 200 반환 (재시도 방지)
    return NextResponse.json({ success: false, error: 'Internal error' });
  }
}

// ============================================
// open 이벤트 처리 - 채팅창 진입
// ============================================

async function handleOpenEvent(
  db: any,
  userKey: string,
  event: NaverOpenEvent,
  now: Date
) {
  // 기존 대화방 찾기
  let chat = await db.collection('channelChats_v2').findOne({
    channel: 'naver',
    channelUserKey: userKey,
    status: { $ne: 'closed' },
  });

  if (!chat) {
    // 새 대화방 생성
    const newChat = {
      channel: 'naver',
      channelRoomId: `naver_${userKey}_${Date.now()}`,
      channelUserKey: userKey,
      status: 'active',
      unreadCount: 0,
      lastMessageAt: now,
      lastMessagePreview: '',
      lastMessageBy: 'system',
      metadata: {
        inflow: event.options?.inflow,
        referer: event.options?.referer,
        friend: event.options?.friend,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('channelChats_v2').insertOne(newChat);
    chat = { ...newChat, _id: result.insertedId };

    // 새 대화방 이벤트 발송
    await pusher.trigger('channel-chat-v2', 'new-chat', { chat });
    console.log('[네이버 웹훅] 새 대화방 생성:', chat._id.toString());
  } else {
    // 기존 대화방 활성화
    await db.collection('channelChats_v2').updateOne(
      { _id: chat._id },
      {
        $set: {
          status: 'active',
          updatedAt: now,
        },
      }
    );
    console.log('[네이버 웹훅] 기존 대화방 활성화:', chat._id.toString());
  }
}

// ============================================
// send 이벤트 처리 - 메시지 수신
// ============================================

async function handleSendEvent(
  db: any,
  userKey: string,
  event: NaverSendEvent,
  now: Date
) {
  // 메시지 내용 추출
  let content = '';
  let messageType: 'text' | 'image' = 'text';
  let fileUrl: string | undefined;

  if (event.textContent?.text) {
    content = event.textContent.text;
    messageType = 'text';
  } else if (event.imageContent?.imageUrl) {
    content = '[이미지]';
    messageType = 'image';
    fileUrl = event.imageContent.imageUrl;
  } else if (event.compositeContent) {
    // 복합 메시지는 첫 번째 항목의 제목 사용
    const first = event.compositeContent.compositeList[0];
    content = first?.title || first?.description || '[복합 메시지]';
  }

  if (!content) {
    console.log('[네이버 웹훅] 빈 메시지 무시');
    return;
  }

  // 대화방 찾기 또는 생성
  let chat = await db.collection('channelChats_v2').findOne({
    channel: 'naver',
    channelUserKey: userKey,
  });

  if (!chat) {
    // 대화방이 없으면 생성 (open 이벤트 없이 바로 메시지 온 경우)
    const newChat = {
      channel: 'naver',
      channelRoomId: `naver_${userKey}_${Date.now()}`,
      channelUserKey: userKey,
      status: 'active',
      unreadCount: 1,
      lastMessageAt: now,
      lastMessagePreview: content.substring(0, 50),
      lastMessageBy: 'customer',
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('channelChats_v2').insertOne(newChat);
    chat = { ...newChat, _id: result.insertedId };

    // 새 대화방 이벤트 발송
    await pusher.trigger('channel-chat-v2', 'new-chat', { chat });
    console.log('[네이버 웹훅] 새 대화방 생성 (메시지):', chat._id.toString());
  }

  // 메시지 저장
  const message = {
    chatId: chat._id.toString(),
    direction: 'incoming',
    messageType,
    content,
    fileUrl,
    senderType: 'customer',
    senderName: chat.patientName || '고객',
    status: 'delivered',
    metadata: {
      inputType: event.textContent?.inputType,
      code: event.textContent?.code,
    },
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

  // 실시간 이벤트 발송
  const savedMessage = {
    ...message,
    _id: messageResult.insertedId,
    id: messageResult.insertedId.toString(),
  };

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

  console.log('[네이버 웹훅] 메시지 저장 완료:', messageResult.insertedId.toString());
}

// ============================================
// 웹훅 검증 (GET 요청)
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    channel: 'naver',
    timestamp: new Date().toISOString(),
  });
}
