// src/app/api/v2/call-analysis/diarize/route.ts
// 기존 통화 녹취에 화자분리를 적용하는 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const maxDuration = 120;

// 통화 방향에 따른 화자분리 프롬프트 생성
function buildDiarizePrompt(direction: 'inbound' | 'outbound' | string): string {
  const directionHint = direction === 'outbound'
    ? `이 통화는 **발신(아웃바운드)** 통화입니다.
- 첫 번째 발화자는 반드시 "상담사"입니다 (전화를 건 쪽).
- 상담사가 먼저 "여보세요" 또는 병원 소개를 합니다.`
    : `이 통화는 **수신(인바운드)** 통화입니다.
- 첫 번째 발화자는 반드시 "상담사"입니다 (전화를 받는 쪽).
- 상담사가 먼저 "감사합니다, OO치과입니다" 등의 인사를 합니다.`;

  return `당신은 치과 콜센터 통화 녹취록의 화자분리 전문가입니다.
아래 녹취 텍스트를 "상담사"와 "환자" 두 화자로 분리하세요.

## 통화 정보
${directionHint}

## 화자 구분 핵심 패턴

### 상담사 (병원 직원)의 특징:
- 병원 이름을 말함 ("OO치과", "저희 병원")
- 치료 설명/안내 ("임플란트는~", "치료 과정이~")
- 가격/비용 안내 ("이벤트 가격이~", "한 대당~")
- 예약/방문 유도 ("한번 오셔서~", "상담 받아보시겠어요?")
- 환자 정보 확인 ("성함이~", "거주하시는 곳이~", "OO님 맞으세요?")
- 맞장구/경청 ("아 그러셨구나", "네 맞습니다", "아 그러세요")

### 환자의 특징:
- 본인 증상/상황 설명 ("이빨이~", "임플란트 2대 박아놓고~", "틀니 쓰고 있는데~")
- 비용 질문/반응 ("얼마예요?", "비용이 부담되서~")
- 개인 정보 대답 ("방학동이요", "75세요", "의료급여~")
- 치료 경험 언급 ("다른 병원에서~", "몇 년 전에~")

## 규칙
1. 각 발화를 "상담사: " 또는 "환자: "로 시작
2. 각 발화는 줄바꿈으로 구분
3. 원문 내용을 절대 수정/생략하지 말 것 — 화자 라벨만 추가
4. 한 화자가 연속으로 긴 말을 할 수 있음 (무리하게 턴을 나누지 말 것)
5. "네", "아" 같은 짧은 맞장구는 맥락상 누구의 것인지 판단
6. 확신이 없으면 앞뒤 맥락(누가 질문했고 누가 대답하는지)으로 판단
7. 화자분리된 결과만 출력하고, 설명이나 주석은 붙이지 말 것`;
}

// GPT-5-mini를 사용한 화자분리 (reasoning 모델 — 높은 정확도)
async function diarizeWithGPT(plainText: string, direction: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const prompt = buildDiarizePrompt(direction);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      messages: [
        { role: 'developer', content: prompt },
        { role: 'user', content: plainText },
      ],
      max_completion_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GPT API: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const result = data.choices[0]?.message?.content?.trim();

  if (!result || result.length < plainText.length * 0.1) {
    const finishReason = data.choices[0]?.finish_reason;
    throw new Error(`화자분리 결과가 너무 짧음 (${result?.length || 0}자 / 원본 ${plainText.length}자, finish: ${finishReason})`);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callLogId, force } = body;

    if (!callLogId) {
      return NextResponse.json(
        { success: false, error: 'callLogId required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const callLog = await db.collection('callLogs_v2').findOne({
      _id: new ObjectId(callLogId),
    });

    if (!callLog) {
      return NextResponse.json(
        { success: false, error: 'Call log not found' },
        { status: 404 }
      );
    }

    // force면 rawTranscript(원본)에서 재분리, 아니면 현재 transcript 사용
    const rawTranscript = callLog.aiAnalysis?.rawTranscript;
    const currentTranscript = callLog.aiAnalysis?.transcript;
    const transcript = force && rawTranscript ? rawTranscript : currentTranscript;

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcript not found' },
        { status: 400 }
      );
    }

    // 이미 화자분리가 되어있으면 스킵 (force면 무시)
    if (!force && (transcript.includes('상담사:') || transcript.includes('환자:'))) {
      return NextResponse.json({
        success: true,
        callLogId,
        message: 'Already diarized',
        transcript,
      });
    }

    // 통화 방향 정보
    const direction = callLog.direction || callLog.callType || 'unknown';
    console.log(`[Diarize] 화자분리 시작: ${callLogId} (${transcript.length}자, ${direction})`);

    const diarized = await diarizeWithGPT(transcript, direction);

    // DB 업데이트: 화자분리 결과 저장, 원본은 rawTranscript로 보존
    await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      {
        $set: {
          'aiAnalysis.transcript': diarized,
          'aiAnalysis.rawTranscript': rawTranscript || transcript,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    console.log(`[Diarize] 완료: ${callLogId}`);

    return NextResponse.json({
      success: true,
      callLogId,
      transcript: diarized,
      rawTranscript: rawTranscript || transcript,
    });
  } catch (error) {
    console.error('[Diarize] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '화자 분리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
