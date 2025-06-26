// src/components/dashboard/MonthlyTrendTable.tsx
'use client'

import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { useMemo } from 'react'

interface MonthlyData {
  month: string
  year: number
  monthNum: number
  totalInquiries: number
  inboundCount: number
  outboundCount: number
  reservationRate: number
  visitRate: number
  treatmentRate: number
  treatmentAmount: number
  reservationCount: number
  visitCount: number
  treatmentCount: number
}

export default function MonthlyTrendTable() {
  const { patients } = useSelector((state: RootState) => state.patients)

  // 최근 6개월 데이터 계산
  const monthlyTrends = useMemo(() => {
    const now = new Date()
    const trends: MonthlyData[] = []

    // 최근 6개월 생성
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = targetDate.getFullYear()
      const monthNum = targetDate.getMonth() + 1
      const month = `${year}-${String(monthNum).padStart(2, '0')}`
      
      // 해당 월의 첫날과 마지막날
      const firstDay = `${year}-${String(monthNum).padStart(2, '0')}-01`
      const lastDay = new Date(year, monthNum, 0)
      const lastDayStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
      
      // 해당 월 환자들 필터링
      const monthPatients = patients.filter(patient => {
        const callInDate = patient.callInDate
        return callInDate >= firstDay && callInDate <= lastDayStr
      })

      // 각 단계별 환자 수 계산
      const reservedPatients = monthPatients.filter(p => p.status === '예약확정')
      const visitedPatients = monthPatients.filter(p => p.visitConfirmed === true)
      const treatmentStartedPatients = monthPatients.filter(p => p.postVisitStatus === '치료시작')
      
      // 인바운드/아웃바운드 구분
      const inboundPatients = monthPatients.filter(p => p.consultationType === 'inbound')
      const outboundPatients = monthPatients.filter(p => p.consultationType === 'outbound')
      
      // 전환율 계산
      const reservationRate = monthPatients.length > 0 ? (reservedPatients.length / monthPatients.length) * 100 : 0
      const visitRate = monthPatients.length > 0 ? (visitedPatients.length / monthPatients.length) * 100 : 0
      const treatmentRate = monthPatients.length > 0 ? (treatmentStartedPatients.length / monthPatients.length) * 100 : 0
      
      // 치료금액 합계 - 🔧 수정: Patient 타입의 실제 필드 사용
      const treatmentAmount = treatmentStartedPatients.reduce((sum, patient) => {
        // consultation.estimatedAmount 또는 postVisitConsultation.estimateInfo.discountPrice 사용
        const amount = patient.postVisitConsultation?.estimateInfo?.discountPrice || 
                       patient.consultation?.estimatedAmount || 0;
        return sum + amount;
      }, 0)

      trends.push({
        month,
        year,
        monthNum,
        totalInquiries: monthPatients.length,
        inboundCount: inboundPatients.length,
        outboundCount: outboundPatients.length,
        reservationRate: Math.round(reservationRate * 10) / 10,
        visitRate: Math.round(visitRate * 10) / 10,
        treatmentRate: Math.round(treatmentRate * 10) / 10,
        treatmentAmount,
        reservationCount: reservedPatients.length,
        visitCount: visitedPatients.length,
        treatmentCount: treatmentStartedPatients.length
      })
    }

    return trends
  }, [patients])

  // 증감 표시 컴포넌트
  const TrendIndicator = ({ current, previous, isPercentage = false, isAmount = false }: {
    current: number
    previous: number
    isPercentage?: boolean
    isAmount?: boolean
  }) => {
    if (previous === 0 && current === 0) return <span className="text-gray-400">-</span>
    if (previous === 0) return <span className="text-green-600">신규</span>
    
    const change = current - previous
    const isPositive = change > 0
    
    let displayChange = ''
    if (isAmount) {
      displayChange = `${isPositive ? '+' : ''}${change.toLocaleString()}원`
    } else if (isPercentage) {
      displayChange = `${isPositive ? '+' : ''}${change.toFixed(1)}%p`
    } else {
      displayChange = `${isPositive ? '+' : ''}${change}`
    }
    
    return (
      <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {displayChange}
      </span>
    )
  }

  // 월 표시 형식 변환
  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-')
    return `${year}년 ${parseInt(monthNum)}월`
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-text-primary">최근 6개월 트렌드</h3>
        <div className="text-sm text-text-secondary">
          전월 대비 증감률 표시
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-2 font-semibold text-text-primary">기간</th>
              <th className="text-center py-3 px-2 font-semibold text-text-primary">신규문의</th>
              <th className="text-center py-3 px-2 font-semibold text-text-primary">예약전환율</th>
              <th className="text-center py-3 px-2 font-semibold text-text-primary">내원전환율</th>
              <th className="text-center py-3 px-2 font-semibold text-text-primary">결제전환율</th>
              <th className="text-center py-3 px-2 font-semibold text-text-primary">치료금액</th>
            </tr>
          </thead>
          <tbody>
            {monthlyTrends.map((trend, index) => {
              const prevTrend = index > 0 ? monthlyTrends[index - 1] : null
              const isCurrentMonth = index === monthlyTrends.length - 1
              
              return (
                <tr 
                  key={trend.month} 
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200 ${
                    isCurrentMonth ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  {/* 기간 */}
                  <td className="py-4 px-2">
                    <div className="flex flex-col">
                      <span className={`font-medium ${isCurrentMonth ? 'text-blue-700' : 'text-text-primary'}`}>
                        {formatMonth(trend.month)}
                      </span>
                      {isCurrentMonth && (
                        <span className="text-xs text-blue-600 font-medium">이번달</span>
                      )}
                    </div>
                  </td>

                  {/* 신규문의 */}
                  <td className="py-4 px-2 text-center">
                    <div className="flex flex-col items-center space-y-1">
                      <span className="font-semibold text-text-primary">{trend.totalInquiries}건</span>
                      <div className="text-xs text-gray-500">
                        인바운드 {trend.inboundCount}건 | 아웃바운드 {trend.outboundCount}건
                      </div>
                      {prevTrend && (
                        <TrendIndicator 
                          current={trend.totalInquiries} 
                          previous={prevTrend.totalInquiries} 
                        />
                      )}
                    </div>
                  </td>

                  {/* 예약전환율 */}
                  <td className="py-4 px-2 text-center">
                    <div className="flex flex-col items-center space-y-1">
                      <span className="font-semibold text-text-primary">{trend.reservationRate}%</span>
                      <span className="text-xs text-gray-500">({trend.reservationCount}명)</span>
                      {prevTrend && (
                        <TrendIndicator 
                          current={trend.reservationRate} 
                          previous={prevTrend.reservationRate} 
                          isPercentage 
                        />
                      )}
                    </div>
                  </td>

                  {/* 내원전환율 */}
                  <td className="py-4 px-2 text-center">
                    <div className="flex flex-col items-center space-y-1">
                      <span className="font-semibold text-text-primary">{trend.visitRate}%</span>
                      <span className="text-xs text-gray-500">({trend.visitCount}명)</span>
                      {prevTrend && (
                        <TrendIndicator 
                          current={trend.visitRate} 
                          previous={prevTrend.visitRate} 
                          isPercentage 
                        />
                      )}
                    </div>
                  </td>

                  {/* 결제전환율 */}
                  <td className="py-4 px-2 text-center">
                    <div className="flex flex-col items-center space-y-1">
                      <span className="font-semibold text-text-primary">{trend.treatmentRate}%</span>
                      <span className="text-xs text-gray-500">({trend.treatmentCount}명)</span>
                      {prevTrend && (
                        <TrendIndicator 
                          current={trend.treatmentRate} 
                          previous={prevTrend.treatmentRate} 
                          isPercentage 
                        />
                      )}
                    </div>
                  </td>

                  {/* 치료금액 */}
                  <td className="py-4 px-2 text-center">
                    <div className="flex flex-col items-center space-y-1">
                      <span className="font-semibold text-text-primary">
                        {trend.treatmentAmount.toLocaleString()}원
                      </span>
                      {trend.treatmentCount > 0 && (
                        <span className="text-xs text-gray-500">
                          평균 {Math.round(trend.treatmentAmount / trend.treatmentCount).toLocaleString()}원
                        </span>
                      )}
                      {prevTrend && (
                        <TrendIndicator 
                          current={trend.treatmentAmount} 
                          previous={prevTrend.treatmentAmount} 
                          isAmount 
                        />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 요약 통계 */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-sm text-text-secondary mb-1">6개월 평균 예약전환율</div>
            <div className="text-lg font-bold text-text-primary">
              {monthlyTrends.length > 0
                ? Math.round((monthlyTrends.reduce((sum, t) => sum + t.reservationRate, 0) / monthlyTrends.length) * 10) / 10
                : 0
              }%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-text-secondary mb-1">6개월 평균 내원전환율</div>
            <div className="text-lg font-bold text-text-primary">
              {monthlyTrends.length > 0
                ? Math.round((monthlyTrends.reduce((sum, t) => sum + t.visitRate, 0) / monthlyTrends.length) * 10) / 10
                : 0
              }%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-text-secondary mb-1">6개월 평균 결제전환율</div>
            <div className="text-lg font-bold text-text-primary">
              {monthlyTrends.length > 0
                ? Math.round((monthlyTrends.reduce((sum, t) => sum + t.treatmentRate, 0) / monthlyTrends.length) * 10) / 10
                : 0
              }%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-text-secondary mb-1">6개월 총 치료금액</div>
            <div className="text-lg font-bold text-text-primary">
              {monthlyTrends.reduce((sum, t) => sum + t.treatmentAmount, 0).toLocaleString()}원
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}