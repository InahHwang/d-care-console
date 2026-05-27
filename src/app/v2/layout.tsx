// src/app/v2/layout.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/v2/layout/Sidebar';
import { CTIPanel } from '@/components/v2/cti';
import AuthGuard from '@/components/auth/AuthGuard';
import AIChatWidget from '@/components/v2/ai-chat/AIChat-Widget';
import { useChannelChat } from '@/hooks/useChannelChat';
import DeskCheckDialog from '@/components/v2/layout/DeskCheckDialog';
import { DeletionApprovalModal } from '@/components/v2/layout/DeletionApprovalModal';
import { DeletionResultModal } from '@/components/v2/layout/DeletionResultModal';
import { useDeletionApprovals } from '@/hooks/useDeletionApprovals';
import { useDeletionResults } from '@/hooks/useDeletionResults';
import { authFetch } from '@/utils/authFetch';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { updateUserInfo } from '@/store/slices/authSlice';

function V2LayoutInner({ children }: { children: React.ReactNode }) {
  // 사이드바 채널상담 뱃지용: 어느 페이지든 새 채팅 들어오면 카운트 갱신
  const { unreadTotal } = useChannelChat();

  // 삭제 승인 대기 (master/admin 전용): 로그인 팝업 + 사이드바 배지
  const { isApprover, requests, pendingCount, loaded, approve, reject } = useDeletionApprovals();
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);

  // 삭제 요청 결과 알림 (요청자/매니저): 로그인 팝업
  const { results: deletionResults, loaded: resultsLoaded, acknowledge: ackDeletionResults } = useDeletionResults();
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const resultDismissedRef = useRef(false);

  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [deskDialogOpen, setDeskDialogOpen] = useState(false);
  const [forceSelect, setForceSelect] = useState(false);
  const [initialDesk, setInitialDesk] = useState<string | undefined>(undefined);

  // 사이드바 환자관리 N 배지용: 오늘 등록된 환자 수
  const [todayNewPatients, setTodayNewPatients] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await authFetch('/api/v2/patients/today-count');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data?.success && typeof data.count === 'number') {
          setTodayNewPatients(data.count);
        }
      } catch {
        // 조용히 무시
      }
    };
    fetchCount();
    const intervalId = setInterval(fetchCount, 60_000); // 1분마다
    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [user]);

  // 삭제 승인 팝업 자동 표시: 새로 들어온(아직 안 본) 요청이 있을 때만.
  // - 로그인/새 요청 → 팝업. 페이지 이동·새로고침으로 이미 본 요청은 다시 안 뜸.
  // - 본 요청 ID를 sessionStorage에 기록(사용자별). 처리/거절로 사라진 ID는 자동 정리됨.
  useEffect(() => {
    if (!isApprover || !loaded) return;
    const seenKey = `deletionApprovalSeen:${user?.id || 'unknown'}`;

    let seen: string[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem(seenKey) || '[]');
    } catch {
      seen = [];
    }

    const currentIds = requests.map((r) => r.id);
    const hasNew = currentIds.some((id) => !seen.includes(id));

    if (hasNew) {
      setApprovalModalOpen(true);
    }
    // 현재 대기 목록을 "본 것"으로 갱신 (사라진 ID는 자연 정리)
    sessionStorage.setItem(seenKey, JSON.stringify(currentIds));
  }, [isApprover, loaded, requests, user]);

  // 삭제 요청 결과 팝업: 미확인 결과(승인/반려)가 있으면 표시. 확인하면 서버 ack로 다시 안 뜸.
  useEffect(() => {
    if (!resultsLoaded || resultDismissedRef.current) return;
    if (deletionResults.length > 0) {
      setResultModalOpen(true);
    }
  }, [resultsLoaded, deletionResults]);

  const handleCloseDeletionResults = () => {
    resultDismissedRef.current = true;
    setResultModalOpen(false);
    ackDeletionResults();
  };

  // 마운트 시 한 번: 본인 자리 정보 조회
  // - currentDeskNumber 있음: 그대로 유지 (재로그인/새로고침 안 깜빡임)
  // - currentDeskNumber 없고 defaultDeskNumber 있음: 자동 복원 (PUT)
  //   (예: 다른 직원이 그 자리 점유해서 본인 currentDeskNumber unset된 상태)
  // - currentDeskNumber 없고 defaultDeskNumber도 없음(필드 부재): 신규 사용자 → 다이얼로그 자동 표시
  // user._id는 login 응답에 없을 수 있음(id만 옴). 둘 다 체크.
  const userId = user?._id || user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/v2/users/me/desk');
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;

        const currentDesk: string | null = data.data.currentDeskNumber;
        const defaultDesk: string | undefined = data.data.defaultDeskNumber;
        const hasDefault: boolean = data.data.hasDefault === true;
        const lastUpdated: string | null = data.data.currentDeskUpdatedAt;

        // Redux user에 반영 (사이드바 표시용)
        dispatch(updateUserInfo({
          currentDeskNumber: currentDesk || undefined,
          currentDeskUpdatedAt: lastUpdated || undefined,
          defaultDeskNumber: defaultDesk,
        }));

        // 자리 이미 있으면 그대로 유지 (재로그인/새로고침 시 깜빡임 방지)
        if (currentDesk) return;

        // 자리 없음 + default 있음 → 자동 복원
        if (hasDefault) {
          const restoreDesk = defaultDesk ?? '';
          // NO_DESK_VALUE('')이면 복원 안 함 (의도적 자리 없음 유지)
          if (restoreDesk === '') return;

          const restoreRes = await authFetch('/api/v2/users/me/desk', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deskNumber: restoreDesk }),
          });
          if (cancelled) return;
          const restoreData = await restoreRes.json();
          if (restoreRes.ok && restoreData.success) {
            dispatch(updateUserInfo({
              currentDeskNumber: restoreData.data.currentDeskNumber || undefined,
              currentDeskUpdatedAt: restoreData.data.currentDeskUpdatedAt,
              defaultDeskNumber: restoreData.data.defaultDeskNumber,
            }));
          }
          return;
        }

        // 자리 없음 + default 없음 → 신규 사용자: 다이얼로그 자동 표시
        setInitialDesk('');
        setForceSelect(true);
        setDeskDialogOpen(true);
      } catch {
        // 조용히 무시 — 자리 정보 조회 실패해도 메인 동작에 영향 없음
      }
    })();
    return () => { cancelled = true; };
    // userId가 바뀔 때만 실행 (로그인/로그아웃 시점)
  }, [userId, dispatch]);

  const handleOpenDeskDialog = () => {
    setInitialDesk(user?.currentDeskNumber ?? '');
    setForceSelect(false); // 사용자가 직접 연 경우는 닫기 가능
    setDeskDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        unreadChatCount={unreadTotal}
        newPatientsCount={todayNewPatients}
        deletionPendingCount={pendingCount}
        onOpenDeletionApproval={() => setApprovalModalOpen(true)}
        onOpenDeskDialog={handleOpenDeskDialog}
      />
      <main className="flex-1 overflow-auto">{children}</main>
      <CTIPanel />
      <AIChatWidget />
      {isApprover && (
        <DeletionApprovalModal
          open={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          requests={requests}
          onApprove={approve}
          onReject={reject}
        />
      )}
      <DeletionResultModal
        open={resultModalOpen}
        onClose={handleCloseDeletionResults}
        results={deletionResults}
      />
      <DeskCheckDialog
        open={deskDialogOpen}
        onClose={() => setDeskDialogOpen(false)}
        initialDeskNumber={initialDesk}
        forceSelect={forceSelect}
      />
    </div>
  );
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 모바일 보고서 페이지는 사이드바/CTI 없이 표시
  const isMobilePage = pathname?.includes('/reports/mobile');

  // 모바일 페이지: 외부 공유 링크이므로 인증 없이 접근 가능
  if (isMobilePage) {
    return <>{children}</>;
  }

  // 일반 V2 페이지: 전체 레이아웃 + 인증
  return (
    <AuthGuard>
      <V2LayoutInner>{children}</V2LayoutInner>
    </AuthGuard>
  );
}
