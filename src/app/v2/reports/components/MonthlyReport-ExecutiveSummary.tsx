// src/app/v2/reports/components/MonthlyReport-ExecutiveSummary.tsx
// V2 월간 보고서 핵심 요약 - 원장님 30초 브리핑용 대시보드
'use client';

import React from 'react';
import { Target, TrendingUp, TrendingDown, Lightbulb, AlertTriangle, Sparkles, Users, PhoneOff, DoorOpen, CheckCircle2 } from 'lucide-react';
import type { MonthlyStatsV2, ChangeIndicator, ConversionPatternInsight } from './MonthlyReport-Types';
import { formatAmount } from './MonthlyReport-Utils';

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
  note,
}: {
  label: string;
  value: string;
  change: ChangeIndicator;
  unit?: string;
  formatValue?: (v: number) => string;
  accentColor: string;
  note?: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-6 text-center shadow-sm hover:shadow-md transition-shadow">
      <div className={`text-sm font-medium ${accentColor} mb-2`}>
        {label}
        {note && <span className="ml-1 text-[10px] text-gray-400 font-normal">({note})</span>}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-3">{value}</div>
      <MoMChangeBadge change={change} unit={unit} formatValue={formatValue} />
    </div>
  );
}

// ============================================
// 전환 패턴 카드
// ============================================

const PATTERN_GROUP_CONFIG: Record<string, {
  icon: React.ReactNode;
  borderColor: string;
  bgColor: string;
  headerBg: string;
  headerText: string;
  tagColor: string;
}> = {
  converted: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    borderColor: 'border-green-200',
    bgColor: 'bg-green-50',
    headerBg: 'bg-green-600',
    headerText: 'text-white',
    tagColor: 'bg-green-100 text-green-700',
  },
  phoneChurned: {
    icon: <PhoneOff className="w-4 h-4" />,
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50',
    headerBg: 'bg-orange-500',
    headerText: 'text-white',
    tagColor: 'bg-orange-100 text-orange-700',
  },
  visitChurned: {
    icon: <DoorOpen className="w-4 h-4" />,
    borderColor: 'border-red-200',
    bgColor: 'bg-red-50',
    headerBg: 'bg-red-500',
    headerText: 'text-white',
    tagColor: 'bg-red-100 text-red-700',
  },
};

function ConversionPatternCard({ pattern }: { pattern: ConversionPatternInsight }) {
  const config = PATTERN_GROUP_CONFIG[pattern.groupKey] || PATTERN_GROUP_CONFIG.converted;

  if (pattern.patientCount === 0) {
    return (
      <div className={`rounded-lg border ${config.borderColor} overflow-hidden opacity-60`}>
        <div className={`${config.headerBg} ${config.headerText} px-4 py-2.5 flex items-center gap-2`}>
          {config.icon}
          <span className="text-sm font-semibold">{pattern.groupName}</span>
          <span className="text-xs opacity-80 ml-auto">0명</span>
        </div>
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          해당 월 데이터 없음
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${config.borderColor} overflow-hidden`}>
      {/* 헤더 */}
      <div className={`${config.headerBg} ${config.headerText} px-4 py-2.5 flex items-center gap-2`}>
        {config.icon}
        <span className="text-sm font-semibold">{pattern.groupName}</span>
        <span className="text-xs opacity-80 ml-auto">{pattern.patientCount}명</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* 요약 */}
        <p className="text-sm text-gray-700 leading-relaxed">
          {pattern.summary}
        </p>

        {/* 공통점 */}
        {pattern.commonPatterns.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">공통 패턴</p>
            <ul className="space-y-1">
              {pattern.commonPatterns.map((cp, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${config.headerBg}`} />
                  {cp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 실행 제안 */}
        {pattern.actionItems.length > 0 && (
          <div className={`${config.bgColor} rounded-md px-3 py-2`}>
            <p className="text-xs font-semibold text-gray-500 mb-1">실행 제안</p>
            {pattern.actionItems.map((action, i) => (
              <p key={i} className="text-xs text-gray-700 leading-relaxed">
                → {action}
              </p>
            ))}
          </div>
        )}
      </div>
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
  const hasStructuredAI = stats.aiInsights?.structuredInsights && stats.aiInsights.structuredInsights.length > 0;
  const hasRuleInsights = stats.executiveInsights && stats.executiveInsights.length > 0;
  const displayInsights = hasAIInsights
    ? stats.aiInsights!.insights
    : (stats.executiveInsights || []);
  const structuredInsights = hasStructuredAI ? stats.aiInsights!.structuredInsights! : [];
  const hasInsights = displayInsights.length > 0 || structuredInsights.length > 0;
  const conversionPatterns = stats.aiInsights?.conversionPatterns || [];
  const hasConversionPatterns = conversionPatterns.length > 0;

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
            accentColor="text-orange-600"
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
            note="내원 대비"
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

          {hasStructuredAI ? (
            <div className="space-y-3">
              {structuredInsights.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100"
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    {getInsightIcon(item.title)}
                    <span className="text-sm font-semibold text-gray-900">
                      {item.title}
                    </span>
                  </div>
                  {item.detail && (
                    <p className="text-sm text-gray-600 leading-relaxed ml-6 mb-1.5">
                      {item.detail}
                    </p>
                  )}
                  {item.action && (
                    <p className="text-sm text-orange-700 bg-orange-50 rounded px-3 py-1.5 ml-6">
                      <span className="font-medium">Action:</span> {item.action}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : hasInsights ? (
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

        {/* 전환 패턴 분석 */}
        {hasConversionPatterns && (
          <div className="border-t pt-6">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              전환 패턴 분석
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                AI 패턴 매칭
              </span>
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {conversionPatterns.map((pattern) => (
                <ConversionPatternCard key={pattern.groupKey} pattern={pattern} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyReportExecutiveSummary;
