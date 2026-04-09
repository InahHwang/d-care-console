// src/utils/monthlyReportAIInsights.ts
// 월간 보고서 AI 인사이트 생성 - OpenAI GPT-5.2 활용

import type { MonthlyStatsV2, PatientSummaryV2, ConversionPatternInsight } from '@/app/v2/reports/components/MonthlyReport-Types';

// ============================================
// Types
// ============================================

export interface AIInsightItem {
  title: string;
  detail: string;
  action: string;
}

export interface AIInsightResult {
  insights: string[];           // 하위 호환 (레거시)
  structuredInsights: AIInsightItem[];  // 구조화된 인사이트
  conversionPatterns?: ConversionPatternInsight[];  // 전환 패턴 분석
  generatedAt: string;
  model: string;
}

// ============================================
// 전환 패턴 데이터 추출 (PII 제거, 집계만)
// ============================================

interface PatternGroupData {
  groupName: string;
  groupKey: 'converted' | 'phoneChurned' | 'visitChurned';
  count: number;
  interests: Record<string, number>;
  consultationTypes: { inbound: number; outbound: number; returning: number };
  hasPhoneConsult: number;
  hasVisitConsult: number;
  hasBothConsult: number;
  avgEstimatedAmount: number;
  avgFinalAmount: number;
  hasActiveCallback: number;
  ageGroups: Record<string, number>;
  genderSplit: { male: number; female: number; unknown: number };
}

function buildPatternGroup(
  name: string,
  key: 'converted' | 'phoneChurned' | 'visitChurned',
  patients: PatientSummaryV2[],
): PatternGroupData {
  const count = patients.length;
  if (count === 0) {
    return {
      groupName: name, groupKey: key, count: 0,
      interests: {}, consultationTypes: { inbound: 0, outbound: 0, returning: 0 },
      hasPhoneConsult: 0, hasVisitConsult: 0, hasBothConsult: 0,
      avgEstimatedAmount: 0, avgFinalAmount: 0, hasActiveCallback: 0,
      ageGroups: {}, genderSplit: { male: 0, female: 0, unknown: 0 },
    };
  }

  const interests: Record<string, number> = {};
  const consultationTypes = { inbound: 0, outbound: 0, returning: 0 };
  let phoneCount = 0, visitCount = 0, bothCount = 0, callbackCount = 0;
  let totalEstimated = 0, totalFinal = 0;
  const ageGroups: Record<string, number> = {};
  const genderSplit = { male: 0, female: 0, unknown: 0 };

  for (const p of patients) {
    // 관심분야
    interests[p.interest] = (interests[p.interest] || 0) + 1;
    // 상담 유형
    if (p.consultationType === 'inbound') consultationTypes.inbound++;
    else if (p.consultationType === 'outbound') consultationTypes.outbound++;
    else if (p.consultationType === 'returning') consultationTypes.returning++;
    // 상담 방식
    if (p.hasPhoneConsultation) phoneCount++;
    if (p.hasVisitConsultation) visitCount++;
    if (p.hasPhoneConsultation && p.hasVisitConsultation) bothCount++;
    // 콜백
    if (p.hasActiveCallback) callbackCount++;
    // 금액
    totalEstimated += p.estimatedAmount || 0;
    totalFinal += p.finalAmount || 0;
    // 연령대
    if (p.age) {
      const bracket = p.age < 20 ? '10대' : p.age < 30 ? '20대' : p.age < 40 ? '30대'
        : p.age < 50 ? '40대' : p.age < 60 ? '50대' : '60대+';
      ageGroups[bracket] = (ageGroups[bracket] || 0) + 1;
    }
    // 성별
    if (p.gender === '남') genderSplit.male++;
    else if (p.gender === '여') genderSplit.female++;
    else genderSplit.unknown++;
  }

  return {
    groupName: name,
    groupKey: key,
    count,
    interests,
    consultationTypes,
    hasPhoneConsult: phoneCount,
    hasVisitConsult: visitCount,
    hasBothConsult: bothCount,
    avgEstimatedAmount: Math.round(totalEstimated / count),
    avgFinalAmount: Math.round(totalFinal / count),
    hasActiveCallback: callbackCount,
    ageGroups,
    genderSplit,
  };
}

function buildConversionPatternData(stats: MonthlyStatsV2): PatternGroupData[] {
  const summaries = stats.patientSummaries || [];

  // 치료 전환 성공: treatment, completed, followup
  const converted = summaries.filter(p =>
    ['treatment', 'completed', 'followup'].includes(p.status)
  );
  // 전화상담 이탈: closed + 내원상담 없음
  const phoneChurned = summaries.filter(p =>
    p.status === 'closed' && !p.hasVisitConsultation
  );
  // 내원 후 이탈: closed + 내원상담 있음
  const visitChurned = summaries.filter(p =>
    p.status === 'closed' && p.hasVisitConsultation
  );

  return [
    buildPatternGroup('치료전환 성공', 'converted', converted),
    buildPatternGroup('전화상담 이탈', 'phoneChurned', phoneChurned),
    buildPatternGroup('내원후 이탈', 'visitChurned', visitChurned),
  ];
}

// ============================================
// Prompt Construction
// ============================================

function buildInsightPrompt(stats: MonthlyStatsV2): string {
  // 집계 데이터만 전송 (patientSummaries 제외 = PII 보호 + 토큰 절약)
  const safeData = {
    totalInquiries: stats.totalInquiries,
    inquiryBreakdown: stats.inquiryBreakdown,
    reservedPatients: stats.reservedPatients,
    reservedRate: stats.reservedRate,
    visitedPatients: stats.visitedPatients,
    visitedRate: stats.visitedRate,
    agreedRevenue: stats.agreedRevenue,
    agreedPatients: stats.agreedPatients,
    agreedRate: stats.agreedRate,
    changes: stats.changes,
    averageAge: stats.averageAge,
    channelStats: stats.channelStats,
    channelROI: stats.channelROI,
    treatmentAnalysis: stats.treatmentAnalysis,
    disagreeReasons: stats.disagreeReasons,
    closedReasonStats: stats.closedReasonStats,
    weeklyPattern: stats.weeklyPattern,
    ageDistribution: stats.ageDistribution,
    genderStats: stats.genderStats,
    revenueAnalysis: {
      achieved: stats.revenueAnalysis.achieved,
      potential: stats.revenueAnalysis.potential,
      lost: stats.revenueAnalysis.lost,
      summary: stats.revenueAnalysis.summary,
    },
    progressStats: stats.progressStats,
    interestBreakdown: stats.interestBreakdown,
  };

  // 전환 패턴 데이터 (PII 없는 집계)
  const patternData = buildConversionPatternData(stats);

  return `당신은 치과 경영 컨설턴트입니다. 아래 월간 리포트 통계 데이터를 분석하여 원장님에게 보고할 핵심 인사이트를 생성하세요.

## 데이터
${JSON.stringify(safeData, null, 2)}

## 전환 패턴 데이터 (환자 그룹별 익명 집계)
${JSON.stringify(patternData, null, 2)}

## 분석 요청
위 데이터를 분석하여 다음 JSON 형식으로 응답해주세요. 반드시 유효한 JSON만 출력하세요.

{
  "insights": [
    {
      "title": "핵심 요약 (한 줄)",
      "detail": "데이터 근거와 분석 (수치 포함)",
      "action": "구체적 실행 제안"
    }
  ],
  "conversionPatterns": [
    {
      "groupKey": "converted",
      "groupName": "치료전환 성공",
      "patientCount": 0,
      "summary": "이 그룹의 상담 패턴 요약 (2~3줄)",
      "commonPatterns": ["공통점 1", "공통점 2", "공통점 3"],
      "actionItems": ["실행 제안 1", "실행 제안 2"]
    }
  ]
}

## 인사이트 작성 가이드라인

### 작성 원칙
1. **title**: 핵심 메시지를 한 줄로 요약 (예: "인바운드 문의 급감이 전체 실적 하락의 주원인")
2. **detail**: 관련 수치와 팩트를 근거로 제시 (예: "인바운드 67% 감소, 전체 문의 32% 하락")
3. **action**: 구체적이고 실행 가능한 제안 (예: "네이버 플레이스 리뷰 이벤트 + 블로그 콘텐츠 주 2회 발행")
4. **한국어 작성**: 치과 업계 용어 사용, 존대말 없이 간결한 보고 문체

### 반드시 포함할 분석 관점 (5~7개 생성)
1. **채널 효율성**: 어떤 유입 채널이 가장 높은 ROI를 보이는지, 투자를 늘려야 할 채널과 줄여야 할 채널
2. **전환율 병목**: 문의→예약→내원→결제 퍼널에서 가장 큰 이탈이 발생하는 구간과 개선 방안
3. **매출 기회**: 잠재환자 전환 시 추가 가능 매출, 고액 치료 전환율 분석
4. **이탈 원인**: 미동의 사유와 종결 사유를 종합하여 해결 가능한 이탈 원인 제시
5. **운영 최적화**: 요일별 패턴, 인력 배치, 피크타임 관리

### 전환 패턴 분석 가이드라인 (conversionPatterns)
각 그룹(치료전환 성공 / 전화상담 이탈 / 내원후 이탈)에 대해:
1. **summary**: 해당 그룹 환자들의 상담 패턴 공통점을 2~3줄로 요약. 데이터의 수치를 근거로 서술
2. **commonPatterns**: 3~5개의 구체적 공통점 (예: "인바운드 유입 비율 80%로 자발적 문의가 대다수", "전화+내원 병행 상담 비율 60%")
3. **actionItems**: 해당 그룹 분석에서 도출된 실행 가능한 제안 1~3개
4. 데이터가 0명인 그룹은 patientCount: 0, summary: "해당 월 데이터 없음"으로 처리
5. **그룹 간 비교**를 통해 전환 성공 그룹과 이탈 그룹의 차이점을 명확히 제시

JSON만 출력하세요.`;
}

// ============================================
// OpenAI API Call
// ============================================

export async function generateAIInsights(
  stats: MonthlyStatsV2
): Promise<AIInsightResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = buildInsightPrompt(stats);

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
          content: '당신은 치과 경영 컨설턴트입니다. 요청받은 형식의 JSON만 출력합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_completion_tokens: 5000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API 오류: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  const finishReason = data.choices[0]?.finish_reason;

  console.log(`[AI Insights] finish_reason: ${finishReason}, content length: ${content?.length || 0}`);

  if (!content) {
    const refusal = data.choices[0]?.message?.refusal;
    throw new Error(`OpenAI 응답이 비어있습니다. finish_reason: ${finishReason}, refusal: ${refusal || 'none'}`);
  }

  // JSON 파싱 (코드블록 래핑 대응)
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const result = JSON.parse(jsonStr);

  // 구조화된 인사이트 파싱
  const structuredInsights: AIInsightItem[] = [];
  const flatInsights: string[] = [];

  if (Array.isArray(result.insights)) {
    for (const item of result.insights) {
      if (typeof item === 'string') {
        flatInsights.push(item);
        structuredInsights.push({ title: item, detail: '', action: '' });
      } else if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const title = String(obj.title || '');
        const detail = String(obj.detail || obj.whatItMeans || obj.description || '');
        const action = String(obj.action || obj.recommendation || '');
        structuredInsights.push({ title, detail, action });
        flatInsights.push([title, detail, action].filter(Boolean).join(' — '));
      }
    }
  }

  // 전환 패턴 분석 파싱
  const conversionPatterns: ConversionPatternInsight[] = [];
  if (Array.isArray(result.conversionPatterns)) {
    for (const cp of result.conversionPatterns) {
      if (typeof cp === 'object' && cp !== null) {
        const obj = cp as Record<string, unknown>;
        conversionPatterns.push({
          groupName: String(obj.groupName || ''),
          groupKey: (obj.groupKey as ConversionPatternInsight['groupKey']) || 'converted',
          patientCount: Number(obj.patientCount || 0),
          summary: String(obj.summary || ''),
          commonPatterns: Array.isArray(obj.commonPatterns)
            ? obj.commonPatterns.map(String)
            : [],
          actionItems: Array.isArray(obj.actionItems)
            ? obj.actionItems.map(String)
            : [],
        });
      }
    }
  }

  return {
    insights: flatInsights.slice(0, 7),
    structuredInsights: structuredInsights.slice(0, 7),
    conversionPatterns: conversionPatterns.length > 0 ? conversionPatterns : undefined,
    generatedAt: new Date().toISOString(),
    model: 'gpt-5.2',
  };
}
