// src/hooks/useDeletionResults.ts
// 요청자(매니저) 결과 알림 훅 — 내가 올린 삭제 요청의 승인/반려 결과를 가져온다.
// staff는 요청 권한이 없어 결과도 없으므로 조회하지 않는다.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/utils/authFetch';
import { useAppSelector } from '@/hooks/reduxHooks';

export interface DeletionResultItem {
  id: string;
  type: 'patient' | 'journey';
  patientName: string;
  journeyLabel?: string;
  status: 'approved' | 'rejected';
  reason: string;
  rejectReason?: string;
  reviewedByName?: string;
  reviewedAt?: string;
}

export function useDeletionResults() {
  const { user } = useAppSelector((s) => s.auth);
  // 요청을 올릴 수 있는 사람만 결과가 생긴다 (staff 제외)
  const canHaveResults = !!user && user.role !== 'staff';

  const [results, setResults] = useState<DeletionResultItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    if (!canHaveResults) return;
    try {
      const res = await authFetch('/api/v2/deletion-requests?mine=resolved');
      if (!res.ok) {
        setResults([]);
        return;
      }
      const json = await res.json();
      setResults(json?.success ? json.data.requests || [] : []);
    } catch {
      setResults([]);
    } finally {
      setLoaded(true);
    }
  }, [canHaveResults]);

  useEffect(() => {
    if (!canHaveResults) return;
    refetch();
    const id = setInterval(refetch, 60000);
    return () => clearInterval(id);
  }, [canHaveResults, refetch]);

  // 결과 확인 처리 (서버에 영구 기록 → 다시 안 뜸)
  const acknowledge = useCallback(async () => {
    try {
      await authFetch('/api/v2/deletion-requests/ack', { method: 'POST' });
    } catch {
      // 실패해도 화면에선 닫음
    }
    setResults([]);
  }, []);

  return { results, loaded, acknowledge };
}
