//src/app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/store/Providers';
import FloatingCTIPanel from '@/components/management/FloatingCTIPanel'
import PatientFormModal from '@/components/management/PatientFormModal'

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'D-Care Console - 치과 상담 관리 시스템',
  description: '치과 상담실장 아웃바운드 콜 상담 일지 기록 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Providers>
          {children}
          {/* ★ 항상 마운트: 모든 페이지에서 CTI 패널 활성 (Providers 안에 위치해야 Redux 사용 가능) */}
          <FloatingCTIPanel />
          {/* ★ 항상 마운트: 모든 페이지에서 환자 등록 모달 사용 가능 */}
          <PatientFormModal />
        </Providers>
      </body>
    </html>
  );
}