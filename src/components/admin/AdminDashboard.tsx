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
  HiOutlineLogin,
  HiOutlineTrash,
  HiOutlineRefresh,
  HiOutlineExclamationCircle
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

interface DataCounts {
  patients: number;
  activityLogs: number;
  messageLogs: number;
  reports: number;
  callbacks: number;
  consultations: number;
  eventTargets: number;
}

interface ClearDataResult {
  success: boolean;
  message: string;
  deleted?: Record<string, number>;
  totalDeleted?: number;
  timestamp?: string;
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
  
  // 테스트 데이터 관리 상태
  const [dataCounts, setDataCounts] = useState<DataCounts | null>(null);
  const [lastClearResult, setLastClearResult] = useState<ClearDataResult | null>(null);
  const [isClearLoading, setIsClearLoading] = useState(false);
  const [showClearSection, setShowClearSection] = useState(false);

  const { user } = useAppSelector(state => state.auth);

  // 개발 환경 체크
  const isDevelopment = process.env.NODE_ENV === 'development';

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
      const activitiesResponse = await fetch('/api/v2/activity-logs?limit=10', {
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

  // 현재 데이터 개수 확인
  const fetchDataCounts = async () => {
    try {
      setIsClearLoading(true);
      const response = await fetch('/api/debug/clear-test-data');
      const data = await response.json();
      
      if (response.ok) {
        setDataCounts(data.counts);
      } else {
        alert(`데이터 개수 확인 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('데이터 개수 확인 오류:', error);
      alert('데이터 개수 확인 중 오류가 발생했습니다.');
    } finally {
      setIsClearLoading(false);
    }
  };

  // 테스트 데이터 삭제
  const handleClearTestData = async () => {
    // 이중 확인
    const firstConfirm = confirm('⚠️ 정말로 모든 테스트 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!');
    if (!firstConfirm) return;

    const secondConfirm = confirm('한 번 더 확인합니다.\n\n모든 환자 데이터, 상담 기록, 활동 로그가 삭제됩니다.\n\n계속하시겠습니까?');
    if (!secondConfirm) return;

    try {
      setIsClearLoading(true);
      setLastClearResult(null);

      const response = await fetch('/api/debug/clear-test-data', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer debug-clear', // 보안 헤더
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        setLastClearResult(result);
        alert(`✅ 삭제 완료!\n\n총 ${result.totalDeleted}개의 레코드가 삭제되었습니다.`);
        // 삭제 후 현재 데이터 개수 다시 확인 및 대시보드 새로고침
        await fetchDataCounts();
        await fetchDashboardData();
      } else {
        alert(`❌ 삭제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('데이터 삭제 오류:', error);
      alert('데이터 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsClearLoading(false);
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
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-red-100">
            마지막 업데이트: {stats.lastUpdated ? format(new Date(stats.lastUpdated), 'yyyy년 M월 d일 HH:mm:ss', { locale: ko }) : '알 수 없음'}
          </div>
          {isDevelopment && (
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-yellow-500 text-yellow-900 text-xs font-medium rounded">
                개발 환경
              </span>
              <button
                onClick={() => setShowClearSection(!showClearSection)}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded transition-colors"
              >
                {showClearSection ? '테스트 데이터 관리 숨기기' : '테스트 데이터 관리'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 테스트 데이터 관리 섹션 (개발 환경에서만 표시) */}
      {isDevelopment && showClearSection && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <HiOutlineExclamationCircle className="w-6 h-6 text-yellow-600 mr-2" />
            <h3 className="text-lg font-semibold text-yellow-800">
              🗑️ 테스트 데이터 관리
            </h3>
            <span className="ml-auto px-2 py-1 bg-yellow-200 text-yellow-800 text-xs font-medium rounded">
              개발 환경 전용
            </span>
          </div>

          {/* 현재 데이터 개수 표시 */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-3">
              <button
                onClick={fetchDataCounts}
                disabled={isClearLoading}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 flex items-center space-x-2"
              >
                <HiOutlineRefresh className={`w-4 h-4 ${isClearLoading ? 'animate-spin' : ''}`} />
                <span>{isClearLoading ? '확인 중...' : '현재 데이터 개수 확인'}</span>
              </button>
            </div>

            {dataCounts && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded border border-yellow-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{dataCounts.patients}</div>
                  <div className="text-sm text-gray-600">환자</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{dataCounts.activityLogs}</div>
                  <div className="text-sm text-gray-600">활동로그</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{dataCounts.messageLogs}</div>
                  <div className="text-sm text-gray-600">메시지로그</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{dataCounts.reports}</div>
                  <div className="text-sm text-gray-600">리포트</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{dataCounts.callbacks}</div>
                  <div className="text-sm text-gray-600">콜백</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-pink-600">{dataCounts.consultations}</div>
                  <div className="text-sm text-gray-600">상담</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-teal-600">{dataCounts.eventTargets}</div>
                  <div className="text-sm text-gray-600">이벤트타겟</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {Object.values(dataCounts).reduce((sum, count) => sum + count, 0)}
                  </div>
                  <div className="text-sm text-gray-600">총합</div>
                </div>
              </div>
            )}
          </div>

          {/* 삭제 버튼 */}
          <div className="border-t border-yellow-200 pt-4">
            <button
              onClick={handleClearTestData}
              disabled={isClearLoading}
              className="w-full px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
            >
              <HiOutlineTrash className="w-5 h-5" />
              <span>{isClearLoading ? '삭제 중...' : '🗑️ 모든 테스트 데이터 삭제'}</span>
            </button>
            
            <p className="text-xs text-gray-500 mt-2 text-center">
              이 작업은 되돌릴 수 없습니다. 신중히 진행해주세요.
            </p>
          </div>

          {/* 마지막 삭제 결과 표시 */}
          {lastClearResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <h4 className="font-medium text-green-800 mb-2">마지막 삭제 결과</h4>
              <div className="text-sm text-green-700">
                <p>삭제 시간: {new Date(lastClearResult.timestamp!).toLocaleString()}</p>
                <p>총 삭제 개수: {lastClearResult.totalDeleted}개</p>
                {lastClearResult.deleted && (
                  <div className="mt-2">
                    <p>상세 내역:</p>
                    <ul className="list-disc list-inside ml-4">
                      {Object.entries(lastClearResult.deleted).map(([key, count]) => (
                        <li key={key}>{key}: {count}개</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 주요 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 전체 사용자 */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <HiOutlineUsers className="w-6 h-6 text-orange-600" />
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
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-orange-600">
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