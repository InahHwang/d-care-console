// src/utils/monthlyReportAIInsights.ts
// 월간 보고서 AI 인사이트 생성 - OpenAI GPT-4o-mini 활용

import type { MonthlyStatsV2 } from '@/app/v2/reports/components/MonthlyReport-Types';

// ============================================
// Types
// ============================================

export interface AIInsightResult {
  insights: string[];
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
    "인사이트 1",
    "인사이트 2"
  ]
}

## 인사이트 작성 가이드라인

### 작성 원칙
1. **해석적 인사이트**: 단순 수치 나열이 아닌, "왜 그런가" + "어떻게 해야 하는가"를 포함
2. **실행 가능한 제안**: 각 인사이트에 구체적인 액션 아이템 포함
3. **데이터 근거 명시**: 반드시 관련 수치를 포함하여 설득력 확보
4. **한국어 작성**: 치과 업계 용어 사용, 존대말 없이 간결한 보고 문체
5. **구분자 활용**: 데이터 팩트와 제안을 " — " (em dash)로 구분

### 반드시 포함할 분석 관점 (5~7개 생성)
1. **채널 효율성**: 어떤 유입 채널이 가장 높은 ROI를 보이는지, 투자를 늘려야 할 채널과 줄여야 할 채널
2. **전환율 병목**: 문의→예약→내원→결제 퍼널에서 가장 큰 이탈이 발생하는 구간과 개선 방안
3. **매출 기회**: 잠재환자 전환 시 추가 가능 매출, 고액 치료 전환율 분석
4. **이탈 원인**: 미동의 사유와 종결 사유를 종합하여 해결 가능한 이탈 원인 제시
5. **운영 최적화**: 요일별 패턴, 인력 배치, 피크타임 관리

### 좋은 인사이트 예시
- "소개 환자 전환율 47.4%로 전 채널 중 최고 — 소개 프로그램(리워드/감사카드) 강화 검토 필요"
- "예약→내원 전환 32.5%로 병목 발생 — 예약 48시간 전 리마인드 콜 + 당일 확인 문자 도입 권고"
- "가격 부담 미동의 42% — 3/6/12개월 무이자 분할납부 옵션 제안 시 전환 가능 환자 약 8명 추정"

### 나쁜 인사이트 예시 (이렇게 하지 마세요)
- "총 문의 45건, 전월 대비 3건 증가" (단순 수치 나열)
- "전환율이 좋습니다" (구체적 수치 없음)
- "마케팅을 강화하세요" (실행 방안 없음)

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
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 치과 경영 컨설턴트입니다. 요청받은 형식의 JSON만 출력합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API 오류: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI 응답이 비어있습니다.');
  }

  // JSON 파싱 (코드블록 래핑 대응)
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const result = JSON.parse(jsonStr);

  return {
    insights: Array.isArray(result.insights) ? result.insights.slice(0, 7) : [],
    generatedAt: new Date().toISOString(),
    model: 'gpt-4o-mini',
  };
}
