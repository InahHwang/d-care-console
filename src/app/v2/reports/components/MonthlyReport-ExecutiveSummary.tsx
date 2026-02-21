// src/app/v2/reports/components/MonthlyReport-ExecutiveSummary.tsx
// V2 월간 보고서 핵심 요약 - 원장님 30초 브리핑용 대시보드
'use client';

import React from 'react';
import { Target, TrendingUp, TrendingDown, Lightbulb, AlertTriangle, Sparkles } from 'lucide-react';
import type { MonthlyStatsV2, ChangeIndicator } from './MonthlyReport-Types';

// ============================================
// Types
// ============================================

interface MonthlyReportExecutiveSummaryProps {
  stats: MonthlyStatsV2;
  year: number;
  month: number;
  onGenerateAIInsights?: () => Promise<void>;
  isGeneratingAI?: boolean;
  isReadOnly?: boolean;
}

// ============================================
// Helper Functions
// ============================================

function formatAmount(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

function getChangeSign(change: ChangeIndicator): string {
  return change.type === 'increase' ? '+' : '-';
}

function getChangeBadgeStyle(change: ChangeIndicator): string {
  return change.type === 'increase'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700';
}

/** 인사이트 텍스트에서 키워드 기반으로 적절한 아이콘 반환 */
function getInsightIcon(text: string): React.ReactNode {
  const lowerText = text.toLowerCase();

  // 경고/위험 키워드
  if (
    lowerText.includes('주의') ||
    lowerText.includes('위험') ||
    lowerText.includes('하락') ||
    lowerText.includes('감소') ||
    lowerText.includes('부족') ||
    lowerText.includes('이탈')
  ) {
    return <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />;
  }

  // 부정적 키워드
  if (
    lowerText.includes('낮') ||
    lowerText.includes('저조') ||
    lowerText.includes('악화') ||
    lowerText.includes('손실') ||
    lowerText.includes('감소')
  ) {
    return <TrendingDown className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />;
  }

  // 기회/제안 키워드
  if (
    lowerText.includes('기회') ||
    lowerText.includes('추천') ||
    lowerText.includes('제안') ||
    lowerText.includes('가능') ||
    lowerText.includes('개선') ||
    lowerText.includes('활용')
  ) {
    return <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />;
  }

  // 긍정적 키워드 (기본)
  return <TrendingUp className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />;
}

// ============================================
// Sub-Components
// ============================================

function MoMChangeBadge({
  change,
  unit = '건',
  formatValue,
}: {
  change: ChangeIndicator;
  unit?: string;
  formatValue?: (v: number) => string;
}) {
  const display = formatValue
    ? formatValue(change.value)
    : `${change.value}${unit}`;

  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full ${getChangeBadgeStyle(change)}`}
    >
      {getChangeSign(change)}{display} 전월비
    </span>
  );
}

function BigMetricCard({
  label,
  value,
  change,
  unit,
  formatValue,
  accentColor,
}: {
  label: string;
  value: string;
  change: ChangeIndicator;
  unit?: string;
  formatValue?: (v: number) => string;
  accentColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-6 text-center shadow-sm hover:shadow-md transition-shadow">
      <div className={`text-sm font-medium ${accentColor} mb-2`}>{label}</div>
      <div className="text-3xl font-bold text-gray-900 mb-3">{value}</div>
      <MoMChangeBadge change={change} unit={unit} formatValue={formatValue} />
    </div>
  );
}

// ============================================
// Main Component
// ============================================

const MonthlyReportExecutiveSummary: React.FC<MonthlyReportExecutiveSummaryProps> = ({
  stats,
  year,
  month,
  onGenerateAIInsights,
  isGeneratingAI = false,
  isReadOnly = false,
}) => {
  const hasAIInsights = stats.aiInsights?.insights && stats.aiInsights.insights.length > 0;
  const hasRuleInsights = stats.executiveInsights && stats.executiveInsights.length > 0;
  const displayInsights = hasAIInsights
    ? stats.aiInsights!.insights
    : (stats.executiveInsights || []);
  const hasInsights = displayInsights.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6 overflow-hidden">
      {/* 헤더 - 다크 프리미엄 */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-white" />
          <div>
            <h2 className="text-lg font-bold text-white">
              {month}월 월간 보고서 핵심 요약
            </h2>
            <p className="text-sm text-slate-300 mt-0.5">
              {year}년 {month}월 실적 한눈에 보기
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* 3대 핵심 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <BigMetricCard
            label="총 신규문의"
            value={`${stats.totalInquiries}건`}
            change={stats.changes.totalInquiries}
            unit="건"
            accentColor="text-blue-600"
          />
          <BigMetricCard
            label="확정매출"
            value={formatAmount(stats.agreedRevenue)}
            change={stats.changes.agreedRevenue}
            formatValue={(v) => formatAmount(v)}
            accentColor="text-emerald-600"
          />
          <BigMetricCard
            label="결제전환율"
            value={`${stats.agreedRate}%`}
            change={stats.changes.agreedRate}
            unit="%p"
            accentColor="text-purple-600"
          />
        </div>

        {/* 핵심 인사이트 */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              핵심 인사이트
              {hasAIInsights && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  AI 분석
                </span>
              )}
              {!hasAIInsights && hasRuleInsights && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                  자동 요약
                </span>
              )}
            </h3>
            {!isReadOnly && onGenerateAIInsights && (
              <button
                onClick={onGenerateAIInsights}
                disabled={isGeneratingAI}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors no-print"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAI ? 'animate-pulse' : ''}`} />
                {isGeneratingAI ? 'AI 분석 중...' : hasAIInsights ? 'AI 재분석' : 'AI 인사이트 생성'}
              </button>
            )}
          </div>

          {hasInsights ? (
            <ul className="space-y-3">
              {displayInsights.map((insight, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 bg-gray-50 rounded-lg px-4 py-3"
                >
                  {getInsightIcon(insight)}
                  <span className="text-sm text-gray-700 leading-relaxed">
                    {insight}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Lightbulb className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                데이터 새로고침을 클릭하여 인사이트를 생성하세요.
              </p>
            </div>
          )}

          {hasAIInsights && stats.aiInsights?.generatedAt && (
            <p className="text-xs text-gray-400 mt-3 text-right">
              AI 분석: {new Date(stats.aiInsights.generatedAt).toLocaleString('ko-KR')} ({stats.aiInsights.model})
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportExecutiveSummary;
