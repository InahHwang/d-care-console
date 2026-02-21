'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/hooks/reduxHooks';
import {
  FiMail,
  FiPlus,
  FiCopy,
  FiX,
  FiCheck,
  FiClock,
  FiArrowLeft,
  FiUserPlus,
  FiRefreshCw
} from 'react-icons/fi';
import { ROLE_CONFIG, INVITATION_STATUS_CONFIG } from '@/types/invitation';
import type { Invitation, UserRole, InvitationStatus, CreateInvitationRequest } from '@/types/invitation';

export default function InvitationsSettingsPage() {
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useAppSelector((state) => state.auth);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    expired: 0,
    cancelled: 0,
    total: 0
  });

  // 새 초대 모달
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateInvitationRequest>({
    name: '',
    email: '',
    role: 'staff'
  });
  const [formError, setFormError] = useState<string | null>(null);

  // 복사 성공 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 권한 체크
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';

  // 초대 목록 조회
  const fetchInvitations = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/v2/invitations?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setInvitations(data.data || []);
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchInvitations();
    }
  }, [isAuthenticated, isAdmin, fetchInvitations]);

  // 권한 없으면 리다이렉트
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      router.push('/v2/dashboard');
    }
  }, [isAuthenticated, isAdmin, router]);

  // 새 초대 생성
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('이름을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v2/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // 생성된 초대 링크 복사
        await navigator.clipboard.writeText(data.data.inviteLink);
        alert(`초대가 생성되었습니다!\n\n초대 링크가 클립보드에 복사되었습니다.\n\n${data.data.inviteLink}`);

        setShowModal(false);
        setFormData({ name: '', email: '', role: 'staff' });
        fetchInvitations();
      } else {
        setFormError(data.error || '초대 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create invitation:', error);
      setFormError('서버 연결에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 초대 취소
  const handleCancelInvitation = async (id: string) => {
    if (!confirm('이 초대를 취소하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v2/invitations?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchInvitations();
      }
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
    }
  };

  // 초대 링크 복사
  const handleCopyLink = async (token: string, id: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const inviteLink = `${baseUrl}/invite/${token}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
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
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FiMail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">초대 관리</h1>
              <p className="text-gray-500 text-sm">새 사용자를 초대하고 초대 현황을 관리합니다</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/v2/settings/users')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              사용자 관리
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              새 초대
            </button>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">대기중</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">수락됨</div>
          <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">만료됨</div>
          <div className="text-2xl font-bold text-gray-400">{stats.expired}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">전체</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {['all', 'pending', 'accepted', 'expired', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? '전체' : INVITATION_STATUS_CONFIG[status as InvitationStatus]?.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchInvitations}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            title="새로고침"
          >
            <FiRefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 초대 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">초대 목록을 불러오는 중...</p>
          </div>
        ) : invitations.length === 0 ? (
          <div className="p-8 text-center">
            <FiUserPlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">초대 내역이 없습니다.</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              첫 초대 생성하기
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">초대 대상</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">초대일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">만료일</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invitations.map((invitation) => {
                const roleConfig = ROLE_CONFIG[invitation.role];
                const statusConfig = INVITATION_STATUS_CONFIG[invitation.status];

                return (
                  <tr key={invitation._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{invitation.name}</div>
                        {invitation.email && (
                          <div className="text-sm text-gray-500">{invitation.email}</div>
                        )}
                        <div className="text-xs text-gray-400">
                          초대자: {invitation.invitedByName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig.bgColor}`}>
                        {roleConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(invitation.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(invitation.expiresAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {invitation.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleCopyLink(invitation.token, invitation._id!)}
                              className={`p-2 rounded-lg transition-colors ${
                                copiedId === (invitation._id)
                                  ? 'text-green-600 bg-green-50'
                                  : 'text-gray-500 hover:bg-gray-100'
                              }`}
                              title="링크 복사"
                            >
                              {copiedId === (invitation._id) ? (
                                <FiCheck className="w-5 h-5" />
                              ) : (
                                <FiCopy className="w-5 h-5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleCancelInvitation(invitation._id!)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="취소"
                            >
                              <FiX className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {invitation.status === 'accepted' && (
                          <span className="text-xs text-green-600">
                            <FiCheck className="inline w-4 h-4 mr-1" />
                            가입 완료
                          </span>
                        )}
                        {(invitation.status === 'expired' || invitation.status === 'cancelled') && (
                          <span className="text-xs text-gray-400">
                            <FiClock className="inline w-4 h-4 mr-1" />
                            {invitation.status === 'expired' ? '만료됨' : '취소됨'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 새 초대 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">새 사용자 초대</h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setFormError(null);
                  }}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateInvitation} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="초대할 사용자 이름"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이메일 <span className="text-gray-400">(선택)</span>
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  역할 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="staff">상담사</option>
                  <option value="manager">매니저</option>
                  <option value="admin">관리자</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.role === 'admin' && '관리자: 사용자 관리, 초대 발송, 모든 설정 접근 가능'}
                  {formData.role === 'manager' && '매니저: 팀 관리, 리포트 조회 가능'}
                  {formData.role === 'staff' && '상담사: 일반 상담 업무 가능'}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '생성 중...' : '초대 생성'}
                </button>
              </div>
            </form>

            <div className="p-6 bg-gray-50 border-t border-gray-200 rounded-b-2xl">
              <p className="text-sm text-gray-600">
                <FiClock className="inline w-4 h-4 mr-1" />
                초대 링크는 7일 후 만료됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
