// src/app/api/v2/webhooks/instagram/route.ts
// 인스타그램 DM 웹훅 API
// API 문서: https://developers.facebook.com/docs/messenger-platform/instagram

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
// 인스타그램 웹훅 타입 정의
// ============================================

interface InstagramWebhookEntry {
  id: string; // Instagram Business Account ID
  time: number;
  messaging?: InstagramMessagingEvent[];
}

interface InstagramMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{
      type: 'image' | 'video' | 'audio' | 'file';
      payload: { url: string };
    }>;
    is_echo?: boolean;
    is_deleted?: boolean;
  };
  read?: {
    mid: string;
  };
  reaction?: {
    mid: string;
    action: 'react' | 'unreact';
    reaction?: string;
  };
}

interface InstagramWebhookBody {
  object: 'instagram';
  entry: InstagramWebhookEntry[];
}

// ============================================
// 웹훅 검증 (GET) - Meta 웹훅 등록 시 필요
// ============================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  // 웹훅 검증 요청
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[인스타그램 웹훅] 검증 성공');
    return new NextResponse(challenge, { status: 200 });
  }

  // 일반 상태 확인
  if (!mode && !token) {
    return NextResponse.json({
      status: 'ok',
      channel: 'instagram',
      timestamp: new Date().toISOString(),
    });
  }

  console.error('[인스타그램 웹훅] 검증 실패:', { mode, token });
  return new NextResponse('Forbidden', { status: 403 });
}

// ============================================
// 웹훅 핸들러 (POST) - 메시지 수신
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: InstagramWebhookBody = await request.json();
    console.log('[인스타그램 웹훅] 수신:', JSON.stringify(body, null, 2));

    // Instagram 이벤트만 처리
    if (body.object !== 'instagram') {
      console.log('[인스타그램 웹훅] instagram이 아닌 이벤트 무시:', body.object);
      return NextResponse.json({ success: true });
    }

    const { db } = await connectToDatabase();
    const now = new Date();

    // 각 entry 처리
    for (const entry of body.entry) {
      if (!entry.messaging) continue;

      for (const event of entry.messaging) {
        await handleMessagingEvent(db, entry.id, event, now);
      }
    }

    // Meta는 항상 200 응답 필요
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[인스타그램 웹훅] 오류:', error);
    // 오류가 발생해도 200 반환 (재시도 방지)
    return NextResponse.json({ success: true });
  }
}

// ============================================
// 메시징 이벤트 처리
// ============================================

async function handleMessagingEvent(
  db: any,
  pageId: string,
  event: InstagramMessagingEvent,
  now: Date
) {
  const { sender, recipient, message, read, reaction } = event;

  // 에코 메시지 (내가 보낸 메시지) 무시
  if (message?.is_echo) {
    console.log('[인스타그램 웹훅] 에코 메시지 무시');
    return;
  }

  // 삭제된 메시지 무시
  if (message?.is_deleted) {
    console.log('[인스타그램 웹훅] 삭제된 메시지 무시');
    return;
  }

  // 읽음 확인 이벤트
  if (read) {
    console.log('[인스타그램 웹훅] 읽음 확인:', read.mid);
    return;
  }

  // 리액션 이벤트
  if (reaction) {
    console.log('[인스타그램 웹훅] 리액션:', reaction);
    return;
  }

  // 메시지 이벤트
  if (message) {
    await handleMessageEvent(db, pageId, sender.id, message, now);
  }
}

// ============================================
// 메시지 이벤트 처리
// ============================================

async function handleMessageEvent(
  db: any,
  pageId: string,
  senderId: string,
  message: NonNullable<InstagramMessagingEvent['message']>,
  now: Date
) {
  // 메시지 내용 추출
  let content = '';
  let messageType: 'text' | 'image' | 'video' | 'file' = 'text';
  let fileUrl: string | undefined;

  if (message.text) {
    content = message.text;
    messageType = 'text';
  } else if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    fileUrl = attachment.payload.url;

    switch (attachment.type) {
      case 'image':
        content = '[이미지]';
        messageType = 'image';
        break;
      case 'video':
        content = '[동영상]';
        messageType = 'video';
        break;
      case 'audio':
        content = '[음성]';
        messageType = 'file';
        break;
      default:
        content = '[파일]';
        messageType = 'file';
    }
  }

  if (!content) {
    console.log('[인스타그램 웹훅] 빈 메시지 무시');
    return;
  }

  // 대화방 찾기 또는 생성
  let chat = await db.collection('channelChats_v2').findOne({
    channel: 'instagram',
    channelUserKey: senderId,
  });

  if (!chat) {
    // 새 대화방 생성
    const newChat = {
      channel: 'instagram',
      channelRoomId: `instagram_${senderId}_${Date.now()}`,
      channelUserKey: senderId,
      channelPageId: pageId, // Instagram Business Account ID
      status: 'active',
      unreadCount: 1,
      lastMessageAt: now,
      lastMessagePreview: content.substring(0, 50),
      lastMessageBy: 'customer',
      // 24시간 윈도우 추적
      messageWindowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('channelChats_v2').insertOne(newChat);
    chat = { ...newChat, _id: result.insertedId };

    // 새 대화방 이벤트 발송
    await pusher.trigger('channel-chat-v2', 'new-chat', { chat });
    console.log('[인스타그램 웹훅] 새 대화방 생성:', chat._id.toString());
  } else {
    // 24시간 윈도우 갱신 (고객이 메시지 보낼 때마다)
    await db.collection('channelChats_v2').updateOne(
      { _id: chat._id },
      {
        $set: {
          messageWindowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          updatedAt: now,
        },
      }
    );
  }

  // 메시지 저장
  const newMessage = {
    chatId: chat._id.toString(),
    direction: 'incoming',
    messageType,
    content,
    fileUrl,
    senderType: 'customer',
    senderName: chat.patientName || '고객',
    status: 'delivered',
    metadata: {
      mid: message.mid, // Instagram message ID
    },
    createdAt: now,
  };

  const messageResult = await db.collection('channelMessages_v2').insertOne(newMessage);

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
    ...newMessage,
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

  console.log('[인스타그램 웹훅] 메시지 저장 완료:', messageResult.insertedId.toString());
}
