// src/components/v2/marketing-analytics/Marketing-Costs-Tab.tsx
// 마케팅 광고비 관리 탭 — 채널 × 월 매트릭스 + 입력 모달

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { authFetch } from '@/utils/authFetch';
import { Plus, Trash2, X, Settings } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { MarketingCost, CATEGORY_LABEL, formatKRWShort } from './Marketing-Analytics-Types';

interface Props {
  year: number;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function MarketingCostsTab({ year }: Props) {
  const [costs, setCosts] = useState<MarketingCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingCost | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/v2/marketing/costs?year=${year}`);
      const json = await res.json();
      if (json.success) setCosts(json.data);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    reload();
  }, [reload]);

  // 채널 × 월 매트릭스 구성
  const channels = Array.from(new Set(costs.map((c) => c.channel))).sort();
  const matrix: Record<string, Record<number, number>> = {};
  const memoMap: Record<string, Record<number, MarketingCost>> = {};
  for (const c of costs) {
    if (!matrix[c.channel]) {
      matrix[c.channel] = {};
      memoMap[c.channel] = {};
    }
    matrix[c.channel][c.month] = (matrix[c.channel][c.month] || 0) + c.amount;
    memoMap[c.channel][c.month] = c;
  }
  const monthlyTotals = MONTHS.map((m) =>
    channels.reduce((sum, ch) => sum + (matrix[ch]?.[m] || 0), 0)
  );
  const channelTotals = channels.map((ch) =>
    MONTHS.reduce((sum, m) => sum + (matrix[ch]?.[m] || 0), 0)
  );

  const handleDeleteChannel = async (channel: string) => {
    const recordCount = MONTHS.reduce((sum, m) => sum + (matrix[channel]?.[m] ? 1 : 0), 0);
    if (!confirm(`'${channel}' 채널의 ${year}년 광고비 기록 ${recordCount}건을 모두 삭제하시겠습니까?`)) return;

    const res = await authFetch(
      `/api/v2/marketing/costs?channel=${encodeURIComponent(channel)}&year=${year}`,
      { method: 'DELETE' }
    );
    const json = await res.json();
    if (!json.success) {
      alert(json.message || '삭제 실패');
      return;
    }
    await reload();
  };

  const handleCellClick = (channel: string, month: number) => {
    const existing = memoMap[channel]?.[month];
    if (existing) {
      setEditing(existing);
    } else {
      setEditing({
        _id: '',
        clinicId: '',
        year,
        month,
        channel,
        category: 'online',
        amount: 0,
        createdAt: '',
        updatedAt: '',
      });
    }
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          광고비를 채널별/월별로 입력하세요. 셀을 클릭하면 수정할 수 있습니다.
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
        >
          <Plus size={16} /> 비용 추가
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400">불러오는 중...</div>
      ) : channels.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 mb-3">아직 등록된 광고비가 없습니다.</p>
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="text-orange-600 hover:underline text-sm"
          >
            첫 광고비 추가하기 →
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 z-10 min-w-[120px]">채널</th>
                {MONTHS.map((m) => (
                  <th key={m} className="px-2 py-2 text-right min-w-[80px]">{m}월</th>
                ))}
                <th className="px-3 py-2 text-right bg-gray-100 min-w-[100px]">합계</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {channels.map((ch, idx) => (
                <tr key={ch} className="hover:bg-gray-50 group">
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10">{ch}</td>
                  {MONTHS.map((m) => {
                    const amount = matrix[ch]?.[m] || 0;
                    return (
                      <td
                        key={m}
                        onClick={() => handleCellClick(ch, m)}
                        className={`px-2 py-2 text-right cursor-pointer hover:bg-orange-50 ${
                          amount === 0 ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        {amount > 0 ? formatKRWShort(amount) : '-'}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-semibold text-gray-900 bg-gray-50">
                    {formatKRWShort(channelTotals[idx])}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleDeleteChannel(ch)}
                      className="p-1 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`'${ch}' 채널 전체 삭제`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-semibold">
                <td className="px-3 py-2 sticky left-0 bg-gray-100 z-10">합계</td>
                {monthlyTotals.map((total, i) => (
                  <td key={i} className="px-2 py-2 text-right text-gray-900">
                    {total > 0 ? formatKRWShort(total) : '-'}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-orange-600">
                  {formatKRWShort(monthlyTotals.reduce((a, b) => a + b, 0))}
                </td>
                <td className="px-2 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <CostFormModal
          initial={editing}
          year={year}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={async () => {
            setModalOpen(false);
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

// ─── 광고비 입력/수정 모달 ───
function CostFormModal({
  initial,
  year,
  onClose,
  onSaved,
}: {
  initial: MarketingCost | null;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?._id;
  const { activeReferralSources, isLoading: catLoading } = useCategories();

  const [form, setForm] = useState({
    year: initial?.year || year,
    month: initial?.month || new Date().getMonth() + 1,
    channel: initial?.channel || '',
    category: initial?.category || 'online' as MarketingCost['category'],
    amount: initial?.amount || 0,
    memo: initial?.memo || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 카테고리에 없는 기존 채널값 (이전에 자유 입력으로 저장된 것)
  const channelLabels = activeReferralSources.map((s) => s.label);
  const isCustomChannel = !!form.channel && !channelLabels.includes(form.channel);

  const handleSubmit = async () => {
    setError(null);
    if (!form.channel.trim()) { setError('채널을 선택하세요.'); return; }
    if (form.amount < 0) { setError('금액은 0 이상이어야 합니다.'); return; }

    setSubmitting(true);
    try {
      const res = isEdit
        ? await authFetch('/api/v2/marketing/costs', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: initial!._id,
              channel: form.channel,
              category: form.category,
              amount: form.amount,
              memo: form.memo,
            }),
          })
        : await authFetch('/api/v2/marketing/costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || '저장 실패');
        return;
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !initial) return;
    if (!confirm('이 광고비 기록을 삭제하시겠습니까?')) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/v2/marketing/costs?id=${initial._id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || '삭제 실패');
        return;
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{isEdit ? '광고비 수정' : '광고비 추가'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">연도</label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || year })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={isEdit}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">월</label>
              <select
                value={form.month}
                onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={isEdit}
              >
                {MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">채널 *</label>
            <select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              disabled={catLoading}
            >
              <option value="">선택하세요</option>
              {channelLabels.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
              {/* 기존 자유 입력 채널 유지 (편집 시) */}
              {isCustomChannel && (
                <option value={form.channel}>{form.channel} (구 입력)</option>
              )}
            </select>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-400">
                환자 등록 시 사용하는 &apos;유입경로&apos; 목록과 동일합니다.
              </p>
              <Link
                href="/v2/settings"
                className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline"
                target="_blank"
              >
                <Settings size={11} /> 유입경로 관리
              </Link>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">카테고리</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as MarketingCost['category'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">금액 (원) *</label>
            <input
              type="number"
              value={form.amount || ''}
              onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })}
              placeholder="예: 800000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="예: 임플란트 키워드 입찰"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t bg-gray-50">
          {isEdit ? (
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="flex items-center gap-1 text-rose-600 hover:text-rose-700 text-sm"
            >
              <Trash2 size={14} /> 삭제
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">취소</button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium disabled:opacity-50"
            >
              {isEdit ? '수정' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
