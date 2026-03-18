// src/app/v2/reports/components/MonthlyReport-RevenueAnalysis.tsx
// V2 매출 현황 분석 - 도넛차트 + 달성/잠재/손실 + 할인율/객단가 + 누적매출 + 환자 명단
'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3, CheckCircle, Clock, XCircle,
  ChevronDown, ChevronRight, TrendingDown, Lightbulb, ExternalLink,
} from 'lucide-react';
import type { MonthlyStatsV2, RevenueAnalysisV2, PatientSummaryV2 } from './MonthlyReport-Types';
import { formatAmount } from './MonthlyReport-Utils';

const {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis,
} = require('recharts') as any;

// ============================================
// 타입 & 상수
// ============================================

interface MonthlyReportRevenueAnalysisProps {
  revenueAnalysis: RevenueAnalysisV2;
  dailyTrends?: MonthlyStatsV2['dailyTrends'];
  patientSummaries?: PatientSummaryV2[];
}

type DetailCategory = 'consultingOngoing' | 'visitManagement' | 'consultingLost' | 'visitLost' | null;

const DONUT_COLORS = ['#10B981', '#3B82F6', '#EF4444'];

// ============================================
// 환자 분류 헬퍼
// ============================================

function categorizePatients(patients: PatientSummaryV2[]) {
  const isPaid = (p: PatientSummaryV2) =>
    p.paymentStatus === 'partial' || p.paymentStatus === 'completed' ||
    (!p.paymentStatus && p.finalAmount > 0 && (p.status === 'treatment' || p.status === 'completed'));

  // 잠재 - 아직 안 오신 환자 (consulting/reserved + 미결제)
  const consultingOngoing = patients.filter((p) =>
    !isPaid(p) && p.status !== 'closed' &&
    (p.status === 'consulting' || p.status === 'reserved')
  );

  // 잠재 - 왔지만 미결제 (visited 이상 + 미결제, closed 제외)
  const visitManagement = patients.filter((p) =>
    !isPaid(p) && p.status !== 'closed' &&
    p.status !== 'consulting' && p.status !== 'reserved'
  );

  // 손실 - 방문 전 이탈 (closed + 내원 이력 없음)
  const consultingLost = patients.filter((p) =>
    p.status === 'closed' && !p.hasVisitConsultation
  );

  // 손실 - 방문 후 이탈 (closed + 내원 이력 있음)
  const visitLost = patients.filter((p) =>
    p.status === 'closed' && p.hasVisitConsultation
  );

  return { consultingOngoing, visitManagement, consultingLost, visitLost };
}

// ============================================
// 커스텀 툴팁
// ============================================

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, percentage } = payload[0].payload;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-2 text-xs">
      <div className="font-medium text-gray-900">{name}</div>
      <div className="text-gray-600">{formatAmount(value)} ({percentage}%)</div>
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-2 text-xs">
      <div className="font-medium text-gray-900">{label}일</div>
      <div className="text-blue-600">누적 매출: {formatAmount(payload[0]?.value || 0)}</div>
    </div>
  );
}

// ============================================
// 환자 목록 서브 컴포넌트
// ============================================

function PatientList({ patients, color }: { patients: PatientSummaryV2[]; color: 'blue' | 'red' }) {
  if (patients.length === 0) return null;

  const borderColor = color === 'blue' ? 'border-blue-100' : 'border-red-100';
  const hoverColor = color === 'blue' ? 'hover:bg-blue-50' : 'hover:bg-red-50';

  return (
    <div className={`mt-3 border ${borderColor} rounded-lg overflow-hidden`}>
      <div className="divide-y divide-gray-100">
        {patients
          .sort((a, b) => (b.estimatedAmount || 0) - (a.estimatedAmount || 0))
          .map((p) => (
          <div
            key={p.patientId}
            className={`flex items-center justify-between px-3 py-2 ${hoverColor} transition-colors`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{p.name}</span>
                {p.age && <span className="text-xs text-gray-400">{p.age}세</span>}
                <span className="text-xs text-gray-500">{p.interest || '미분류'}</span>
              </div>
              {p.consultationSummary && (
                <div className="text-xs text-gray-400 truncate mt-0.5">{p.consultationSummary}</div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {p.estimatedAmount > 0 && (
                <span className="text-xs font-medium text-gray-600">
                  {formatAmount(p.estimatedAmount)}
                </span>
              )}
              <a
                href={`/v2/patients/${p.patientId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

const MonthlyReportRevenueAnalysis: React.FC<MonthlyReportRevenueAnalysisProps> = ({
  revenueAnalysis,
  dailyTrends,
  patientSummaries,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<DetailCategory>(null);
  const { achieved, potential, lost, summary } = revenueAnalysis;

  const categorized = useMemo(
    () => patientSummaries ? categorizePatients(patientSummaries) : null,
    [patientSummaries]
  );

  const toggleCategory = (cat: DetailCategory) => {
    setExpandedCategory((prev) => prev === cat ? null : cat);
  };

  // 도넛 차트 데이터
  const donutData = useMemo(() => [
    { name: '확정매출', value: achieved.amount, percentage: achieved.percentage },
    { name: '잠재매출', value: potential.totalAmount, percentage: potential.percentage },
    { name: '손실매출', value: lost.totalAmount, percentage: lost.percentage },
  ].filter((d) => d.value > 0), [achieved, potential, lost]);

  // 누적 일별 매출
  const cumulativeRevenue = useMemo(() => {
    if (!dailyTrends || dailyTrends.length === 0) return [];
    let cumulative = 0;
    return dailyTrends.map((d) => {
      cumulative += d.revenue;
      const dayNum = d.date.split('-')[2] || d.date;
      return { day: parseInt(dayNum), value: cumulative };
    });
  }, [dailyTrends]);

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-5 border-b bg-emerald-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          매출 현황 분석
          <span className="text-sm bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
            총 {summary.totalInquiries}명 문의
          </span>
        </h2>
      </div>

      <div className="p-5">
        {/* 도넛 + 3분류 카드 */}
        <div className="flex flex-col lg:flex-row gap-5 mb-5">
          {/* 도넛 차트 */}
          {donutData.length > 0 && (
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="w-44 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((_: any, idx: number) => (
                        <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-3 text-xs mt-1">
                {donutData.map((d: any, idx: number) => (
                  <span key={d.name} className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                    />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3분류 카드 */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">확정매출</span>
              </div>
              <div className="text-2xl font-bold text-emerald-900 mb-1">
                {formatAmount(achieved.amount)}
              </div>
              <div className="text-xs text-emerald-700 mb-1">
                {achieved.patients}명 ({achieved.percentage}%)
              </div>
              <div className="text-xs text-emerald-600/70">
                결제 완료된 최종금액 합계
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">잠재매출</span>
              </div>
              <div className="text-2xl font-bold text-blue-900 mb-1">
                {formatAmount(potential.totalAmount)}
              </div>
              <div className="text-xs text-blue-700 mb-1">
                {potential.totalPatients}명 ({potential.percentage}%)
              </div>
              <div className="text-xs text-blue-600/70">
                미결제 환자의 원래금액 합계
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">손실매출</span>
              </div>
              <div className="text-2xl font-bold text-red-900 mb-1">
                {formatAmount(lost.totalAmount)}
              </div>
              <div className="text-xs text-red-700 mb-1">
                {lost.totalPatients}명 ({lost.percentage}%)
              </div>
              <div className="text-xs text-red-600/70">
                종결 환자의 원래금액 합계
              </div>
            </div>
          </div>
        </div>

        {/* 핵심 지표 */}
        <div className="flex flex-wrap gap-4 mb-5 px-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">할인율</span>
            <span className={`font-semibold ${
              summary.discountRate <= 10 ? 'text-emerald-600' :
              summary.discountRate <= 30 ? 'text-amber-600' : 'text-red-500'
            }`}>
              {summary.discountRate}%
            </span>
          </div>
          <div className="text-gray-300">|</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">평균 객단가</span>
            <span className="font-semibold text-gray-900">
              {summary.avgDealSize > 0 ? formatAmount(summary.avgDealSize) : '-'}
            </span>
          </div>
          <div className="text-gray-300">|</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">매출 회수율</span>
            <span className="font-semibold text-gray-900">{summary.achievementRate}%</span>
            <span className="text-xs text-gray-400">전체 문의금액 대비 결제 금액 비율</span>
          </div>
        </div>

        {/* 누적 일별 매출 그래프 */}
        {cumulativeRevenue.length > 0 && cumulativeRevenue[cumulativeRevenue.length - 1]?.value > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-medium text-gray-700 mb-2">누적 매출 추이</h4>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeRevenue} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickFormatter={(v: number) => v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 인사이트 */}
        {potential.totalAmount > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg mb-5 text-sm">
            <Lightbulb className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <span className="text-emerald-800">
              잠재환자 전환 시 <span className="font-bold">{formatAmount(potential.totalAmount)}</span> 추가 가능
              {achieved.amount > 0 && (
                <span> (확정매출의 <span className="font-bold">{summary.potentialGrowth}%</span>)</span>
              )}
            </span>
          </div>
        )}

        {/* 세부 분석 토글 */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3 no-print"
        >
          {showDetails
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
          세부 분석
        </button>

        {showDetails && (
          <div className="space-y-4">
            {/* 잠재매출 세부 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                아직 전환 가능한 환자 ({potential.totalPatients}명)
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* 아직 안 오신 환자 */}
                <div>
                  <button
                    onClick={() => toggleCategory('consultingOngoing')}
                    className="w-full bg-white rounded-lg p-4 border border-blue-100 text-left hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📞</span>
                        <span className="font-medium text-blue-800">아직 안 오신 환자</span>
                      </div>
                      {categorized && categorized.consultingOngoing.length > 0 && (
                        expandedCategory === 'consultingOngoing'
                          ? <ChevronDown className="w-4 h-4 text-blue-400" />
                          : <ChevronRight className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="text-2xl font-bold text-blue-900 mb-1">
                      {potential.consultingOngoing.patients}명
                    </div>
                    <div className="text-sm text-blue-700 mb-2">
                      {formatAmount(potential.consultingOngoing.amount)}
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                      전화상담 · 예약만 한 상태
                    </div>
                    <div className="text-xs text-blue-600 mt-2 font-medium">→ 내원 유도 필요</div>
                  </button>
                  {expandedCategory === 'consultingOngoing' && categorized && (
                    <PatientList patients={categorized.consultingOngoing} color="blue" />
                  )}
                </div>

                {/* 왔지만 아직 미결제 */}
                <div>
                  <button
                    onClick={() => toggleCategory('visitManagement')}
                    className="w-full bg-white rounded-lg p-4 border border-blue-100 text-left hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏥</span>
                        <span className="font-medium text-blue-800">왔지만 아직 미결제</span>
                      </div>
                      {categorized && categorized.visitManagement.length > 0 && (
                        expandedCategory === 'visitManagement'
                          ? <ChevronDown className="w-4 h-4 text-blue-400" />
                          : <ChevronRight className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="text-2xl font-bold text-blue-900 mb-1">
                      {potential.visitManagement.patients}명
                    </div>
                    <div className="text-sm text-blue-700 mb-2">
                      {formatAmount(potential.visitManagement.amount)}
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                      내원 완료, 치료 결정 대기 중
                    </div>
                    <div className="text-xs text-blue-600 mt-2 font-medium">→ 치료 동의 유도 필요</div>
                  </button>
                  {expandedCategory === 'visitManagement' && categorized && (
                    <PatientList patients={categorized.visitManagement} color="blue" />
                  )}
                </div>
              </div>
            </div>

            {/* 손실매출 세부 */}
            {lost.totalPatients > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  이탈한 환자 ({lost.totalPatients}명)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {/* 방문 전 이탈 */}
                  <div>
                    <button
                      onClick={() => toggleCategory('consultingLost')}
                      className="w-full bg-white rounded-lg p-4 border border-red-100 text-left hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🚪</span>
                          <span className="font-medium text-red-800">방문 전 이탈</span>
                        </div>
                        {categorized && categorized.consultingLost.length > 0 && (
                          expandedCategory === 'consultingLost'
                            ? <ChevronDown className="w-4 h-4 text-red-400" />
                            : <ChevronRight className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="text-2xl font-bold text-red-900 mb-1">
                        {lost.consultingLost.patients}명
                      </div>
                      <div className="text-sm text-red-700 mb-2">
                        {formatAmount(lost.consultingLost.amount)}
                      </div>
                      <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                        상담만 하고 내원하지 않은 환자
                      </div>
                      <div className="text-xs text-red-600 mt-2 font-medium">→ 재연락 검토</div>
                    </button>
                    {expandedCategory === 'consultingLost' && categorized && (
                      <PatientList patients={categorized.consultingLost} color="red" />
                    )}
                  </div>

                  {/* 방문 후 이탈 */}
                  <div>
                    <button
                      onClick={() => toggleCategory('visitLost')}
                      className="w-full bg-white rounded-lg p-4 border border-red-100 text-left hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">😔</span>
                          <span className="font-medium text-red-800">방문 후 이탈</span>
                        </div>
                        {categorized && categorized.visitLost.length > 0 && (
                          expandedCategory === 'visitLost'
                            ? <ChevronDown className="w-4 h-4 text-red-400" />
                            : <ChevronRight className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="text-2xl font-bold text-red-900 mb-1">
                        {lost.visitLost.patients}명
                      </div>
                      <div className="text-sm text-red-700 mb-2">
                        {formatAmount(lost.visitLost.amount)}
                      </div>
                      <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                        내원까지 했지만 치료 없이 종결
                      </div>
                      <div className="text-xs text-red-600 mt-2 font-medium">→ 원인 분석 및 재상담 검토</div>
                    </button>
                    {expandedCategory === 'visitLost' && categorized && (
                      <PatientList patients={categorized.visitLost} color="red" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyReportRevenueAnalysis;
