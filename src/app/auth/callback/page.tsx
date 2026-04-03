// src/app/auth/callback/page.tsx
// 홈페이지(catchall.ai.kr)에서 로그인 후 JWT 토큰과 함께 리다이렉트되는 콜백 페이지

'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      router.replace('/login');
      return;
    }

    // localStorage에 토큰 저장 → AuthGuard가 자동으로 JWT decode해서 Redux 복원
    localStorage.setItem('token', token);

    // 대시보드로 이동
    router.replace('/v2/dashboard');
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4" />
        <p className="text-gray-600">로그인 중...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <p className="text-gray-600">로딩 중...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
