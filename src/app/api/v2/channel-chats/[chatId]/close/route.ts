// src/app/api/v2/channel-chats/[chatId]/close/route.ts
// 채팅 상담 종료 + AI 분석 API

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import OpenAI from 'openai';
import Pusher from 'pusher';

export const dynamic = 'force-dynamic';

// OpenAI 클라이언트
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Pusher 클라이언트
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

interface RouteParams {
  params: Promise<{ chatId: string }>;
}

// AI 채팅 분석 프롬프트
const CHAT_ANALYSIS_PROMPT = `당신은 치과 상담 분석 전문가입니다.
다음 채팅 대화 내용을 분석하여 JSON 형식으로 결과를 반환하세요.

분석 항목:
1. interest: 관심 치료 (임플란트, 교정, 충치치료, 스케일링 등)
2. temperature: 관심도 (hot: 즉시 예약 의향, warm: 관심 있음, cold: 정보 수집 중)
3. summary: 상담 요약 (1-2문장)
4. followUp: 후속 조치 (콜백필요, 예약확정, 종결 중 하나)
5. concerns: 고객이 우려하는 점 배열 (가격, 통증, 기간 등)
6. confidence: 분석 신뢰도 (0.0 ~ 1.0)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "interest": "string",
  "temperature": "hot" | "warm" | "cold",
  "summary": "string",
  "followUp": "콜백필요" | "예약확정" | "종결",
  "concerns": ["string"],
  "confidence": number
}`;

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { chatId } = await params;

    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채팅 ID입니다.' },
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

    // 메시지 조회
    const messages = await db
      .collection('channelMessages_v2')
      .find({ chatId })
      .sort({ createdAt: 1 })
      .toArray();

    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, error: '분석할 메시지가 없습니다.' },
        { status: 400 }
      );
    }

    // 채팅 내용 포맷팅
    const chatContent = messages
      .map((msg) => {
        const role = msg.senderType === 'customer' ? '고객' : '상담사';
        return `${role}: ${msg.content}`;
      })
      .join('\n');

    // AI 분석 수행
    let aiAnalysis = null;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: CHAT_ANALYSIS_PROMPT },
          { role: 'user', content: `다음 채팅 대화를 분석해주세요:\n\n${chatContent}` },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const responseText = completion.choices[0]?.message?.content || '';

      // JSON 파싱 시도
      try {
        // JSON 블록 추출
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiAnalysis = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('[AI 분석] JSON 파싱 실패:', parseError);
        // 기본값 사용
        aiAnalysis = {
          interest: '기타',
          temperature: 'warm',
          summary: '채팅 상담 종료',
          followUp: '콜백필요',
          concerns: [],
          confidence: 0.5,
        };
      }
    } catch (aiError) {
      console.error('[AI 분석] OpenAI 호출 실패:', aiError);
      // AI 실패 시 기본값
      aiAnalysis = {
        interest: '기타',
        temperature: 'warm',
        summary: '채팅 상담 종료 (AI 분석 실패)',
        followUp: '콜백필요',
        concerns: [],
        confidence: 0,
      };
    }

    const now = new Date();

    // 대화방 종료 및 AI 분석 결과 저장
    await db.collection('channelChats_v2').updateOne(
      { _id: new ObjectId(chatId) },
      {
        $set: {
          status: 'closed',
          aiAnalysis,
          aiAnalyzedAt: now,
          updatedAt: now,
        },
      }
    );

    // 시스템 메시지 추가
    await db.collection('channelMessages_v2').insertOne({
      chatId,
      direction: 'outgoing',
      messageType: 'system',
      content: '상담이 종료되었습니다.',
      senderType: 'system',
      status: 'sent',
      createdAt: now,
    });

    // 실시간 이벤트 발송
    await pusher.trigger('channel-chat-v2', 'chat-closed', { chatId });
    await pusher.trigger('channel-chat-v2', 'ai-analysis-complete', {
      chatId,
      analysis: aiAnalysis,
    });

    return NextResponse.json({
      success: true,
      data: {
        chatId,
        status: 'closed',
        aiAnalysis,
      },
    });
  } catch (error) {
    console.error('[상담 종료] 오류:', error);
    return NextResponse.json(
      { success: false, error: '상담 종료 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
