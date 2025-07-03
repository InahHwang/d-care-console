// src/app/admin/page.tsx

'use client';

import { useState } from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import AdminLayout from '@/components/admin/AdminLayout';
import UserManagement from '@/components/admin/UserManagement';
import ActivityLogs from '@/components/admin/ActivityLogs';
import AdminDashboard from '@/components/admin/AdminDashboard';
import DailyTasksManagement from '@/components/admin/DailyTasksManagement'; 

import { 
  HiOutlineUsers, 
  HiOutlineClipboardList, 
  HiOutlineChartBar,
  HiOutlineShieldCheck,
  HiOutlineClipboardCheck
} from 'react-icons/hi';

type AdminTab = 'dashboard' | 'users' | 'logs' | 'daily-tasks' | 'settings';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  const tabs = [
    {
      id: 'dashboard' as AdminTab,
      name: '대시보드',
      icon: HiOutlineChartBar,
      description: '시스템 개요 및 통계'
    },
    {
      id: 'users' as AdminTab,
      name: '사용자 관리',
      icon: HiOutlineUsers,
      description: '담당자 계정 관리'
    },
    {
      id: 'daily-tasks' as AdminTab,  // 🔥 새로 추가
      name: '오늘 처리된 업무',
      icon: HiOutlineClipboardCheck, // 이 아이콘 import 추가 필요
      description: '매니저들이 오늘 처리한 업무 현황'
    },
    {
      id: 'logs' as AdminTab,
      name: '활동 로그',
      icon: HiOutlineClipboardList,
      description: '전체 시스템 활동 이력'
    },
    {
      id: 'settings' as AdminTab,
      name: '시스템 설정',
      icon: HiOutlineShieldCheck,
      description: '시스템 환경 설정'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'daily-tasks':
        return <DailyTasksManagement />;
      case 'dashboard':
        return <AdminDashboard />;
      case 'users':
        return <UserManagement />;
      case 'logs':
        return <ActivityLogs />;
      case 'settings':
        return (
          <div className="bg-white rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">시스템 설정</h2>
            <p className="text-gray-600">시스템 설정 기능은 준비 중입니다.</p>
          </div>
        );
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <AuthGuard requiredRole="master">
      <AdminLayout>
        <div className="space-y-6">
          {/* 페이지 헤더 */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <HiOutlineShieldCheck className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">마스터 관리자</h1>
                <p className="text-gray-600">시스템 전체를 관리하고 모니터링합니다.</p>
              </div>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="관리자 메뉴">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-red-500 text-red-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <IconComponent 
                        className={`mr-2 w-5 h-5 ${
                          activeTab === tab.id ? 'text-red-500' : 'text-gray-400 group-hover:text-gray-500'
                        }`} 
                      />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* 탭 설명 */}
            <div className="px-6 py-3 bg-gray-50">
              <p className="text-sm text-gray-600">
                {tabs.find(tab => tab.id === activeTab)?.description}
              </p>
            </div>
          </div>

          {/* 탭 컨텐츠 */}
          <div className="min-h-[600px]">
            {renderTabContent()}
          </div>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}