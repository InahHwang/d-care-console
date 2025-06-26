// src/components/common/DataPrefetcher.tsx
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppDispatch } from '@/hooks/reduxHooks'
import { fetchPatients } from '@/store/slices/patientsSlice'

export default function DataPrefetcher({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()

  useEffect(() => {
    // 🚀 앱 시작과 동시에 핵심 데이터를 병렬로 prefetch
    const prefetchData = async () => {
      console.log('🚀 데이터 prefetching 시작')
      
      try {
        // 🚀 환자 데이터만 우선 prefetch (가장 중요)
        await queryClient.prefetchQuery({
          queryKey: ['patients'],
          queryFn: () => dispatch(fetchPatients()).unwrap(),
          staleTime: 5 * 60 * 1000, // 5분
        })
        
        console.log('🚀 환자 데이터 prefetching 완료')
      } catch (error) {
        console.warn('데이터 prefetching 실패:', error)
      }
    }

    // 약간의 지연 후 prefetch (초기 렌더링 우선)
    const timer = setTimeout(prefetchData, 100)
    
    return () => clearTimeout(timer)
  }, [queryClient, dispatch])

  return <>{children}</>
}