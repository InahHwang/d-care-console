// src/components/v2/marketing-analytics/Marketing-Reports-Tab.tsx
// 월별 리포트 탭 — 채널 × 월 ROAS 히트맵 + CSV 내보내기

'use client';

import React, { useEffect, useState } from 'react';
import { authFetch } from '@/utils/authFetch';
import { Download } from 'lucide-react';
import { MonthlyAnalytics, formatKRWShort } from './Marketing-Analytics-Types';
import { MarketingInfoTooltip, MARKETING_METRIC_DESCRIPTIONS } from './Marketing-Info-Tooltip';

interface Props {
  year: number;
}

export function MarketingReportsTab({ year }: Props) {
  const [data, setData] = useState<MonthlyAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/v2/marketing/analytics?year=${year}`);
        const json = await res.json();
        if (!cancelled && json.success) setData(json.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year]);

  if (loading) return <div className="p-10 text-center text-gray-400">불러오는 중...</div>;

  // 모든 채널 수집
  const channelSet = new Set<string>();
  for (const m of data) for (const c of m.channels) channelSet.add(c.channel);
  const channels = Array.from(channelSet).sort();

  // 채널별 평균 ROAS
  const channelAvg: Record<string, number> = {};
  for (const ch of channels) {
    const rows = data.map((m) => m.channels.find((c) => c.channel === ch)?.actualRoas || 0);
    const nonZero = rows.filter((v) => v > 0);
    channelAvg[ch] = nonZero.length > 0 ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;
  }

  const exportCSV = () => {
    const headers = ['채널', ...data.map((m) => `${m.month}월 광고비`), ...data.map((m) => `${m.month}월 매출`), ...data.map((m) => `${m.month}월 ROAS`)];
    const rows: string[][] = [headers];
    for (const ch of channels) {
      const row = [ch];
      for (const m of data) {
        const c = m.channels.find((c) => c.channel === ch);
        row.push(String(c?.cost || 0));
      }
      for (const m of data) {
        const c = m.channels.find((c) => c.channel === ch);
        row.push(String(c?.actualRevenue || 0));
      }
      for (const m of data) {
        const c = m.channels.find((c) => c.channel === ch);
        row.push(`${c?.actualRoas || 0}%`);
      }
      rows.push(row);
    }
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `마케팅리포트_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 inline-flex items-center gap-1">
          {year}년 월별 ROAS 히트맵. 색상 강도가 짙을수록 효율이 좋습니다.
          <MarketingInfoTooltip text={MARKETING_METRIC_DESCRIPTIONS.roas} position="bottom" />
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
        >
          <Download size={14} /> CSV 내보내기
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
          분석할 데이터가 없습니다.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 z-10 min-w-[120px]">채널</th>
                {data.map((m) => (
                  <th key={m.month} className="px-2 py-2 text-center min-w-[70px]">{m.month}월</th>
                ))}
                <th className="px-3 py-2 text-center bg-gray-100 min-w-[80px]">평균</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {channels.map((ch) => (
                <tr key={ch}>
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10">{ch}</td>
                  {data.map((m) => {
                    const c = m.channels.find((c) => c.channel === ch);
                    const roas = c?.actualRoas || 0;
                    const cost = c?.cost || 0;
                    return (
                      <td key={m.month} className="px-2 py-2 text-center">
                        {cost === 0 && roas === 0 ? (
                          <span className="text-gray-300">-</span>
                        ) : (
                          <HeatCell roas={roas} />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center bg-gray-50 font-semibold text-gray-900">
                    {channelAvg[ch] > 0 ? `${channelAvg[ch]}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">월별 합산</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">월</th>
                <th className="px-3 py-2 text-right">총 광고비</th>
                <th className="px-3 py-2 text-right">총 매출 (수납)</th>
                <th className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-1 justify-end w-full">ROAS<MarketingInfoTooltip text={MARKETING_METRIC_DESCRIPTIONS.roas} /></span>
                </th>
                <th className="px-3 py-2 text-right">신환</th>
                <th className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-1 justify-end w-full">CAC<MarketingInfoTooltip text={MARKETING_METRIC_DESCRIPTIONS.cac} /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((m) => (
                <tr key={m.month} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{m.month}월</td>
                  <td className="px-3 py-2 text-right text-gray-700">{m.totalCost > 0 ? formatKRWShort(m.totalCost) : '-'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{m.totalActualRevenue > 0 ? formatKRWShort(m.totalActualRevenue) : '-'}</td>
                  <td className="px-3 py-2 text-right"><HeatCell roas={m.actualRoas} /></td>
                  <td className="px-3 py-2 text-right text-gray-700">{m.totalNewPatients}명</td>
                  <td className="px-3 py-2 text-right text-gray-700">{m.cac > 0 ? formatKRWShort(m.cac) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <Legend label="좋음 (500%↑)" color="bg-emerald-500" />
        <Legend label="보통 (300~500%)" color="bg-amber-400" />
        <Legend label="낮음 (300%↓)" color="bg-rose-400" />
      </div>
    </div>
  );
}

function HeatCell({ roas }: { roas: number }) {
  if (roas === 0) return <span className="text-gray-300">0%</span>;
  const color = roas >= 500 ? 'bg-emerald-100 text-emerald-800'
    : roas >= 300 ? 'bg-amber-100 text-amber-800'
    : 'bg-rose-100 text-rose-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${color}`}>{roas}%</span>
  );
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${color}`}></span>
      <span>{label}</span>
    </div>
  );
}
