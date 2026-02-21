// src/app/v2/settings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/v2/layout/PageHeader';
import PatientCategorySettings from '@/components/settings/PatientCategorySettings';
import {
  Settings,
  Phone,
  Sparkles,
  Bell,
  Target,
  Save,
  CheckCircle,
  Building,
  Tags,
  BookOpen,
  RefreshCw,
  Users,
  UserPlus,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Copy,
  Check,
  X,
  Link,
  Pencil,
} from 'lucide-react';
import ManualSettings from '@/components/v2/settings/ManualSettings';
import RecallSettings from '@/components/v2/settings/RecallSettings';
import { useAppSelector } from '@/hooks/reduxHooks';
import { ROLE_CONFIG, INVITATION_STATUS_CONFIG } from '@/types/invitation';
import type { UserRole, Invitation, InvitationStatus } from '@/types/invitation';
import type { User } from '@/types/user';

interface SettingsData {
  clinicName: string;
  cti: {
    enabled: boolean;
    serverUrl: string;
    agentId: string;
  };
  ai: {
    enabled: boolean;
    autoAnalysis: boolean;
    model: string;
  };
  notifications: {
    missedCall: boolean;
    newPatient: boolean;
    callback: boolean;
  };
  targets: {
    monthlyRevenue: number;
    dailyCalls: number;
    conversionRate: number;
  };
}

type TabType = 'general' | 'categories' | 'manuals' | 'recall' | 'users' | 'invitations';

export default function SettingsPage() {
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';

  // 기본 탭: 관리자는 general, 그 외는 categories
  const [activeTab, setActiveTab] = useState<TabType>(isAdmin ? 'general' : 'categories');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 사용자 관리 상태
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserRole, setEditUserRole] = useState<UserRole>('staff');

  // 초대 관리 상태
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'staff' as UserRole });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | 'all'>('all');

  useEffect(() => {
    fetchSettings();
  }, []);

  // 사용자 정보 로드 후 비관리자면 기본 탭을 categories로 변경
  useEffect(() => {
    if (currentUser && !isAdmin && activeTab === 'general') {
      setActiveTab('categories');
    }
  }, [currentUser, isAdmin, activeTab]);

  // 사용자 목록 조회
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users?includeInactive=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  // 초대 목록 조회
  const fetchInvitations = useCallback(async () => {
    if (!isAdmin) return;
    setInvitationsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v2/invitations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setInvitationsLoading(false);
    }
  }, [isAdmin]);

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      fetchUsers();
    } else if (activeTab === 'invitations' && isAdmin) {
      fetchInvitations();
    }
  }, [activeTab, isAdmin, fetchUsers, fetchInvitations]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/v2/settings');
      const result = await response.json();

      if (result.success) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/v2/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (path: string, value: unknown) => {
    if (!settings) return;

    const keys = path.split('.');
    const newSettings = { ...settings };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj: any = newSettings;

    for (let i = 0; i < keys.length - 1; i++) {
      obj[keys[i]] = { ...obj[keys[i]] };
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;

    setSettings(newSettings);
  };

  // 사용자 상태 토글
  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
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
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`정말 "${userName}" 사용자를 삭제하시겠습니까?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  // 역할 수정 모달 열기
  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    // master는 admin으로 표시
    const normalizedRole = user.role === 'master' ? 'admin' : user.role;
    setEditUserRole(normalizedRole as UserRole);
    setShowEditUserModal(true);
  };

  // 역할 수정 저장
  const handleUpdateUserRole = async () => {
    if (!editingUser) return;
    try {
      const token = localStorage.getItem('token');
      const userId = editingUser.id || editingUser._id;
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: editUserRole })
      });
      const data = await response.json();
      if (data.success) {
        setShowEditUserModal(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        alert(data.message || '역할 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
      alert('역할 수정 중 오류가 발생했습니다.');
    }
  };

  // 초대 생성
  const handleCreateInvitation = async () => {
    if (!inviteForm.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v2/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(inviteForm)
      });
      const data = await response.json();
      if (data.success) {
        setShowInviteModal(false);
        setInviteForm({ name: '', email: '', role: 'staff' });
        fetchInvitations();
        // 링크 자동 복사
        await navigator.clipboard.writeText(data.inviteLink);
        alert('초대가 생성되었습니다. 링크가 클립보드에 복사되었습니다.');
      } else {
        alert(data.error || '초대 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create invitation:', error);
      alert('초대 생성 중 오류가 발생했습니다.');
    }
  };

  // 초대 링크 복사
  const handleCopyInviteLink = async (token: string, invitationId: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invitationId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // 초대 취소
  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('정말 이 초대를 취소하시겠습니까?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v2/invitations?id=${invitationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchInvitations();
      }
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
    }
  };

  // 역할 표시
  const getRoleDisplay = (role: string) => {
    const normalizedRole = role === 'master' ? 'admin' : role;
    return ROLE_CONFIG[normalizedRole as UserRole] || ROLE_CONFIG.staff;
  };

  // 필터링된 사용자
  const filteredUsers = users.filter(user => {
    if (!userSearchTerm) return true;
    const search = userSearchTerm.toLowerCase();
    return user.name?.toLowerCase().includes(search) ||
           user.username?.toLowerCase().includes(search) ||
           user.email?.toLowerCase().includes(search);
  });

  // 필터링된 초대
  const filteredInvitations = invitations.filter(inv => {
    if (statusFilter === 'all') return true;
    return inv.status === statusFilter;
  });

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="설정" subtitle="시스템 설정을 관리하세요" />
        <div className="mt-6 text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <PageHeader title="설정" subtitle="시스템 설정을 관리하세요" />
        <div className="mt-6 text-center text-red-500">설정을 불러올 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="설정"
        subtitle="시스템 설정을 관리하세요"
        action={activeTab === 'general' ? {
          label: saving ? '저장 중...' : saved ? '저장됨' : '저장',
          icon: saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />,
          onClick: handleSave,
        } : undefined}
      />

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {isAdmin && (
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
              activeTab === 'general'
                ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            일반 설정
          </button>
        )}
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'categories'
              ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Tags className="w-4 h-4" />
          카테고리 관리
        </button>
        <button
          onClick={() => setActiveTab('manuals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'manuals'
              ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          상담 매뉴얼
        </button>
        <button
          onClick={() => setActiveTab('recall')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'recall'
              ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          리콜 발송 설정
        </button>

        {/* 관리자 전용 탭 */}
        {isAdmin && (
          <>
            <div className="w-px bg-gray-300 mx-2" /> {/* 구분선 */}
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'users'
                  ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-purple-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              사용자 관리
            </button>
            <button
              onClick={() => setActiveTab('invitations')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'invitations'
                  ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-purple-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              초대 관리
            </button>
          </>
        )}
      </div>

      {/* 카테고리 관리 탭 */}
      {activeTab === 'categories' && (
        <section className="bg-white rounded-xl border border-gray-100 p-6">
          <PatientCategorySettings />
        </section>
      )}

      {/* 상담 매뉴얼 탭 */}
      {activeTab === 'manuals' && (
        <section className="bg-white rounded-xl border border-gray-100 p-6">
          <ManualSettings />
        </section>
      )}

      {/* 리콜 발송 설정 탭 */}
      {activeTab === 'recall' && (
        <section className="bg-white rounded-xl border border-gray-100 p-6">
          <RecallSettings />
        </section>
      )}

      {/* 사용자 관리 탭 */}
      {activeTab === 'users' && isAdmin && (
        <section className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-purple-600" />
              <h3 className="font-medium text-gray-900">사용자 관리</h3>
              <span className="text-sm text-gray-500">({users.length}명)</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="이름, 아이디 검색..."
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {usersLoading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">등록된 사용자가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const roleConfig = getRoleDisplay(user.role);
                    const isCurrentUser = user.id === currentUser?.id || user._id === currentUser?.id;
                    return (
                      <tr key={user.id || user._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig.bgColor}`}>
                            {roleConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {user.isActive ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isCurrentUser && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditUser(user)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="역할 수정"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(user.id || user._id!, user.isActive)}
                                className={`p-1.5 rounded transition-colors ${
                                  user.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                                }`}
                                title={user.isActive ? '비활성화' : '활성화'}
                              >
                                {user.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id || user._id!, user.name)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {isCurrentUser && <span className="text-xs text-gray-400">본인</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 초대 관리 탭 */}
      {activeTab === 'invitations' && isAdmin && (
        <section className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <UserPlus className="w-5 h-5 text-purple-600" />
              <h3 className="font-medium text-gray-900">초대 관리</h3>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              <UserPlus className="w-4 h-4" />
              새 사용자 초대
            </button>
          </div>

          {/* 상태 필터 */}
          <div className="flex gap-2 mb-4">
            {(['all', 'pending', 'accepted', 'expired', 'cancelled'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? '전체' : INVITATION_STATUS_CONFIG[status].label}
                {status !== 'all' && (
                  <span className="ml-1">
                    ({invitations.filter(i => i.status === status).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {invitationsLoading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : filteredInvitations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">초대 내역이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">초대 대상</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">만료일</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInvitations.map((invitation) => {
                    const roleConfig = ROLE_CONFIG[invitation.role];
                    const statusConfig = INVITATION_STATUS_CONFIG[invitation.status];
                    return (
                      <tr key={invitation._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{invitation.name}</div>
                          {invitation.email && <div className="text-sm text-gray-500">{invitation.email}</div>}
                          <div className="text-xs text-gray-400">초대자: {invitation.invitedByName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig.bgColor}`}>
                            {roleConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(invitation.expiresAt).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {invitation.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleCopyInviteLink(invitation.token, invitation._id!)}
                                className={`p-1.5 rounded transition-colors ${
                                  copiedId === invitation._id
                                    ? 'text-green-600 bg-green-50'
                                    : 'text-gray-500 hover:bg-gray-100'
                                }`}
                                title="링크 복사"
                              >
                                {copiedId === invitation._id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleCancelInvitation(invitation._id!)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="취소"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 초대 생성 모달 */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">새 사용자 초대</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일 (선택)</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">역할 *</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="staff">상담사</option>
                  <option value="manager">매니저</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateInvitation}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  초대 생성
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 역할 수정 모달 */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">사용자 역할 수정</h3>
              <button onClick={() => setShowEditUserModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">사용자</p>
                <p className="font-medium text-gray-900">{editingUser.name}</p>
                <p className="text-sm text-gray-500">@{editingUser.username}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">역할 변경</label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="staff">상담사</option>
                  <option value="manager">매니저</option>
                  <option value="admin">관리자</option>
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  {editUserRole === 'admin' && '모든 기능에 접근 가능, 사용자 관리 권한 포함'}
                  {editUserRole === 'manager' && '팀 관리, 리포트 조회 가능'}
                  {editUserRole === 'staff' && '기본 상담 업무만 수행 가능'}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowEditUserModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleUpdateUserRole}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 일반 설정 탭 (관리자만) */}
      {activeTab === 'general' && isAdmin && (
        <>
        {/* 기본 정보 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-4">
          <Building className="w-5 h-5" />
          기본 정보
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              병원 이름
            </label>
            <input
              type="text"
              value={settings.clinicName}
              onChange={(e) => updateSettings('clinicName', e.target.value)}
              className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* CTI 설정 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Phone className="w-5 h-5" />
            CTI 연동
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.cti.enabled}
              onChange={(e) => updateSettings('cti.enabled', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">활성화</span>
          </label>
        </div>

        {settings.cti.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CTI 서버 URL
              </label>
              <input
                type="text"
                value={settings.cti.serverUrl}
                onChange={(e) => updateSettings('cti.serverUrl', e.target.value)}
                placeholder="ws://localhost:5100"
                className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상담사 ID
              </label>
              <input
                type="text"
                value={settings.cti.agentId}
                onChange={(e) => updateSettings('cti.agentId', e.target.value)}
                placeholder="agent001"
                className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        )}
      </section>

      {/* AI 분석 설정 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Sparkles className="w-5 h-5" />
            AI 분석
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.ai.enabled}
              onChange={(e) => updateSettings('ai.enabled', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">활성화</span>
          </label>
        </div>

        {settings.ai.enabled && (
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ai.autoAnalysis}
                  onChange={(e) => updateSettings('ai.autoAnalysis', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">통화 종료 후 자동 분석</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI 모델
              </label>
              <select
                value={settings.ai.model}
                onChange={(e) => updateSettings('ai.model', e.target.value)}
                className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="gpt-4o-mini">GPT-4o Mini (빠름, 저렴)</option>
                <option value="gpt-4o">GPT-4o (정확함)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo (균형)</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* 알림 설정 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-4">
          <Bell className="w-5 h-5" />
          알림 설정
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications.missedCall}
              onChange={(e) => updateSettings('notifications.missedCall', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">부재중 전화 알림</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications.newPatient}
              onChange={(e) => updateSettings('notifications.newPatient', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">신규 환자 등록 알림</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications.callback}
              onChange={(e) => updateSettings('notifications.callback', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">콜백 일정 알림</span>
          </label>
        </div>
      </section>

      {/* 목표 설정 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-4">
          <Target className="w-5 h-5" />
          목표 설정
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              월 매출 목표 (만원)
            </label>
            <input
              type="number"
              value={settings.targets.monthlyRevenue}
              onChange={(e) => updateSettings('targets.monthlyRevenue', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              일 통화 목표 (건)
            </label>
            <input
              type="number"
              value={settings.targets.dailyCalls}
              onChange={(e) => updateSettings('targets.dailyCalls', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전환율 목표 (%)
            </label>
            <input
              type="number"
              value={settings.targets.conversionRate}
              onChange={(e) => updateSettings('targets.conversionRate', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              min={0}
              max={100}
            />
          </div>
        </div>
      </section>

      {/* 저장 버튼 (하단 고정) */}
      <div className="sticky bottom-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium shadow-lg transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          } disabled:opacity-50`}
        >
          {saved ? (
            <>
              <CheckCircle className="w-5 h-5" />
              저장 완료
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {saving ? '저장 중...' : '변경사항 저장'}
            </>
          )}
        </button>
      </div>
        </>
      )}
    </div>
  );
}
