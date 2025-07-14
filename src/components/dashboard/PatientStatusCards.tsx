// src/components/dashboard/PatientStatusCards.tsx - 새로운 구조로 완전 개편
import React, { useState } from 'react';
import PatientListModal from '../management/PatientListModal';

// 🔥 새로운 상태 카운트 타입 정의
interface StatusCardData {
  consultation: number;  // 상담환자
  visit: number;        // 내원환자
}

interface ReminderCardData {
  registrationNeeded: number; // 등록필요
}

interface NewPatientStatusCounts {
  overdueCallbacks: StatusCardData;      // 미처리 콜백
  todayScheduled: StatusCardData;        // 오늘 예정된 콜백  
  callbackUnregistered: StatusCardData;  // 콜백 미등록
  reminderCallbacks: ReminderCardData;   // 리마인더 콜백
}

interface PatientStatusCardsProps {
  statusCounts: NewPatientStatusCounts;
}

// 🔥 새로운 필터 타입 정의
export type NewPatientFilterType = 
  | 'overdueCallbacks_consultation'    // 미처리 콜백 - 상담환자
  | 'overdueCallbacks_visit'          // 미처리 콜백 - 내원환자
  | 'todayScheduled_consultation'     // 오늘 예정된 콜백 - 상담환자
  | 'todayScheduled_visit'           // 오늘 예정된 콜백 - 내원환자
  | 'callbackUnregistered_consultation' // 콜백 미등록 - 상담환자
  | 'callbackUnregistered_visit'      // 콜백 미등록 - 내원환자
  | 'reminderCallbacks_registrationNeeded'; // 리마인더 콜백 - 등록필요

const PatientStatusCards: React.FC<PatientStatusCardsProps> = ({ statusCounts }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<NewPatientFilterType | null>(null);

  const handleCardClick = (filterType: NewPatientFilterType) => {
    setSelectedFilter(filterType);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFilter(null);
  };

  const getModalTitle = (filterType: NewPatientFilterType | null) => {
    switch (filterType) {
      case 'overdueCallbacks_consultation':
        return '🚨 미처리 콜백 - 상담환자 (즉시 대응 필요)';
      case 'overdueCallbacks_visit':
        return '🚨 미처리 콜백 - 내원환자 (즉시 대응 필요)';
      case 'todayScheduled_consultation':
        return '📅 오늘 예정된 콜백 - 상담환자';
      case 'todayScheduled_visit':
        return '📅 오늘 예정된 콜백 - 내원환자';
      case 'callbackUnregistered_consultation':
        return '📋 콜백 미등록 - 상담환자';
      case 'callbackUnregistered_visit':
        return '📋 콜백 미등록 - 내원환자';
      case 'reminderCallbacks_registrationNeeded':
        return '⚠️ 리마인더 콜백 - 등록필요';
      default:
        return '환자 목록';
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 🔥 첫 번째: 미처리 콜백 (가장 우선순위) */}
        <div className="card p-6 border-l-4 border-red-500 hover:shadow-lg transition-shadow duration-200">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-red-700">🚨 미처리 콜백</p>
              <p className="text-xs text-red-600">예정 날짜가 지난 미처리 콜백</p>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center text-sm font-medium text-gray-700">상담환자</div>
                <div className="text-center text-sm font-medium text-gray-700">내원환자</div>
              </div>
            </div>
            <div className="border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 p-4">
                <div 
                  className="text-center cursor-pointer hover:bg-red-50 rounded p-2 transition-colors"
                  onClick={() => handleCardClick('overdueCallbacks_consultation')}
                >
                  <span className="text-2xl font-bold text-red-600 hover:text-red-700">
                    {statusCounts.overdueCallbacks.consultation}건
                  </span>
                </div>
                <div 
                  className="text-center cursor-pointer hover:bg-red-50 rounded p-2 transition-colors"
                  onClick={() => handleCardClick('overdueCallbacks_visit')}
                >
                  <span className="text-2xl font-bold text-red-600 hover:text-red-700">
                    {statusCounts.overdueCallbacks.visit}건
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-red-600">
            <div>상담환자: 환자상태가 "콜백필요"로 구분되어있고, 콜백 예정 날짜가 오늘 이전인 경우</div>
            <div>내원환자: 내원 후 상태가 "재콜백필요"로 구분되어 있는 경우</div>
          </div>
        </div>

        {/* 🔥 두 번째: 오늘 예정된 콜백 */}
        <div className="card p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow duration-200">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">📅 오늘 예정된 콜백</p>
              <p className="text-xs text-blue-600">오늘 스케줄된 콜백 업무량</p>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center text-sm font-medium text-gray-700">상담환자</div>
                <div className="text-center text-sm font-medium text-gray-700">내원환자</div>
              </div>
            </div>
            <div className="border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 p-4">
                <div 
                  className="text-center cursor-pointer hover:bg-blue-50 rounded p-2 transition-colors"
                  onClick={() => handleCardClick('todayScheduled_consultation')}
                >
                  <span className="text-2xl font-bold text-blue-600 hover:text-blue-700">
                    {statusCounts.todayScheduled.consultation}건
                  </span>
                </div>
                <div 
                  className="text-center cursor-pointer hover:bg-blue-50 rounded p-2 transition-colors"
                  onClick={() => handleCardClick('todayScheduled_visit')}
                >
                  <span className="text-2xl font-bold text-blue-600 hover:text-blue-700">
                    {statusCounts.todayScheduled.visit}건
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-blue-600">
            <div>상담환자: 오늘 날짜로 콜백이 등록된 환자</div>
            <div>내원환자: 오늘 날짜로 재콜백이 등록된 환자</div>
          </div>
        </div>

        {/* 🔥 세 번째: 콜백 미등록 */}
        <div className="card p-6 border-l-4 border-orange-500 hover:shadow-lg transition-shadow duration-200">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-orange-700">📋 콜백 미등록</p>
              <p className="text-xs text-orange-600">재콜백 등록 없이 방치되어있는 경우</p>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center text-sm font-medium text-gray-700">상담환자</div>
                <div className="text-center text-sm font-medium text-gray-700">내원환자</div>
              </div>
            </div>
            <div className="border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 p-4">
                <div 
                  className="text-center cursor-pointer hover:bg-orange-50 rounded p-2 transition-colors"
                  onClick={() => handleCardClick('callbackUnregistered_consultation')}
                >
                  <span className="text-2xl font-bold text-orange-600 hover:text-orange-700">
                    {statusCounts.callbackUnregistered.consultation}명
                  </span>
                </div>
                <div 
                  className="text-center cursor-pointer hover:bg-orange-50 rounded p-2 transition-colors"
                  onClick={() => handleCardClick('callbackUnregistered_visit')}
                >
                  <span className="text-2xl font-bold text-orange-600 hover:text-orange-700">
                    {statusCounts.callbackUnregistered.visit}명
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-orange-600">
            <div>상담환자: 예약 후 미내원 상태, 부재중 상태, 잠재고객 상태로 재콜백 등록 없이 방치</div>
            <div>내원환자: 상태미설정 상태로 재콜백 등록 없이 방치</div>
          </div>
        </div>

        {/* 🔥 네 번째: 리마인더 콜백 */}
        <div className="card p-6 border-l-4 border-purple-500 hover:shadow-lg transition-shadow duration-200">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-purple-700">⏰ 리마인더 콜백</p>
              <p className="text-xs text-purple-600">치료 시작 전 리마인더 관리</p>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2">
              <div className="text-center text-sm font-medium text-gray-700">등록필요</div>
            </div>
            <div className="border-t border-gray-200">
              <div className="p-4">
                <div 
                  className="text-center cursor-pointer hover:bg-purple-50 rounded p-2 transition-colors"
                  onClick={() => handleCardClick('reminderCallbacks_registrationNeeded')}
                >
                  <span className="text-2xl font-bold text-purple-600 hover:text-purple-700">
                    {statusCounts.reminderCallbacks.registrationNeeded}건
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-purple-600">
            <div>예정: 리마인더 콜백 예정일 3일 전에 다다른 환자 표기</div>
            <div>등록필요: 치료동의 상태인데 "치료시작예정일"이 오늘날짜보다 이전인 경우</div>
          </div>
        </div>
      </div>

      {/* 환자 목록 모달 */}
      {isModalOpen && selectedFilter && (
        <PatientListModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          filterType={selectedFilter as any} // 기존 PatientListModal 호환성을 위해 임시 타입 캐스팅
          title={getModalTitle(selectedFilter)}
        />
      )}
    </>
  );
};

export default PatientStatusCards;