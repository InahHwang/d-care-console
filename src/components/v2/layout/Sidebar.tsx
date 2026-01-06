// src/components/v2/layout/Sidebar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: '대시보드', href: '/v2/dashboard', icon: <Home size={20} /> },
  { id: 'call-logs', label: '통화 기록', href: '/v2/call-logs', icon: <Phone size={20} /> },
  { id: 'patients', label: '환자 관리', href: '/v2/patients', icon: <Users size={20} /> },
  { id: 'schedules', label: '일정 관리', href: '/v2/schedules', icon: <Bell size={20} /> },
  { id: 'referrals', label: '소개 관리', href: '/v2/referrals', icon: <Gift size={20} /> },
  { id: 'reports', label: '리포트', href: '/v2/reports', icon: <BarChart3 size={20} /> },
  { id: 'settings', label: '설정', href: '/v2/settings', icon: <Settings size={20} /> },
];

interface SidebarProps {
  analysisPending?: number;
  callbackCount?: number;
}

export function Sidebar({ analysisPending = 0, callbackCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/v2/dashboard') {
      return pathname === '/v2/dashboard' || pathname === '/v2';
    }
    return pathname.startsWith(href);
  };

  const getBadge = (id: string) => {
    if (id === 'call-logs' && analysisPending > 0) return analysisPending;
    if (id === 'schedules' && callbackCount > 0) return callbackCount;
    return undefined;
  };

  return (
    <div className="w-64 bg-white border-r flex flex-col h-screen sticky top-0">
      {/* 로고 */}
      <div className="p-5 border-b">
        <Link href="/v2/dashboard" className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-blue-600">CatchAll</h1>
          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">v2</span>
        </Link>
        <p className="text-xs text-gray-400 mt-1">치과 상담 관리</p>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => {
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

      {/* 사용자 정보 */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
            <User size={18} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">김상담</div>
            <div className="text-xs text-gray-400">상담사</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
