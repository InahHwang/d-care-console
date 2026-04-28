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

  // 마운트 시 한 번: 본인 자리 정보 조회 → 오늘 변경 안 했으면 자동 표시
  useEffect(() => {
    if (!user?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/v2/users/me/desk');
        const data = await res.json();
        if (!res.ok || !data.success || cancelled) return;

        const currentDesk: string | null = data.data.currentDeskNumber;
        const lastUpdated: string | null = data.data.currentDeskUpdatedAt;

        // Redux user에도 반영 (사이드바 표시용)
        dispatch(updateUserInfo({
          currentDeskNumber: currentDesk || undefined,
          currentDeskUpdatedAt: lastUpdated || undefined,
        }));

        // 오늘 한 번도 확인/변경 안 했으면 다이얼로그 자동 표시
        const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const lastDateKst = lastUpdated
          ? new Date(new Date(lastUpdated).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : null;

        if (lastDateKst !== todayKst) {
          setInitialDesk(currentDesk ?? '');
          setForceSelect(true); // 자동 표시 시 X 버튼 비활성 (반드시 선택)
          setDeskDialogOpen(true);
        }
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
