//src/components/layout/AppLayout.tsx

'use client'

import { ReactNode, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store'
import { setCurrentMenuItem } from '@/store/slices/uiSlice'
import { fetchPatients } from '@/store/slices/patientsSlice'
import Sidebar from './Sidebar'
import Header from './Header'
import InboundWidget from '../widget/InboundWidget'
import AuthGuard from '../auth/AuthGuard' // 🔥 AuthGuard 추가

interface AppLayoutProps {
  children: ReactNode
  currentPage?: 'dashboard' | 'management' | 'statistics' | 'settings'
}

const getMenuItemFromPage = (page?: string) => {
  switch (page) {
    case 'dashboard':
      return '대시보드'
    case 'management':
      return '상담 관리'
    case 'statistics':
      return '통계 분석'
    case 'settings':
      return '설정'
    default:
      return '대시보드'
  }
}

export default function AppLayout({ children, currentPage = 'dashboard' }: AppLayoutProps) {
  const dispatch = useDispatch<AppDispatch>()
  
  // 🔥 인증 상태 확인
  const { isAuthenticated, isInitialized, user } = useSelector((state: RootState) => state.auth)
  const { widget } = useSelector((state: RootState) => state.ui)

  // 현재 페이지에 따라 사이드바 메뉴 아이템 설정
  useEffect(() => {
    // 🔥 인증이 완료된 후에만 실행
    if (isAuthenticated && isInitialized && user) {
      console.log('🔥 AppLayout: 인증된 사용자로 페이지 초기화', {
        currentPage,
        userId: user._id,
        userName: user.name
      });

      // 메뉴 아이템 설정
      const menuItem = getMenuItemFromPage(currentPage)
      dispatch(setCurrentMenuItem(menuItem))
      
      // 대시보드나 환자 관리 페이지로 이동할 때 환자 데이터 다시 불러오기
      if (currentPage === 'dashboard' || currentPage === 'management') {
        dispatch(fetchPatients());
      }
    }
  }, [currentPage, dispatch, isAuthenticated, isInitialized, user]);

  // 🔥 AuthGuard로 전체 레이아웃을 감싸서 인증 보호
  return (
    <AuthGuard>
      <div className="min-h-screen flex bg-light-bg w-full relative">
        {/* 사이드바 */}
        <div className="w-56 flex-shrink-0">
          <Sidebar />
        </div>
        
        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 min-h-screen w-0 overflow-hidden">
          {/* 헤더 */}
          <Header />
          
          {/* 메인 콘텐츠 */}
          <main className="p-6 overflow-x-auto">
            {children}
          </main>
        </div>
        
        {/* 인바운드 위젯 - 모든 페이지에서 표시 */}
        <InboundWidget isVisible={widget.isVisible} />
      </div>
    </AuthGuard>
  )
}