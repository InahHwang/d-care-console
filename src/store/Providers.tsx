'use client';

import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './index';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  // 🚀 React Query 클라이언트 설정 (Optimistic Update 최적화)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5분간 fresh 유지
        gcTime: 10 * 60 * 1000, // 10분간 캐시 유지
        refetchOnWindowFocus: false, // 창 포커스시 자동 refetch 방지
        retry: 1, // 실패시 1번만 재시도
      },
      mutations: {
        retry: 1, // 뮤테이션 실패시 1번만 재시도
        onError: (error) => {
          console.error('Mutation failed:', error);
        },
      },
    },
  }));

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </Provider>
  );
}