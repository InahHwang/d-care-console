// src/app/visit-management/page.tsx

'use client'

import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '@/store'
import { setCurrentMenuItem } from '@/store/slices/uiSlice'
import { fetchPatients, fetchPostVisitPatients } from '@/store/slices/patientsSlice'
import VisitManagement from '@/components/management/VisitManagement'
import AppLayout from '@/components/layout/AppLayout'

export default function VisitManagementPage() {
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    // 메뉴 아이템 설정
    dispatch(setCurrentMenuItem('내원 관리'))
    
    // 필요한 데이터 로드
    dispatch(fetchPatients())
    dispatch(fetchPostVisitPatients())
  }, [dispatch])

  return (
    <AppLayout>
      <VisitManagement />
    </AppLayout>
  )
}