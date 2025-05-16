import AppLayout from '@/components/layout/AppLayout'

export default function StatisticsPage() {
  return (
    <AppLayout currentPage="statistics">
      <div className="card p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">통계 분석</h2>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-medium text-text-primary">통계 분석 기능 준비 중</h3>
            <p className="mt-2 text-text-secondary">
              이 기능은 개발 중입니다. 곧 이용 가능합니다.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}