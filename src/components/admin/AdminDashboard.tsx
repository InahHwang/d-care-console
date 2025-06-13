// src/components/admin/AdminDashboard.tsx (개선된 버전)

'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/reduxHooks';
import { 
  HiOutlineUsers, 
  HiOutlineClipboardList, 
  HiOutlineUserGroup,
  HiOutlinePhone,
  HiOutlineChartBar,
  HiOutlineClock,
  HiOutlineDatabase,
  HiOutlineUserAdd,
  HiOutlineLogin
} from 'react-icons/hi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface SystemStats {
  totalUsers: number;                    // 전체 사용자 수
  todayLoginUsers: number;              // 오늘 로그인한 사용자 수
  totalPatients: number;                // 전체 환자 수
  todayNewPatients: number;             // 오늘 새로 등록된 환자 수
  todayActions: number;                 // 오늘의 업무 활동 수
  totalActions: number;                 // 전체 활동 수
  recentActivities: number;             // 최근 7일간 활동 수
  systemUptime: string;                 // 실제 서버 가동시간
  dbSizeMB: number;                     // DB 크기
  userActivityToday: UserActivity[];    // 오늘 사용자별 활동
  lastUpdated: string;
}

interface UserActivity {
  _id: string;
  userName: string;
  actionCount: number;
  lastActivity: string;
}

interface RecentActivity {
  _id: string;
  userName: string;
  action: string;
  target: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    todayLoginUsers: 0,
    totalPatients: 0,
    todayNewPatients: 0,
    todayActions: 0,
    totalActions: 0,
    recentActivities: 0,
    systemUptime: '0시간',
    dbSizeMB: 0,
    userActivityToday: [],
    lastUpdated: ''
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { user } = useAppSelector(state => state.auth);

  useEffect(() => {
    fetchDashboardData();
    // 30초마다 자동 새로고침
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // 시스템 통계 가져오기
      const statsResponse = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // 최근 활동 가져오기
      const activitiesResponse = await fetch('/api/activity-logs?limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setRecentActivities(activitiesData.logs || []);
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionDisplayName = (action: string) => {
    const actionMap: Record<string, string> = {
      'login': '로그인',
      'logout': '로그아웃',
      'patient_create': '환자 등록',
      'patient_update': '환자 수정',
      'patient_delete': '환자 삭제',
      'callback_create': '콜백 등록',
      'callback_complete': '콜백 완료',
      'user_create': '사용자 생성',
      'user_update': '사용자 수정',
      'user_delete': '사용자 삭제',
    };
    return actionMap[action] || action;
  };

  const getRelativeTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return '방금 전';
      if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}시간 전`;
      return format(date, 'M월 d일 HH:mm', { locale: ko });
    } catch {
      return '알 수 없음';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-600">대시보드를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 환영 메시지 */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          안녕하세요, {user?.name || 'Master Admin'}님!
        </h2>
        <p className="text-red-100">
          시스템 관리자 대시보드에 오신 것을 환영합니다. 
          현재 시스템 상태와 사용자 활동을 실시간으로 모니터링할 수 있습니다.
        </p>
        <div className="mt-4 text-sm text-red-100">
          마지막 업데이트: {stats.lastUpdated ? format(new Date(stats.lastUpdated), 'yyyy년 M월 d일 HH:mm:ss', { locale: ko }) : '알 수 없음'}
        </div>
      </div>

      {/* 주요 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 전체 사용자 */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <HiOutlineUsers className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">전체 사용자</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</p>
              <p className="text-xs text-gray-500">오늘 로그인: {stats.todayLoginUsers}명</p>
            </div>
          </div>
        </div>

        {/* 전체 환자 */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <HiOutlineUserGroup className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">전체 환자</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalPatients}</p>
              <p className="text-xs text-gray-500">오늘 신규: {stats.todayNewPatients}명</p>
            </div>
          </div>
        </div>

        {/* 오늘 업무 활동 */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <HiOutlineClipboardList className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">오늘 업무 활동</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.todayActions}</p>
              <p className="text-xs text-gray-500">전체: {stats.totalActions.toLocaleString()}개</p>
            </div>
          </div>
        </div>

        {/* 최근 7일 활동 */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <HiOutlineChartBar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">최근 7일 활동</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.recentActivities}</p>
              <p className="text-xs text-gray-500">일평균: {Math.round(stats.recentActivities / 7)}개</p>
            </div>
          </div>
        </div>
      </div>

      {/* 시스템 정보 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 서버 가동시간 */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <HiOutlineClock className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">서버 가동시간</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.systemUptime}</p>
              <p className="text-xs text-gray-500">연속 운영 중</p>
            </div>
          </div>
        </div>

        {/* 데이터베이스 크기 */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                <HiOutlineDatabase className="w-6 h-6 text-teal-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">데이터베이스 크기</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.dbSizeMB} MB</p>
              <p className="text-xs text-gray-500">현재 사용량</p>
            </div>
          </div>
        </div>
      </div>

      {/* 사용자별 오늘 활동 */}
      {stats.userActivityToday.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">오늘 사용자별 활동 현황</h3>
            <p className="text-sm text-gray-500 mt-1">각 사용자의 오늘 업무 활동 건수입니다.</p>
          </div>
          
          <div className="divide-y divide-gray-200">
            {stats.userActivityToday.map((activity) => (
              <div key={activity._id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600">
                          {activity.userName?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.userName}
                      </p>
                      <p className="text-sm text-gray-500">
                        마지막 활동: {getRelativeTime(activity.lastActivity)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {activity.actionCount}건
                    </p>
                    <p className="text-xs text-gray-500">오늘 업무</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 시스템 활동 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">최근 시스템 활동</h3>
          <p className="text-sm text-gray-500 mt-1">사용자들의 최근 활동 내역입니다.</p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {recentActivities.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              최근 활동이 없습니다.
            </div>
          ) : (
            recentActivities.map((activity) => (
              <div key={activity._id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {activity.userName?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.userName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {getActionDisplayName(activity.action)} - {activity.target}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {getRelativeTime(activity.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {recentActivities.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 text-center">
            <button 
              onClick={() => window.location.href = '/admin?tab=logs'}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              전체 활동 로그 보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}