// src/app/api/v2/call-analysis/coaching/route.ts
// 통화 녹취 기반 AI 상담 코칭 분석

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import type { AICoachingResult } from '@/types/v2';

// Vercel Function 타임아웃 설정 (gpt-5.2는 응답이 느릴 수 있음)
export const maxDuration = 120;

// 환자 상태 한글 매핑
const PATIENT_STATUS_LABELS: Record<string, string> = {
  consulting: '전화상담 중',
  reserved: '내원예약 완료',
  visited: '내원완료',
  treatmentBooked: '치료예약 완료',
  treatment: '치료 진행 중',
  completed: '치료완료',
  followup: '사후관리',
  closed: '종결',
};

// 코칭 프롬프트 생성
function buildCoachingPrompt(
  transcript: string,
  consultationStatus: string | undefined,
  statusReason: string | undefined,
  disagreeReasons: string[] | undefined,
  summary: string,
  concerns: string[],
  interest?: string,
  patientStatus?: string
): string {
  const statusLabel = patientStatus ? (PATIENT_STATUS_LABELS[patientStatus] || patientStatus) : '알 수 없음';

  return `당신은 치과 콜센터 상담 코칭 전문가입니다. 아래 통화 녹취를 분석하여 상담사에게 구체적인 개선 조언을 제공하세요.

## 통화 녹취
${transcript}

## 상담 결과 정보
- 상담 결과: ${consultationStatus || '알 수 없음'} (${statusReason || ''})
- 미동의/보류 사유: ${disagreeReasons?.length ? disagreeReasons.join(', ') : '없음'}
- 관심 치료: ${interest || '알 수 없음'}
- AI 요약: ${summary}
- 환자 우려사항: ${concerns.length ? concerns.join(', ') : '없음'}

## 환자 현재 상태 (실제 결과)
- 현재 퍼널 상태: ${statusLabel}
※ 이 상태는 이 통화 이후 환자가 실제로 도달한 단계입니다. 예약/내원/치료까지 진행된 환자라면 상담이 효과적이었다는 뜻이므로 점수에 반드시 반영하세요.

## 분석 요청
위 통화를 분석하여 다음 JSON 형식으로 응답해주세요.

{
  "overallScore": 0~100,
  "overallComment": "전반적 평가 (2-3문장)",
  "strengths": [
    {
      "point": "잘한 포인트 제목",
      "quote": "관련 대화 인용 (있으면)",
      "explanation": "왜 이것이 효과적이었는지"
    }
  ],
  "improvements": [
    {
      "point": "개선이 필요한 포인트 제목",
      "quote": "관련 대화 인용 (있으면)",
      "currentApproach": "상담사가 실제로 한 말/접근",
      "suggestedApproach": "이렇게 말했으면 더 좋았을 구체적 화법 예시",
      "reason": "왜 이 변경이 효과적인지"
    }
  ],
  "missedOpportunities": [
    "놓친 기회 설명"
  ],
  "nextCallStrategy": "다음 콜백 시 추천 전략 (2-3문장)"
}

## 코칭 작성 가이드라인

### 핵심 원칙
1. **구체적 화법 제안 필수**: "공감해야 합니다" 같은 추상적 조언 금지. 반드시 "어머니, 금액이 부담되시죠. 저도 충분히 이해합니다. 다만 이 치료를 미루시면..." 수준의 구체적 대안 화법을 제시하세요.
2. **녹취 기반만**: 녹취에 없는 내용은 추측하지 마세요.
3. **균형잡힌 평가**: 잘한 점도 반드시 1개 이상 포함하세요.
4. **실행 가능한 조언**: 다음 콜백에서 바로 적용 가능해야 합니다.

### overallScore 기준
**중요: 환자의 실제 전환 결과를 반드시 반영하세요.**
- 환자가 내원예약 이상(reserved/visited/treatmentBooked/treatment/completed)까지 진행했으면 최소 75점 이상
- 치료예약/치료 진행까지 갔으면 최소 80점 이상
- 화법이 다소 아쉬워도 결과가 좋으면 높은 점수를 주되, 개선점은 별도로 제시

점수 범위:
- 90~100: 모범적 상담 (예약 확정 + 우수한 화법)
- 80~89: 좋은 결과 (전환 성공, 개선 여지 약간 있음)
- 70~79: 양호 (전환 성공했거나, 미전환이지만 적절한 상담)
- 50~69: 주요 개선점 존재 (환자 이탈 위험)
- 30~49: 상당한 개선 필요
- 0~29: 기본 응대 미흡

### strengths (1~3개)
- 상담사가 잘 대응한 구체적 포인트

### improvements (2~4개, 가장 중요!)
- 결정적으로 개선하면 결과가 달라졌을 포인트
- 각 개선점에 반드시 suggestedApproach(구체적 대안 화법) 포함

### 미동의 사유별 특화 코칭
- **가격 부담**: 가치 제안 화법, 분할납부/보험 안내, 치료 미루면 더 큰 비용 발생 설명
- **치료 계획 이견**: 환자 관점 경청, 대안 제시, 단계적 접근 제안
- **결정 보류**: 긴급성 부여 (통증 악화, 치아 상태), 명확한 후속 연락 약속
- **타 병원 비교**: 해당 병원의 차별화 포인트, 원장님 경력/전문성 강조

### missedOpportunities (0~2개)
- 통화에서 다루지 않았지만 다뤘으면 좋았을 포인트

### nextCallStrategy
- 이 환자에게 다시 전화할 때의 구체적 전략 (오프닝 멘트, 핵심 포인트)

반드시 유효한 JSON만 출력하세요.`;
}

// OpenAI GPT 호출
async function analyzeCoachingWithGPT(
  transcript: string,
  consultationStatus: string | undefined,
  statusReason: string | undefined,
  disagreeReasons: string[] | undefined,
  summary: string,
  concerns: string[],
  interest?: string,
  patientStatus?: string
): Promise<AICoachingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = buildCoachingPrompt(
    transcript, consultationStatus, statusReason,
    disagreeReasons, summary, concerns, interest, patientStatus
  );

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'developer',
          content: '당신은 치과 콜센터 상담 코칭 전문가입니다. 요청받은 형식의 JSON만 출력합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_completion_tokens: 16000,
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

  // JSON 파싱 (코드블록 래핑 대응)
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const result = JSON.parse(jsonStr);

  return {
    overallScore: result.overallScore ?? 50,
    overallComment: result.overallComment || '',
    strengths: result.strengths || [],
    improvements: result.improvements || [],
    missedOpportunities: result.missedOpportunities || [],
    nextCallStrategy: result.nextCallStrategy || '',
    generatedAt: new Date().toISOString(),
    model: 'gpt-5.2',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callLogId, force, preview, apply, coachingData } = body;

    console.log(`[Coaching] 코칭 분석 요청: ${callLogId}, force: ${force}, preview: ${preview}, apply: ${apply}`);

    if (!callLogId) {
      return NextResponse.json(
        { success: false, error: 'callLogId required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // apply 모드: 미리보기 결과를 DB에 저장
    if (apply && coachingData) {
      const callLog = await db.collection('callLogs_v2').findOne(
        { _id: new ObjectId(callLogId) },
        { projection: { patientId: 1 } }
      );

      await db.collection('callLogs_v2').updateOne(
        { _id: new ObjectId(callLogId) },
        { $set: { aiCoaching: coachingData, updatedAt: new Date().toISOString() } }
      );

      if (callLog?.patientId && ObjectId.isValid(callLog.patientId)) {
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(callLog.patientId) },
          { $set: { lastCoachingScore: coachingData.overallScore, lastCoachingAt: coachingData.generatedAt } }
        );
      }

      console.log(`[Coaching] 미리보기 결과 적용: ${callLogId}, score: ${coachingData.overallScore}`);
      return NextResponse.json({ success: true, callLogId, coaching: coachingData, cached: false });
    }

    // 통화 기록 조회
    const callLog = await db.collection('callLogs_v2').findOne({
      _id: new ObjectId(callLogId),
    });

    if (!callLog) {
      return NextResponse.json(
        { success: false, error: 'Call log not found' },
        { status: 404 }
      );
    }

    // transcript 확인
    const transcript = callLog.aiAnalysis?.transcript;
    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcript not found. STT must complete first.' },
        { status: 400 }
      );
    }

    // 캐시 확인 (force가 아니면 기존 결과 반환)
    if (callLog.aiCoaching && !force) {
      console.log(`[Coaching] 캐시된 코칭 결과 반환: ${callLogId}`);
      return NextResponse.json({
        success: true,
        callLogId,
        coaching: callLog.aiCoaching,
        cached: true,
      });
    }

    // 환자 현재 상태 조회
    let patientStatus: string | undefined;
    if (callLog.patientId && ObjectId.isValid(callLog.patientId)) {
      const patient = await db.collection('patients_v2').findOne(
        { _id: new ObjectId(callLog.patientId) },
        { projection: { status: 1 } }
      );
      patientStatus = patient?.status;
    }

    // AI 코칭 분석 실행
    const aiAnalysis = callLog.aiAnalysis;
    const coaching = await analyzeCoachingWithGPT(
      transcript,
      aiAnalysis?.consultationResult?.status,
      aiAnalysis?.consultationResult?.statusReason,
      aiAnalysis?.consultationResult?.disagreeReasons,
      aiAnalysis?.summary || '',
      aiAnalysis?.concerns || [],
      aiAnalysis?.interest,
      patientStatus
    );

    // 결과 저장 (환자 상태 스냅샷 포함)
    const coachingWithSnapshot = {
      ...coaching,
      patientStatusAtCoaching: patientStatus || null,
    };

    // preview 모드: DB 저장 없이 결과만 반환
    if (preview) {
      console.log(`[Coaching] 미리보기 반환: ${callLogId}, score: ${coaching.overallScore}`);
      return NextResponse.json({
        success: true,
        callLogId,
        coaching: coachingWithSnapshot,
        cached: false,
        preview: true,
      });
    }

    await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      {
        $set: {
          aiCoaching: coachingWithSnapshot,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    // 환자 정보에 코칭 결과 요약 저장 (테이블 표시/필터용)
    if (callLog.patientId && ObjectId.isValid(callLog.patientId)) {
      try {
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(callLog.patientId) },
          {
            $set: {
              lastCoachingScore: coaching.overallScore,
              lastCoachingAt: coaching.generatedAt,
            },
          }
        );
        console.log(`[Coaching] 환자 코칭 정보 업데이트: ${callLog.patientId}`);
      } catch (patientErr) {
        console.error('[Coaching] 환자 업데이트 오류:', patientErr);
      }
    }

    console.log(`[Coaching] 코칭 분석 완료: ${callLogId}, score: ${coaching.overallScore}`);

    return NextResponse.json({
      success: true,
      callLogId,
      coaching,
      cached: false,
    });
  } catch (error) {
    console.error('[Coaching] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'AI 코칭 분석 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

// AI 코칭 결과 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const callLogId = searchParams.get('callLogId');

    if (!callLogId) {
      return NextResponse.json({ success: false, error: 'callLogId required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const callLog = await db.collection('callLogs_v2').findOne(
      { _id: new ObjectId(callLogId) },
      { projection: { patientId: 1 } }
    );

    if (!callLog) {
      return NextResponse.json({ success: false, error: 'Call log not found' }, { status: 404 });
    }

    // callLogs_v2에서 aiCoaching 제거
    await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      { $unset: { aiCoaching: '' }, $set: { updatedAt: new Date().toISOString() } }
    );

    // patients_v2에서 코칭 정보 제거 (해당 환자의 다른 코칭이 없는 경우)
    if (callLog.patientId && ObjectId.isValid(callLog.patientId)) {
      const otherCoaching = await db.collection('callLogs_v2').findOne({
        patientId: callLog.patientId,
        aiCoaching: { $exists: true },
        _id: { $ne: new ObjectId(callLogId) },
      });

      if (!otherCoaching) {
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(callLog.patientId) },
          { $unset: { lastCoachingScore: '', lastCoachingAt: '' } }
        );
      } else {
        // 다른 코칭이 있으면 그 중 최신 점수로 업데이트
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(callLog.patientId) },
          { $set: {
            lastCoachingScore: otherCoaching.aiCoaching.overallScore,
            lastCoachingAt: otherCoaching.aiCoaching.generatedAt,
          }}
        );
      }
    }

    console.log(`[Coaching] 코칭 삭제: ${callLogId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Coaching] 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '코칭 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
