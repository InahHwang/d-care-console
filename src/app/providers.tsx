'use client'

import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { store } from '@/store'
import PatientFormModal from '@/components/management/PatientFormModal'
import DeleteConfirmModal from '@/components/management/DeleteConfirmModal'

export function Providers({ children }: { children: React.ReactNode }) {
  // React Query 클라이언트 생성
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5분
        gcTime: 10 * 60 * 1000, // 10분
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
        <PatientFormModal />
        <DeleteConfirmModal />
      </QueryClientProvider>
    </Provider>
  )
}