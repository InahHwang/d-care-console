// layout.tsx - 서버 컴포넌트
import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'D-Care Console | 치과 상담 관리 시스템',
  description: '치과 상담실장을 위한 아웃바운드 콜 상담 관리 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}