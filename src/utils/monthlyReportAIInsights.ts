// src/utils/monthlyReportAIInsights.ts
// 월간 보고서 AI 인사이트 생성 - OpenAI GPT-5.2 활용

import type { MonthlyStatsV2 } from '@/app/v2/reports/components/MonthlyReport-Types';

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
  generatedAt: string;
  model: string;
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

  return `당신은 치과 경영 컨설턴트입니다. 아래 월간 리포트 통계 데이터를 분석하여 원장님에게 보고할 핵심 인사이트를 생성하세요.

## 데이터
${JSON.stringify(safeData, null, 2)}

## 분석 요청
위 데이터를 분석하여 다음 JSON 형식으로 응답해주세요. 반드시 유효한 JSON만 출력하세요.

{
  "insights": [
    {
      "title": "핵심 요약 (한 줄)",
      "detail": "데이터 근거와 분석 (수치 포함)",
      "action": "구체적 실행 제안"
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
      max_completion_tokens: 3000,
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

  return {
    insights: flatInsights.slice(0, 7),
    structuredInsights: structuredInsights.slice(0, 7),
    generatedAt: new Date().toISOString(),
    model: 'gpt-5.2',
  };
}
