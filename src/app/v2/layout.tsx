// src/app/v2/layout.tsx
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/v2/layout/Sidebar';
import { CTIPanel } from '@/components/v2/cti';
import AuthGuard from '@/components/auth/AuthGuard';

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
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
        <CTIPanel />
      </div>
    </AuthGuard>
  );
}
