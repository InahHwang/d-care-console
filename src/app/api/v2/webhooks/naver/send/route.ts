// src/app/api/v2/webhooks/naver/send/route.ts
// 네이버 톡톡 메시지 발송 API
// API 문서: https://github.com/navertalk/chatbot-api

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import Pusher from 'pusher';

export const dynamic = 'force-dynamic';

// 네이버톡톡 발송 API 엔드포인트
const NAVER_TALKTALK_API_URL = 'https://gw.talk.naver.com/chatbot/v1/event';

// Pusher 클라이언트
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// ============================================
// 네이버톡톡 발송 API 타입 정의
// ============================================

interface NaverSendRequest {
  event: 'send';
  user: string;
  textContent?: {
    text: string;
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
        data: {
          title: string;
          code?: string;
          url?: string;
        };
      }>;
    }>;
  };
  options?: {
    notification?: boolean;
  };
}

interface NaverSendResponse {
  success: boolean;
  resultCode: string;
  resultMessage?: string;
}

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

    if (chat.channel !== 'naver') {
      return NextResponse.json(
        { success: false, error: '네이버 톡톡 대화방이 아닙니다.' },
        { status: 400 }
      );
    }

    if (!chat.channelUserKey) {
      return NextResponse.json(
        { success: false, error: '사용자 식별키가 없습니다.' },
        { status: 400 }
      );
    }

    // 환경변수 확인
    const authToken = process.env.NAVER_TALKTALK_AUTH_TOKEN;
    if (!authToken) {
      console.error('[네이버 발송] NAVER_TALKTALK_AUTH_TOKEN 환경변수 없음');
      return NextResponse.json(
        { success: false, error: '네이버톡톡 인증 토큰이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const now = new Date();

    // 네이버톡톡 발송 요청 구성
    const naverRequest: NaverSendRequest = {
      event: 'send',
      user: chat.channelUserKey,
      options: {
        notification: true, // 푸시 알림 발송
      },
    };

    if (messageType === 'image' && imageUrl) {
      naverRequest.imageContent = { imageUrl };
    } else {
      naverRequest.textContent = { text: content };
    }

    console.log('[네이버 발송] 요청:', JSON.stringify(naverRequest, null, 2));

    // 네이버톡톡 API 호출
    const naverResponse = await fetch(NAVER_TALKTALK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: authToken,
      },
      body: JSON.stringify(naverRequest),
    });

    const naverResult: NaverSendResponse = await naverResponse.json();
    console.log('[네이버 발송] 응답:', JSON.stringify(naverResult, null, 2));

    // 발송 결과 확인
    if (!naverResult.success || naverResult.resultCode !== '00') {
      const errorMessage = getNaverErrorMessage(naverResult.resultCode);
      console.error('[네이버 발송] 실패:', errorMessage);

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
        errorCode: naverResult.resultCode,
        errorMessage,
        createdAt: now,
      };

      await db.collection('channelMessages_v2').insertOne(failedMessage);

      return NextResponse.json(
        { success: false, error: errorMessage, code: naverResult.resultCode },
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

    console.log('[네이버 발송] 성공:', messageResult.insertedId.toString());

    return NextResponse.json({
      success: true,
      data: savedMessage,
    });
  } catch (error) {
    console.error('[네이버 발송] 오류:', error);
    return NextResponse.json(
      { success: false, error: '메시지 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ============================================
// 에러 코드 매핑
// ============================================

function getNaverErrorMessage(code: string): string {
  const errorMessages: Record<string, string> = {
    '00': '성공',
    '01': '인증 정보 오류 (Authorization 확인 필요)',
    '02': 'JSON 파싱 오류',
    '03': '필수 필드 누락',
    '04': '사용자를 찾을 수 없음',
    '05': '메시지 형식 오류',
    'IMG-01': '이미지 포맷 오류 (jpg, png, gif만 지원)',
    'IMG-02': '이미지 다운로드 타임아웃',
    'IMG-03': '이미지 크기 초과 (20MB 제한)',
  };

  return errorMessages[code] || `알 수 없는 오류 (코드: ${code})`;
}
