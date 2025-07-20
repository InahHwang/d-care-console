// src/app/event-target-management/page.tsx

import { Suspense } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import EventTargetManagement from '@/components/management/EventTargetManagement'

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">이벤트타겟관리 페이지 로딩 중...</div>
    </div>
  )
}

export default function EventTargetManagementPage() {
  return (
    <AppLayout currentPage="event-target-management">
      <Suspense fallback={<LoadingFallback />}>
        <EventTargetManagement />
      </Suspense>
    </AppLayout>
  )
}