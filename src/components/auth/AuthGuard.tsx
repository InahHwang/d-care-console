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
      // 이미 초기화되었다면 건너뛰기
      if (isInitialized) return;

      // 초기화 시작
      dispatch(initializeAuth());

      try {
        // 공개 경로인 경우
        if (publicPaths.includes(pathname)) {
          dispatch(initializeComplete());
          return;
        }

        // 1차: /api/auth/me (쿠키 기반)
        let authenticated = false;
        try {
          const res = await fetch('/api/auth/me', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              const restoredUser = {
                _id: data.user.id, id: data.user.id,
                email: data.user.email || '', username: data.user.username || '',
                name: data.user.name || 'Unknown User', role: data.user.role || 'staff',
                isActive: true, createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(), clinicId: data.user.clinicId || 'default',
              };
              const authResult = checkAuthorization(restoredUser);
              if (!authResult.authorized) {
                if (authResult.redirect) router.push(authResult.redirect);
                dispatch(initializeComplete());
                return;
              }
              dispatch(restoreAuth({ user: restoredUser, token: 'cookie-based' }));
              authenticated = true;
            }
          }
        } catch { /* 쿠키 인증 실패 → localStorage 폴백 */ }

        // 2차: localStorage 폴백 (쿠키 전환 완료 시 제거 예정)
        if (!authenticated) {
          let token = localStorage.getItem('token');
          if (!token) {
            dispatch(initializeComplete());
            router.push(fallbackPath);
            return;
          }

          let decoded = jwt.decode(token) as any;
          if (!decoded) {
            localStorage.removeItem('token');
            dispatch(initializeComplete());
            router.push(fallbackPath);
            return;
          }

          // 토큰 만료 → refresh 시도
          const currentTime = Date.now() / 1000;
          if (decoded.exp < currentTime) {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              try {
                const res = await fetch('/api/auth/refresh', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ refreshToken }),
                });
                const data = await res.json();
                if (res.ok && data.success && data.token) {
                  localStorage.setItem('token', data.token);
                  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                  token = data.token;
                  decoded = jwt.decode(token!) as any;
                } else { throw new Error('Refresh failed'); }
              } catch {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                dispatch(initializeComplete());
                router.push(fallbackPath);
                return;
              }
            } else {
              localStorage.removeItem('token');
              dispatch(initializeComplete());
              router.push(fallbackPath);
              return;
            }
          }

          const restoredUser = {
            _id: decoded.id || 'unknown', id: decoded.id || 'unknown',
            email: decoded.email || '', username: decoded.username || '',
            name: decoded.name || 'Unknown User', role: decoded.role || 'staff',
            isActive: true, createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(), clinicId: decoded.clinicId || 'default',
          };
          const authResult = checkAuthorization(restoredUser);
          if (!authResult.authorized) {
            if (authResult.redirect) router.push(authResult.redirect);
            dispatch(initializeComplete());
            return;
          }
          const storedRefreshToken = localStorage.getItem('refreshToken') || undefined;
          dispatch(restoreAuth({ user: restoredUser, token: token!, refreshToken: storedRefreshToken }));
        }

      } catch (error) {
        console.error('AuthGuard: 인증 초기화 오류:', error);
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