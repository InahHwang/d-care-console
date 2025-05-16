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
  HiOutlineCog 
} from 'react-icons/hi'
import { Icon } from '../common/Icon'

const SidebarItem = ({ 
  icon, 
  text, 
  isActive, 
  href 
}: { 
  icon: IconType
  text: string
  isActive: boolean
  href: string
}) => {
  return (
    <Link href={href} className={`sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}>
      <div className={`w-6 h-6 flex items-center justify-center ${isActive ? 'text-primary' : 'text-text-muted'}`}>
        <Icon icon={icon} size={20} />
      </div>
      <span>{text}</span>
      {isActive && <div className="w-1 h-5 bg-primary absolute left-0 rounded-r-full"></div>}
    </Link>
  )
}

export default function Sidebar() {
  const dispatch = useDispatch()
  const { currentMenuItem } = useSelector((state: RootState) => state.ui)
  const pathname = usePathname()

  // 페이지 경로에 따라 메뉴 아이템 활성화
  const getIsActive = (menuItem: string) => {
    return currentMenuItem === menuItem
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
          isActive={getIsActive('대시보드')} 
          href="/"
        />
        <SidebarItem 
          icon={HiOutlinePhone} 
          text="상담 관리" 
          isActive={getIsActive('상담 관리')} 
          href="/management"
        />
        <SidebarItem 
          icon={HiOutlineChartBar} 
          text="통계 분석" 
          isActive={getIsActive('통계 분석')} 
          href="/statistics"
        />
        <SidebarItem 
          icon={HiOutlineCog} 
          text="설정" 
          isActive={getIsActive('설정')} 
          href="/settings"
        />
      </nav>

      {/* 사용자 정보 */}
      <div className="px-3 mb-6">
        <div className="bg-sidebar-active p-3 rounded-lg flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-white">
            <span>홍</span>
          </div>
          <div className="ml-3 overflow-hidden">
            <div className="text-sm font-medium text-white truncate">홍길동</div>
            <div className="text-xs text-text-muted truncate">상담 실장</div>
          </div>
        </div>
      </div>
    </aside>
  )
}