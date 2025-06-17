// src/components/dashboard/PerformanceCards.tsx
import React from 'react';

// 성과 데이터 타입 정의 - 🔥 totalInquiries 필드 추가
interface PerformanceData {
  totalInquiries: {  // 🔥 변경: outboundCalls → totalInquiries
    count: number;
    trend: number;
  };
  appointmentRate: {
    value: number;
    trend: number;
  };
  visitRate: {
    value: number;
    trend: number;
  };
   paymentRate: {
    value: number;
    trend: number;
  };
}

interface PerformanceCardsProps {
  performance: PerformanceData;
}

const PerformanceCards: React.FC<PerformanceCardsProps> = ({ performance }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 이번달 신규 문의 카드 (분모 역할) */}
      <div className="card p-4">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-text-secondary">이번달 신규 문의(인+아웃바운드)</h3>
            <TrendBadge value={performance.totalInquiries.trend} />
          </div>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-text-primary">{performance.totalInquiries.count}</span>
            <span className="ml-2 text-sm text-text-secondary">건</span>
          </div>
          <div className="mt-2 text-xs text-text-muted">
            전월 대비 {Math.abs(performance.totalInquiries.trend)}% {performance.totalInquiries.trend >= 0 ? '증가' : '감소'}
          </div>
          <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
        </div>
      </div>

      {/* 🔥 예약 전환율 카드 - 설명 업데이트 */}
      <div className="card p-4">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-text-secondary">예약 전환율</h3>
            <TrendBadge value={performance.appointmentRate.trend} />
          </div>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-text-primary">{performance.appointmentRate.value}</span>
            <span className="ml-2 text-sm text-text-secondary">%</span>
          </div>
          <div className="mt-2 text-xs text-text-muted">
            신규 문의 중 예약 확정한 비율
          </div>
          <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
        </div>
      </div>

      {/* 🔥 내원 전환율 카드 - 설명 업데이트 */}
      <div className="card p-4">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-text-secondary">내원 전환율</h3>
            <TrendBadge value={performance.visitRate.trend} />
          </div>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-text-primary">{performance.visitRate.value}</span>
            <span className="ml-2 text-sm text-text-secondary">%</span>
          </div>
          <div className="mt-2 text-xs text-text-muted">
            신규 문의 중 실제 내원한 비율
          </div>
          <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
        </div>
      </div>

      {/* 🔥 결제 전환율 카드 - 설명 업데이트 */}
      <div className="card p-4">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-text-secondary">결제 전환율</h3>
            <TrendBadge value={performance.paymentRate.trend} />
          </div>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-text-primary">{performance.paymentRate.value}</span>
            <span className="ml-2 text-sm text-text-secondary">%</span>
          </div>
          <div className="mt-2 text-xs text-text-muted">
            신규 문의 중 견적 동의한 비율
          </div>
          <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
        </div>
      </div>
    </div>
  );
};

// 증가/감소 추세를 보여주는 뱃지 컴포넌트 - 기존 그대로
const TrendBadge: React.FC<{ value: number }> = ({ value }) => {
  // 0 이상이면 증가, 0 미만이면 감소
  const isPositive = value >= 0;
  
  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      {/* 증가/감소 아이콘 */}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-3 w-3 mr-1" 
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
      {Math.abs(value)}%
    </div>
  );
};

export default PerformanceCards;