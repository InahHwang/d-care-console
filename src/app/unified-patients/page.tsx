// src/app/unified-patients/page.tsx
// 통합 환자관리 페이지 (퍼널 기반)

'use client'

import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '@/store'
import { setCurrentMenuItem } from '@/store/slices/uiSlice'
import UnifiedPatientManagement from '@/components/management/UnifiedPatientManagement'
import AppLayout from '@/components/layout/AppLayout'

export default function UnifiedPatientsPage() {
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    dispatch(setCurrentMenuItem('통합 환자관리'))
  }, [dispatch])

  return (
    <AppLayout>
      <UnifiedPatientManagement />
    </AppLayout>
  )
}
