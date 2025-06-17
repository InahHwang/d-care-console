// src/components/dashboard/PatientStatusCards.tsx
import React, { useState } from 'react';
import PatientListModal from '../management/PatientListModal';

// 환자 상태별 카운트 타입 정의 - 🔥 수정: newPatients 제거, overdueCallbacks 추가
interface PatientStatusCounts {
  overdueCallbacks: number;  // 🔥 새로 추가: 미처리 콜백
  callbackNeeded: number;
  absentCount: number;
  todayScheduled: number;
}

interface PatientStatusCardsProps {
  statusCounts: PatientStatusCounts;
}

// 필터 타입 정의 - 🔥 수정: newPatients 제거, overdueCallbacks 추가
export type PatientFilterType = 'overdueCallbacks' | 'callbackNeeded' | 'absent' | 'todayScheduled';

const PatientStatusCards: React.FC<PatientStatusCardsProps> = ({ statusCounts }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<PatientFilterType | null>(null);

  const handleCardClick = (filterType: PatientFilterType) => {
    setSelectedFilter(filterType);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFilter(null);
  };

  const getModalTitle = (filterType: PatientFilterType | null) => {
    switch (filterType) {
      case 'overdueCallbacks':
        return '🚨 미처리 콜백 - 즉시 대응 필요';
      case 'callbackNeeded':
        return '콜백이 필요한 환자';
      case 'absent':
        return '부재중 환자';
      case 'todayScheduled':
        return '오늘 예정된 콜백';
      default:
        return '환자 목록';
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 🔥 새로 추가: 미처리 콜백 (첫 번째 자리) */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:bg-red-50 border-l-4 border-red-500"
          onClick={() => handleCardClick('overdueCallbacks')}
        >
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-red-700">🚨 미처리 콜백</p>
              <p className="text-xl font-bold text-red-600 hover:text-red-700 transition-colors">
                {statusCounts.overdueCallbacks}건
              </p>
            </div>
          </div>
          <div className="mt-1 text-xs text-red-600">
            예정 날짜가 지난 미처리 콜백
          </div>
        </div>

        {/* 콜백 필요 환자 수 */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:bg-gray-50"
          onClick={() => handleCardClick('callbackNeeded')}
        >
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary">콜백 필요</p>
              <p className="text-xl font-bold text-yellow-600 hover:text-yellow-700 transition-colors">
                {statusCounts.callbackNeeded}명
              </p>
            </div>
          </div>
          <div className="mt-1 text-xs text-text-muted">
            콜백 조치가 필요한 환자 수
          </div>
        </div>

        {/* 부재중 환자 수 */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:bg-gray-50"
          onClick={() => handleCardClick('absent')}
        >
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary">부재중</p>
              <p className="text-xl font-bold text-red-600 hover:text-red-700 transition-colors">
                {statusCounts.absentCount}명
              </p>
            </div>
          </div>
          <div className="mt-1 text-xs text-text-muted">
            연락 재시도가 필요한 환자 수
          </div>
        </div>

        {/* 오늘 예정된 콜백 */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:bg-gray-50"
          onClick={() => handleCardClick('todayScheduled')}
        >
          <div className="flex items-center mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary">오늘 예정된 콜</p>
              <p className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
                {statusCounts.todayScheduled}건
              </p>
            </div>
          </div>
          <div className="mt-1 text-xs text-text-muted">
            오늘 스케줄된 콜백 업무량
          </div>
        </div>
      </div>

      {/* 환자 목록 모달 */}
      {isModalOpen && selectedFilter && (
        <PatientListModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          filterType={selectedFilter}
          title={getModalTitle(selectedFilter)}
        />
      )}
    </>
  );
};

export default PatientStatusCards;