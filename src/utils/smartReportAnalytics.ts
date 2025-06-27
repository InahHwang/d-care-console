// /src/utils/smartReportAnalytics.ts - 타입 에러 수정
import { Patient } from '@/types/patient';

// 환자 세그먼트 분석
export function analyzePatientSegments(patients: Patient[]) {
  const segments = patients.reduce((acc, patient) => {
    let segment = "기타";
    
    // 관심 서비스와 견적 금액으로 세그먼트 분류
    if (patient.interestedServices?.includes("임플란트")) {
      const estimate = patient.postVisitConsultation?.estimateInfo?.regularPrice || 0;
      segment = estimate > 5000000 ? "임플란트 다수" : "임플란트 단일";
    } else if (patient.interestedServices?.includes("풀케이스")) {
      segment = "풀케이스";
    } else if (patient.interestedServices?.includes("충치치료")) {
      segment = "충치치료";
    }

    if (!acc[segment]) {
      acc[segment] = { 
        total: 0, 
        conversions: 0, 
        totalEstimate: 0,
        totalCallbacks: 0 // 🔥 avgCallbacks → totalCallbacks로 변경
      };
    }
    
    acc[segment].total++;
    acc[segment].totalCallbacks += patient.callbackHistory?.length || 0; // 🔥 수정
    
    // 성공 케이스 판단 - Patient 타입의 실제 status 값들 사용
    if (patient.status === "예약확정" || 
        patient.visitConfirmed === true ||
        patient.postVisitStatus === "치료시작") {
      acc[segment].conversions++;
    }
    
    // 견적 금액 누적
    if (patient.postVisitConsultation?.estimateInfo?.regularPrice) {
      acc[segment].totalEstimate += patient.postVisitConsultation.estimateInfo.regularPrice;
    }
    
    return acc;
  }, {} as Record<string, { total: number; conversions: number; totalEstimate: number; totalCallbacks: number }>);

  return Object.entries(segments).map(([segment, data]) => ({
    segment,
    count: data.total,
    rate: data.total > 0 ? Math.round((data.conversions / data.total) * 100) : 0,
    avgAmount: data.total > 0 ? Math.round(data.totalEstimate / data.total) : 0,
    avgCallbacks: data.total > 0 ? Number((data.totalCallbacks / data.total).toFixed(1)) : 0 // 🔥 number로 반환
  }));
}

// 지역별 성과 분석
export function analyzeRegionPerformance(patients: Patient[]) {
  const regions = patients.reduce((acc, patient) => {
    const region = patient.region?.city || patient.region?.province || "기타";
    
    if (!acc[region]) {
      acc[region] = { total: 0, conversions: 0, totalRevenue: 0 };
    }
    
    acc[region].total++;
    
    if (patient.status === "예약확정" || 
        patient.visitConfirmed === true ||
        patient.postVisitStatus === "치료시작") {
      acc[region].conversions++;
      
      // 수익 계산
      const revenue = patient.postVisitConsultation?.estimateInfo?.discountPrice || 
                     patient.postVisitConsultation?.estimateInfo?.regularPrice || 0;
      acc[region].totalRevenue += revenue;
    }
    
    return acc;
  }, {} as Record<string, { total: number; conversions: number; totalRevenue: number }>);

  return Object.entries(regions)
    .map(([region, data]) => ({
      region,
      count: data.total,
      rate: data.total > 0 ? Math.round((data.conversions / data.total) * 100) : 0,
      revenue: Math.round(data.totalRevenue / 10000) // 만원 단위
    }))
    .sort((a, b) => b.rate - a.rate); // 전환율 순 정렬
}

// 연령대별 분석
export function analyzeAgeGroups(patients: Patient[]) {
  const ageGroups = patients.reduce((acc, patient) => {
    if (!patient.age) return acc;
    
    const group = patient.age >= 70 ? "70+" : 
                 patient.age >= 60 ? "60-69" :
                 patient.age >= 50 ? "50-59" :
                 patient.age >= 40 ? "40-49" :
                 patient.age >= 30 ? "30-39" : "20-29";
    
    if (!acc[group]) {
      acc[group] = { total: 0, conversions: 0, avgEstimate: 0, totalEstimate: 0 };
    }
    
    acc[group].total++;
    
    if (patient.status === "예약확정" || 
        patient.visitConfirmed === true ||
        patient.postVisitStatus === "치료시작") {
      acc[group].conversions++;
    }
    
    const estimate = patient.postVisitConsultation?.estimateInfo?.regularPrice || 0;
    acc[group].totalEstimate += estimate;
    
    return acc;
  }, {} as Record<string, any>);

  return Object.entries(ageGroups).map(([age, data]) => ({
    ageGroup: age,
    count: data.total,
    rate: data.total > 0 ? Math.round((data.conversions / data.total) * 100) : 0,
    avgEstimate: data.total > 0 ? Math.round(data.totalEstimate / data.total / 10000) : 0
  }));
}

// 상담 패턴 분석
export function analyzeConsultationPatterns(patients: Patient[]) {
  let totalCallbacks = 0;
  let successfulWithFewCallbacks = 0;
  let failedWithManyCallbacks = 0;
  let competitorMentions = 0;
  let priceHesitations = 0;
  let familyConsultations = 0;

  patients.forEach(patient => {
    const callbacks = patient.callbackHistory?.length || 0;
    totalCallbacks += callbacks;
    
    const isSuccess = patient.status === "예약확정" || 
                     patient.visitConfirmed === true ||
                     patient.postVisitStatus === "치료시작";
    
    // 적은 콜백으로 성공
    if (isSuccess && callbacks <= 2) {
      successfulWithFewCallbacks++;
    }
    
    // 많은 콜백에도 실패
    if (!isSuccess && callbacks >= 3) {
      failedWithManyCallbacks++;
    }
    
    // 상담 내용 키워드 분석
    const allNotes = patient.callbackHistory?.map(cb => cb.notes || '').join(' ') || '';
    
    if (allNotes.includes('다른') || allNotes.includes('타치과') || allNotes.includes('비교')) {
      competitorMentions++;
    }
    
    if (allNotes.includes('비싸') || allNotes.includes('부담') || allNotes.includes('가격')) {
      priceHesitations++;
    }
    
    if (allNotes.includes('남편') || allNotes.includes('아내') || allNotes.includes('가족') || allNotes.includes('상의')) {
      familyConsultations++;
    }
  });

  return {
    avgCallbacks: patients.length > 0 ? Number((totalCallbacks / patients.length).toFixed(1)) : 0, // 🔥 number로 반환
    quickSuccessRate: patients.length > 0 ? Math.round((successfulWithFewCallbacks / patients.length) * 100) : 0,
    persistentFailureRate: patients.length > 0 ? Math.round((failedWithManyCallbacks / patients.length) * 100) : 0,
    competitorMentionRate: patients.length > 0 ? Math.round((competitorMentions / patients.length) * 100) : 0,
    priceHesitationRate: patients.length > 0 ? Math.round((priceHesitations / patients.length) * 100) : 0,
    familyConsultationRate: patients.length > 0 ? Math.round((familyConsultations / patients.length) * 100) : 0
  };
}

// 고급 AI 인사이트 생성
export function generateAdvancedInsights(patients: Patient[], currentMonth: any, previousMonth: any) {
  const insights: Array<{
    type: 'success' | 'warning' | 'opportunity' | 'risk';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    action: string;
    details: string[];
    confidence: number; // AI 확신도 (0-100)
  }> = [];

  const patterns = analyzeConsultationPatterns(patients);
  const segments = analyzePatientSegments(patients);
  const regions = analyzeRegionPerformance(patients);
  const ageGroups = analyzeAgeGroups(patients);

  // 1. 전환율 급변 감지
  const conversionChange = currentMonth.conversionRate - (previousMonth?.conversionRate || 0);
  if (Math.abs(conversionChange) > 5) {
    insights.push({
      type: conversionChange > 0 ? 'success' : 'warning',
      title: conversionChange > 0 ? '예약 전환율 급상승 🚀' : '예약 전환율 급락 ⚠️',
      description: `전월 대비 ${Math.abs(conversionChange).toFixed(1)}%p ${conversionChange > 0 ? '증가' : '감소'}`,
      impact: 'high',
      action: conversionChange > 0 ? '성공 요인 분석 및 표준화' : '원인 분석 및 즉시 개선',
      details: conversionChange > 0 ? 
        ['현재 상담 방식 문서화', '성공 케이스 분석', '팀 교육 자료 제작'] :
        ['실패 케이스 긴급 분석', '상담 프로세스 점검', '즉시 개선 조치'],
      confidence: 95
    });
  }

  // 2. 지역별 기회 포착
  const topRegion = regions[0];
  if (topRegion && topRegion.rate > 30 && topRegion.count >= 3) {
    insights.push({
      type: 'opportunity',
      title: `${topRegion.region} 집중 공략 기회 🎯`,
      description: `전환율 ${topRegion.rate}%, 수익 ${topRegion.revenue}만원 달성`,
      impact: 'high',
      action: '해당 지역 마케팅 투자 확대',
      details: [
        `${topRegion.region} 추가 마케팅 예산 배정`,
        '지역 특성 맞춤 서비스 개발',
        '성공 요인을 인근 지역에 적용'
      ],
      confidence: 88
    });
  }

  // 3. 세그먼트별 위험 감지
  const lowPerformingSegments = segments.filter(s => s.rate < 20 && s.count >= 3);
  if (lowPerformingSegments.length > 0) {
    const segment = lowPerformingSegments[0];
    insights.push({
      type: 'warning',
      title: `${segment.segment} 세그먼트 저조 📉`,
      description: `전환율 ${segment.rate}%, 평균 ${segment.avgCallbacks}회 상담`,
      impact: 'medium',
      action: '세그먼트별 맞춤 전략 수립',
      details: [
        '해당 세그먼트 성공 케이스 분석',
        '맞춤형 상담 스크립트 개발',
        '가격 정책 재검토'
      ],
      confidence: 82
    });
  }

  // 4. 상담 효율성 분석
  if (patterns.avgCallbacks > 3.0) { // 🔥 string 비교 제거
    insights.push({
      type: 'warning',
      title: '상담 횟수 과다 🔄',
      description: `평균 ${patterns.avgCallbacks}회 상담, 효율성 개선 필요`,
      impact: 'medium',
      action: '상담 프로세스 최적화',
      details: [
        '1-2차 상담 성공률 분석',
        '조기 결정 유도 방법 개발',
        '부재중 처리 자동화'
      ],
      confidence: 76
    });
  }

  // 5. 경쟁사 위협 감지
  if (patterns.competitorMentionRate > 25) {
    insights.push({
      type: 'risk',
      title: '경쟁사 비교 급증 ⚔️',
      description: `환자의 ${patterns.competitorMentionRate}%가 타 업체 언급`,
      impact: 'high',
      action: '차별화 전략 강화',
      details: [
        '경쟁사 대응 스크립트 개발',
        '독점 서비스 포인트 강화',
        '가격 경쟁력 재평가'
      ],
      confidence: 91
    });
  }

  // 6. 가족 의사결정 패턴
  if (patterns.familyConsultationRate > 30) {
    insights.push({
      type: 'opportunity',
      title: '가족 동반 상담 효과 👨‍👩‍👧‍👦',
      description: `${patterns.familyConsultationRate}% 가족 상의 패턴 확인`,
      impact: 'medium',
      action: '가족 동반 상담 프로그램 도입',
      details: [
        '배우자/가족 동반 상담 권장',
        '가족 할인 혜택 개발',
        '가정용 상담 자료 제작'
      ],
      confidence: 73
    });
  }

  // 7. 연령대별 맞춤 기회
  const dominantAge = ageGroups.sort((a, b) => b.count - a.count)[0];
  if (dominantAge && dominantAge.count >= patients.length * 0.4) {
    insights.push({
      type: 'opportunity',
      title: `${dominantAge.ageGroup}세 맞춤 전략 👥`,
      description: `전체의 ${Math.round((dominantAge.count / patients.length) * 100)}% 차지, 평균 견적 ${dominantAge.avgEstimate}만원`,
      impact: 'medium',
      action: '연령대별 맞춤 서비스 개발',
      details: [
        `${dominantAge.ageGroup}세 맞춤 상담법 개발`,
        '연령대별 관심사 기반 마케팅',
        '맞춤형 치료 패키지 구성'
      ],
      confidence: 79
    });
  }

  // 8. 가격 민감도 분석
  if (patterns.priceHesitationRate > 40) {
    insights.push({
      type: 'risk',
      title: '가격 부담감 증가 💰',
      description: `${patterns.priceHesitationRate}% 가격 관련 우려 표현`,
      impact: 'high',
      action: '가격 정책 및 할인 전략 재검토',
      details: [
        '분할 결제 옵션 확대',
        '가치 기반 상담법 도입',
        '투명한 가격 안내 시스템'
      ],
      confidence: 86
    });
  }

  // 확신도 순으로 정렬하여 최대 6개 반환
  return insights
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);
}

// 실행 계획 생성
export function generateActionPlans(insights: any[], currentMetrics: any) {
  const plans = {
    immediate: [] as any[],
    shortTerm: [] as any[],
    longTerm: [] as any[]
  };

  // 즉시 실행 계획 (high impact 인사이트 기반)
  const highImpactInsights = insights.filter(i => i.impact === 'high');
  highImpactInsights.forEach(insight => {
    plans.immediate.push({
      title: insight.action,
      description: insight.details[0],
      priority: 'high',
      source: insight.title
    });
  });

  // 기본 즉시 실행 항목들
  plans.immediate.push(
    {
      title: '부재중 3차 자동 처리',
      description: '3회 이상 부재중 시 이벤트 타겟 자동 전환',
      priority: 'medium',
      source: '프로세스 최적화'
    },
    {
      title: '성공 패턴 표준화',
      description: '높은 전환율 달성 방법론 문서화',
      priority: 'high',
      source: '성과 분석'
    }
  );

  // 단기 계획
  plans.shortTerm.push(
    {
      title: '세그먼트별 맞춤 전략',
      description: '환자 유형별 최적화된 상담 가이드라인',
      timeline: '2주'
    },
    {
      title: '경쟁사 대응 시스템',
      description: '실시간 가격 비교 대응 프로세스',
      timeline: '1개월'
    }
  );

  // 장기 계획
  plans.longTerm.push(
    {
      title: 'AI 예측 시스템',
      description: '환자별 예약 가능성 자동 예측',
      timeline: '분기'
    },
    {
      title: '통합 고객 관리',
      description: '지역/연령/세그먼트 통합 관리 시스템',
      timeline: '분기'
    }
  );

  return plans;
}

// 성과 목표 계산
export function calculateTargets(currentMetrics: any, previousMetrics: any, insights: any[]) {
  const growth = currentMetrics.totalPatients > 0 ? 
    Math.min(Math.max((currentMetrics.conversionRate - (previousMetrics?.conversionRate || 0)) * 1.5, 3), 8) : 5;

  return {
    conversionRate: Math.min(currentMetrics.conversionRate + growth, 40),
    totalPatients: Math.ceil(currentMetrics.totalPatients * 1.15),
    avgCallbacks: Math.max(currentMetrics.avgCallbacks - 0.4, 1.5),
    highValueRate: 30, // 고액 케이스 목표
    customerSatisfaction: 95 // 고객 만족도 목표
  };
}