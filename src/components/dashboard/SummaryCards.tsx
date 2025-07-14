// src/components/dashboard/SummaryCards.tsx - 건수/포인트 증감 표시로 수정된 버전

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
import { useState } from 'react'
import PatientListModal from './PatientListModal'
import { PatientFilterType } from '@/types/patient'


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
  // 🔥 새로 추가: 증감 표시 관련 props
  changeValue?: number  // 증감 수치
  changeType?: 'count' | 'percentage_point' | 'amount'  // 🔥 'percentage' 제거
  inboundChange?: number  // 인바운드 증감
  outboundChange?: number  // 아웃바운드 증감
}

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
  
  // 🔥 인바운드/아웃바운드 증감 텍스트
  const getInOutChangeText = () => {
    if (inboundChange === undefined || outboundChange === undefined) return '';
    
    // 🔥 실제 건수와 증감을 함께 표시하도록 수정 필요
    // 하지만 SummaryCards에서는 실제 건수 정보가 없으므로 
    // 이 함수는 PerformanceCards에서만 사용하도록 변경
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
        {/* 🔥 증감 뱃지를 헤더 오른쪽에 배치 */}
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
      
      {/* 🔥 인바운드/아웃바운드 증감만 표시 (신규 문의 카드에만) */}
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

interface SummaryCardsProps {
  summary: CallSummary
  isLoading?: boolean
}

export default function SummaryCards({ summary, isLoading = false }: SummaryCardsProps) {
  const { scheduled, completed, pending, confirmed } = summary
  
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
  
  // 환자 데이터에서 통계 가져오기
  const { patients } = useSelector((state: RootState) => state.patients)
  
  // 🔥 수정된 월별 통계 계산 - 전월 대비 건수 증감 포함
  const getMonthlyStats = () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    
    // 이번달 범위
    const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const todayStr = now.toISOString().split('T')[0];
    
    // 지난달 범위
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthNum = currentMonth === 0 ? 12 : currentMonth;
    const firstDayOfPrevMonthStr = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-01`;
    const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0);
    const lastDayOfPrevMonthStr = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-${String(lastDayOfPrevMonth.getDate()).padStart(2, '0')}`;
    
    // 이번달 환자들
    const thisMonthPatients = patients.filter(patient => {
      const callInDate = patient.callInDate;
      return callInDate >= firstDayOfMonthStr && callInDate <= todayStr;
    });
    
    // 지난달 환자들
    const prevMonthPatients = patients.filter(patient => {
      const callInDate = patient.callInDate;
      return callInDate >= firstDayOfPrevMonthStr && callInDate <= lastDayOfPrevMonthStr;
    });
    
    // 🔥 이번달 인바운드/아웃바운드 구분
    const thisMonthInbound = thisMonthPatients.filter(p => p.consultationType === 'inbound').length;
    const thisMonthOutbound = thisMonthPatients.filter(p => p.consultationType === 'outbound').length;
    
    // 🔥 지난달 인바운드/아웃바운드 구분
    const prevMonthInbound = prevMonthPatients.filter(p => p.consultationType === 'inbound').length;
    const prevMonthOutbound = prevMonthPatients.filter(p => p.consultationType === 'outbound').length;
    
    // 이번달 각 단계별 환자 수
    const reservedPatients = thisMonthPatients.filter(p => p.status === '예약확정');
    const visitedPatients = thisMonthPatients.filter(p => p.visitConfirmed === true);
    const treatmentStartedPatients = thisMonthPatients.filter(p => p.postVisitStatus === '치료시작');
    
    // 지난달 각 단계별 환자 수 (전환율 %p 계산용)
    const prevReservedPatients = prevMonthPatients.filter(p => p.status === '예약확정');
    const prevVisitedPatients = prevMonthPatients.filter(p => p.visitConfirmed === true);
    const prevTreatmentStartedPatients = prevMonthPatients.filter(p => p.postVisitStatus === '치료시작');
    
    // 이번달 전환율
    const reservationRate = thisMonthPatients.length > 0 ? (reservedPatients.length / thisMonthPatients.length) * 100 : 0;
    const visitRate = thisMonthPatients.length > 0 ? (visitedPatients.length / thisMonthPatients.length) * 100 : 0;
    const treatmentRate = thisMonthPatients.length > 0 ? (treatmentStartedPatients.length / thisMonthPatients.length) * 100 : 0;
    
    // 지난달 전환율
    const prevReservationRate = prevMonthPatients.length > 0 ? (prevReservedPatients.length / prevMonthPatients.length) * 100 : 0;
    const prevVisitRate = prevMonthPatients.length > 0 ? (prevVisitedPatients.length / prevMonthPatients.length) * 100 : 0;
    const prevTreatmentRate = prevMonthPatients.length > 0 ? (prevTreatmentStartedPatients.length / prevMonthPatients.length) * 100 : 0;
    
    return {
      totalInquiries: thisMonthPatients.length,
      reservedCount: reservedPatients.length,
      visitedCount: visitedPatients.length,
      treatmentStartedCount: treatmentStartedPatients.length,
      
      // 전환율
      reservationRate,
      visitRate,
      treatmentRate,
      
      // 🔥 건수 증감
      inquiryChange: thisMonthPatients.length - prevMonthPatients.length,
      inboundChange: thisMonthInbound - prevMonthInbound,
      outboundChange: thisMonthOutbound - prevMonthOutbound,
      
      // 🔥 전환율 %p 증감
      reservationRateChange: reservationRate - prevReservationRate,
      visitRateChange: visitRate - prevVisitRate,
      treatmentRateChange: treatmentRate - prevTreatmentRate
    };
  };
  
  // 인바운드/아웃바운드 통계 계산 (기존 유지)
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
  
  const monthlyStats = getMonthlyStats()
  const consultationStats = getConsultationStats()
  
  // 모달 핸들러들
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
  
  // 진행률 계산
  const calculateProgress = (value: number, total: number) => {
    return total > 0 ? (value / total) * 100 : 0
  }
  
  const totalCalls = scheduled + completed
  
  return (
    <>
      <div className="space-y-6">
        {/* 🔥 이번달 성과 섹션 - 수정된 증감 표시 */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Icon icon={HiOutlineCalendar} size={20} />
            이번달 성과 현황
          </h3>
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
        </div>

        {/* 상담 타입별 통계 섹션 - 기존 유지 */}
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

        {/* 기존 콜 통계 섹션 - 기존 유지 */}
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

// 🔥 건수 증감을 보여주는 뱃지 컴포넌트 - 텍스트 형태로 수정
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
  
  // 단위별 텍스트 생성
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