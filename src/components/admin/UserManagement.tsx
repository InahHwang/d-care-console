// src/components/admin/UserManagement.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { fetchUsers, deleteUser, createUser, updateUser, clearError } from '@/store/slices/usersSlice';
import { logActivity } from '@/utils/activityLogger';
import { User } from '@/types/user';
import type { UserRole } from '@/types/invitation';
import {
  HiOutlineUserAdd,
  HiOutlineUser,
  HiOutlineShieldCheck,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineX
} from 'react-icons/hi';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 역할 타입 (master는 레거시, admin으로 취급)
type FormRole = UserRole | 'master';

interface UserFormData {
  username: string;
  email: string;
  name: string;
  password: string;
  role: FormRole;
  isActive: boolean;
}

export default function UserManagement() {
  // Redux 상태 사용
  const dispatch = useAppDispatch();
  const { users, isLoading, error, totalUsers } = useAppSelector(state => state.users);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    name: '',
    password: '',
    role: 'staff',
    isActive: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Redux 액션으로 사용자 목록 조회
    dispatch(fetchUsers({}));
  }, [dispatch]);

  // 에러 표시 (Redux 에러 상태 사용)
  useEffect(() => {
    if (error) {
      console.error('Users error:', error);
      // 에러를 사용자에게 표시하거나 처리
      // 필요하다면 toast 알림 등으로 변경 가능
    }
  }, [error]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // 기존 에러 클리어
    dispatch(clearError());

    try {
      // Redux 액션 사용
      const resultAction = await dispatch(createUser(formData));
      
      if (createUser.fulfilled.match(resultAction)) {
        // 활동 로그 기록
        await logActivity(
          'user_create',
          'user',
          resultAction.payload.user.id,
          resultAction.payload.user.name,
          {
            userName: resultAction.payload.user.username,
            userRole: resultAction.payload.user.role,
            notes: `새 사용자 계정 생성: ${resultAction.payload.user.name} (${resultAction.payload.user.role})`
          }
        );

        setShowCreateModal(false);
        resetForm();
        alert('사용자가 성공적으로 생성되었습니다.');
      } else {
        alert(resultAction.payload || '사용자 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      alert('사용자 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    
    // 기존 에러 클리어
    dispatch(clearError());

    try {
      const { password, ...updateData } = formData;
      const requestData = password ? formData : updateData;

      // Redux 액션 사용
      const resultAction = await dispatch(updateUser({
        userId: editingUser._id || editingUser.id!,
        userData: requestData
      }));

      if (updateUser.fulfilled.match(resultAction)) {
        // 활동 로그 기록
        await logActivity(
          'user_update',
          'user',
          resultAction.payload.user.id,
          resultAction.payload.user.name,
          {
            userName: resultAction.payload.user.username,
            userRole: resultAction.payload.user.role,
            notes: `사용자 정보 수정: ${resultAction.payload.user.name}`
          }
        );

        setShowEditModal(false);
        setEditingUser(null);
        resetForm();
        alert('사용자 정보가 성공적으로 업데이트되었습니다.');
      } else {
        alert(resultAction.payload || '사용자 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('사용자 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const userToDelete = users.find(u => u._id === userId);
      if (!userToDelete) return;

      // 기존 에러 클리어
      dispatch(clearError());

      // Redux 액션 사용
      const resultAction = await dispatch(deleteUser(userId));

      if (deleteUser.fulfilled.match(resultAction)) {
        // 활동 로그 기록
        await logActivity(
          'user_delete',
          'user',
          userId,
          userToDelete.name,
          {
            userName: userToDelete.username,
            userRole: userToDelete.role,
            notes: `사용자 계정 삭제: ${userToDelete.name}`
          }
        );

        setShowDeleteConfirm(null);
        alert('사용자가 성공적으로 삭제되었습니다.');
      } else {
        alert(resultAction.payload || '사용자 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('사용자 삭제 중 오류가 발생했습니다.');
    }
  };

  const openEditModal = (user: User) => {
    const userId = user._id || user.id; // _id 또는 id 중 하나라도 있으면
    if (!userId) return; // 둘 다 없으면 수정 불가
    
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      isActive: user.isActive
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      name: '',
      password: '',
      role: 'staff',
      isActive: true
    });
    setShowPassword(false);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingUser(null);
    resetForm();
    // 에러도 클리어
    dispatch(clearError());
  };

  // 삭제 확인 함수 - null 체크 추가
  const handleDeleteConfirm = (userId: string | null) => {
    if (userId) {
      handleDeleteUser(userId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-600">사용자 목록을 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 에러 메시지 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
          <button
            onClick={() => dispatch(clearError())}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <HiOutlineX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">사용자 관리</h2>
          <p className="text-gray-600 mt-1">시스템에 등록된 모든 사용자를 관리합니다. (총 {totalUsers}명)</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <HiOutlineUserAdd className="w-4 h-4 mr-2" />
          새 사용자 추가
        </button>
      </div>

      {/* 사용자 목록 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사용자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  아이디
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  권한
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  가입일
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    등록된 사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          user.role === 'master' ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          {user.role === 'master' ? (
                            <HiOutlineShieldCheck className={`w-5 h-5 ${
                              user.role === 'master' ? 'text-red-600' : 'text-blue-600'
                            }`} />
                          ) : (
                            <HiOutlineUser className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {user.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'master' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role === 'master' ? '마스터 관리자' : '일반 담당자'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {format(new Date(user.createdAt), 'yyyy.MM.dd', { locale: ko })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-blue-600 hover:text-blue-800"
                          title="수정"
                        >
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        {user.role !== 'master' && (user._id || user.id) && (
                          <button
                            onClick={() => setShowDeleteConfirm(user._id || user.id!)}
                            className="text-red-600 hover:text-red-800"
                            title="삭제"
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 사용자 생성/수정 모달 */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {showCreateModal ? '새 사용자 추가' : '사용자 정보 수정'}
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600"
              >
                <HiOutlineX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={showCreateModal ? handleCreateUser : handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  아이디
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {showEditModal ? '새 비밀번호 (변경 시에만 입력)' : '비밀번호'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required={showCreateModal}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <HiOutlineEyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <HiOutlineEye className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  권한
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as 'master' | 'staff'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="staff">일반 담당자</option>
                  <option value="master">마스터 관리자</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                  계정 활성화
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    isSubmitting 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isSubmitting ? '처리 중...' : (showCreateModal ? '생성' : '수정')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              사용자 삭제 확인
            </h3>
            <p className="text-gray-600 mb-6">
              정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}