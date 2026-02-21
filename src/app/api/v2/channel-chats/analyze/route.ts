// src/app/api/v2/channel-chats/analyze/route.ts
// 채팅 상담 AI 분석 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

export const dynamic = 'force-dynamic';

// 채팅 분석용 프롬프트
function buildChatAnalysisPrompt(messages: string): string {
  return `당신은 치과 채팅 상담 분석 전문가입니다. 아래 채팅 내용을 분석해주세요.

## 채팅 내용
${messages}

## 분석 요청
위 채팅 내용을 분석하여 다음 JSON 형식으로 응답해주세요. 반드시 유효한 JSON만 출력하세요.

{
  "interest": "관심 진료 (임플란트/교정/충치치료/스케일링/검진/미백/기타 중 선택)",
  "temperature": "온도 (hot/warm/cold 중 하나 - hot:예약확정/매우적극, warm:관심있음, cold:단순문의)",
  "summary": "핵심 내용 요약 (2~3줄, 각 줄은 \\n으로 구분)",
  "followUp": "후속조치 (콜백필요/예약확정/종결 중 하나)",
  "concerns": ["환자 우려사항 배열"],
  "confidence": 0.85
}

## summary 작성 가이드라인
- 환자가 문의한 주요 내용
- 상담사가 안내한 핵심 정보
- 다음 단계 (예약, 추가 상담 등)

## 가이드라인
- temperature: hot(예약확정/매우적극), warm(관심있음/추가상담필요), cold(단순문의/관심낮음)
- followUp: 콜백필요(전화상담 권유), 예약확정(예약 완료), 종결(추가조치 불필요)

JSON만 출력하세요.`;
}

// OpenAI GPT-4o-mini 호출
async function analyzeWithGPT(messages: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = buildChatAnalysisPrompt(messages);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 치과 채팅 상담 분석 전문가입니다. 요청받은 형식의 JSON만 출력합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GPT API 오류: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('GPT 응답이 비어있습니다.');
  }

  // JSON 파싱
  try {
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const result = JSON.parse(jsonStr);

    return {
      interest: result.interest || '기타',
      temperature: result.temperature || 'warm',
      summary: result.summary || '',
      followUp: result.followUp || '콜백필요',
      concerns: result.concerns || [],
      confidence: result.confidence || 0.8,
      analyzedAt: new Date().toISOString(),
    };
  } catch (parseError) {
    console.error('[Chat Analyze] JSON 파싱 오류:', parseError);

    return {
      interest: '기타',
      temperature: 'warm',
      summary: '분석 결과를 파싱할 수 없습니다.',
      followUp: '콜백필요',
      concerns: [],
      confidence: 0.5,
      analyzedAt: new Date().toISOString(),
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const body = await request.json();
    const { chatId } = body;

    console.log(`[Chat Analyze] 분석 시작: ${chatId}`);

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'chatId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채팅 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 채팅 조회
    const chat = await db.collection('channelChats_v2').findOne({
      _id: new ObjectId(chatId),
      clinicId,
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: '채팅을 찾을 수 없습니다.' },
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

    // 메시지를 텍스트로 변환
    const messageText = messages
      .map((msg) => {
        const sender = msg.senderType === 'agent' ? '상담사' : '고객';
        return `[${sender}] ${msg.content}`;
      })
      .join('\n');

    // AI 분석 실행
    const analysis = await analyzeWithGPT(messageText);

    // 분석 결과 저장
    await db.collection('channelChats_v2').updateOne(
      { _id: new ObjectId(chatId) },
      {
        $set: {
          aiAnalysis: analysis,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    console.log(`[Chat Analyze] 분석 완료: ${chatId}`);
    console.log(`  관심사: ${analysis.interest}, 온도: ${analysis.temperature}`);

    // 환자 정보 업데이트 (있는 경우)
    if (chat.patientId) {
      try {
        const updateData: Record<string, unknown> = {
          temperature: analysis.temperature,
          updatedAt: new Date().toISOString(),
        };

        if (analysis.interest && analysis.interest !== '기타') {
          updateData.interest = analysis.interest;
        }

        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(chat.patientId) },
          { $set: updateData }
        );

        console.log(`[Chat Analyze] 환자 정보 업데이트: ${chat.patientId}`);
      } catch (patientError) {
        console.error('[Chat Analyze] 환자 업데이트 오류:', patientError);
      }
    }

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('[Chat Analyze] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
