// src/app/api/v2/call-analysis/diarize/route.ts
// 기존 통화 녹취에 화자분리를 적용하는 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const maxDuration = 60;

// GPT를 사용한 화자분리
async function diarizeWithGPT(plainText: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

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
          content: `당신은 치과 콜센터 통화 녹취록을 화자분리하는 전문가입니다.
주어진 텍스트를 "상담사"와 "환자" 두 화자로 분리하여 대화 형식으로 변환하세요.

규칙:
1. 각 발화를 "상담사: " 또는 "환자: "로 시작
2. 각 발화는 줄바꿈(\\n)으로 구분
3. 병원 직원의 말(인사, 안내, 설명, 질문)은 "상담사:"
4. 내원자/문의자의 말(증상 설명, 질문, 응답)은 "환자:"
5. 맥락상 화자가 바뀌는 지점을 정확히 파악
6. 원문의 내용을 변경하지 말고, 화자 라벨만 추가
7. 내용이 짧거나 화자 구분이 불가능하면 원문 그대로 반환`,
        },
        { role: 'user', content: plainText },
      ],
      temperature: 0.1,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GPT API: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const result = data.choices[0]?.message?.content?.trim();

  if (!result || result.length < plainText.length * 0.3) {
    throw new Error('화자분리 결과가 너무 짧음');
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callLogId } = body;

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

    const transcript = callLog.aiAnalysis?.transcript;
    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcript not found' },
        { status: 400 }
      );
    }

    // 이미 화자분리가 되어있으면 스킵
    if (transcript.includes('상담사:') || transcript.includes('환자:')) {
      return NextResponse.json({
        success: true,
        callLogId,
        message: 'Already diarized',
        transcript,
      });
    }

    console.log(`[Diarize] 화자분리 시작: ${callLogId} (${transcript.length}자)`);

    const diarized = await diarizeWithGPT(transcript);

    // DB 업데이트: 화자분리 결과 저장, 원본은 rawTranscript로 보존
    await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      {
        $set: {
          'aiAnalysis.transcript': diarized,
          'aiAnalysis.rawTranscript': transcript,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    console.log(`[Diarize] 완료: ${callLogId}`);

    return NextResponse.json({
      success: true,
      callLogId,
      transcript: diarized,
      rawTranscript: transcript,
    });
  } catch (error) {
    console.error('[Diarize] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
