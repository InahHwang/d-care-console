// src/components/v2/marketing-analytics/Marketing-Overview-Tab.tsx
// 마케팅 개요 탭 — KPI + 월별 ROAS 추이 + 채널별 성과 TOP 5

'use client';

import React, { useEffect, useState } from 'react';
import { authFetch } from '@/utils/authFetch';
import { TrendingUp, TrendingDown, Users, DollarSign, Target as TargetIcon, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { MonthlyAnalytics, formatKRW, formatKRWShort } from './Marketing-Analytics-Types';
import { MarketingInfoTooltip, MARKETING_METRIC_DESCRIPTIONS } from './Marketing-Info-Tooltip';

interface Props {
  year: number;
  month: number;
}

const PIE_COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280'];

export function MarketingOverviewTab({ year, month }: Props) {
  const [current, setCurrent] = useState<MonthlyAnalytics | null>(null);
  const [previous, setPrevious] = useState<MonthlyAnalytics | null>(null);
  const [trend, setTrend] = useState<MonthlyAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // 현재 월
        const curRes = await authFetch(`/api/v2/marketing/analytics?year=${year}&month=${month}`);
        const curJson = await curRes.json();

        // 전월
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevRes = await authFetch(`/api/v2/marketing/analytics?year=${prevYear}&month=${prevMonth}`);
        const prevJson = await prevRes.json();

        // 최근 6개월
        const trendRes = await authFetch(`/api/v2/marketing/analytics?months=6`);
        const trendJson = await trendRes.json();

        if (cancelled) return;
        if (curJson.success) setCurrent(curJson.data);
        if (prevJson.success) setPrevious(prevJson.data);
        if (trendJson.success) setTrend(trendJson.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year, month]);

  if (loading) {
    return <div className="p-10 text-center text-gray-400">불러오는 중...</div>;
  }
  if (!current) {
    return <div className="p-10 text-center text-gray-400">데이터를 불러오지 못했습니다.</div>;
  }

  const diff = (cur: number, prev: number, unit: '%' | 'p' | '원' | '명' = '%') => {
    if (prev === 0 && cur === 0) return null;
    if (prev === 0) return { up: cur > 0, text: '신규' };
    const delta = cur - prev;
    const pct = prev !== 0 ? Math.round((delta / prev) * 100) : 0;
    if (unit === 'p') return { up: delta > 0, text: `${delta > 0 ? '+' : ''}${delta}%p` };
    if (unit === '명') return { up: delta > 0, text: `${delta > 0 ? '+' : ''}${delta}명` };
    if (unit === '원') return { up: delta > 0, text: `${delta > 0 ? '+' : ''}${formatKRWShort(Math.abs(delta))}` };
    return { up: delta > 0, text: `${pct > 0 ? '+' : ''}${pct}%` };
  };

  const costDiff = previous ? diff(current.totalCost, previous.totalCost, '%') : null;
  const revDiff = previous ? diff(current.totalActualRevenue, previous.totalActualRevenue, '%') : null;
  const roasDiff = previous ? diff(current.actualRoas, previous.actualRoas, 'p') : null;
  const patDiff = previous ? diff(current.totalNewPatients, previous.totalNewPatients, '명') : null;
  const cacDiff = previous ? diff(current.cac, previous.cac, '원') : null;

  const top5 = [...current.channels].sort((a, b) => b.actualRevenue - a.actualRevenue).slice(0, 5);

  const trendData = trend.map((m) => ({
    label: `${m.month}월`,
    'ROAS(수납)': m.actualRoas,
    'ROAS(견적)': m.roas,
  }));

  const pieData = current.channels
    .filter((c) => c.actualRevenue > 0)
    .map((c) => ({ name: c.channel, value: c.actualRevenue }));

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          icon={<DollarSign size={18} />}
          label="총 광고비"
          tooltip={MARKETING_METRIC_DESCRIPTIONS.totalCost}
          value={formatKRW(current.totalCost)}
          diff={costDiff}
          color="orange"
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="총 매출 (수납)"
          tooltip={MARKETING_METRIC_DESCRIPTIONS.totalRevenue}
          value={formatKRW(current.totalActualRevenue)}
          subValue={`견적 ${formatKRWShort(current.totalEstimatedRevenue)}`}
          diff={revDiff}
          color="green"
        />
        <KpiCard
          icon={<TargetIcon size={18} />}
          label="ROAS (수납)"
          tooltip={MARKETING_METRIC_DESCRIPTIONS.roas}
          value={`${current.actualRoas}%`}
          subValue={`견적 ${current.roas}%`}
          diff={roasDiff}
          color="blue"
        />
        <KpiCard
          icon={<Users size={18} />}
          label="신환 수"
          tooltip={MARKETING_METRIC_DESCRIPTIONS.newPatients}
          value={`${current.totalNewPatients}명`}
          diff={patDiff}
          color="purple"
        />
        <KpiCard
          icon={<Activity size={18} />}
          label="CAC"
          tooltip={MARKETING_METRIC_DESCRIPTIONS.cac}
          value={current.cac > 0 ? formatKRW(current.cac) : '-'}
          diff={cacDiff}
          inverted
          color="gray"
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="월별 ROAS 추이 (최근 6개월)">
          {trendData.length === 0 ? (
            <EmptyState message="추이 데이터가 없습니다." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="ROAS(수납)" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="ROAS(견적)" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="채널별 매출 비중">
          {pieData.length === 0 ? (
            <EmptyState message="이번 달 매출 데이터가 없습니다." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => entry.name}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatKRW(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* 채널별 성과 TOP 5 */}
      <Card title="채널별 성과 TOP 5">
        {top5.length === 0 ? (
          <EmptyState message="채널 데이터가 없습니다." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">순위</th>
                  <th className="px-3 py-2 text-left">채널</th>
                  <th className="px-3 py-2 text-right">광고비</th>
                  <th className="px-3 py-2 text-right">매출 (수납)</th>
                  <th className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1">ROAS<MarketingInfoTooltip text={MARKETING_METRIC_DESCRIPTIONS.roas} /></span>
                  </th>
                  <th className="px-3 py-2 text-right">신환</th>
                  <th className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1">CAC<MarketingInfoTooltip text={MARKETING_METRIC_DESCRIPTIONS.cac} /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {top5.map((c, idx) => (
                  <tr key={c.channel} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{c.channel}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatKRW(c.cost)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-medium">{formatKRW(c.actualRevenue)}</td>
                    <td className="px-3 py-2 text-right">
                      <RoasBadge value={c.actualRoas} />
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{c.newPatients}명</td>
                    <td className="px-3 py-2 text-right text-gray-700">{c.cac > 0 ? formatKRWShort(c.cac) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── 내부 컴포넌트 ───
function KpiCard({
  icon,
  label,
  tooltip,
  value,
  subValue,
  diff,
  color,
  inverted = false,
}: {
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
  value: string;
  subValue?: string;
  diff: { up: boolean; text: string } | null;
  color: 'orange' | 'green' | 'blue' | 'purple' | 'gray';
  inverted?: boolean;
}) {
  const colorMap: Record<string, string> = {
    orange: 'text-orange-600 bg-orange-50',
    green: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    gray: 'text-gray-600 bg-gray-50',
  };
  const isPositive = inverted ? !diff?.up : diff?.up;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <span className="text-xs text-gray-500 inline-flex items-center gap-1">
          {label}
          {tooltip && <MarketingInfoTooltip text={tooltip} />}
        </span>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {subValue && <div className="text-xs text-gray-400 mt-0.5">{subValue}</div>}
      {diff && (
        <div className={`flex items-center gap-1 text-xs mt-1 ${
          isPositive ? 'text-emerald-600' : 'text-rose-600'
        }`}>
          {diff.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{diff.text}</span>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">{message}</div>;
}

function RoasBadge({ value }: { value: number }) {
  const color = value >= 500 ? 'bg-emerald-100 text-emerald-700'
    : value >= 300 ? 'bg-amber-100 text-amber-700'
    : value > 0 ? 'bg-rose-100 text-rose-700'
    : 'bg-gray-100 text-gray-500';
  return <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${color}`}>{value}%</span>;
}
