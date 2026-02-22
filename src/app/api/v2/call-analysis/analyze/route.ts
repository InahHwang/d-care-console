// src/app/api/v2/call-analysis/analyze/route.ts
// Claude/GPT API를 사용한 통화 내용 AI 분석 - v2 타입 시스템 통합

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import Pusher from 'pusher';
import type { AIAnalysis, AIConsultationResult, Temperature, AIClassification, FollowUpType, ConsultationStatus, ConsultationV2 } from '@/types/v2';
import { createRouteLogger } from '@/lib/logger';

const CLINIC_ID = process.env.DEFAULT_CLINIC_ID || 'default';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// 기존 필드로 상담 결과 추론 (fallback)
function inferConsultationResult(result: Record<string, unknown>): AIConsultationResult {
  const temperature = result.temperature as string;
  const followUp = result.followUp as string;
  const confidence = (result.confidence as number) || 0.8;

  let status: ConsultationStatus = 'pending';
  let statusReason = '';

  // 예약확정 + hot = 동의
  if (followUp === '예약확정' && temperature === 'hot') {
    status = 'agreed';
    statusReason = '예약 확정됨 (temperature: hot, followUp: 예약확정)';
  }
  // cold + 종결 = 미동의 가능성 높음
  else if (temperature === 'cold' && followUp === '종결') {
    status = 'disagreed';
    statusReason = '관심 낮음 및 종결 (temperature: cold, followUp: 종결)';
  }
  // 그 외는 보류
  else {
    status = 'pending';
    statusReason = '아직 결정되지 않음';
  }

  return {
    status,
    statusReason,
    estimatedAmount: 0,
    disagreeReasons: [],
    confidence: confidence * 0.7, // 추론이므로 신뢰도 낮춤
  };
}

// v2 분석용 프롬프트
function buildAnalysisPrompt(transcript: string): string {
  return `당신은 치과 상담 전화 분석 전문가입니다. 아래 통화 내용을 분석해주세요.

## 통화 내용
${transcript}

## ⚠️ 가장 중요한 규칙
1. **통화에서 실제로 언급된 내용만 작성하세요.**
2. **추측, 상상, 일반화 절대 금지!** 언급되지 않은 내용은 포함하지 마세요.
3. **불확실하면 "정보 없음" 또는 빈 값으로 두세요.**

## 분석 요청
위 통화 내용을 분석하여 다음 JSON 형식으로 응답해주세요.

{
  "classification": "분류",
  "patientName": "환자 이름 (통화에서 직접 언급된 경우만, 없으면 빈 문자열)",
  "interest": "관심 진료",
  "interestDetail": "세부 관심사항 (통화에서 언급된 구체적 내용)",
  "temperature": "온도",
  "summary": "핵심 내용 요약",
  "followUp": "후속조치",
  "recommendedCallback": "권장 콜백 일시 (필요한 경우만)",
  "concerns": ["환자 우려사항"],
  "preferredTime": "선호 연락시간",
  "confidence": 0.85,
  "consultationResult": {
    "status": "상담 결과 (agreed/disagreed/pending)",
    "statusReason": "분류 근거",
    "estimatedAmount": 0,
    "appointmentDate": "예약일 (YYYY-MM-DD 형식, 언급된 경우만)",
    "disagreeReasons": ["미동의 사유"],
    "confidence": 0.85
  }
}

## 필드별 작성 가이드

### patientName
- 통화에서 "성함이 어떻게 되세요?" → "홍길동입니다" 처럼 **직접 언급된 이름만**
- 추측 금지. 이름이 안 나오면 빈 문자열 ""

### interest (관심 진료)
- 임플란트/교정/충치치료/스케일링/검진/통증/발치/보철/잇몸치료/기타 중 선택
- 통화 내용에 맞는 것으로 선택

### interestDetail (세부사항)
- **반드시 통화에서 언급된 구체적 내용만 작성**
- 예: "오른쪽 아래 앞니 통증", "위 어금니 2개 임플란트", "전체 스케일링"
- 위치(앞니/어금니/송곳니, 위/아래, 왼쪽/오른쪽)가 언급되면 반드시 포함

### summary (요약) - 매우 중요!
- 3~5개 문장, 각 문장을 줄바꿈(\\n)으로 구분
- **통화에서 실제로 언급된 내용만!**
- 포함할 내용 (언급된 경우만):
  1. 환자의 현재 상태/증상/문제 (구체적 위치 포함)
  2. 환자가 원하는 것 / 문의 내용
  3. 병원에서 안내한 내용
  4. 예약/후속 조치 결과

### summary 좋은 예시 vs 나쁜 예시

**[통화 예시 1 - 통증 문의]**
통화: "아랫니 앞쪽이 아파요" → "5시 반에 오세요" → "변호석입니다"

✅ 좋은 요약:
"아래 앞니 통증으로 내원 문의함.\\n당일 5시 반 예약을 잡음.\\n환자명: 변호석."

❌ 나쁜 요약:
"오른쪽 어금니에 심한 통증이 있음.\\n임플란트 치료가 필요할 수 있음.\\n장기 치료 계획 상담 예정." (← 언급 안 된 내용 추가됨!)

**[통화 예시 2 - 예약 변경]**
통화: "목요일 예약 금요일로 바꿀 수 있나요?" → "네 변경했습니다"

✅ 좋은 요약:
"기존 목요일 예약을 금요일로 변경 요청함.\\n예약 변경 완료됨."

❌ 나쁜 요약:
"충치 치료를 위해 내원 예정.\\n금요일 오후 3시에 예약됨." (← 치료 종류, 시간 추측!)

**[통화 예시 3 - 짧은 통화]**
통화: "문자 보내드릴게요" → "감사합니다"

✅ 좋은 요약:
"안내 문자 발송 예정으로 통화 종료됨."

❌ 나쁜 요약:
"임플란트 상담 후 자료를 발송하기로 함." (← 없는 내용 창작!)

## 분류 가이드라인
1. 신환: 처음 연락하는 신규 환자
2. 구신환: 기존 환자가 새로운 치료 문의
3. 구환: 기존 환자가 진행 중인 치료/예약 관련 문의
4. 부재중: 통화 연결 안됨
5. 거래처: 업체 (의료기기, 재료 등)
6. 스팸: 광고, 홍보
7. 기타: 위에 해당 없음

## temperature 가이드라인
- hot: 예약 확정됨 / 매우 적극적
- warm: 관심 있음 / 아직 결정 안 함
- cold: 관심 낮음 / 단순 문의

## followUp 가이드라인
- 예약확정: 예약이 잡힘
- 콜백필요: 재연락 필요
- 종결: 추가 조치 불필요

## consultationResult 가이드라인 (상담 결과 자동 분류)

### status 판단 기준
- **agreed (동의)**:
  - 예약이 확정된 경우: "예약할게요", "내일 3시에 갈게요", "다음 주 월요일에 볼게요"
  - 치료 진행 동의: "하겠습니다", "진행해주세요"
  - temperature가 hot이고 followUp이 '예약확정'인 경우

- **disagreed (미동의)**:
  - 명확한 거절: "안 할게요", "다른 데서 할게요", "관심 없어요"
  - 가격 거부: "비싸서 못 하겠어요", "예산이 안 돼요"
  - 치료 거부: "그 치료는 안 하고 싶어요"

- **pending (보류)**:
  - 결정 보류: "생각해볼게요", "가족하고 상의해볼게요", "검토해볼게요"
  - 비교 중: "다른 병원도 알아볼게요"
  - 단순 정보 문의
  - 아직 결정이 안 된 경우 (기본값)

### estimatedAmount (금액)
- 통화에서 직접 언급된 금액만 (원 단위)
- 예: "임플란트 하나에 150만원이에요" → 1500000
- 금액 언급 없으면 0

### appointmentDate (예약일)
- 예약이 확정된 경우만 YYYY-MM-DD 형식
- 상대적 표현은 오늘 기준 계산: "내일" → 다음 날, "다음 주 월요일" → 해당 날짜
- 불확실하면 빈 문자열

### disagreeReasons (미동의 사유)
- status가 disagreed인 경우만 작성
- 가능한 값: "예산 초과", "타 병원 대비 비쌈", "분납/할부 조건 안 맞음", "당장 여유가 안 됨", "치료 계획 이견", "제안 치료 거부", "치료 범위 과다", "치료 기간 부담", "가족 상의 필요", "타 병원 비교 중", "추가 상담/정보 필요", "단순 정보 문의", "일정 조율 어려움", "치료 두려움/불안", "기타"

반드시 유효한 JSON만 출력하세요.`;
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

    // consultationResult 파싱
    let consultationResult: AIConsultationResult | undefined;
    if (result.consultationResult) {
      consultationResult = {
        status: (result.consultationResult.status || 'pending') as ConsultationStatus,
        statusReason: result.consultationResult.statusReason,
        estimatedAmount: result.consultationResult.estimatedAmount || 0,
        appointmentDate: result.consultationResult.appointmentDate || undefined,
        disagreeReasons: result.consultationResult.disagreeReasons || [],
        confidence: result.consultationResult.confidence || result.confidence || 0.8,
      };
    } else {
      // consultationResult가 없으면 기존 필드로 추론
      consultationResult = inferConsultationResult(result);
    }

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
      consultationResult,
    };
  } catch (parseError) {
    const parseLog = createRouteLogger('/api/v2/call-analysis/analyze', 'analyzeWithGPT');
    parseLog.error('JSON 파싱 오류', parseError);

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
  const log = createRouteLogger('/api/v2/call-analysis/analyze', 'POST');
  try {
    const body = await request.json();
    const { callLogId } = body;

    log.info('분석 시작', { callLogId });

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
      clinicId: CLINIC_ID,
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
        log.info('기존 이름 발견', { callLogId, existingName, aiRecognizedName: analysis.patientName });
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

    log.info('분석 완료', { callLogId, classification: analysis.classification, temperature: analysis.temperature });

    // 환자 정보 업데이트 (있는 경우)
    if (callLog.patientId) {
      await updatePatientWithAnalysis(db, callLog.patientId, analysis);
    }

    // 자동 상담 결과 저장 (신환/구신환만, 조건 충족 시)
    if (callLog.patientId && ['신환', '구신환'].includes(analysis.classification)) {
      await createAutoConsultation(db, {
        patientId: callLog.patientId,
        callLogId,
        analysis,
        duration: callLog.duration || 0,
      });
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
      log.error('Pusher 오류', pusherError, { callLogId });
    }

    return NextResponse.json({
      success: true,
      callLogId,
      analysis,
    });
  } catch (error) {
    log.error('분석 오류', error);
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
  const fnLog = createRouteLogger('/api/v2/call-analysis/analyze', 'getExistingName');
  try {
    // 같은 전화번호의 다른 통화 기록 조회 (현재 건 제외)
    const existingLogs = await db.collection('callLogs_v2')
      .find({
        clinicId: CLINIC_ID,
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
      l => l.aiAnalysis?.manuallyEdited && l.aiAnalysis?.patientName
    );
    if (manuallyEditedLog?.aiAnalysis?.patientName) {
      fnLog.debug('수동 수정된 이름 사용', { name: manuallyEditedLog.aiAnalysis.patientName, phone });
      return manuallyEditedLog.aiAnalysis.patientName;
    }

    // 2순위: 최초 인식된 이름
    const firstLogWithName = existingLogs.find(l => l.aiAnalysis?.patientName);
    if (firstLogWithName?.aiAnalysis?.patientName) {
      fnLog.debug('최초 인식 이름 사용', { name: firstLogWithName.aiAnalysis.patientName, phone });
      return firstLogWithName.aiAnalysis.patientName;
    }

    return null;
  } catch (error) {
    fnLog.error('기존 이름 조회 오류', error, { phone });
    return null;
  }
}

// 환자 정보에 분석 결과 반영
async function updatePatientWithAnalysis(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  patientId: string,
  analysis: AIAnalysis
) {
  const fnLog = createRouteLogger('/api/v2/call-analysis/analyze', 'updatePatient');
  try {
    // 기존 환자 정보 조회
    const existingPatient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(patientId),
      clinicId: CLINIC_ID,
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

    fnLog.info('환자 정보 업데이트', { patientId });
  } catch (error) {
    fnLog.error('환자 업데이트 오류', error, { patientId });
  }
}

// 자동 상담 결과 저장
async function createAutoConsultation(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  data: {
    patientId: string;
    callLogId: string;
    analysis: AIAnalysis;
    duration: number;
  }
): Promise<void> {
  const { patientId, callLogId, analysis, duration } = data;
  const fnLog = createRouteLogger('/api/v2/call-analysis/analyze', 'autoConsultation');

  try {
    // 조건 체크: 통화 시간 30초 미만이면 스킵
    if (duration < 30) {
      fnLog.debug('통화 시간 부족 - 자동 상담 결과 생성 스킵', { callLogId, duration });
      return;
    }

    // 조건 체크: consultationResult 없거나 신뢰도 낮으면 스킵
    const consultationResult = analysis.consultationResult;
    if (!consultationResult || (consultationResult.confidence && consultationResult.confidence < 0.6)) {
      fnLog.debug('신뢰도 낮음 - 자동 상담 결과 생성 스킵', { callLogId });
      return;
    }

    // 중복 체크: 같은 callLogId로 이미 존재하면 스킵
    const existingConsultation = await db.collection('consultations_v2').findOne({
      clinicId: CLINIC_ID,
      callLogId: callLogId,
    });

    if (existingConsultation) {
      fnLog.debug('이미 상담 결과 존재 - 스킵', { callLogId });
      return;
    }

    const now = new Date().toISOString();
    const status = consultationResult.status || 'pending';

    // 새 상담 결과 생성
    const newConsultation: Omit<ConsultationV2, '_id'> = {
      clinicId: CLINIC_ID,
      patientId,
      callLogId,
      type: 'phone',
      date: new Date(now),
      treatment: analysis.interest || '',
      originalAmount: consultationResult.estimatedAmount || 0,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: status === 'agreed' ? (consultationResult.estimatedAmount || 0) : 0,
      discountReason: undefined,
      status,
      disagreeReasons: status === 'disagreed' ? consultationResult.disagreeReasons : undefined,
      correctionPlan: undefined,
      appointmentDate: status === 'agreed' && consultationResult.appointmentDate
        ? new Date(consultationResult.appointmentDate)
        : undefined,
      callbackDate: undefined, // 상담사가 설정
      consultantName: '(AI 자동분류)',
      inquiry: undefined,
      memo: undefined,
      aiSummary: analysis.summary,
      aiGenerated: true,
      createdAt: now,
    };

    await db.collection('consultations_v2').insertOne(newConsultation);

    fnLog.info('자동 상담 결과 생성', { patientId, callLogId, status });

    // 동의인 경우 환자 상태 업데이트
    if (status === 'agreed') {
      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(patientId) },
        {
          $set: {
            status: 'reserved',
            statusChangedAt: now,
            updatedAt: now,
          },
        }
      );
      fnLog.info('환자 상태 변경: reserved (동의)', { patientId, callLogId });
    }
  } catch (error) {
    fnLog.error('자동 상담 결과 생성 오류', error, { patientId, callLogId });
    // 오류가 발생해도 전체 프로세스는 중단하지 않음
  }
}
