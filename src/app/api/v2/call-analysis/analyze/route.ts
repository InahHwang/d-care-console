// src/app/api/v2/call-analysis/analyze/route.ts
// Claude/GPT API를 사용한 통화 내용 AI 분석 - v2 타입 시스템 통합

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import Pusher from 'pusher';
import type { AIAnalysis, Temperature, AIClassification, FollowUpType } from '@/types/v2';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// v2 분석용 프롬프트
function buildAnalysisPrompt(transcript: string): string {
  return `당신은 치과 상담 전화 분석 전문가입니다. 아래 통화 내용을 분석해주세요.

## 통화 내용
${transcript}

## 분석 요청
위 통화 내용을 분석하여 다음 JSON 형식으로 응답해주세요. 반드시 유효한 JSON만 출력하세요.

{
  "classification": "분류 (신환/구신환/구환/부재중/거래처/스팸/기타 중 하나)",
  "patientName": "환자 이름 (언급된 경우)",
  "interest": "관심 진료 (임플란트/교정/충치치료/스케일링/검진/기타 중 하나)",
  "interestDetail": "세부 관심사항 (예: '앞니 2개 임플란트')",
  "temperature": "온도 (hot/warm/cold 중 하나 - hot:예약확정, warm:관심있음, cold:관심낮음)",
  "summary": "통화 요약 (2-3문장)",
  "followUp": "후속조치 (콜백필요/예약확정/종결 중 하나)",
  "recommendedCallback": "권장 콜백 일시 (YYYY-MM-DD 형식, 필요한 경우만)",
  "concerns": ["환자 우려사항 배열"],
  "preferredTime": "선호 연락시간 (예: '오후 2시 이후')",
  "confidence": 0.85
}

## 분류 가이드라인 (중요!)
1. 신환: 우리 병원에 처음 연락하는 완전 신규 환자
2. 구신환: 기존 환자이지만 새로운 치료를 문의 (예: 기존에 충치치료 받았는데 이번에 임플란트 문의)
3. 구환: 기존 환자가 진행 중인 치료 관련 문의 (예약 변경, 치료 경과 문의 등)
4. 부재중: 통화 연결 안됨
5. 거래처: 의료기기, 재료, 기타 업체
6. 스팸: 광고, 홍보
7. 기타: 위 분류에 해당하지 않는 경우

## 기타 가이드라인
- temperature: hot(예약확정/매우적극), warm(관심있음/결정보류), cold(관심낮음/단순문의)
- followUp: 콜백필요(재연락), 예약확정(예약완료), 종결(추가조치불필요)

JSON만 출력하세요.`;
}

// OpenAI GPT-4o-mini 호출 (빠른 응답)
async function analyzeWithGPT(transcript: string): Promise<AIAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = buildAnalysisPrompt(transcript);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // 빠른 응답을 위해 mini 사용
      messages: [
        {
          role: 'system',
          content: '당신은 치과 상담 전화 분석 전문가입니다. 요청받은 형식의 JSON만 출력합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
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

    // v2 타입으로 변환
    return {
      classification: result.classification as AIClassification,
      patientName: result.patientName,
      interest: result.interest,
      interestDetail: result.interestDetail,
      temperature: result.temperature as Temperature,
      summary: result.summary,
      followUp: result.followUp as FollowUpType,
      recommendedCallback: result.recommendedCallback,
      concerns: result.concerns || [],
      preferredTime: result.preferredTime,
      confidence: result.confidence || 0.8,
      transcript: transcript,
    };
  } catch (parseError) {
    console.error('[Analyze v2] JSON 파싱 오류:', parseError);

    // 기본 결과
    return {
      classification: '기타' as AIClassification,
      temperature: 'warm' as Temperature,
      summary: '분석 결과를 파싱할 수 없습니다.',
      followUp: '콜백필요' as FollowUpType,
      concerns: [],
      confidence: 0.5,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callLogId } = body;

    console.log(`[Analyze v2] 분석 시작: ${callLogId}`);

    if (!callLogId) {
      return NextResponse.json(
        { success: false, error: 'callLogId required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

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

    // 상태 업데이트
    await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      {
        $set: {
          aiStatus: 'processing',
          updatedAt: now,
        },
      }
    );

    // AI 분석 실행
    const analysis = await analyzeWithGPT(transcript);

    // 같은 전화번호의 기존 이름 확인 (수동 수정 > 최초 인식 > 현재 AI 인식)
    if (callLog.phone) {
      const existingName = await getExistingNameForPhone(db, callLog.phone, callLogId);
      if (existingName) {
        console.log(`[Analyze v2] 기존 이름 발견: "${existingName}" (현재 AI 인식: "${analysis.patientName}")`);
        analysis.patientName = existingName;
      }
    }

    // 분석 결과 저장
    await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      {
        $set: {
          aiStatus: 'completed',
          aiAnalysis: analysis,
          aiCompletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }
    );

    console.log(`[Analyze v2] 분석 완료: ${callLogId}`);
    console.log(`  분류: ${analysis.classification}, 온도: ${analysis.temperature}`);

    // 환자 정보 업데이트 (있는 경우)
    if (callLog.patientId) {
      await updatePatientWithAnalysis(db, callLog.patientId, analysis);
    }

    // Pusher로 분석 완료 알림
    try {
      await pusher.trigger('cti-v2', 'analysis-complete', {
        callLogId,
        patientId: callLog.patientId,
        classification: analysis.classification,
        temperature: analysis.temperature,
        summary: analysis.summary,
      });
    } catch (pusherError) {
      console.error('[Analyze v2] Pusher 오류:', pusherError);
    }

    return NextResponse.json({
      success: true,
      callLogId,
      analysis,
    });
  } catch (error) {
    console.error('[Analyze v2] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// 같은 전화번호의 기존 이름 조회 (수동 수정 > 최초 인식)
async function getExistingNameForPhone(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  phone: string,
  currentCallLogId: string
): Promise<string | null> {
  try {
    // 같은 전화번호의 다른 통화 기록 조회 (현재 건 제외)
    const existingLogs = await db.collection('callLogs_v2')
      .find({
        phone: phone,
        _id: { $ne: new ObjectId(currentCallLogId) },
        'aiAnalysis.patientName': { $exists: true, $nin: ['', null] },
      })
      .sort({ createdAt: 1 }) // 오래된 순 (최초 인식 우선)
      .toArray();

    if (existingLogs.length === 0) {
      return null;
    }

    // 1순위: 수동 수정된 이름 찾기
    const manuallyEditedLog = existingLogs.find(
      log => log.aiAnalysis?.manuallyEdited && log.aiAnalysis?.patientName
    );
    if (manuallyEditedLog?.aiAnalysis?.patientName) {
      console.log(`[Analyze v2] 수동 수정된 이름 사용: ${manuallyEditedLog.aiAnalysis.patientName}`);
      return manuallyEditedLog.aiAnalysis.patientName;
    }

    // 2순위: 최초 인식된 이름
    const firstLogWithName = existingLogs.find(log => log.aiAnalysis?.patientName);
    if (firstLogWithName?.aiAnalysis?.patientName) {
      console.log(`[Analyze v2] 최초 인식 이름 사용: ${firstLogWithName.aiAnalysis.patientName}`);
      return firstLogWithName.aiAnalysis.patientName;
    }

    return null;
  } catch (error) {
    console.error('[Analyze v2] 기존 이름 조회 오류:', error);
    return null;
  }
}

// 환자 정보에 분석 결과 반영
async function updatePatientWithAnalysis(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  patientId: string,
  analysis: AIAnalysis
) {
  try {
    // 기존 환자 정보 조회
    const existingPatient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(patientId)
    });

    const updateData: Record<string, unknown> = {
      temperature: analysis.temperature,
      updatedAt: new Date().toISOString(),
    };

    if (analysis.interest) {
      updateData.interest = analysis.interest;
    }
    if (analysis.interestDetail) {
      updateData.interestDetail = analysis.interestDetail;
    }
    // 기존 이름이 없을 때만 AI 인식 이름 사용
    if (analysis.patientName && !existingPatient?.name) {
      updateData.name = analysis.patientName;
    }

    // 예약 확정된 경우 상태 변경
    if (analysis.followUp === '예약확정') {
      updateData.status = 'reserved';
      updateData.statusChangedAt = new Date().toISOString();
    }

    // 콜백 일정은 상담사가 수동으로 등록 (AI 자동 설정 제거)

    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(patientId) },
      { $set: updateData }
    );

    console.log(`[Analyze v2] 환자 정보 업데이트: ${patientId}`);
  } catch (error) {
    console.error('[Analyze v2] 환자 업데이트 오류:', error);
  }
}
