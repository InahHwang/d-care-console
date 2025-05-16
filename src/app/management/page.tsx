//src/app/management/page.tsx

import AppLayout from '@/components/layout/AppLayout'
import PatientManagement from '@/components/management/PatientManagement'

export default function ManagementPage() {
  return (
    <AppLayout currentPage="management">
      <PatientManagement />
    </AppLayout>
  )
}