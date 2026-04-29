// src/app/v2/layout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/v2/layout/Sidebar';
import { CTIPanel } from '@/components/v2/cti';
import AuthGuard from '@/components/auth/AuthGuard';
import AIChatWidget from '@/components/v2/ai-chat/AIChat-Widget';
import { useChannelChat } from '@/hooks/useChannelChat';
import DeskCheckDialog from '@/components/v2/layout/DeskCheckDialog';
import { authFetch } from '@/utils/authFetch';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { updateUserInfo } from '@/store/slices/authSlice';

function V2LayoutInner({ children }: { children: React.ReactNode }) {
  // 사이드바 채널상담 뱃지용: 어느 페이지든 새 채팅 들어오면 카운트 갱신
  const { unreadTotal } = useChannelChat();

  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [deskDialogOpen, setDeskDialogOpen] = useState(false);
  const [forceSelect, setForceSelect] = useState(false);
  const [initialDesk, setInitialDesk] = useState<string | undefined>(undefined);

  // 마운트 시 한 번: 본인 자리 정보 조회
  // - currentDeskNumber 있음: 그대로 유지 (재로그인/새로고침 안 깜빡임)
  // - currentDeskNumber 없고 defaultDeskNumber 있음: 자동 복원 (PUT)
  //   (예: 다른 직원이 그 자리 점유해서 본인 currentDeskNumber unset된 상태)
  // - currentDeskNumber 없고 defaultDeskNumber도 없음(필드 부재): 신규 사용자 → 다이얼로그 자동 표시
  useEffect(() => {
    if (!user?._id) return;
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
    // user._id가 바뀔 때만 실행 (로그인/로그아웃 시점)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const handleOpenDeskDialog = () => {
    setInitialDesk(user?.currentDeskNumber ?? '');
    setForceSelect(false); // 사용자가 직접 연 경우는 닫기 가능
    setDeskDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar unreadChatCount={unreadTotal} onOpenDeskDialog={handleOpenDeskDialog} />
      <main className="flex-1 overflow-auto">{children}</main>
      <CTIPanel />
      <AIChatWidget />
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
