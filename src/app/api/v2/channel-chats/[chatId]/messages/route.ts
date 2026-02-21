// src/app/api/v2/channel-chats/[chatId]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { MessageDirection, MessageType, SenderType, MessageStatus, ChannelType } from '@/types/v2';
import Pusher from 'pusher';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { createChatMessageSchema } from '@/lib/validations/schemas';

// Pusher 클라이언트
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// 네이버톡톡 발송 API
const NAVER_TALKTALK_API_URL = 'https://gw.talk.naver.com/chatbot/v1/event';

// 카카오 상담톡 API
const KAKAO_CONSULTALK_API_URL = 'https://api.business.kakao.com/v1/message/send';

// 인스타그램 Graph API
const INSTAGRAM_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

// CoolSMS SDK (홈페이지 채팅 이탈 고객 SMS 알림용)
let coolsmsService: any = null;
try {
  const isVercel = process.env.VERCEL === '1';
  if (isVercel) {
    const coolsmsModule = require('coolsms-node-sdk');
    coolsmsService = coolsmsModule.default || coolsmsModule;
  } else {
    coolsmsService = require('coolsms-node-sdk').default;
  }
} catch (error) {
  console.log('[채널메시지] CoolSMS SDK 로드 실패 (SMS 알림 비활성화)');
}

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ chatId: string }>;
}

// GET: 메시지 목록 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { chatId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채팅 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 대화방 존재 확인
    const chat = await db.collection('channelChats_v2').findOne({
      _id: new ObjectId(chatId),
      clinicId,
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: '대화방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      db
        .collection('channelMessages_v2')
        .find({ chatId })
        .sort({ createdAt: -1 }) // 최신순
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('channelMessages_v2').countDocuments({ chatId }),
    ]);

    // 시간순으로 정렬해서 반환 (클라이언트에서 사용하기 편하게)
    const sortedMessages = messages.reverse();

    return NextResponse.json({
      success: true,
      data: sortedMessages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('메시지 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '메시지를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 메시지 발송
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { chatId } = await params;
    const body = await request.json();

    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채팅 ID입니다.' },
        { status: 400 }
      );
    }

    const validation = validateBody(createChatMessageSchema, body);
    if (!validation.success) return validation.response;
    const { content = '', messageType = 'text', imageUrl, senderName, senderId } = validation.data;

    const { db } = await connectToDatabase();

    // 대화방 존재 확인
    const chat = await db.collection('channelChats_v2').findOne({
      _id: new ObjectId(chatId),
      clinicId,
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: '대화방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const now = new Date();
    const channel = chat.channel as ChannelType;

    // ============================================
    // 채널별 메시지 발송 처리
    // ============================================

    let externalSendResult: { success: boolean; error?: string } = { success: true };

    switch (channel) {
      case 'naver':
        externalSendResult = await sendNaverTalkTalkMessage(
          chat.channelUserKey,
          content,
          messageType,
          imageUrl
        );
        break;

      case 'kakao':
        externalSendResult = await sendKakaoMessage(
          db,
          chatId,
          chat.channelUserKey,
          content,
          messageType,
          imageUrl
        );
        break;

      case 'website':
        // 웹사이트 채널은 Pusher로 전송 + 이탈 고객에게 SMS 알림
        // SMS 알림은 아래에서 비동기로 처리 (발송 성공 후)
        break;

      case 'instagram':
        externalSendResult = await sendInstagramMessage(
          chat,
          content,
          messageType,
          imageUrl
        );
        break;

      default:
        console.log('[메시지 API] 알 수 없는 채널:', channel);
    }

    // 외부 발송 실패 시 에러 반환
    if (!externalSendResult.success) {
      // 실패 메시지도 DB에 저장 (히스토리용)
      const failedMessage = {
        chatId,
        direction: 'outgoing' as MessageDirection,
        messageType: messageType as MessageType,
        content: content || '[이미지]',
        fileUrl: imageUrl,
        senderType: 'agent' as SenderType,
        senderName: senderName || '상담사',
        senderId,
        status: 'failed' as MessageStatus,
        errorMessage: externalSendResult.error,
        createdAt: now,
      };

      await db.collection('channelMessages_v2').insertOne(failedMessage);

      return NextResponse.json(
        { success: false, error: externalSendResult.error || '메시지 발송 실패' },
        { status: 400 }
      );
    }

    // 메시지 생성
    const newMessage = {
      chatId,
      direction: 'outgoing' as MessageDirection,
      messageType: messageType as MessageType,
      content: content || '[이미지]',
      fileUrl: imageUrl,
      senderType: 'agent' as SenderType,
      senderName: senderName || '상담사',
      senderId,
      status: 'sent' as MessageStatus,
      createdAt: now,
    };

    const result = await db.collection('channelMessages_v2').insertOne(newMessage);

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

    // Pusher로 실시간 이벤트 전송 (상담사 UI 및 웹사이트 위젯용)
    const savedMessage = {
      id: result.insertedId.toString(),
      ...newMessage,
    };

    try {
      console.log('[메시지 API] Pusher 이벤트 전송:', { chatId, channel, senderType: savedMessage.senderType });
      await pusher.trigger('channel-chat-v2', 'new-message', {
        chatId,
        message: savedMessage,
        chat: {
          _id: chat._id,
          lastMessageAt: now,
          lastMessagePreview: (content || '[이미지]').substring(0, 50),
        },
      });
    } catch (pusherError) {
      console.error('[메시지 API] Pusher 이벤트 전송 실패:', pusherError);
      // Pusher 실패해도 메시지는 저장되었으므로 계속 진행
    }

    // 홈페이지 채팅: SMS 알림은 Cron Job에서 처리 (10분 미응답 시)
    // /api/cron/send-chat-notifications 에서 주기적으로 체크

    return NextResponse.json({
      success: true,
      data: { ...newMessage, _id: result.insertedId },
    });
  } catch (error) {
    console.error('메시지 발송 오류:', error);
    return NextResponse.json(
      { success: false, error: '메시지 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ============================================
// 네이버톡톡 메시지 발송
// ============================================

async function sendNaverTalkTalkMessage(
  userKey: string | undefined,
  content: string,
  messageType: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  if (!userKey) {
    return { success: false, error: '네이버톡톡 사용자 식별키가 없습니다.' };
  }

  const authToken = process.env.NAVER_TALKTALK_AUTH_TOKEN;
  if (!authToken) {
    console.error('[네이버 발송] NAVER_TALKTALK_AUTH_TOKEN 환경변수 없음');
    return { success: false, error: '네이버톡톡 인증 토큰이 설정되지 않았습니다.' };
  }

  try {
    const naverRequest: any = {
      event: 'send',
      user: userKey,
      options: { notification: true },
    };

    if (messageType === 'image' && imageUrl) {
      naverRequest.imageContent = { imageUrl };
    } else {
      naverRequest.textContent = { text: content };
    }

    console.log('[네이버 발송] 요청:', JSON.stringify(naverRequest, null, 2));

    const response = await fetch(NAVER_TALKTALK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: authToken,
      },
      body: JSON.stringify(naverRequest),
    });

    const result = await response.json();
    console.log('[네이버 발송] 응답:', JSON.stringify(result, null, 2));

    if (!result.success || result.resultCode !== '00') {
      const errorMessages: Record<string, string> = {
        '01': '인증 정보 오류',
        '02': 'JSON 파싱 오류',
        '03': '필수 필드 누락',
        '04': '사용자를 찾을 수 없음',
        '05': '메시지 형식 오류',
        'IMG-01': '이미지 포맷 오류',
        'IMG-02': '이미지 다운로드 타임아웃',
        'IMG-03': '이미지 크기 초과',
      };

      return {
        success: false,
        error: errorMessages[result.resultCode] || `발송 실패 (코드: ${result.resultCode})`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[네이버 발송] 오류:', error);
    return { success: false, error: '네이버톡톡 API 호출 중 오류가 발생했습니다.' };
  }
}

// ============================================
// 카카오 메시지 발송
// ============================================

async function sendKakaoMessage(
  db: any,
  chatId: string,
  userKey: string | undefined,
  content: string,
  messageType: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string; pending?: boolean }> {
  // 상담톡 API 토큰이 있는 경우 직접 발송 시도
  const consultalkToken = process.env.KAKAO_CONSULTALK_API_TOKEN;

  if (consultalkToken && userKey) {
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
          Authorization: `Bearer ${consultalkToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      console.log('[카카오 상담톡] 응답:', JSON.stringify(result, null, 2));

      if (response.ok && result.success) {
        return { success: true };
      }

      // 상담톡 API 실패 시 pending_send로 저장
      console.log('[카카오 상담톡] API 발송 실패, pending_send로 전환');
    } catch (error) {
      console.error('[카카오 상담톡] API 오류:', error);
    }
  }

  // 상담톡 API 미설정 또는 실패 시: pending_send 상태로 저장
  // 고객이 다음 메시지를 보낼 때 웹훅 응답으로 전송됨
  console.log('[카카오 발송] 상담톡 API 미설정 - pending_send로 저장');

  // pending 메시지 저장 (메인 로직에서 별도로 저장하므로 여기서는 상태만 반환)
  // 실제 pending 저장은 /api/v2/webhooks/kakao/send에서 처리
  return {
    success: true, // 저장 자체는 성공
    pending: true, // 즉시 발송되지 않음을 표시
  };
}

// ============================================
// 홈페이지 채팅 이탈 고객 SMS 알림
// ============================================

async function sendWebsiteChatSmsNotification(
  db: any,
  chat: any,
  agentMessage: string
): Promise<void> {
  // CoolSMS SDK 로드 확인
  if (!coolsmsService) {
    console.log('[SMS 알림] CoolSMS SDK 미로드, 알림 건너뜀');
    return;
  }

  // 환경 변수 확인
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  const senderNumber = process.env.COOLSMS_SENDER_NUMBER;

  if (!apiKey || !apiSecret || !senderNumber) {
    console.log('[SMS 알림] CoolSMS 환경 변수 미설정, 알림 건너뜀');
    return;
  }

  const phone = chat.phone?.replace(/-/g, '');
  if (!phone) {
    console.log('[SMS 알림] 전화번호 없음, 알림 건너뜀');
    return;
  }

  try {
    // 병원 이름 가져오기 (설정에서)
    const settings = await db.collection('settings').findOne({});
    const clinicName = settings?.clinicName || '병원';

    // SMS 메시지 생성 (90바이트 이내)
    const smsMessage = `[${clinicName}] 홈페이지 상담 답변이 도착했습니다. 확인해주세요.`;

    console.log('[SMS 알림] 발송 시도:', { phone, clinicName, chatId: chat._id?.toString() });

    // CoolSMS 발송
    const messageService = new coolsmsService(apiKey, apiSecret);
    await messageService.sendOne({
      to: phone,
      from: senderNumber,
      text: smsMessage,
      type: 'SMS',
    });

    console.log('[SMS 알림] 발송 성공:', phone);

    // 중복 발송 방지: smsNotificationSent 플래그 설정
    await db.collection('channelChats_v2').updateOne(
      { _id: chat._id },
      { $set: { smsNotificationSent: true, smsNotificationSentAt: new Date() } }
    );
  } catch (error) {
    console.error('[SMS 알림] 발송 실패:', error);
    // 실패해도 메인 로직에 영향 없음
  }
}

// ============================================
// 인스타그램 메시지 발송
// ============================================

async function sendInstagramMessage(
  chat: any,
  content: string,
  messageType: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  if (!chat.channelUserKey) {
    return { success: false, error: '인스타그램 사용자 식별키가 없습니다.' };
  }

  // 24시간 윈도우 확인
  const now = new Date();
  if (chat.messageWindowExpiresAt && new Date(chat.messageWindowExpiresAt) < now) {
    return {
      success: false,
      error: '24시간 응답 시간이 초과되었습니다. 고객이 다시 메시지를 보내야 응답할 수 있습니다.',
    };
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const pageId = process.env.INSTAGRAM_PAGE_ID || chat.channelPageId;

  if (!accessToken) {
    console.error('[인스타그램 발송] INSTAGRAM_ACCESS_TOKEN 환경변수 없음');
    return { success: false, error: '인스타그램 액세스 토큰이 설정되지 않았습니다.' };
  }

  if (!pageId) {
    console.error('[인스타그램 발송] Page ID 없음');
    return { success: false, error: '인스타그램 페이지 ID가 설정되지 않았습니다.' };
  }

  try {
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

    if (!response.ok || result.error) {
      const errorMessages: Record<number, string> = {
        10: '권한이 없습니다.',
        100: '잘못된 파라미터입니다.',
        190: '액세스 토큰이 만료되었습니다.',
        200: '권한이 부족합니다.',
        551: '이 사용자에게 메시지를 보낼 수 없습니다.',
        613: '요청 제한 초과. 잠시 후 다시 시도해주세요.',
      };

      const errorCode = result.error?.code;
      return {
        success: false,
        error: errorMessages[errorCode] || result.error?.message || `발송 실패 (코드: ${errorCode})`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[인스타그램 발송] 오류:', error);
    return { success: false, error: '인스타그램 API 호출 중 오류가 발생했습니다.' };
  }
}
