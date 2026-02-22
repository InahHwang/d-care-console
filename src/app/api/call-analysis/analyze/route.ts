// src/app/api/call-analysis/analyze/route.ts
// Claude/GPT API를 사용한 통화 내용 AI 분석

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { withDeprecation } from '@/lib/deprecation';

// AI 분석 결과 타입
interface AnalysisResult {
  summary: string;              // 통화 요약 (2-3문장)
  category: string;             // 진료과목: 임플란트|교정|충치|스케일링|검진|기타
  result: string;               // 상담 결과: 예약완료|예약예정|보류|거절|단순문의
  expectedRevenue?: number;     // 예상 매출
  patientConcerns?: string[];   // 환자 우려사항
  consultantStrengths?: string[];   // 상담사 강점
  improvementPoints?: string[];     // 개선 포인트
  sentiment?: string;           // 전체 분위기: 긍정|중립|부정
  urgency?: string;             // 긴급도: 높음|보통|낮음
}

// 분석용 프롬프트 생성
function buildAnalysisPrompt(transcript: string): string {
  return `당신은 치과 상담 전화 분석 전문가입니다. 아래 통화 내용을 분석해주세요.

## 통화 내용
${transcript}

## 분석 요청
위 통화 내용을 분석하여 다음 JSON 형식으로 응답해주세요. 반드시 유효한 JSON만 출력하세요.

{
  "summary": "통화 내용을 2-3문장으로 요약",
  "category": "진료과목 (임플란트/교정/충치/스케일링/검진/기타 중 하나)",
  "result": "상담 결과 (예약완료/예약예정/보류/거절/단순문의 중 하나)",
  "expectedRevenue": 예상 매출액 (숫자, 알 수 없으면 0),
  "patientConcerns": ["환자가 걱정하거나 우려한 사항들"],
  "consultantStrengths": ["상담사가 잘한 점들"],
  "improvementPoints": ["상담사가 개선할 수 있는 점들"],
  "sentiment": "전체 통화 분위기 (긍정/중립/부정 중 하나)",
  "urgency": "환자의 치료 긴급도 (높음/보통/낮음 중 하나)"
}

## 분석 가이드라인
1. summary: 누가 어떤 이유로 전화했고, 어떤 결과가 나왔는지 핵심만
2. category: 주로 문의한 진료 과목. 여러 개면 가장 주된 것 하나만
3. result:
   - 예약완료: 구체적인 날짜/시간이 정해진 경우
   - 예약예정: 다시 연락하기로 한 경우
   - 보류: 고민 중이거나 결정을 미룬 경우
   - 거절: 명확히 거절한 경우
   - 단순문의: 정보만 물어본 경우
4. expectedRevenue: 상담사가 구체적인 금액을 언급하면 그 금액을 사용. 금액 언급이 없으면 진료과목 기준으로 추정 (임플란트 약 150-300만원, 교정 300-500만원, 충치 10-30만원, 스케일링 5-10만원)
5. patientConcerns: 가격, 통증, 기간, 부작용 등 환자가 걱정한 것
6. consultantStrengths: 친절함, 명확한 설명, 공감 등
7. improvementPoints: 가격 안내 부족, 예약 유도 부족 등

JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`;
}

// OpenAI GPT-4 API 호출
async function analyzeWithOpenAI(transcript: string): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = buildAnalysisPrompt(transcript);

  console.log('[Analyze] OpenAI API 호출 중...');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '당신은 치과 상담 전화 분석 전문가입니다. 요청받은 형식의 JSON만 출력합니다.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Analyze] OpenAI API 오류:', errorText);
    throw new Error(`OpenAI API 오류: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI 응답이 비어있습니다.');
  }

  console.log('[Analyze] OpenAI 응답:', content);

  // JSON 파싱
  try {
    // JSON 블록 추출 (```json ... ``` 형태 처리)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const result = JSON.parse(jsonStr);
    return result as AnalysisResult;
  } catch (parseError) {
    console.error('[Analyze] JSON 파싱 오류:', parseError);
    console.error('[Analyze] 원본 응답:', content);

    // 기본 결과 반환
    return {
      summary: '분석 결과를 파싱할 수 없습니다.',
      category: '기타',
      result: '단순문의',
      expectedRevenue: 0,
      patientConcerns: [],
      consultantStrengths: [],
      improvementPoints: ['AI 분석 결과 파싱 실패'],
      sentiment: '중립',
      urgency: '보통'
    };
  }
}

// POST - AI 분석 요청
async function _POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysisId } = body;

    console.log('='.repeat(60));
    console.log('[Analyze API] AI 분석 요청');
    console.log(`  분석ID: ${analysisId}`);
    console.log('='.repeat(60));

    if (!analysisId) {
      return NextResponse.json(
        { success: false, error: 'analysisId is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const analysisCollection = db.collection('callAnalysis');

    // 분석 레코드 조회
    const callAnalysis = await analysisCollection.findOne({
      _id: new ObjectId(analysisId)
    });

    if (!callAnalysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis record not found' },
        { status: 404 }
      );
    }

    // STT 완료 확인
    const transcript = callAnalysis.transcriptFormatted || callAnalysis.transcript?.raw;
    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcript not found. STT must be completed first.' },
        { status: 400 }
      );
    }

    // 상태 업데이트: 분석 중
    await analysisCollection.updateOne(
      { _id: new ObjectId(analysisId) },
      {
        $set: {
          status: 'analyzing',
          updatedAt: new Date().toISOString()
        }
      }
    );

    try {
      // AI 분석 실행
      const analysisResult = await analyzeWithOpenAI(transcript);

      // DB 업데이트
      const now = new Date().toISOString();
      await analysisCollection.updateOne(
        { _id: new ObjectId(analysisId) },
        {
          $set: {
            status: 'complete',
            analysis: analysisResult,
            analysisCompletedAt: now,
            updatedAt: now
          }
        }
      );

      console.log('[Analyze] AI 분석 완료');
      console.log('--- 분석 결과 ---');
      console.log(JSON.stringify(analysisResult, null, 2));
      console.log('--- 끝 ---');

      // 환자 정보에도 최근 상담 결과 업데이트
      if (callAnalysis.patientId) {
        await updatePatientWithAnalysis(db, callAnalysis.patientId, analysisResult);
      }

      return NextResponse.json({
        success: true,
        message: 'Analysis completed',
        data: {
          analysisId,
          analysis: analysisResult
        }
      });

    } catch (analysisError) {
      console.error('[Analyze] 분석 오류:', analysisError);

      // 실패 상태로 업데이트
      await analysisCollection.updateOne(
        { _id: new ObjectId(analysisId) },
        {
          $set: {
            status: 'failed',
            errorMessage: analysisError instanceof Error ? analysisError.message : '알 수 없는 오류',
            updatedAt: new Date().toISOString()
          }
        }
      );

      throw analysisError;
    }

  } catch (error) {
    console.error('[Analyze API] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// 환자 정보에 분석 결과 연결
async function updatePatientWithAnalysis(
  db: ReturnType<typeof connectToDatabase> extends Promise<infer T> ? T extends { db: infer D } ? D : never : never,
  patientId: string,
  analysis: AnalysisResult
) {
  try {
    await db.collection('patients').updateOne(
      { _id: new ObjectId(patientId) },
      {
        $set: {
          lastCallAnalysis: {
            summary: analysis.summary,
            category: analysis.category,
            result: analysis.result,
            expectedRevenue: analysis.expectedRevenue,
            analyzedAt: new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        }
      }
    );
    console.log(`[Analyze] 환자 정보 업데이트: ${patientId}`);
  } catch (error) {
    console.error('[Analyze] 환자 정보 업데이트 실패:', error);
  }
}

// GET - 특정 분석 결과 조회
async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysisId');

    if (!analysisId) {
      return NextResponse.json(
        { success: false, error: 'analysisId is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const callAnalysis = await db.collection('callAnalysis').findOne(
      { _id: new ObjectId(analysisId) },
      { projection: { analysis: 1, status: 1, analysisCompletedAt: 1 } }
    );

    if (!callAnalysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        analysisId,
        analysis: callAnalysis.analysis,
        status: callAnalysis.status,
        completedAt: callAnalysis.analysisCompletedAt
      }
    });

  } catch (error) {
    console.error('[Analyze API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const deprecationOpts = { v1Route: '/api/call-analysis/analyze', v2Route: '/api/v2/call-analysis/analyze' };
export const GET = withDeprecation(_GET, deprecationOpts);
export const POST = withDeprecation(_POST, deprecationOpts);
