// src/components/dashboard/PerformanceCards.tsx - 건수/포인트 증감 표시로 수정된 버전
import React, { useState } from 'react';
import PatientListModal from './PatientListModal';
import { PatientFilterType } from '@/store/slices/patientsSlice';

// 🔥 수정된 성과 데이터 타입 정의 - 인바운드/아웃바운드 실제 건수 추가
interface PerformanceData {
  totalInquiries: {
    count: number;
    trend: number;        // 🔥 건수 증감
    inboundChange: number;  // 🔥 인바운드 건수 증감
    outboundChange: number; // 🔥 아웃바운드 건수 증감
    inboundCount: number;   // 🔥 이번달 인바운드 실제 건수
    outboundCount: number;  // 🔥 이번달 아웃바운드 실제 건수
  };
  appointmentRate: {
    value: number;
    trend: number;        // 🔥 %p 증감
    count: number;        // 🔥 예약전환 환자수
  };
  visitRate: {
    value: number;
    trend: number;        // 🔥 %p 증감
    count: number;        // 🔥 내원완료 환자수
  };
  paymentRate: {
    value: number;
    trend: number;        // 🔥 %p 증감
    count: number;        // 🔥 치료시작 환자수
  };
  // 🔥 치료금액 데이터 - 원 단위 증감으로 변경
  totalTreatmentAmount: {
    amount: number;       // 이번달 치료금액 합계
    count: number;        // 치료시작 환자 수
    trend: number;        // 🔥 원 단위 증감 (금액)
  };
}

interface PerformanceCardsProps {
  performance: PerformanceData;
}

const PerformanceCards: React.FC<PerformanceCardsProps> = ({ performance }) => {
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

  // 🔥 치료금액 상세 정보 토글 상태 추가
  const [showTreatmentDetails, setShowTreatmentDetails] = useState(false);

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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 🔥 이번달 신규 문의 카드 - 건수 증감으로 수정 */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary transition-all duration-200"
          onClick={() => handleOpenModal('new_inquiry', '이번달 신규 문의 환자')}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-secondary">이번달 신규 문의</h3>
              <div className="flex items-center gap-2">
                <ChangeBadge value={performance.totalInquiries.trend} type="count" size="small" />
                <span className="text-xs text-primary">클릭하여 보기</span>
              </div>
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-text-primary">{performance.totalInquiries.count}</span>
              <span className="ml-2 text-sm text-text-secondary">건</span>
            </div>
            {/* 🔥 인바운드/아웃바운드 한 줄로 표시 */}
            <div className="mt-2 text-xs text-gray-500">
              인바운드: {performance.totalInquiries.inboundCount}건 
              ({performance.totalInquiries.inboundChange >= 0 ? '+' : ''}{performance.totalInquiries.inboundChange}건), 
              아웃바운드: {performance.totalInquiries.outboundCount}건 
              ({performance.totalInquiries.outboundChange >= 0 ? '+' : ''}{performance.totalInquiries.outboundChange}건)
            </div>
            <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
          </div>
        </div>

        {/* 🔥 예약 전환율 카드 - %p 증감으로 수정 */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary transition-all duration-200"
          onClick={() => handleOpenModal('reservation_rate', '예약 전환 환자')}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-secondary">예약전환율</h3>
              <div className="flex items-center gap-2">
                <ChangeBadge value={performance.appointmentRate.trend} type="percentage_point" size="small" />
                <span className="text-xs text-primary">클릭하여 보기</span>
              </div>
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-text-primary">{performance.appointmentRate.value}</span>
              <span className="ml-2 text-sm text-text-secondary">%</span>
            </div>
            <div className="mt-2 text-xs text-text-muted">
              {performance.appointmentRate.count}명 예약전환
            </div>
            <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
          </div>
        </div>

        {/* 🔥 내원 전환율 카드 - %p 증감으로 수정 */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary transition-all duration-200"
          onClick={() => handleOpenModal('visit_rate', '내원 완료 환자')}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-secondary">내원전환율</h3>
              <div className="flex items-center gap-2">
                <ChangeBadge value={performance.visitRate.trend} type="percentage_point" size="small" />
                <span className="text-xs text-primary">클릭하여 보기</span>
              </div>
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-text-primary">{performance.visitRate.value}</span>
              <span className="ml-2 text-sm text-text-secondary">%</span>
            </div>
            <div className="mt-2 text-xs text-text-muted">
              {performance.visitRate.count}명 내원완료
            </div>
            <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
          </div>
        </div>

        {/* 🔥 결제전환율 카드 - 토글 방식으로 수정 */}
        <div 
          className="card p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-blue-400 transition-all duration-200"
          onClick={() => handleOpenModal('treatment_rate', '치료 시작 환자')}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-blue-700">결제전환율</h3>
              <div className="flex items-center gap-2">
                <ChangeBadge value={performance.paymentRate.trend} type="percentage_point" size="small" />
                <span className="text-xs text-blue-600">클릭하여 보기</span>
              </div>
            </div>
            
            {/* 결제전환율 표시 */}
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-blue-800">{performance.paymentRate.value}</span>
              <span className="ml-2 text-sm text-blue-600">%</span>
            </div>
            
            {/* 결제전환 환자수 */}
            <div className="mt-2 text-xs text-blue-600">
              {performance.paymentRate.count}명 치료시작
            </div>
            
            {/* 🔥 치료금액 토글 버튼 */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700">치료금액 상세</span>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // 카드 클릭 이벤트 방지
                  setShowTreatmentDetails(!showTreatmentDetails);
                }}
                className="p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 text-blue-600 transition-transform duration-200 ${
                    showTreatmentDetails ? 'transform rotate-180' : ''
                  }`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            {/* 🔥 치료금액 상세 정보 - 토글로 표시 */}
            {showTreatmentDetails && (
              <div className="mt-2 bg-white/70 rounded-lg p-3 border border-blue-100 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-700">이번달 치료금액</span>
                  <div className="flex items-center">
                    <ChangeBadge value={performance.totalTreatmentAmount.trend} type="amount" size="small" />
                  </div>
                </div>
                
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline">
                    <span className="text-lg font-bold text-blue-900">
                      {performance.totalTreatmentAmount.amount.toLocaleString()}
                    </span>
                    <span className="ml-1 text-xs text-blue-600">원</span>
                  </div>
                </div>
                
                {/* 평균 치료비 표시 */}
                {performance.totalTreatmentAmount.count > 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-600">평균 치료비</span>
                      <span className="text-xs font-medium text-blue-800">
                        {Math.round(performance.totalTreatmentAmount.amount / performance.totalTreatmentAmount.count).toLocaleString()}원
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* 🔥 치료금액 상세가 닫혀있을 때 공간 채우기 */}
            {!showTreatmentDetails && (
              <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
            )}
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
  );
};

// 🔥 통합된 증감 뱃지 컴포넌트 - 텍스트 형태로 수정
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

export default PerformanceCards;