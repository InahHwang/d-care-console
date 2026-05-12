// src/components/v2/marketing-analytics/Marketing-Channels-Tab.tsx
// 채널 분석 탭 — 단일 채널 심층 분석

'use client';

import React, { useEffect, useState } from 'react';
import { authFetch } from '@/utils/authFetch';
import { MonthlyAnalytics, formatKRW, formatKRWShort } from './Marketing-Analytics-Types';

interface Props {
  year: number;
  month: number;
}

interface ChannelPatient {
  patientId: string;
  name: string;
  phone: string;
  status: string;
  registeredAt: string;
  estimatedAmount: number;
  actualAmount: number;
  interests: string[];
}

export function MarketingChannelsTab({ year, month }: Props) {
  const [analytics, setAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [patients, setPatients] = useState<ChannelPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/v2/marketing/analytics?year=${year}&month=${month}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setAnalytics(json.data);
          if (json.data.channels.length > 0 && !selectedChannel) {
            setSelectedChannel(json.data.channels[0].channel);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year, month, selectedChannel]);

  useEffect(() => {
    if (!selectedChannel) { setPatients([]); return; }
    let cancelled = false;
    const load = async () => {
      setPatientsLoading(true);
      try {
        const res = await authFetch(
          `/api/v2/marketing/channel-patients?year=${year}&month=${month}&channel=${encodeURIComponent(selectedChannel)}`
        );
        const json = await res.json();
        if (cancelled) return;
        if (json.success) setPatients(json.data);
      } finally {
        if (!cancelled) setPatientsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year, month, selectedChannel]);

  if (loading) return <div className="p-10 text-center text-gray-400">불러오는 중...</div>;
  if (!analytics) return <div className="p-10 text-center text-gray-400">데이터 없음</div>;
  if (analytics.channels.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
        분석할 채널이 없습니다. 광고비 입력 또는 환자 등록 후 다시 확인하세요.
      </div>
    );
  }

  const ch = analytics.channels.find((c) => c.channel === selectedChannel);

  // 시술 분포 집계
  const interestCount: Record<string, number> = {};
  for (const p of patients) {
    for (const i of p.interests) {
      interestCount[i] = (interestCount[i] || 0) + 1;
    }
  }
  const totalInterestPatients = patients.filter((p) => p.interests.length > 0).length;
  const interestRows = Object.entries(interestCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  // 퍼널 계산 (간단)
  const consulted = patients.filter((p) => p.estimatedAmount > 0).length;
  const treated = patients.filter((p) => p.actualAmount > 0).length;

  return (
    <div className="space-y-4">
      {/* 채널 선택 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">채널:</span>
        <select
          value={selectedChannel}
          onChange={(e) => setSelectedChannel(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {analytics.channels.map((c) => (
            <option key={c.channel} value={c.channel}>{c.channel}</option>
          ))}
        </select>
      </div>

      {!ch ? <div className="text-gray-400 p-6">채널을 선택하세요.</div> : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="광고비" value={formatKRW(ch.cost)} />
            <Stat label="신환 수" value={`${ch.newPatients}명`} />
            <Stat
              label="평균 객단가 (수납)"
              value={ch.newPatients > 0 ? formatKRWShort(Math.round(ch.actualRevenue / ch.newPatients)) : '-'}
            />
            <Stat label="CAC" value={ch.cac > 0 ? formatKRW(ch.cac) : '-'} />
          </div>

          {/* 퍼널 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">유입 → 상담 → 치료 퍼널</h3>
            <FunnelBar label="유입 (신환)" value={ch.newPatients} max={ch.newPatients || 1} color="bg-blue-500" />
            <FunnelBar label="상담 (견적 발행)" value={consulted} max={ch.newPatients || 1} color="bg-orange-500" />
            <FunnelBar label="치료 (수납)" value={treated} max={ch.newPatients || 1} color="bg-emerald-500" />
          </div>

          {/* 시술 분포 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">시술/관심분야 분포</h3>
            {interestRows.length === 0 ? (
              <div className="text-gray-400 text-sm py-4">관심분야 데이터가 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {interestRows.map(([name, count]) => {
                  const pct = totalInterestPatients > 0
                    ? Math.round((count / totalInterestPatients) * 100) : 0;
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <div className="w-24 text-sm text-gray-700 truncate">{name}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-purple-500 h-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-20 text-right text-sm text-gray-600">{count}명 ({pct}%)</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 환자 리스트 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              유입 환자 리스트 ({patients.length}명)
            </h3>
            {patientsLoading ? (
              <div className="text-gray-400 text-sm py-4">불러오는 중...</div>
            ) : patients.length === 0 ? (
              <div className="text-gray-400 text-sm py-4">이 채널 환자가 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">등록일</th>
                      <th className="px-3 py-2 text-left">환자명</th>
                      <th className="px-3 py-2 text-left">상태</th>
                      <th className="px-3 py-2 text-left">관심분야</th>
                      <th className="px-3 py-2 text-right">견적</th>
                      <th className="px-3 py-2 text-right">수납</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {patients.map((p) => (
                      <tr key={p.patientId} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">{p.registeredAt.slice(5, 10)}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{p.name}</td>
                        <td className="px-3 py-2 text-gray-600">{p.status}</td>
                        <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]">{p.interests.join(', ') || '-'}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{p.estimatedAmount > 0 ? formatKRWShort(p.estimatedAmount) : '-'}</td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-600">{p.actualAmount > 0 ? formatKRWShort(p.actualAmount) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-32 text-sm text-gray-700">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className={`${color} h-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-24 text-right text-sm text-gray-700">{value}명 ({pct}%)</div>
    </div>
  );
}
