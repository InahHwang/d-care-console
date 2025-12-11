// src/app/visit-management/page.tsx

'use client'

import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '@/store'
import { setCurrentMenuItem } from '@/store/slices/uiSlice'
import { fetchPostVisitPatients } from '@/store/slices/patientsSlice'
import VisitManagement from '@/components/management/VisitManagement'
import AppLayout from '@/components/layout/AppLayout'

export default function VisitManagementPage() {
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    // 메뉴 아이템 설정
    dispatch(setCurrentMenuItem('내원 관리'))

    // 🔥 성능 최적화: 내원확정 환자만 로드 (전체 환자 로드 제거)
    // fetchPatients() 제거 - 불필요한 전체 환자 로딩 방지
    dispatch(fetchPostVisitPatients())
  }, [dispatch])

  return (
    <AppLayout>
      <VisitManagement />
    </AppLayout>
  )
}