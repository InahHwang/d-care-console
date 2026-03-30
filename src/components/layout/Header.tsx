//src/components/layout/Header.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppSelector, useAppDispatch } from '@/hooks/reduxHooks'
import { logout } from '@/store/slices/authSlice'
import { logActivity } from '@/utils/activityLogger'
import { Icon } from '../common/Icon';
import { 
  HiOutlineSearch, 
  HiOutlinePlus, 
  HiOutlineCog, 
  HiOutlineQuestionMarkCircle,
  HiOutlineUserAdd,
  HiOutlinePhone,
  HiOutlineMail,
  HiOutlineCalendar,
  HiOutlineDocumentReport,
  HiOutlineUser,
  HiOutlineLogout,
  HiOutlineShieldCheck
} from 'react-icons/hi'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Link from 'next/link'

export default function Header() {
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated } = useAppSelector(state => state.auth)
  
  const today = format(new Date(), "yyyy년 M월 d일 eeee", { locale: ko })

  const handleLogout = async () => {
    try {
      // 로그아웃 활동 로그 기록
      if (user) {
        await logActivity(
          'logout',
          'system', 
          user._id || '',
          user.name || '',
          {
            userName: user.username || '',
            userRole: user.role || 'staff',
            metadata: {
              logoutTime: new Date().toISOString()
            }
          }
        );
      }
    } catch (error) {
      console.error('Failed to log logout activity:', error);
    } finally {
      // 로그아웃 처리
      dispatch(logout())
      localStorage.removeItem('token')
      router.push('/login')
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'master':
        return '마스터 관리자'
      case 'staff':
        return '일반 담당자'
      default:
        return '담당자'
    }
  }

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

        {/* 퀵 액션 */}
        <div className="relative">
          <button 
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="w-9 h-9 flex items-center justify-center bg-primary text-white rounded-full hover:bg-primary-dark transition-colors"
          >
            <Icon 
              icon={HiOutlinePlus} 
              size={20} 
            />
          </button>
          
          {/* 퀵 액션 드롭다운 */}
          {showQuickActions && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-lg border border-border py-2 z-50">
              <Link href="/management?tab=patients&action=add">
                <button 
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                  onClick={() => setShowQuickActions(false)}
                >
                  <Icon icon={HiOutlineUserAdd} size={18} className="text-green-600" />
                  신규 환자 등록
                </button>
              </Link>
              
              <Link href="/management?tab=callbacks&action=add">
                <button 
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                  onClick={() => setShowQuickActions(false)}
                >
                  <Icon icon={HiOutlinePhone} size={18} className="text-orange-600" />
                  콜백 스케줄 등록
                </button>
              </Link>
              
              <Link href="/management?tab=messages&action=send">
                <button 
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                  onClick={() => setShowQuickActions(false)}
                >
                  <Icon icon={HiOutlineMail} size={18} className="text-purple-600" />
                  메시지 전송
                </button>
              </Link>
              
              <hr className="my-2 border-border" />
              
              <Link href="/management?tab=appointments&action=add">
                <button 
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                  onClick={() => setShowQuickActions(false)}
                >
                  <Icon icon={HiOutlineCalendar} size={18} className="text-orange-600" />
                  예약 등록
                </button>
              </Link>
              
              <Link href="/statistics">
                <button 
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                  onClick={() => setShowQuickActions(false)}
                >
                  <Icon icon={HiOutlineDocumentReport} size={18} className="text-indigo-600" />
                  퀵 리포트 생성
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* 설정 */}
        <Link href="/settings">
          <button className="w-9 h-9 flex items-center justify-center bg-light-bg rounded-full hover:bg-gray-200 transition-colors">
            <Icon 
              icon={HiOutlineCog} 
              size={20} 
              className="text-text-secondary hover:text-text-primary" 
            />
          </button>
        </Link>

        {/* 도움말 */}
        <div className="relative hidden md:block">
          <button 
            onClick={() => setShowHelp(!showHelp)}
            className="w-9 h-9 flex items-center justify-center bg-light-bg rounded-full hover:bg-gray-200 transition-colors"
          >
            <Icon 
              icon={HiOutlineQuestionMarkCircle} 
              size={20} 
              className="text-text-secondary hover:text-text-primary" 
            />
          </button>
          
          {/* 도움말 드롭다운 */}
          {showHelp && (
            <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-lg border border-border py-2 z-50">
              <Link href="/guide">
                <button 
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                  onClick={() => setShowHelp(false)}
                >
                  📖 사용 가이드
                </button>
              </Link>
              
              <button 
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                onClick={() => setShowHelp(false)}
              >
                🎥 튜토리얼 동영상
              </button>
              
              <button 
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                onClick={() => setShowHelp(false)}
              >
                💬 문의하기
              </button>
              
              <hr className="my-2 border-border" />
              
              <button 
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                onClick={() => setShowHelp(false)}
              >
                🐛 버그 신고
              </button>
              
              <button 
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                onClick={() => setShowHelp(false)}
              >
                ℹ️ 버전 정보
              </button>
            </div>
          )}
        </div>

        {/* 사용자 메뉴 (새로 추가) */}
        {isAuthenticated && user && (
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-3 pr-4 py-2 bg-light-bg rounded-full hover:bg-gray-200 transition-colors"
            >
              <div className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium text-text-primary">
                  {user.name || 'Unknown User'}
                </div>
                <div className="text-xs text-text-muted">
                  {getRoleDisplayName(user.role || 'staff')}
                </div>
              </div>
            </button>
            
            {/* 사용자 메뉴 드롭다운 */}
            {showUserMenu && (
              <div className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-lg border border-border py-2 z-50">
                {/* 사용자 정보 */}
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-medium">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">
                        {user.name || 'Unknown User'}
                      </div>
                      <div className="text-sm text-text-muted">
                        {user.username || user.email || 'N/A'}
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {user.role === 'master' ? (
                          <Icon icon={HiOutlineShieldCheck} size={12} className="text-red-500" />
                        ) : (
                          <Icon icon={HiOutlineUser} size={12} className="text-orange-500" />
                        )}
                        <span className={user.role === 'master' ? 'text-red-600' : 'text-orange-600'}>
                          {getRoleDisplayName(user.role || 'staff')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 마스터 관리자 전용 메뉴 */}
                {user.role === 'master' && (
                  <>
                    <Link href="/admin">
                      <button 
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Icon icon={HiOutlineShieldCheck} size={18} className="text-red-600" />
                        관리자 페이지
                      </button>
                    </Link>
                    <hr className="my-2 border-border" />
                  </>
                )}

                {/* 내 정보 */}
                <button 
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Icon icon={HiOutlineUser} size={18} className="text-gray-600" />
                  내 정보
                </button>

                <hr className="my-2 border-border" />

                {/* 로그아웃 */}
                <button 
                  onClick={() => {
                    setShowUserMenu(false)
                    handleLogout()
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Icon icon={HiOutlineLogout} size={18} />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 드롭다운 외부 클릭시 닫기 */}
      {(showQuickActions || showHelp || showUserMenu) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowQuickActions(false)
            setShowHelp(false)
            setShowUserMenu(false)
          }}
        />
      )}
    </header>
  )
}