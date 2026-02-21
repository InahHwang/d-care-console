// src/app/api/v2/webhooks/kakao/cstalk/message/route.ts
// 비즈고(인포뱅크) Omni API V2 - 카카오 상담톡 웹훅 수신
// 문서: https://infobank-guide.gitbook.io/omni-api-v2/comm/kakao/cstalk/chat-recv/message

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
// 비즈고 상담톡 웹훅 타입 정의
// ============================================

interface BizgoCstalkContent {
  url?: string;        // 미디어 URL (이미지/파일/동영상/음성)
  comment?: string;    // 텍스트 내용 또는 캡션/파일명
}

interface BizgoCstalkWebhook {
  msgKey: string;         // 메시지 식별자
  userKey: string;        // 사용자 식별자
  senderKey: string;      // 발신프로필 키
  serviceType?: string;   // 서비스 타입
  msgType: string;        // 메시지 타입 (TEXT, IMAGE, FILE, VIDEO, AUDIO)
  requestType?: string;   // 요청 타입
  sendTime: string;       // 전송 시각 (ISO 8601)
  reportTime: string;     // 리포트 시각 (ISO 8601)
  kakaoTime?: string;     // 카카오 서버 시각
  contents?: BizgoCstalkContent[] | string;  // 사용자 전송 메시지 (배열 또는 문자열)
  attachment?: {          // 4000자 초과 시 원본 텍스트 파일 URL
    url?: string;
  };
}

// ============================================
// 웹훅 핸들러
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: BizgoCstalkWebhook = await request.json();
    console.log('[비즈고 상담톡 웹훅] 수신:', JSON.stringify(body, null, 2));

    const { msgKey, userKey, senderKey, msgType } = body;

    if (!userKey) {
      console.error('[비즈고 상담톡 웹훅] userKey 없음');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const { db } = await connectToDatabase();
    const now = new Date();

    // 메시지 내용 추출
    const { content, messageType, fileUrl } = extractMessageContent(body);

    if (!content) {
      console.log('[비즈고 상담톡 웹훅] 빈 메시지 무시');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ============================================
    // 대화방 찾기 또는 생성
    // ============================================

    let chat = await db.collection('channelChats_v2').findOne({
      channel: 'kakao',
      channelUserKey: userKey,
    });

    const isNewChat = !chat;

    if (!chat) {
      const newChat = {
        channel: 'kakao',
        channelRoomId: `kakao_cstalk_${userKey}_${Date.now()}`,
        channelUserKey: userKey,
        status: 'active',
        unreadCount: 1,
        lastMessageAt: now,
        lastMessagePreview: content.substring(0, 50),
        lastMessageBy: 'customer',
        metadata: {
          source: 'bizgo_cstalk',
          senderKey,
        },
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.collection('channelChats_v2').insertOne(newChat);
      chat = { ...newChat, _id: result.insertedId };

      // 새 대화방 이벤트 발송
      await pusher.trigger('channel-chat-v2', 'new-chat', { chat });
      console.log('[비즈고 상담톡 웹훅] 새 대화방 생성:', chat._id.toString());
    }

    // ============================================
    // 메시지 저장
    // ============================================

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
        msgKey,
        senderKey,
        msgType: body.msgType,
        sendTime: body.sendTime,
      },
      createdAt: now,
    };

    const messageResult = await db.collection('channelMessages_v2').insertOne(message);

    // ============================================
    // 대화방 업데이트 (기존 대화방만 - 새 대화방은 생성 시 이미 설정됨)
    // ============================================

    if (!isNewChat) {
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
    }

    // ============================================
    // 실시간 이벤트 발송
    // ============================================

    const savedMessage = {
      ...message,
      _id: messageResult.insertedId,
      id: messageResult.insertedId.toString(),
    };

    const updatedUnreadCount = isNewChat ? 1 : (chat.unreadCount || 0) + 1;

    await pusher.trigger('channel-chat-v2', 'new-message', {
      chatId: chat._id.toString(),
      message: savedMessage,
      chat: {
        _id: chat._id,
        lastMessageAt: now,
        lastMessagePreview: content.substring(0, 50),
        unreadCount: updatedUnreadCount,
      },
    });

    console.log('[비즈고 상담톡 웹훅] 메시지 저장 완료:', messageResult.insertedId.toString());

    // 비즈고는 200 응답 필수 (5초 타임아웃, 실패 시 3회 재시도)
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[비즈고 상담톡 웹훅] 오류:', error);
    // 오류 발생해도 200 반환 (재시도 방지)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 200 });
  }
}

// ============================================
// 메시지 내용 추출 헬퍼
// ============================================

function extractMessageContent(body: BizgoCstalkWebhook): {
  content: string;
  messageType: 'text' | 'image' | 'file';
  fileUrl?: string;
} {
  const { msgType, contents, attachment } = body;

  // contents가 문자열인 경우 (단순 텍스트)
  if (typeof contents === 'string') {
    return { content: contents, messageType: 'text' };
  }

  // contents가 배열인 경우
  // 비즈고 Omni API V2 스펙: contents[].url (미디어 URL), contents[].comment (텍스트/캡션)
  if (Array.isArray(contents) && contents.length > 0) {
    const first = contents[0];

    switch (msgType) {
      case 'IMAGE':
        return {
          content: first.comment || '[이미지]',
          messageType: 'image',
          fileUrl: first.url,
        };

      case 'FILE':
      case 'VIDEO':
      case 'AUDIO':
        return {
          content: first.comment || `[${msgType === 'FILE' ? '파일' : msgType === 'VIDEO' ? '동영상' : '음성'}]`,
          messageType: 'file',
          fileUrl: first.url,
        };

      case 'TEXT':
      default:
        // 4000자 초과 시 attachment에 전체 텍스트 URL
        if (attachment?.url) {
          return {
            content: first.comment || '[장문 메시지]',
            messageType: 'text',
            fileUrl: attachment.url,
          };
        }
        return {
          content: first.comment || '',
          messageType: 'text',
        };
    }
  }

  // contents가 없는 경우 - msgType으로 추론
  return { content: '', messageType: 'text' };
}

// ============================================
// 웹훅 상태 확인 (GET)
// ============================================

export async function GET(request: NextRequest) {
  // ?debug=1 로 호출 시 디버그 로그 + 최근 카카오 대화방 조회
  const { searchParams } = new URL(request.url);
  if (searchParams.get('debug') === '1') {
    try {
      const { db } = await connectToDatabase();
      const debugLogs = await db.collection('webhook_debug_logs')
        .find({})
        .sort({ receivedAt: -1 })
        .limit(10)
        .toArray();
      const kakaoChats = await db.collection('channelChats_v2')
        .find({ channel: 'kakao' })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      return NextResponse.json({
        debugLogs,
        kakaoChats,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) });
    }
  }

  return NextResponse.json({
    status: 'ok',
    channel: 'kakao_cstalk',
    provider: 'bizgo',
    timestamp: new Date().toISOString(),
  });
}
