// src/components/v2/layout/Sidebar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/hooks/reduxHooks';
import {
  Home,
  Phone,
  Users,
  Bell,
  Gift,
  BarChart3,
  Settings,
  User,
  Sparkles,
  MessageCircle,
  LogOut,
  ExternalLink,
  BookOpen,
  Target,
} from 'lucide-react';
import { ROLE_CONFIG } from '@/types/invitation';
import type { UserRole } from '@/types/invitation';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  adminOnly?: boolean;  // 관리자 전용 메뉴
  managerOnly?: boolean;  // 매니저 이상 접근 가능 메뉴
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: '대시보드', href: '/v2/dashboard', icon: <Home size={20} /> },
  { id: 'call-logs', label: '통화 기록', href: '/v2/call-logs', icon: <Phone size={20} /> },
  { id: 'patients', label: '환자 관리', href: '/v2/patients', icon: <Users size={20} /> },
  { id: 'schedules', label: '일정 관리', href: '/v2/schedules', icon: <Bell size={20} /> },
  { id: 'channel-chat', label: '채널 상담', href: '/v2/channel-chat', icon: <MessageCircle size={20} /> },
  { id: 'referrals', label: '소개 관리', href: '/v2/referrals', icon: <Gift size={20} /> },
  { id: 'marketing-targets', label: '이벤트 타겟', href: '/v2/marketing-targets', icon: <Target size={20} /> },
  { id: 'reports', label: '리포트', href: '/v2/reports', icon: <BarChart3 size={20} /> },
  { id: 'settings', label: '설정', href: '/v2/settings', icon: <Settings size={20} />, managerOnly: true },
];

interface SidebarProps {
  analysisPending?: number;
  callbackCount?: number;
  unreadChatCount?: number;
}

export function Sidebar({ analysisPending = 0, callbackCount = 0, unreadChatCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  // 관리자 권한 체크 (admin 또는 레거시 master)
  const isAdmin = user?.role === 'admin' || user?.role === 'master';
  // 매니저 이상 권한 체크
  const isManagerOrAbove = isAdmin || user?.role === 'manager';

  // 역할 표시 (master는 admin으로 표시)
  const getRoleDisplay = (role: string) => {
    const normalizedRole = role === 'master' ? 'admin' : role;
    const config = ROLE_CONFIG[normalizedRole as UserRole] || ROLE_CONFIG.staff;
    return config.label;
  };

  const isActive = (href: string) => {
    if (href === '/v2/dashboard') {
      return pathname === '/v2/dashboard' || pathname === '/v2';
    }
    // 설정 메뉴: /v2/settings로 시작하는 모든 경로
    if (href === '/v2/settings') {
      return pathname.startsWith('/v2/settings');
    }
    return pathname.startsWith(href);
  };

  const getBadge = (id: string) => {
    if (id === 'call-logs' && analysisPending > 0) return analysisPending;
    if (id === 'schedules' && callbackCount > 0) return callbackCount;
    if (id === 'channel-chat' && unreadChatCount > 0) return unreadChatCount;
    return undefined;
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // 권한별 메뉴 필터링
  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.managerOnly && !isManagerOrAbove) return false;
    return true;
  });

  return (
    <div className="w-64 bg-white border-r flex flex-col h-screen sticky top-0">
      {/* 로고 */}
      <div className="p-5 border-b">
        <Link href="/v2/dashboard" className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-blue-600">D-care</h1>
          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">v2</span>
        </Link>
        <p className="text-xs text-gray-400 mt-1">치과 상담 관리</p>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-1">
          {filteredNavItems.map((item) => {
            const active = isActive(item.href);
            const badge = getBadge(item.id);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {badge && badge > 0 && (
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                    item.id === 'call-logs'
                      ? 'bg-purple-500 text-white'
                      : item.id === 'channel-chat'
                      ? 'bg-green-500 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* AI 상태 표시 */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl text-emerald-600 text-sm">
          <Sparkles size={16} />
          <span>AI 분석 활성화</span>
        </div>
      </div>

      {/* 사용자 가이드 링크 */}
      <div className="px-3 pb-1">
        <a
          href="/guide/v2-user-guide.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl text-sm transition-colors"
        >
          <BookOpen size={14} />
          <span>사용자 가이드</span>
          <ExternalLink size={12} className="ml-auto opacity-50" />
        </a>
      </div>

      {/* V1 레거시 링크 */}
      <div className="px-3 pb-1">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl text-sm transition-colors"
        >
          <ExternalLink size={14} />
          <span>V1 버전 보기</span>
        </Link>
      </div>

      {/* 사용자 정보 */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={18} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {user?.name || '사용자'}
            </div>
            <div className="text-xs text-gray-400">
              {user?.role ? getRoleDisplay(user.role) : '로딩 중...'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="로그아웃"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
