//src/components/auth/AuthGuard.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { restoreAuth, logout, initializeAuth, initializeComplete } from '@/store/slices/authSlice';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@/types/invitation';

// 역할 타입 (master는 레거시, admin으로 취급)
type AuthRole = UserRole | 'master';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: AuthRole | AuthRole[];  // 단일 역할 또는 역할 배열
  fallbackPath?: string;
}

export default function AuthGuard({ 
  children, 
  requiredRole,
  fallbackPath = '/login' 
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, user, isInitialized } = useAppSelector((state) => state.auth);

  // 보호되지 않는 경로들 (로그인 없이 접근 가능)
  const publicPaths = ['/login', '/invite', '/auth/callback'];

  // 관리자 전용 경로들 (admin 또는 master만 접근 가능)
  const adminOnlyPaths = ['/admin'];

  // 역할 정규화 함수 (master → admin)
  const normalizeRole = (role: string): UserRole => {
    if (role === 'master') return 'admin';
    return role as UserRole;
  };

  // 관리자 역할인지 확인 (admin 또는 master)
  const isAdminRole = (role: string): boolean => {
    return role === 'admin' || role === 'master';
  };

  useEffect(() => {
    const initializeAuthState = async () => {
      console.log('🔥 AuthGuard: 인증 초기화 시작');
      
      // 이미 초기화되었다면 건너뛰기
      if (isInitialized) {
        console.log('🔥 AuthGuard: 이미 초기화됨, 건너뛰기');
        return;
      }

      // 초기화 시작
      dispatch(initializeAuth());

      try {
        // 공개 경로인 경우 (정확히 일치하거나 하위 경로)
        if (publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))) {
          console.log('🔥 AuthGuard: 공개 경로 접근');
          dispatch(initializeComplete());
          return;
        }

        const token = localStorage.getItem('token');
        
        if (!token) {
          console.log('🔥 AuthGuard: 토큰 없음, 로그인 페이지로 이동');
          dispatch(initializeComplete());
          router.push(fallbackPath);
          return;
        }

        // 토큰 유효성 검사
        const decoded = jwt.decode(token) as any;
        
        if (!decoded) {
          console.log('🔥 AuthGuard: 토큰 디코딩 실패');
          localStorage.removeItem('token');
          dispatch(initializeComplete());
          router.push(fallbackPath);
          return;
        }

        // 토큰 만료 확인
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          console.log('🔥 AuthGuard: 토큰 만료됨');
          localStorage.removeItem('token');
          dispatch(initializeComplete());
          router.push(fallbackPath);
          return;
        }

        // 🔥 사용자 정보 복원 - 더 안전한 방식
        const restoredUser = {
          _id: decoded._id || decoded.id || 'unknown',
          id: decoded.id || decoded._id || 'unknown',
          email: decoded.email || '',
          username: decoded.username || decoded.email?.split('@')[0] || '',
          name: decoded.name || decoded.username || decoded.email?.split('@')[0] || 'Unknown User',
          role: decoded.role || 'staff',
          isActive: decoded.isActive !== undefined ? decoded.isActive : true,
          createdAt: decoded.createdAt || new Date().toISOString(),
          updatedAt: decoded.updatedAt || new Date().toISOString(),
          lastLogin: decoded.lastLogin
        };

        console.log('🔥 AuthGuard: 사용자 정보 복원:', {
          userId: restoredUser._id,
          userName: restoredUser.name,
          userRole: restoredUser.role
        });

        // 권한 검사
        const authResult = checkAuthorization(restoredUser);
        if (!authResult.authorized) {
          console.log('🔥 AuthGuard: 권한 검사 실패:', authResult.redirect);
          if (authResult.redirect) {
            router.push(authResult.redirect);
          }
          dispatch(initializeComplete());
          return;
        }

        // 🔥 Redux 상태 복원
        dispatch(restoreAuth({ user: restoredUser, token }));
        console.log('🔥 AuthGuard: 인증 상태 복원 완료');

      } catch (error) {
        console.error('🔥 AuthGuard: 인증 초기화 오류:', error);
        localStorage.removeItem('token');
        dispatch(initializeComplete());
        router.push(fallbackPath);
      }
    };

    const checkAuthorization = (currentUser: any) => {
      // 비활성 사용자 검사
      if (currentUser.isActive === false) {
        dispatch(logout());
        localStorage.removeItem('token');
        return {
          authorized: false,
          redirect: '/login?message=account_deactivated'
        };
      }

      const userRole = normalizeRole(currentUser.role);

      // 특정 권한이 필요한 경우
      if (requiredRole) {
        const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        const normalizedRequiredRoles = requiredRoles.map(r => normalizeRole(r));

        if (!normalizedRequiredRoles.includes(userRole)) {
          // admin이 필요한데 master로 접근해도 허용
          const hasAdminAccess = normalizedRequiredRoles.includes('admin') && isAdminRole(currentUser.role);
          if (!hasAdminAccess) {
            return {
              authorized: false,
              redirect: '/unauthorized'
            };
          }
        }
      }

      // 관리자 전용 경로 검사 (admin 또는 master만 접근 가능)
      if (adminOnlyPaths.some(path => pathname.startsWith(path))) {
        if (!isAdminRole(currentUser.role)) {
          return {
            authorized: false,
            redirect: '/'
          };
        }
      }

      return { authorized: true };
    };

    // 🔥 초기화되지 않았을 때만 실행
    if (!isInitialized) {
      initializeAuthState();
    } else if (isAuthenticated && user) {
      // 이미 인증된 사용자의 권한 재검사
      const authResult = checkAuthorization(user);
      if (!authResult.authorized && authResult.redirect) {
        router.push(authResult.redirect);
        return;
      }
    }
  }, [isInitialized, pathname, dispatch, router, fallbackPath, requiredRole, isAuthenticated, user]);

  // 🔥 초기화 중이거나 인증되지 않은 경우 로딩 표시
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  // 🔥 공개 경로가 아니면서 인증되지 않은 경우
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
  if (!isPublicPath && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로그인 페이지로 이동 중...</p>
        </div>
      </div>
    );
  }

  // 공개 경로이거나 인증된 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
}

// 역할 표시 헬퍼 함수
const getRoleLabel = (role: string): string => {
  const roleLabels: Record<string, string> = {
    admin: '관리자',
    master: '관리자',
    manager: '매니저',
    staff: '상담사',
  };
  return roleLabels[role] || role;
};

// 권한 없음 페이지 컴포넌트
export function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.598 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h1>
        <p className="text-gray-600 mb-6">
          이 페이지에 접근하기 위한 권한이 부족합니다.
          {user && (
            <span className="block mt-2 text-sm">
              현재 권한: <span className="font-medium">{getRoleLabel(user.role)}</span>
            </span>
          )}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
          >
            대시보드로 이동
          </button>
          <button
            onClick={() => router.back()}
            className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
          >
            이전 페이지로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}