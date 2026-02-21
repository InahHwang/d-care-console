//src/components/auth/AuthGuard.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { restoreAuth, logout, initializeAuth, initializeComplete } from '@/store/slices/authSlice';
import jwt from 'jsonwebtoken';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'master' | 'staff';
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
  const publicPaths = ['/login'];
  
  // 마스터 전용 경로들
  const masterOnlyPaths = ['/admin'];

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
        // 공개 경로인 경우
        if (publicPaths.includes(pathname)) {
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
          lastLogin: decoded.lastLogin,
          clinicId: decoded.clinicId || 'default',
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

      // 특정 권한이 필요한 경우
      if (requiredRole && currentUser.role !== requiredRole) {
        return { 
          authorized: false, 
          redirect: '/unauthorized' 
        };
      }

      // 마스터 전용 경로 검사
      if (masterOnlyPaths.some(path => pathname.startsWith(path))) {
        if (currentUser.role !== 'master') {
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
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  // 🔥 공개 경로가 아니면서 인증되지 않은 경우
  if (!publicPaths.includes(pathname) && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로그인 페이지로 이동 중...</p>
        </div>
      </div>
    );
  }

  // 공개 경로이거나 인증된 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
}

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
              현재 권한: <span className="font-medium">{user.role === 'master' ? '마스터 관리자' : '일반 담당자'}</span>
            </span>
          )}
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            메인 페이지로 이동
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