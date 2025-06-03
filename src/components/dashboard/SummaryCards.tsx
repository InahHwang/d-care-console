//src/components/dashboard/SummaryCards.tsx

'use client'

import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { CallSummary } from '@/store/slices/callsSlice'
import { IconType } from 'react-icons'
import { 
  HiOutlineCalendar, 
  HiOutlineCheck, 
  HiOutlineExclamation,
  HiOutlineClock,
  HiOutlineUsers
} from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'

interface SummaryCardProps {
  title: string
  value: number
  suffix?: string
  icon: IconType
  progressValue: number
  progressColor: string
  isLoading?: boolean
  subtitle?: string
}

const SummaryCard = ({
  title,
  value,
  suffix = '건',
  icon,
  progressValue,
  progressColor,
  isLoading = false,
  subtitle
}: SummaryCardProps) => {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-text-secondary text-sm">
        <Icon icon={icon} size={16} className="text-text-secondary" />
        <span>{title}</span>
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

interface SummaryCardsProps {
  summary: CallSummary
  isLoading?: boolean
}

export default function SummaryCards({ summary, isLoading = false }: SummaryCardsProps) {
  const { scheduled, completed, pending, confirmed } = summary
  
  // 🔥 환자 데이터에서 인바운드/아웃바운드 통계 가져오기
  const { patients } = useSelector((state: RootState) => state.patients)
  
  // 🔥 인바운드/아웃바운드 통계 계산
  const getConsultationStats = () => {
    const inboundPatients = patients.filter(p => p.consultationType === 'inbound')
    const outboundPatients = patients.filter(p => p.consultationType === 'outbound')
    
    return {
      totalPatients: patients.length,
      inboundCount: inboundPatients.length,
      outboundCount: outboundPatients.length,
      inboundActive: inboundPatients.filter(p => 
        ['잠재고객', '콜백필요', '활성고객', 'VIP'].includes(p.status)
      ).length,
      outboundActive: outboundPatients.filter(p => 
        ['잠재고객', '콜백필요', '활성고객', 'VIP'].includes(p.status)
      ).length,
      inboundCompleted: inboundPatients.filter(p => 
        ['예약확정', '종결'].includes(p.status)
      ).length,
      outboundCompleted: outboundPatients.filter(p => 
        ['예약확정', '종결'].includes(p.status)
      ).length
    }
  }
  
  const consultationStats = getConsultationStats()
  
  // 진행률 계산
  const calculateProgress = (value: number, total: number) => {
    return total > 0 ? (value / total) * 100 : 0
  }
  
  const totalCalls = scheduled + completed
  
  return (
    <div className="space-y-6">
      {/* 🔥 상담 타입별 통계 섹션 추가 */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Icon icon={HiOutlineUsers} size={20} />
          상담 타입별 현황
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard
            title="전체 환자"
            value={consultationStats.totalPatients}
            suffix="명"
            icon={HiOutlineUsers}
            progressValue={100}
            progressColor="bg-gray-400"
            isLoading={isLoading}
            subtitle="등록된 모든 환자"
          />
          <SummaryCard
            title="인바운드 환자"
            value={consultationStats.inboundCount}
            suffix="명"
            icon={FiPhone}
            progressValue={calculateProgress(consultationStats.inboundCount, consultationStats.totalPatients)}
            progressColor="bg-green-500"
            isLoading={isLoading}
            subtitle={`활성: ${consultationStats.inboundActive}명, 완료: ${consultationStats.inboundCompleted}명`}
          />
          <SummaryCard
            title="아웃바운드 환자"
            value={consultationStats.outboundCount}
            suffix="명"
            icon={FiPhoneCall}
            progressValue={calculateProgress(consultationStats.outboundCount, consultationStats.totalPatients)}
            progressColor="bg-blue-500"
            isLoading={isLoading}
            subtitle={`활성: ${consultationStats.outboundActive}명, 완료: ${consultationStats.outboundCompleted}명`}
          />
          <SummaryCard
            title="상담 전환율"
            value={Math.round(calculateProgress(consultationStats.inboundCompleted + consultationStats.outboundCompleted, consultationStats.totalPatients))}
            suffix="%"
            icon={HiOutlineCheck}
            progressValue={calculateProgress(consultationStats.inboundCompleted + consultationStats.outboundCompleted, consultationStats.totalPatients)}
            progressColor="bg-purple-500"
            isLoading={isLoading}
            subtitle="예약확정 + 종결 비율"
          />
        </div>
      </div>

      {/* 기존 콜 통계 섹션 */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Icon icon={HiOutlineCalendar} size={20} />
          콜 진행 현황
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard
            title="예정된 콜"
            value={scheduled}
            icon={HiOutlineCalendar}
            progressValue={calculateProgress(scheduled, totalCalls)}
            progressColor="bg-primary"
            isLoading={isLoading}
          />
          <SummaryCard
            title="완료된 콜"
            value={completed}
            icon={HiOutlineCheck}
            progressValue={calculateProgress(completed, totalCalls)}
            progressColor="bg-success"
            isLoading={isLoading}
          />
          <SummaryCard
            title="미완료 콜"
            value={pending}
            icon={HiOutlineExclamation}
            progressValue={calculateProgress(pending, totalCalls)}
            progressColor="bg-error"
            isLoading={isLoading}
          />
          <SummaryCard
            title="예약 확정"
            value={confirmed}
            icon={HiOutlineClock}
            progressValue={calculateProgress(confirmed, totalCalls)}
            progressColor="bg-warning"
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}