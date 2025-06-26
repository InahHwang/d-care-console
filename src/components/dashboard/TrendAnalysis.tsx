// src/components/dashboard/TrendAnalysis.tsx
'use client'

import FunnelVisualization from './FunnelVisualization'
import MonthlyTrendTable from './MonthlyTrendTable'

export default function TrendAnalysis() {
  return (
    <div className="space-y-8">
      {/* 퍼널 시각화 섹션 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-primary rounded-full"></div>
          <h2 className="text-xl font-bold text-text-primary">이번달 전환 퍼널</h2>
        </div>
        <p className="text-text-secondary mb-6">
          신규 문의부터 치료 시작까지의 전환 과정을 한눈에 확인하세요. 각 단계를 클릭하면 해당 환자 목록을 볼 수 있습니다.
        </p>
        <FunnelVisualization />
      </div>

      {/* 월별 트렌드 테이블 섹션 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
          <h2 className="text-xl font-bold text-text-primary">월별 성과 트렌드</h2>
        </div>
        <p className="text-text-secondary mb-6">
          최근 6개월간의 성과 변화를 추적하고 전월 대비 증감률을 확인하세요. 이번달은 파란색으로 강조표시됩니다.
        </p>
        <MonthlyTrendTable />
      </div>

      {/* 인사이트 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-blue-800">트렌드 분석 팁</h3>
          </div>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>예약전환율이 낮다면 초기 상담 프로세스를 점검해보세요</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>내원전환율이 낮다면 예약 확정 후 리마인드 강화가 필요합니다</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>결제전환율 개선을 위해 내원 당일 상담 품질을 높여보세요</span>
            </li>
          </ul>
        </div>

        <div className="card p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-green-800">성과 개선 포인트</h3>
          </div>
          <ul className="space-y-2 text-sm text-green-700">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>전환율이 상승 추세라면 현재 전략을 유지하고 강화하세요</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>인바운드와 아웃바운드 성과를 비교해 효과적인 채널을 파악하세요</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>치료금액과 전환율을 종합적으로 고려해 목표를 수립하세요</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}