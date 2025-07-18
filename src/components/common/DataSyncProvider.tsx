// src/components/common/DataSyncProvider.tsx
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppSelector, useAppDispatch } from '@/hooks/reduxHooks'
import { fetchPatients } from '@/store/slices/patientsSlice'

export default function DataSyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const reduxPatients = useAppSelector(state => state.patients.patients)

  // 🚀 Redux 상태가 변경되면 React Query 캐시도 업데이트
  useEffect(() => {
    if (reduxPatients && reduxPatients.length > 0) {
      const queryData = queryClient.getQueryData(['patients']) as any
      
      // React Query 데이터와 Redux 데이터가 다르면 동기화
      if (queryData) {
        const currentPatients = queryData?.patients || queryData
        
        if (Array.isArray(currentPatients) && currentPatients.length !== reduxPatients.length) {
          console.log('🔄 Redux → React Query 동기화:', reduxPatients.length, '명')
          
          queryClient.setQueryData(['patients'], {
            patients: reduxPatients,
            totalItems: reduxPatients.length
          })
        }
      }
    }
  }, [reduxPatients, queryClient])

  // 🚀 React Query 데이터가 변경되면 Redux도 업데이트
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query?.queryKey?.[0] === 'patients' && event.type === 'updated') {
        const newData = event.query.state.data as any
        
        if (newData?.patients && Array.isArray(newData.patients)) {
          const currentReduxCount = reduxPatients.length
          const newCount = newData.patients.length
          
          if (currentReduxCount !== newCount) {
            console.log('🔄 React Query → Redux 동기화 필요:', newCount, '명')
            
            // Redux 상태가 뒤처져 있으면 새로고침
            setTimeout(() => {
              dispatch(fetchPatients())
            }, 100)
          }
        }
      }
    })

    return unsubscribe
  }, [queryClient, reduxPatients.length, dispatch])

  return <>{children}</>
}