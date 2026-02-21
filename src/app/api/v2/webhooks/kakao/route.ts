// src/app/api/v2/webhooks/kakao/route.ts
// 카카오 비즈니스 채널 웹훅 API (챗봇 스킬 서버)
// API 문서: https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import Pusher from 'pusher';

export const dynamic = 'force-dynamic';

const CLINIC_ID = process.env.DEFAULT_CLINIC_ID || 'default';

// Pusher 클라이언트 (서버사이드)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// ============================================
// 카카오 챗봇 스킬 요청 타입 정의
// ============================================

interface KakaoSkillRequest {
  intent?: {
    id: string;
    name: string;
  };
  userRequest: {
    timezone: string;
    params?: Record<string, any>;
    block?: {
      id: string;
      name: string;
    };
    utterance: string; // 사용자 발화 (메시지)
    lang?: string;
    user: {
      id: string; // botUserKey
      type: string;
      properties?: {
        plusfriendUserKey?: string; // 카카오톡 채널 사용자 ID
        appUserId?: string;
        isFriend?: boolean;
        botUserKey?: string;
      };
    };
    callbackUrl?: string; // AI 챗봇 콜백 URL
  };
  contexts?: any[];
  bot: {
    id: string;
    name: string;
  };
  action?: {
    name: string;
    clientExtra?: any;
    params?: Record<string, any>;
    id: string;
    detailParams?: Record<string, any>;
  };
}

interface KakaoSkillResponse {
  version: '2.0';
  template: {
    outputs: Array<
      | { simpleText: { text: string } }
      | { simpleImage: { imageUrl: string; altText: string } }
      | { basicCard: any }
      | { carousel: any }
    >;
    quickReplies?: Array<{
      messageText: string;
      action: 'message' | 'block';
      label: string;
      blockId?: string;
    }>;
  };
  context?: {
    values: Array<{
      name: string;
      lifeSpan: number;
      params?: Record<string, string>;
    }>;
  };
  data?: Record<string, any>;
}

// ============================================
// 웹훅 핸들러 (스킬 서버)
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: KakaoSkillRequest = await request.json();
    console.log('[카카오 웹훅] 수신:', JSON.stringify(body, null, 2));

    const { userRequest, bot } = body;
    const utterance = userRequest?.utterance || '';
    const userKey = userRequest?.user?.properties?.plusfriendUserKey
      || userRequest?.user?.properties?.botUserKey
      || userRequest?.user?.id;

    if (!userKey) {
      console.error('[카카오 웹훅] 사용자 식별값 없음');
      return NextResponse.json(createTextResponse('죄송합니다. 오류가 발생했습니다.'));
    }

    const { db } = await connectToDatabase();
    const now = new Date();

    // 대화방 찾기 또는 생성
    let chat = await db.collection('channelChats_v2').findOne({
      clinicId: CLINIC_ID,
      channel: 'kakao',
      channelUserKey: userKey,
    });

    if (!chat) {
      // 새 대화방 생성
      const newChat = {
        clinicId: CLINIC_ID,
        channel: 'kakao',
        channelRoomId: `kakao_${userKey}_${Date.now()}`,
        channelUserKey: userKey,
        status: 'active',
        unreadCount: 1,
        lastMessageAt: now,
        lastMessagePreview: utterance.substring(0, 50),
        lastMessageBy: 'customer',
        metadata: {
          botId: bot?.id,
          botName: bot?.name,
          isFriend: userRequest?.user?.properties?.isFriend,
        },
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.collection('channelChats_v2').insertOne(newChat);
      chat = { ...newChat, _id: result.insertedId };

      // 새 대화방 이벤트 발송
      await pusher.trigger('channel-chat-v2', 'new-chat', { chat });
      console.log('[카카오 웹훅] 새 대화방 생성:', chat._id.toString());
    }

    // 메시지 저장
    const message = {
      clinicId: CLINIC_ID,
      chatId: chat._id.toString(),
      direction: 'incoming',
      messageType: 'text',
      content: utterance,
      senderType: 'customer',
      senderName: chat.patientName || '고객',
      status: 'delivered',
      metadata: {
        blockId: userRequest?.block?.id,
        blockName: userRequest?.block?.name,
        actionName: body.action?.name,
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
          lastMessagePreview: utterance.substring(0, 50),
          lastMessageBy: 'customer',
          status: 'active',
          updatedAt: now,
        },
        $inc: { unreadCount: 1 },
      }
    );

    // 실시간 이벤트 발송 (상담사 화면에 표시)
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
        lastMessagePreview: utterance.substring(0, 50),
        unreadCount: (chat.unreadCount || 0) + 1,
      },
    });

    console.log('[카카오 웹훅] 메시지 저장 완료:', messageResult.insertedId.toString());

    // ============================================
    // 자동 응답 (상담 연결 안내)
    // ============================================

    // 대기 중인 상담사 메시지가 있는지 확인
    const pendingAgentMessage = await db.collection('channelMessages_v2').findOne({
      chatId: chat._id.toString(),
      direction: 'outgoing',
      status: 'pending_send',
    }, { sort: { createdAt: -1 } });

    if (pendingAgentMessage) {
      // 대기 중인 상담사 메시지가 있으면 발송
      await db.collection('channelMessages_v2').updateOne(
        { _id: pendingAgentMessage._id },
        { $set: { status: 'sent' } }
      );

      return NextResponse.json(createTextResponse(pendingAgentMessage.content));
    }

    // 기본 응답: 상담 연결 안내
    const autoResponse = createAutoResponse(utterance, chat);
    return NextResponse.json(autoResponse);

  } catch (error) {
    console.error('[카카오 웹훅] 오류:', error);
    return NextResponse.json(createTextResponse('죄송합니다. 잠시 후 다시 시도해주세요.'));
  }
}

// ============================================
// 응답 생성 헬퍼 함수
// ============================================

function createTextResponse(text: string): KakaoSkillResponse {
  return {
    version: '2.0',
    template: {
      outputs: [
        {
          simpleText: { text },
        },
      ],
    },
  };
}

function createAutoResponse(utterance: string, chat: any): KakaoSkillResponse {
  // 첫 메시지인 경우 환영 인사
  if (!chat.lastMessagePreview || chat.unreadCount <= 1) {
    return {
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: '안녕하세요! 다산바른치과입니다.\n상담사가 곧 답변 드리겠습니다.\n\n진료 문의, 예약, 상담 등 무엇이든 편하게 말씀해주세요.',
            },
          },
        ],
        quickReplies: [
          { label: '진료 예약', action: 'message', messageText: '진료 예약 문의드립니다' },
          { label: '비용 문의', action: 'message', messageText: '치료 비용 문의드립니다' },
          { label: '위치 안내', action: 'message', messageText: '병원 위치가 어디인가요?' },
        ],
      },
    };
  }

  // 일반 메시지에 대한 응답
  return {
    version: '2.0',
    template: {
      outputs: [
        {
          simpleText: {
            text: '메시지가 접수되었습니다.\n상담사가 확인 후 답변 드리겠습니다.',
          },
        },
      ],
    },
  };
}

// ============================================
// 웹훅 검증 (GET 요청)
// ============================================

export async function GET(request: NextRequest) {
  // 카카오 웹훅 등록 시 검증용
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('challenge');

  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({
    status: 'ok',
    channel: 'kakao',
    timestamp: new Date().toISOString(),
  });
}
