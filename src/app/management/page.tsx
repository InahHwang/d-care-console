import { Suspense } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PatientManagement from '@/components/management/PatientManagement'

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">환자 관리 페이지 로딩 중...</div>
    </div>
  )
}

export default function ManagementPage() {
  return (
    <AppLayout currentPage="management">
      <Suspense fallback={<LoadingFallback />}>
        <PatientManagement />
      </Suspense>
    </AppLayout>
  )
}