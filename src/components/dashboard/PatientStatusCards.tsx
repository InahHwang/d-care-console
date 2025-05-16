// src/components/dashboard/PatientStatusCards.tsx
import React from 'react';

// 환자 상태별 카운트 타입 정의
interface PatientStatusCounts {
  callbackNeeded: number;
  absentCount: number;
  todayScheduled: number;
  newPatients: number;
}

interface PatientStatusCardsProps {
  statusCounts: PatientStatusCounts;
}

const PatientStatusCards: React.FC<PatientStatusCardsProps> = ({ statusCounts }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* 콜백 필요 환자 수 */}
      <div className="card p-4">
        <div className="flex items-center mb-2">
          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-secondary">콜백 필요</p>
            <p className="text-xl font-bold text-yellow-600">{statusCounts.callbackNeeded}명</p>
          </div>
        </div>
        <div className="mt-1 text-xs text-text-muted">
          즉시 조치가 필요한 환자 수
        </div>
      </div>

      {/* 부재중 환자 수 (이전의 미응답) */}
      <div className="card p-4">
        <div className="flex items-center mb-2">
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-secondary">부재중</p>
            <p className="text-xl font-bold text-red-600">{statusCounts.absentCount}명</p>
          </div>
        </div>
        <div className="mt-1 text-xs text-text-muted">
          연락 재시도가 필요한 환자 수
        </div>
      </div>

      {/* 오늘 예정된 콜백 */}
      <div className="card p-4">
        <div className="flex items-center mb-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-secondary">오늘 예정된 콜</p>
            <p className="text-xl font-bold text-blue-600">{statusCounts.todayScheduled}건</p>
          </div>
        </div>
        <div className="mt-1 text-xs text-text-muted">
          오늘 스케줄된 콜백 업무량
        </div>
      </div>

      {/* 이번달 신규 환자 */}
      <div className="card p-4">
        <div className="flex items-center mb-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-secondary">이번달 신규 환자</p>
            <p className="text-xl font-bold text-green-600">{statusCounts.newPatients}명</p>
          </div>
        </div>
        <div className="mt-1 text-xs text-text-muted">
          이번달 등록된 신규 환자 수
        </div>
      </div>
    </div>
  );
};

export default PatientStatusCards;