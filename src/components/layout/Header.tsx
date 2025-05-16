'use client'

import { useSelector } from 'react-redux'
import { Icon } from '../common/Icon';
import { RootState } from '@/store'
import { HiOutlineSearch, HiOutlineBell, HiOutlineCog, HiOutlineQuestionMarkCircle } from 'react-icons/hi'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function Header() {
  const { notificationCount } = useSelector((state: RootState) => state.ui)
  const today = format(new Date(), "yyyy년 M월 d일 eeee", { locale: ko })

  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 md:px-6 shadow-sm">
      {/* 검색창 */}
      <div className="relative hidden md:block">
        <input
          type="text"
          placeholder="환자, 콜, 예약 검색..."
          className="pl-10 pr-4 py-2 w-60 lg:w-80 bg-light-bg rounded-full text-sm focus:outline-none"
        />
        <Icon 
          icon={HiOutlineSearch} 
          size={18} 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" 
        />
      </div>

      {/* 현재 날짜 - 모바일에서는 숨김 */}
      <div className="text-sm text-text-secondary hidden sm:block">
        오늘: {today}
      </div>

      {/* 우측 아이콘들 */}
      <div className="flex items-center gap-2 md:gap-4 ml-auto md:ml-0">
        {/* 모바일용 검색 아이콘 */}
        <button className="w-9 h-9 flex items-center justify-center bg-light-bg rounded-full md:hidden">
          <Icon 
            icon={HiOutlineSearch} 
            size={20} 
            className="text-text-secondary" 
          />
        </button>

        {/* 알림 */}
        <div className="relative">
          <button className="w-9 h-9 flex items-center justify-center bg-light-bg rounded-full">
            <Icon 
              icon={HiOutlineBell} 
              size={20} 
              className="text-text-secondary" 
            />
          </button>
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-error text-white text-xs rounded-full">
              {notificationCount}
            </span>
          )}
        </div>

        {/* 설정 */}
        <button className="w-9 h-9 flex items-center justify-center bg-light-bg rounded-full">
          <Icon 
            icon={HiOutlineCog} 
            size={20} 
            className="text-text-secondary" 
          />
        </button>

        {/* 도움말 - 모바일에서는 숨김 */}
        <button className="w-9 h-9 hidden md:flex items-center justify-center bg-light-bg rounded-full">
          <Icon 
            icon={HiOutlineQuestionMarkCircle} 
            size={20} 
            className="text-text-secondary" 
          />
        </button>
      </div>
    </header>
  )
}