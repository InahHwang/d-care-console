//src/components/dashboard/SummaryCards.tsx

'use client'

import { CallSummary } from '@/store/slices/callsSlice'
import { IconType } from 'react-icons'
import { 
  HiOutlineCalendar, 
  HiOutlineCheck, 
  HiOutlineExclamation,
  HiOutlineClock 
} from 'react-icons/hi'
import { Icon } from '../common/Icon'

interface SummaryCardProps {
  title: string
  value: number
  suffix?: string
  icon: IconType
  progressValue: number
  progressColor: string
  isLoading?: boolean
}

const SummaryCard = ({
  title,
  value,
  suffix = '건',
  icon,
  progressValue,
  progressColor,
  isLoading = false
}: SummaryCardProps) => {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-text-secondary text-sm">
        <Icon icon={icon} size={16} className="text-text-secondary" />
        <span>{title}</span>
      </div>
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
  
  // 진행률 계산
  const calculateProgress = (value: number, total: number) => {
    return total > 0 ? (value / total) * 100 : 0
  }
  
  const totalCalls = scheduled + completed
  
  return (
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
  )
}