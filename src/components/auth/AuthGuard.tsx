//src/components/auth/AuthGuard.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { restoreAuth } from '@/store/slices/authSlice';
import jwt from 'jsonwebtoken';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          setIsInitialized(true);
          router.push('/login');
          return;
        }

        // 토큰 유효성 검사
        const decoded = jwt.decode(token) as any;
        
        if (!decoded) {
          localStorage.removeItem('token');
          setIsInitialized(true);
          router.push('/login');
          return;
        }

        // 토큰 만료 확인
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          localStorage.removeItem('token');
          setIsInitialized(true);
          router.push('/login');
          return;
        }

        // 사용자 정보 복원
        const user = {
          id: decoded.id,
          email: decoded.email,
          name: decoded.name || decoded.email.split('@')[0],
          role: decoded.role || 'user'
        };

        dispatch(restoreAuth({ user, token }));
        setIsInitialized(true);

      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('token');
        setIsInitialized(true);
        router.push('/login');
      }
    };

    if (!isAuthenticated && !isLoading) {
      initializeAuth();
    } else {
      setIsInitialized(true);
    }
  }, [isAuthenticated, isLoading, dispatch, router]);

  // 초기화 중이거나 인증되지 않은 경우 로딩 표시
  if (!isInitialized || (!isAuthenticated && !isLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  // 인증된 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
}