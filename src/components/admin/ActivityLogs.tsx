// src/components/admin/ActivityLogs.tsx - 수정된 버전 (실시간 개수 동기화)

'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/reduxHooks';
import { ActivityLog, ActivityLogFilters, ActivityAction, ActivityTarget } from '@/types/activityLog';
import { User } from '@/types/user';
import { 
  HiOutlineSearch,
  HiOutlineFilter,
  HiOutlineDownload,
  HiOutlineRefresh,
  HiOutlineUser,
  HiOutlinePhone,
  HiOutlineUserGroup,
  HiOutlineMail,
  HiOutlineShieldCheck,
  HiOutlineClock,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlineCalendar,
  HiOutlineExclamationCircle
} from 'react-icons/hi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0); // 🔥 실시간 동기화될 총 개수
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showDateDeleteModal, setShowDateDeleteModal] = useState(false);
  
  // 다중 선택 관련 상태
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);
  
  // 날짜 기준 삭제 관련 상태
  const [deleteDays, setDeleteDays] = useState(30);
  const [deleteActionTypes, setDeleteActionTypes] = useState<string[]>(['login', 'logout']);
  
  // 현재 사용자 정보 가져오기
  const { user: currentUser } = useAppSelector(state => state.auth);
  const isMaster = currentUser?.role === 'master';
  
  const [filters, setFilters] = useState<ActivityLogFilters>({
    userId: '',
    action: undefined,
    target: undefined,
    startDate: '',
    endDate: '',
    searchTerm: ''
  });

  const limit = 20;

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, [currentPage, filters]);

  // 전체 선택 상태 업데이트
  useEffect(() => {
    const currentPageLogIds = logs.map(log => log._id);
    const selectedInCurrentPage = currentPageLogIds.filter(id => selectedLogs.has(id));
    setIsAllSelected(currentPageLogIds.length > 0 && selectedInCurrentPage.length === currentPageLogIds.length);
  }, [logs, selectedLogs]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== undefined)
        )
      });

      const response = await fetch(`/api/v2/activity-logs?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setTotalLogs(data.total || 0); // 🔥 실시간 총 개수 업데이트
        // 삭제 후 선택 상태 초기화
        setSelectedLogs(new Set());
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ActivityLogFilters, value: string) => {
    const newValue = value === '' ? undefined : value;
    if (key === 'action') {
      setFilters(prev => ({ ...prev, [key]: newValue as ActivityAction | undefined }));
    } else if (key === 'target') {
      setFilters(prev => ({ ...prev, [key]: newValue as ActivityTarget | undefined }));
    } else {
      setFilters(prev => ({ ...prev, [key]: value }));
    }
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({
      userId: '',
      action: undefined,
      target: undefined,
      startDate: '',
      endDate: '',
      searchTerm: ''
    });
    setCurrentPage(1);
  };

  // 개별 선택/해제
  const handleSelectLog = (logId: string) => {
    const newSelected = new Set(selectedLogs);
    if (newSelected.has(logId)) {
      newSelected.delete(logId);
    } else {
      newSelected.add(logId);
    }
    setSelectedLogs(newSelected);
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    const currentPageLogIds = logs.map(log => log._id);
    const newSelected = new Set(selectedLogs);
    
    if (isAllSelected) {
      // 현재 페이지 모든 항목 해제
      currentPageLogIds.forEach(id => newSelected.delete(id));
    } else {
      // 현재 페이지 모든 항목 선택
      currentPageLogIds.forEach(id => newSelected.add(id));
    }
    
    setSelectedLogs(newSelected);
  };

  // 🔥 개별 로그 삭제 - 실시간 개수 업데이트
  const handleDeleteLog = async (logId: string) => {
    try {
      console.log('삭제 시도:', logId);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/v2/activity-logs/${logId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('응답 상태:', response.status);
      const responseData = await response.json();
      console.log('응답 데이터:', responseData);

      if (response.ok) {
        console.log('삭제 성공, 목록 새로고침 중...');
        
        // 🔥 실시간 개수 업데이트
        if (responseData.remainingCount !== undefined) {
          setTotalLogs(responseData.remainingCount);
        }
        
        // 로그 목록 새로고침
        await fetchLogs();
        setShowDeleteConfirm(null);
        alert('로그가 성공적으로 삭제되었습니다.');
      } else {
        console.error('삭제 실패:', responseData);
        alert(responseData.message || '로그 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete log:', error);
      alert('로그 삭제 중 오류가 발생했습니다.');
    }
  };

  // 🔥 다중 로그 삭제 - 실시간 개수 업데이트
  const handleBulkDelete = async () => {
    if (selectedLogs.size === 0) return;

    try {
      const token = localStorage.getItem('token');
      const logIds = Array.from(selectedLogs);
      
      // 병렬로 개별 삭제 API 호출
      const deletePromises = logIds.map(logId =>
        fetch(`/api/v2/activity-logs/${logId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const successCount = results.filter(result => result.status === 'fulfilled' && (result.value as Response).ok).length;
      const failCount = results.length - successCount;

      // 🔥 목록 새로고침 및 실시간 개수 업데이트
      await fetchLogs();
      setSelectedLogs(new Set());
      setShowBulkDeleteConfirm(false);

      if (failCount === 0) {
        alert(`${successCount}개의 로그가 성공적으로 삭제되었습니다.`);
      } else {
        alert(`${successCount}개 삭제 성공, ${failCount}개 삭제 실패`);
      }
    } catch (error) {
      console.error('Failed to bulk delete logs:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    }
  };

  // 🔥 날짜 기준 삭제 - 실시간 개수 업데이트
  const handleDateBasedDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        type: 'older-than',
        days: deleteDays.toString(),
        ...(deleteActionTypes.length > 0 && { actions: deleteActionTypes.join(',') })
      });

      const response = await fetch(`/api/v2/activity-logs/cleanup?${queryParams}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setShowDateDeleteModal(false);
        
        // 🔥 실시간 개수 업데이트
        if (data.remainingCount !== undefined) {
          setTotalLogs(data.remainingCount);
        }
        
        alert(data.message);
        // 목록 새로고침
        await fetchLogs();
      } else {
        const errorData = await response.json();
        alert(errorData.message || '로그 정리에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete logs by date:', error);
      alert('로그 정리 중 오류가 발생했습니다.');
    }
  };

  // 엑셀로 내보내기
  const exportLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== undefined)
        ),
        format: 'csv'
      });

      const response = await fetch(`/api/v2/activity-logs/export?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `활동로그_${format(new Date(), 'yyyy-MM-dd_HHmm', { locale: ko })}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alert('로그가 성공적으로 내보내졌습니다.');
      } else {
        const errorData = await response.json();
        alert(errorData.message || '로그 내보내기에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
      alert('로그 내보내기에 실패했습니다.');
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
      case 'logout':
        return HiOutlineShieldCheck;
      case 'patient_create':
      case 'patient_update':
      case 'patient_delete':
        return HiOutlineUserGroup;
      case 'callback_create':
      case 'callback_complete':
        return HiOutlinePhone;
      case 'message_send':
        return HiOutlineMail;
      case 'user_create':
      case 'user_update':
      case 'user_delete':
        return HiOutlineUser;
      default:
        return HiOutlineClock;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login':
        return 'text-green-600 bg-green-100';
      case 'logout':
        return 'text-gray-600 bg-gray-100';
      case 'patient_create':
      case 'user_create':
        return 'text-orange-600 bg-orange-100';
      case 'patient_update':
      case 'user_update':
        return 'text-yellow-600 bg-yellow-100';
      case 'patient_delete':
      case 'user_delete':
        return 'text-red-600 bg-red-100';
      case 'callback_create':
      case 'callback_complete':
        return 'text-purple-600 bg-purple-100';
      case 'message_send':
        return 'text-indigo-600 bg-indigo-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getActionDisplayName = (action: string) => {
    const actionMap: Record<string, string> = {
      'login': '로그인',
      'logout': '로그아웃',
      'patient_create': '환자 등록',
      'patient_update': '환자 수정',
      'patient_delete': '환자 삭제',
      'patient_view': '환자 조회',
      'callback_create': '콜백 등록',
      'callback_update': '콜백 수정',
      'callback_complete': '콜백 완료',
      'callback_cancel': '콜백 취소',
      'message_send': '메시지 전송',
      'user_create': '사용자 생성',
      'user_update': '사용자 수정',
      'user_delete': '사용자 삭제',
    };
    return actionMap[action] || action;
  };

  const totalPages = Math.ceil(totalLogs / limit);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">활동 로그</h2>
          <p className="text-gray-600 mt-1">
            시스템의 모든 사용자 활동을 추적합니다. (총 {totalLogs}개) {/* 🔥 실시간 개수 표시 */}
            {selectedLogs.size > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                {selectedLogs.size}개 선택됨
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {isMaster && selectedLogs.size > 0 && (
            <>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="inline-flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <HiOutlineTrash className="w-4 h-4 mr-2" />
                선택 삭제 ({selectedLogs.size})
              </button>
              <div className="border-l border-gray-300 h-6"></div>
            </>
          )}
          {isMaster && (
            <button
              onClick={() => setShowDateDeleteModal(true)}
              className="inline-flex items-center px-3 py-2 border border-orange-300 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <HiOutlineCalendar className="w-4 h-4 mr-2" />
              날짜 기준 정리
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <HiOutlineFilter className="w-4 h-4 mr-2" />
            필터
          </button>
          <button
            onClick={fetchLogs}
            className="inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <HiOutlineRefresh className="w-4 h-4 mr-2" />
            새로고침
          </button>
          <button
            onClick={exportLogs}
            className="inline-flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <HiOutlineDownload className="w-4 h-4 mr-2" />
            엑셀 내보내기
          </button>
        </div>
      </div>

      {/* 필터 패널 - 기존과 동일 */}
      {showFilters && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사용자
              </label>
              <select
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">전체 사용자</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                액션
              </label>
              <select
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">전체 액션</option>
                <option value="login">로그인</option>
                <option value="logout">로그아웃</option>
                <option value="patient_create">환자 등록</option>
                <option value="patient_update">환자 수정</option>
                <option value="patient_delete">환자 삭제</option>
                <option value="callback_create">콜백 등록</option>
                <option value="callback_complete">콜백 완료</option>
                <option value="user_create">사용자 생성</option>
                <option value="user_update">사용자 수정</option>
                <option value="user_delete">사용자 삭제</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작 날짜
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료 날짜
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <HiOutlineSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="검색어 입력..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
            <button
              onClick={resetFilters}
              className="ml-4 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              필터 초기화
            </button>
          </div>
        </div>
      )}

      {/* 로그 목록 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">로그를 불러오는 중...</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {isMaster && (
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={isMaster ? 7 : 5} className="px-6 py-8 text-center text-gray-500">
                        조건에 맞는 로그가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const IconComponent = getActionIcon(log.action);
                      const colorClasses = getActionColor(log.action);
                      
                      return (
                        <tr key={log._id} className="hover:bg-gray-50">
                          {isMaster && (
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedLogs.has(log._id)}
                                onChange={() => handleSelectLog(log._id)}
                                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClasses}`}>
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <span className="ml-3 text-sm font-medium text-gray-900">
                                {getActionDisplayName(log.action)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {log.userName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {log.userRole === 'master' ? '마스터 관리자' : '일반 담당자'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {log.targetName || log.targetId}
                            </div>
                            <div className="text-sm text-gray-500">
                              {log.target}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate">
                              {log.details?.notes || log.details?.reason || log.details?.changeDetails || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {format(new Date(log.timestamp), 'yyyy.MM.dd HH:mm:ss', { locale: ko })}
                          </td>
                          {isMaster && (
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => setShowDeleteConfirm(log._id)}
                                className="text-red-600 hover:text-red-800"
                                title="삭제"
                              >
                                <HiOutlineTrash className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                총 {totalLogs}개 중 {((currentPage - 1) * limit) + 1}-{Math.min(currentPage * limit, totalLogs)} 표시 {/* 🔥 실시간 개수 표시 */}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  이전
                </button>
                
                <span className="px-3 py-1 text-sm text-gray-700">
                  {currentPage} / {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 개별 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              로그 삭제 확인
            </h3>
            <p className="text-gray-600 mb-6">
              정말로 이 활동 로그를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => showDeleteConfirm && handleDeleteLog(showDeleteConfirm)}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 삭제 확인 모달 */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              일괄 삭제 확인
            </h3>
            <p className="text-gray-600 mb-6">
              선택한 {selectedLogs.size}개의 활동 로그를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                {selectedLogs.size}개 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 날짜 기준 삭제 모달 */}
      {showDateDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex items-center mb-4">
              <HiOutlineExclamationCircle className="w-6 h-6 text-orange-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">
                날짜 기준 로그 정리
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  삭제 기준 (일)
                </label>
                <select
                  value={deleteDays}
                  onChange={(e) => setDeleteDays(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value={7}>7일 이전</option>
                  <option value={30}>30일 이전</option>
                  <option value={60}>60일 이전</option>
                  <option value={90}>90일 이전</option>
                  <option value={180}>180일 이전</option>
                  <option value={365}>1년 이전</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  삭제할 액션 타입 (선택)
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {[
                    { value: 'login', label: '로그인' },
                    { value: 'logout', label: '로그아웃' },
                    { value: 'patient_view', label: '환자 조회' },
                    { value: 'message_log_view', label: '메시지 로그 조회' },
                  ].map(action => (
                    <label key={action.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={deleteActionTypes.includes(action.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDeleteActionTypes(prev => [...prev, action.value]);
                          } else {
                            setDeleteActionTypes(prev => prev.filter(type => type !== action.value));
                          }
                        }}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{action.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  선택하지 않으면 모든 액션 타입이 대상이 됩니다.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ {deleteDays}일 이전의 로그가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowDateDeleteModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDateBasedDelete}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                정리 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
