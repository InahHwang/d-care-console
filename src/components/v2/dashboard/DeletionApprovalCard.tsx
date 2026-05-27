// src/components/v2/dashboard/DeletionApprovalCard.tsx
// 삭제 승인 카드 — 매니저의 환자/여정 삭제 요청을 master/admin이 승인/거절.
// 대기 요청이 있을 때만 대시보드에 표시된다. (master/admin 전용)

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Check, X, Clock } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';
import { useAppSelector } from '@/hooks/reduxHooks';

interface DeletionRequestItem {
  id: string;
  type: 'patient' | 'journey';
  patientId: string;
  patientName: string;
  journeyLabel?: string;
  reason: string;
  requestedByName: string;
  requestedAt: string;
}

function formatRelativeDate(iso: string): string {
  const created = new Date(iso);
  const diffMin = Math.floor((Date.now() - created.getTime()) / (60 * 1000));
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${created.getMonth() + 1}/${created.getDate()}`;
}

export function DeletionApprovalCard() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const isApprover = user?.role === 'master' || user?.role === 'admin';

  const [requests, setRequests] = useState<DeletionRequestItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!isApprover) return;
    try {
      const res = await authFetch('/api/v2/deletion-requests?status=pending');
      if (!res.ok) {
        setRequests([]);
        return;
      }
      const json = await res.json();
      setRequests(json?.success ? json.data.requests || [] : []);
    } catch {
      setRequests([]);
    }
  }, [isApprover]);

  useEffect(() => {
    if (!isApprover) return;
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRequests, isApprover]);

  const handleApprove = async (req: DeletionRequestItem) => {
    const label =
      req.type === 'journey'
        ? `${req.patientName} 님의 '${req.journeyLabel || '여정'}' 여정`
        : `${req.patientName} 님`;
    if (!window.confirm(`${label}을(를) 삭제합니다. 복원할 수 없습니다. 승인하시겠습니까?`)) return;

    setBusyId(req.id);
    try {
      const res = await authFetch(`/api/v2/deletion-requests/${req.id}/approve`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== req.id));
      } else {
        alert(data?.error || '승인에 실패했습니다.');
        await fetchRequests();
      }
    } catch {
      alert('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: DeletionRequestItem) => {
    const rejectReason = window.prompt('거절 사유를 입력해주세요. (선택)', '');
    // 취소 버튼 → null이면 중단
    if (rejectReason === null) return;

    setBusyId(req.id);
    try {
      const res = await authFetch(`/api/v2/deletion-requests/${req.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectReason }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== req.id));
      } else {
        alert(data?.error || '거절에 실패했습니다.');
        await fetchRequests();
      }
    } catch {
      alert('거절 처리 중 오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  // 승인 권한 없거나 대기 요청 없으면 카드 숨김
  if (!isApprover || requests.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-red-100">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-100">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">삭제 승인 대기</h3>
          <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
            {requests.length}
          </span>
        </div>
        <span className="text-xs text-gray-500">관리자 승인 필요</span>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {requests.map((req) => (
          <div
            key={req.id}
            className="p-3 rounded-xl border border-gray-100 bg-gray-50"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 text-sm">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      req.type === 'journey'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {req.type === 'journey' ? '여정' : '환자'}
                  </span>
                  <button
                    onClick={() => router.push(`/v2/patients/${req.patientId}`)}
                    className="font-bold text-gray-900 hover:underline truncate"
                  >
                    {req.patientName}
                  </button>
                  {req.type === 'journey' && req.journeyLabel && (
                    <span className="text-xs text-gray-500 truncate">· {req.journeyLabel}</span>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Clock size={11} />
                    {formatRelativeDate(req.requestedAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">{req.reason}</p>
                <p className="mt-1 text-xs text-gray-400">요청: {req.requestedByName}</p>
              </div>
            </div>

            {/* 승인/거절 버튼 */}
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={() => handleApprove(req)}
                disabled={busyId === req.id}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Check size={15} />
                승인 (삭제)
              </button>
              <button
                onClick={() => handleReject(req)}
                disabled={busyId === req.id}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <X size={15} />
                거절
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeletionApprovalCard;
