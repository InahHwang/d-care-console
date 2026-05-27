// src/hooks/useDeletionApprovals.ts
// 삭제 승인 대기 요청 데이터 훅 (master/admin 전용)
// 레이아웃에서 사이드바 배지 + 로그인 팝업을 함께 구동한다.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/utils/authFetch';
import { useAppSelector } from '@/hooks/reduxHooks';

export interface DeletionRequestItem {
  id: string;
  type: 'patient' | 'journey';
  patientId: string;
  patientName: string;
  journeyLabel?: string;
  reason: string;
  requestedByName: string;
  requestedAt: string;
}

interface ActionResult {
  ok: boolean;
  error?: string;
}

export function useDeletionApprovals() {
  const { user } = useAppSelector((s) => s.auth);
  const isApprover = user?.role === 'master' || user?.role === 'admin';

  const [requests, setRequests] = useState<DeletionRequestItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
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
    } finally {
      setLoaded(true);
    }
  }, [isApprover]);

  useEffect(() => {
    if (!isApprover) return;
    refetch();
    const id = setInterval(refetch, 30000);
    return () => clearInterval(id);
  }, [isApprover, refetch]);

  const approve = useCallback(async (id: string): Promise<ActionResult> => {
    try {
      const res = await authFetch(`/api/v2/deletion-requests/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        return { ok: true };
      }
      const data = await res.json().catch(() => null);
      await refetch();
      return { ok: false, error: data?.error };
    } catch {
      return { ok: false, error: '승인 처리 중 오류가 발생했습니다.' };
    }
  }, [refetch]);

  const reject = useCallback(async (id: string, rejectReason: string): Promise<ActionResult> => {
    try {
      const res = await authFetch(`/api/v2/deletion-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectReason }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        return { ok: true };
      }
      const data = await res.json().catch(() => null);
      await refetch();
      return { ok: false, error: data?.error };
    } catch {
      return { ok: false, error: '거절 처리 중 오류가 발생했습니다.' };
    }
  }, [refetch]);

  return {
    isApprover,
    requests,
    pendingCount: requests.length,
    loaded,
    refetch,
    approve,
    reject,
  };
}
