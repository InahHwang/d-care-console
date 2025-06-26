// src/components/dashboard/MetricsTabs.tsx - 완전한 버전 (3개 탭)

'use client'

import { useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { IconType } from 'react-icons'
import { 
  HiOutlineCalendar, 
  HiOutlineCheck, 
  HiOutlineUsers,
  HiOutlineClock
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import PatientListModal from './PatientListModal'
import { PatientFilterType } from '@/store/slices/patientsSlice'

interface SummaryCardProps {
  title: string
  value: number
  suffix?: string
  icon: IconType
  progressValue: number
  progressColor: string
  isLoading?: boolean
  subtitle?: string
  onClick?: () => void
  isClickable?: boolean
  changeValue?: number
  changeType?: 'count' | 'percentage_point' | 'amount'
  inboundChange?: number
  outboundChange?: number
}

interface MetricsTabsProps {
  monthlyStats: any  // 기존 monthlyStats 타입 그대로 사용
  isLoading?: boolean
}

type TabType = 'monthly' | 'total' | 'comparison'

const SummaryCard = ({
  title,
  value,
  suffix = '건',
  icon,
  progressValue,
  progressColor,
  isLoading = false,
  subtitle,
  onClick,
  isClickable = false,
  changeValue,
  changeType = 'count',
  inboundChange,
  outboundChange
}: SummaryCardProps) => {
  
  const getInOutChangeText = () => {
    if (inboundChange === undefined || outboundChange === undefined) return '';
    
    const inText = inboundChange >= 0 ? `+${inboundChange}` : `${inboundChange}`;
    const outText = outboundChange >= 0 ? `+${outboundChange}` : `${outboundChange}`;
    
    return `인바운드 ${inText}건, 아웃바운드 ${outText}건`;
  };

  return (
    <div 
      className={`card p-5 transition-all duration-200 ${
        isClickable 
          ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary' 
          : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-text-secondary text-sm">
        <Icon icon={icon} size={16} className="text-text-secondary" />
        <span>{title}</span>
        {isClickable && (
          <span className="ml-auto text-xs text-primary">클릭하여 보기</span>
        )}
        {changeValue !== undefined && (
          <div className="ml-auto">
            <ChangeBadge value={changeValue} type={changeType} size="small" />
          </div>
        )}
      </div>
      
      {subtitle && (
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      )}
      
      <div className="mt-4 flex items-baseline">
        <span className="text-2xl font-bold text-text-primary">
          {isLoading ? '...' : value}
        </span>
        <span className="ml-1 text-text-secondary">{suffix}</span>
      </div>
      
      {inboundChange !== undefined && outboundChange !== undefined && (
        <div className="mt-2">
          <div className="text-xs text-gray-500">
            {getInOutChangeText()}
          </div>
        </div>
      )}
      
      <div className="mt-4 flex items-center gap-1.5">
        <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${progressColor}`}
            style={{ width: `${progressValue}%` }}
          ></div>
        </div>
      </div>
    </div>
  )
}

const ChangeBadge: React.FC<{ 
  value: number; 
  type: 'count' | 'percentage_point' | 'amount';
  size?: 'normal' | 'small' 
}> = ({ value, type, size = 'normal' }) => {
  const isPositive = value >= 0;
  const absValue = Math.abs(value);
  
  const sizeClasses = size === 'small' 
    ? 'px-2 py-1 text-xs' 
    : 'px-2.5 py-1 text-xs';
  
  const iconSize = size === 'small' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  
  const getText = () => {
    switch (type) {
      case 'count':
        return `전월 대비 ${absValue}건 ${isPositive ? '증가' : '감소'}`;
      case 'percentage_point':
        return `전월 대비 ${absValue.toFixed(1)}%p ${isPositive ? '증가' : '감소'}`;
      case 'amount':
        return `전월 대비 ${absValue.toLocaleString()}원 ${isPositive ? '증가' : '감소'}`;
      default:
        return '';
    }
  };
  
  return (
    <div className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${
      isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={`${iconSize} mr-1.5`}
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d={isPositive 
            ? "M5 15l7-7 7 7" 
            : "M19 9l-7 7-7-7"
          } 
        />
      </svg>
      {getText()}
    </div>
  );
};

export default function MetricsTabs({ monthlyStats, isLoading = false }: MetricsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('monthly')
  const { patients } = useSelector((state: RootState) => state.patients)
  
  // 모달 상태 관리
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    filterType: PatientFilterType | null
    title: string
  }>({
    isOpen: false,
    filterType: null,
    title: ''
  })
  
  const handleOpenModal = (filterType: PatientFilterType, title: string) => {
    setModalState({
      isOpen: true,
      filterType,
      title
    })
  }
  
  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      filterType: null,
      title: ''
    })
  }

  // 전체 누적 통계 계산 (간단하게)
  const getTotalStats = () => {
    const totalPatients = patients.length
    const reservedCount = patients.filter(p => p.status === '예약확정').length
    const visitedCount = patients.filter(p => p.visitConfirmed === true).length
    const treatmentStartedCount = patients.filter(p => 
      p.visitConfirmed === true && p.postVisitStatus === '치료시작'
    ).length

    const reservationRate = totalPatients > 0 ? (reservedCount / totalPatients) * 100 : 0
    const visitRate = totalPatients > 0 ? (visitedCount / totalPatients) * 100 : 0
    const treatmentRate = totalPatients > 0 ? (treatmentStartedCount / totalPatients) * 100 : 0

    return {
      totalPatients,
      reservedCount,
      visitedCount,
      treatmentStartedCount,
      reservationRate,
      visitRate,
      treatmentRate
    }
  }

  // 월별 비교 통계 계산 (최근 6개월)
  const getMonthlyComparison = () => {
    const months = []
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = monthDate.getFullYear()
      const month = monthDate.getMonth() + 1
      
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0)
      const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
      
      const monthPatients = patients.filter(patient => {
        const callInDate = patient.callInDate
        return callInDate >= firstDay && callInDate <= lastDayStr
      })
      
      const reservedCount = monthPatients.filter(p => p.status === '예약확정').length
      const visitedCount = monthPatients.filter(p => p.visitConfirmed === true).length
      const treatmentCount = monthPatients.filter(p => 
        p.visitConfirmed === true && p.postVisitStatus === '치료시작'
      ).length
      
      months.push({
        label: `${month}월`,
        inquiries: monthPatients.length,
        reservationRate: monthPatients.length > 0 ? (reservedCount / monthPatients.length) * 100 : 0,
        visitRate: monthPatients.length > 0 ? (visitedCount / monthPatients.length) * 100 : 0,
        treatmentRate: monthPatients.length > 0 ? (treatmentCount / monthPatients.length) * 100 : 0
      })
    }
    
    return months
  }

  const totalStats = getTotalStats()
  const comparisonData = getMonthlyComparison()

  const renderTabContent = () => {
    switch (activeTab) {
      case 'monthly':
        // 🎯 기존 "이번달 성과 현황" 그대로 유지
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SummaryCard
              title="이번달 신규 문의"
              value={monthlyStats.totalInquiries}
              suffix="명"
              icon={HiOutlineUsers}
              progressValue={100}
              progressColor="bg-blue-500"
              isLoading={isLoading}
              subtitle="이번달 새로 등록된 환자"
              onClick={() => handleOpenModal('new_inquiry', '이번달 신규 문의 환자')}
              isClickable={true}
              changeValue={monthlyStats.inquiryChange}
              changeType="count"
              inboundChange={monthlyStats.inboundChange}
              outboundChange={monthlyStats.outboundChange}
            />
            <SummaryCard
              title="예약전환율"
              value={Math.round(monthlyStats.reservationRate * 10) / 10}
              suffix="%"
              icon={HiOutlineCheck}
              progressValue={monthlyStats.reservationRate}
              progressColor="bg-green-500"
              isLoading={isLoading}
              subtitle={`${monthlyStats.reservedCount}명 예약전환`}
              onClick={() => handleOpenModal('reservation_rate', '예약 전환 환자')}
              isClickable={true}
              changeValue={Math.round(monthlyStats.reservationRateChange * 10) / 10}
              changeType="percentage_point"
            />
            <SummaryCard
              title="내원전환율"
              value={Math.round(monthlyStats.visitRate * 10) / 10}
              suffix="%"
              icon={HiOutlineCalendar}
              progressValue={monthlyStats.visitRate}
              progressColor="bg-purple-500"
              isLoading={isLoading}
              subtitle={`${monthlyStats.visitedCount}명 내원완료`}
              onClick={() => handleOpenModal('visit_rate', '내원 완료 환자')}
              isClickable={true}
              changeValue={Math.round(monthlyStats.visitRateChange * 10) / 10}
              changeType="percentage_point"
            />
            <SummaryCard
              title="결제전환율"
              value={Math.round(monthlyStats.treatmentRate * 10) / 10}
              suffix="%"
              icon={HiOutlineClock}
              progressValue={monthlyStats.treatmentRate}
              progressColor="bg-orange-500"
              isLoading={isLoading}
              subtitle={`${monthlyStats.treatmentStartedCount}명 치료시작`}
              onClick={() => handleOpenModal('treatment_rate', '치료 시작 환자')}
              isClickable={true}
              changeValue={Math.round(monthlyStats.treatmentRateChange * 10) / 10}
              changeType="percentage_point"
            />
          </div>
        )

      case 'total':
        // 🎯 기존 디자인 그대로, 텍스트만 "전체~"로 변경
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SummaryCard
              title="전체 누적 문의"
              value={totalStats.totalPatients}
              suffix="명"
              icon={HiOutlineUsers}
              progressValue={100}
              progressColor="bg-blue-500"
              isLoading={isLoading}
              subtitle="서비스 시작부터 현재까지"
              isClickable={false}
            />
            <SummaryCard
              title="전체 예약전환율"
              value={Math.round(totalStats.reservationRate * 10) / 10}
              suffix="%"
              icon={HiOutlineCheck}
              progressValue={totalStats.reservationRate}
              progressColor="bg-green-500"
              isLoading={isLoading}
              subtitle={`${totalStats.reservedCount}명 전체 예약`}
              isClickable={false}
            />
            <SummaryCard
              title="전체 내원전환율"
              value={Math.round(totalStats.visitRate * 10) / 10}
              suffix="%"
              icon={HiOutlineCalendar}
              progressValue={totalStats.visitRate}
              progressColor="bg-purple-500"
              isLoading={isLoading}
              subtitle={`${totalStats.visitedCount}명 전체 내원`}
              isClickable={false}
            />
            <SummaryCard
              title="전체 결제전환율"
              value={Math.round(totalStats.treatmentRate * 10) / 10}
              suffix="%"
              icon={HiOutlineClock}
              progressValue={totalStats.treatmentRate}
              progressColor="bg-orange-500"
              isLoading={isLoading}
              subtitle={`${totalStats.treatmentStartedCount}명 전체 치료`}
              isClickable={false}
            />
          </div>
        )

      case 'comparison':
        // 🎯 트렌드 분석 탭
        return (
          <div className="space-y-6">
            {/* 퍼널 시각화 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border">
              <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Icon icon={HiOutlineCalendar} size={20} />
                이번달 전환 퍼널
              </h4>
              <div className="flex items-center gap-4 overflow-x-auto">
                <div className="flex-shrink-0 bg-white p-4 rounded-lg text-center border-2 border-blue-200 min-w-[120px]">
                  <div className="text-2xl font-bold text-blue-600">{monthlyStats.totalInquiries}</div>
                  <div className="text-sm text-gray-600">신규 문의</div>
                  <div className="text-xs text-blue-500 mt-1">100%</div>
                </div>
                <div className="flex-shrink-0 text-2xl text-gray-400">→</div>
                <div className="flex-shrink-0 bg-white p-4 rounded-lg text-center border-2 border-green-200 min-w-[120px]">
                  <div className="text-2xl font-bold text-green-600">{monthlyStats.reservedCount}</div>
                  <div className="text-sm text-gray-600">예약 완료</div>
                  <div className="text-xs text-green-500 mt-1">{Math.round(monthlyStats.reservationRate)}%</div>
                </div>
                <div className="flex-shrink-0 text-2xl text-gray-400">→</div>
                <div className="flex-shrink-0 bg-white p-4 rounded-lg text-center border-2 border-purple-200 min-w-[120px]">
                  <div className="text-2xl font-bold text-purple-600">{monthlyStats.visitedCount}</div>
                  <div className="text-sm text-gray-600">내원 완료</div>
                  <div className="text-xs text-purple-500 mt-1">{Math.round(monthlyStats.visitRate)}%</div>
                </div>
                <div className="flex-shrink-0 text-2xl text-gray-400">→</div>
                <div className="flex-shrink-0 bg-white p-4 rounded-lg text-center border-2 border-orange-200 min-w-[120px]">
                  <div className="text-2xl font-bold text-orange-600">{monthlyStats.treatmentStartedCount}</div>
                  <div className="text-sm text-gray-600">치료 시작</div>
                  <div className="text-xs text-orange-500 mt-1">{Math.round(monthlyStats.treatmentRate)}%</div>
                </div>
              </div>
            </div>

            {/* 월별 트렌드 테이블 */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h4 className="text-lg font-semibold text-gray-800">최근 6개월 트렌드</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-gray-700">월</th>
                      <th className="px-6 py-3 text-center font-medium text-gray-700">신규문의</th>
                      <th className="px-6 py-3 text-center font-medium text-gray-700">예약전환율</th>
                      <th className="px-6 py-3 text-center font-medium text-gray-700">내원전환율</th>
                      <th className="px-6 py-3 text-center font-medium text-gray-700">결제전환율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {comparisonData.map((month, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{month.label}</td>
                        <td className="px-6 py-4 text-center text-gray-700">{month.inquiries}명</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {month.reservationRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {month.visitRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            {month.treatmentRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Icon icon={HiOutlineCalendar} size={20} />
            성과 현황
          </h3>
          
          {/* 탭 버튼들 */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('monthly')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'monthly'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                이번달 실적
              </button>
              <button
                onClick={() => setActiveTab('total')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'total'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                전체 누적
              </button>
              <button
                onClick={() => setActiveTab('comparison')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'comparison'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                트렌드 분석
              </button>
            </nav>
          </div>

          {/* 탭 컨텐츠 */}
          {renderTabContent()}
        </div>
      </div>

      {/* 환자 목록 모달 */}
      {modalState.filterType && (
        <PatientListModal
          isOpen={modalState.isOpen}
          onClose={handleCloseModal}
          filterType={modalState.filterType}
          title={modalState.title}
        />
      )}
    </>
  )
}