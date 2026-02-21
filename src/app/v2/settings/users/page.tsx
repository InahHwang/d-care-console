'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/hooks/reduxHooks';
import { FiUsers, FiSearch, FiUserPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight, FiArrowLeft } from 'react-icons/fi';
import { ROLE_CONFIG } from '@/types/invitation';
import type { User } from '@/types/user';
import type { UserRole } from '@/types/invitation';

export default function UsersSettingsPage() {
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useAppSelector((state) => state.auth);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // 권한 체크 (admin 또는 master만 접근 가능)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';

  // 사용자 목록 조회
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(roleFilter !== 'all' && { role: roleFilter }),
        includeInactive: 'true'
      });

      const response = await fetch(`/api/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setUsers(data.users || []);
        setPagination(prev => ({
          ...prev,
          total: data.total || 0,
          totalPages: Math.ceil((data.total || 0) / prev.limit)
        }));
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, roleFilter]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchUsers();
    }
  }, [isAuthenticated, isAdmin, fetchUsers]);

  // 권한 없으면 리다이렉트
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      router.push('/v2/dashboard');
    }
  }, [isAuthenticated, isAdmin, router]);

  // 사용자 상태 토글
  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  // 사용자 삭제
  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`정말 "${userName}" 사용자를 삭제하시겠습니까?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  // 역할 표시 (master는 admin으로 표시)
  const getRoleDisplay = (role: string) => {
    const normalizedRole = role === 'master' ? 'admin' : role;
    const config = ROLE_CONFIG[normalizedRole as UserRole] || ROLE_CONFIG.staff;
    return config;
  };

  if (!isAuthenticated) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">접근 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <FiArrowLeft className="mr-2" />
          뒤로가기
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiUsers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
              <p className="text-gray-500 text-sm">조직 내 사용자 계정을 관리합니다</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/v2/settings/invitations')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiUserPlus className="w-4 h-4" />
            새 사용자 초대
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex gap-4">
          {/* 검색 */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="이름, 아이디, 이메일 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* 역할 필터 */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">모든 역할</option>
            <option value="admin">관리자</option>
            <option value="master">관리자 (레거시)</option>
            <option value="manager">매니저</option>
            <option value="staff">상담사</option>
          </select>
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">사용자 목록을 불러오는 중...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <FiUsers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">등록된 사용자가 없습니다.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">마지막 로그인</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => {
                const roleConfig = getRoleDisplay(user.role);
                const isCurrentUser = user.id === currentUser?.id || user._id === currentUser?.id;

                return (
                  <tr key={user.id || user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">@{user.username}</div>
                        {user.email && <div className="text-xs text-gray-400">{user.email}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig.bgColor}`}>
                        {roleConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {user.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleString('ko-KR') : '없음'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isCurrentUser && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(user.id || user._id!, user.isActive)}
                            className={`p-2 rounded-lg transition-colors ${
                              user.isActive
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={user.isActive ? '비활성화' : '활성화'}
                          >
                            {user.isActive ? (
                              <FiToggleRight className="w-5 h-5" />
                            ) : (
                              <FiToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(user.id || user._id!, user.name)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <FiTrash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      {isCurrentUser && (
                        <span className="text-xs text-gray-400">본인</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              총 {pagination.total}명 중 {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)}명
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                이전
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
