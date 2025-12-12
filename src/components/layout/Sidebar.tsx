// src/components/layout/Sidebar.tsx

'use client'

import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store'
import { setCurrentMenuItem } from '@/store/slices/uiSlice'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconType } from 'react-icons'
import {
  HiOutlineViewGrid,
  HiOutlinePhone,
  HiOutlineChartBar,
  HiOutlineCog,
  HiOutlineDocumentReport,
  HiOutlineClipboardCheck, // 🔥 내원 관리 아이콘 추가
  HiOutlineLightBulb, // 🔥 스마트 보고서 아이콘 추가
  HiOutlineVolumeUp, // 🆕 이벤트타겟관리 아이콘 추가
  HiOutlinePhoneIncoming, // 🆕 통화기록 아이콘 추가
  HiOutlineHeart // 🆕 사후관리 아이콘 추가
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { useMemo } from 'react'

const SidebarItem = ({ 
  icon, 
  text, 
  isActive, 
  href,
  badge,
  aiLabel // 🔥 AI 라벨 추가
}: { 
  icon: IconType
  text: string
  isActive: boolean
  href: string
  badge?: number
  aiLabel?: boolean // 🔥 AI 라벨 표시 여부
}) => {
  return (
    <Link href={href} className={`sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}>
      <div className={`w-6 h-6 flex items-center justify-center ${isActive ? 'text-primary' : 'text-text-muted'}`}>
        <Icon icon={icon} size={20} />
      </div>
      <div className="flex-1 flex flex-col">
        <span>{text}</span>
        {/* 🔥 AI 라벨 표시 */}
        {aiLabel && (
          <span className="text-xs text-purple-400 font-medium">AI 분석</span>
        )}
      </div>
      {/* 🔥 배지 표시 */}
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {/* 🔥 AI 배지 표시 */}
      {aiLabel && (
        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-full">
          AI
        </span>
      )}
      {/* 🔥 새 기능 표시점 */}
      {aiLabel && (
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      )}
      {isActive && <div className="w-1 h-5 bg-primary absolute left-0 rounded-r-full"></div>}
    </Link>
  )
}

export default function Sidebar() {
  const dispatch = useDispatch()
  const { currentMenuItem } = useSelector((state: RootState) => state.ui)
  const pathname = usePathname()

  // 🔥 내원 관리 관련 통계 계산
  const { patients } = useSelector((state: RootState) => state.patients)
  
  const visitManagementBadge = useMemo(() => {
    if (!patients || patients.length === 0) return 0;
    
    // 내원확정되고 추가 콜백이 필요한 환자 수
    return patients.filter(patient => 
      patient.visitConfirmed === true && 
      (patient.postVisitStatus === '재콜백필요')
    ).length;
  }, [patients]);

  // 🔥 수정된 활성화 판단 로직 - pathname 우선, Redux 상태는 보조
  const getIsActive = (href: string, menuItem: string) => {
    // 🔥 루트 경로는 정확히 일치할 때만 활성화
    if (href === '/') {
      return pathname === '/';
    }
    
    // 🔥 다른 경로들은 정확히 일치할 때만 활성화
    if (pathname === href) {
      return true;
    }
    
    // 2순위: Redux 상태 기반 판단 (SPA 네비게이션 대응)
    return currentMenuItem === menuItem;
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-56 bg-sidebar text-white z-10 flex flex-col flex-shrink-0">
      {/* 로고 영역 */}
      <div className="h-16 flex items-center px-6 bg-dark-bg">
        <div className="text-xl font-bold text-primary">D•Care</div>
        <div className="text-xs text-text-muted ml-2">Console</div>
      </div>

      {/* 메뉴 아이템 */}
      <nav className="flex flex-col gap-1 p-3 mt-4 flex-1 overflow-y-auto">
        <SidebarItem 
          icon={HiOutlineViewGrid} 
          text="대시보드" 
          isActive={getIsActive('/', '대시보드')} 
          href="/"
        />
        <SidebarItem 
          icon={HiOutlinePhone} 
          text="상담 관리" 
          isActive={getIsActive('/management', '상담 관리')} 
          href="/management"
        />
        {/* 🔥 내원 관리 메뉴 - 수정된 활성화 로직 적용 */}
        <SidebarItem
          icon={HiOutlineClipboardCheck}
          text="내원 관리"
          isActive={getIsActive('/visit-management', '내원 관리')}
          href="/visit-management"
          badge={visitManagementBadge}
        />
        {/* 🆕 사후관리 메뉴 - 내원관리 바로 밑 */}
        <SidebarItem
          icon={HiOutlineHeart}
          text="사후관리"
          isActive={getIsActive('/follow-up', '사후관리')}
          href="/follow-up"
        />
        {/* 🆕 이벤트타겟관리 메뉴 추가 */}
        <SidebarItem
          icon={HiOutlineVolumeUp}
          text="이벤트 타겟 관리"
          isActive={getIsActive('/event-target-management', '이벤트타겟관리')}
          href="/event-target-management"
        />

       {/* 임시 비활성화
       <SidebarItem
          icon={HiOutlineChartBar}
          text="통계 분석"
          isActive={getIsActive('/statistics', '통계 분석')}
          href="/statistics"
        />
        */}
        <SidebarItem
          icon={HiOutlineDocumentReport}
          text="보고서"
          isActive={getIsActive('/reports', '보고서')}
          href="/reports"
        />
        {/* 🆕 통화기록 메뉴 추가 */}
        <SidebarItem
          icon={HiOutlinePhoneIncoming}
          text="통화기록"
          isActive={getIsActive('/call-logs', '통화기록')}
          href="/call-logs"
        />
        {/* 임시 비활성화
        <SidebarItem 
          icon={HiOutlineLightBulb} 
          text="스마트 보고서" 
          isActive={getIsActive('/smart-reports', '스마트 보고서')} 
          href="/smart-reports"
          aiLabel={true}
        />
        */}
        
        <SidebarItem 
          icon={HiOutlineCog} 
          text="설정" 
          isActive={getIsActive('/settings', '설정')} 
          href="/settings"
        />
      </nav>
    </aside>
  )
}