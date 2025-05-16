// src/components/dashboard/TodaysCallsTable.tsx
import React from 'react';

// 콜 데이터 타입 정의
interface CallData {
  id: string;
  patientName: string;
  phoneNumber: string;
  scheduledTime: string;
  status: string;
  reminderStatus: string;
  interestedServices: string;
}

interface TodaysCallsTableProps {
  calls: CallData[];
}

const TodaysCallsTable: React.FC<TodaysCallsTableProps> = ({ calls }) => {
  // 시간 포맷 함수
  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch (e) {
      return timeString;
    }
  };

  return (
    <div className="card">
      <div className="p-4 border-b border-border">
        <h3 className="text-md font-semibold text-text-primary flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          오늘 예정된 콜
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        {calls.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            오늘 예정된 콜이 없습니다.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-light-bg">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">시간</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">환자명</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">연락처</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">관심 분야</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">액션</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary font-medium">
                    {formatTime(call.scheduledTime)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-text-primary">
                    {call.patientName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-text-secondary">
                    {call.phoneNumber}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={call.status} reminderStatus={call.reminderStatus} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-text-secondary max-w-[150px] truncate">
                    {call.interestedServices}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {/* 전화 버튼 */}
                      <button 
                        className="w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center"
                        title="전화 걸기"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </button>
                      
                      {/* 문자 발송 버튼 */}
                      <button 
                        className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center"
                        title="문자 발송"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </button>
                      
                      {/* 상세 정보 버튼 */}
                      <button 
                        className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center"
                        title="환자 상세 정보"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {calls.length > 0 && (
        <div className="p-4 border-t border-border flex justify-between items-center">
          <span className="text-sm text-text-secondary">
            총 {calls.length}개의 콜이 예정되어 있습니다.
          </span>
          <a href="#" className="text-sm text-primary hover:text-primary-dark font-medium">
            모든 콜 보기 →
          </a>
        </div>
      )}
    </div>
  );
};

// 상태 뱃지 컴포넌트
const StatusBadge: React.FC<{ status: string; reminderStatus: string }> = ({ status, reminderStatus }) => {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-800';
  
  if (status === '콜백필요') {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-800';
  } else if (status === '미응답') {
    bgColor = 'bg-red-100';
    textColor = 'text-red-800';
  }
  
  // 리마인더 상태에 따른 표시
  let reminderBadge = null;
  if (reminderStatus && reminderStatus !== '초기') {
    const reminderColors = {
      '1차': 'bg-orange-100 text-orange-800',
      '2차': 'bg-orange-200 text-orange-900',
      '3차': 'bg-red-100 text-red-800',
      '4차': 'bg-red-200 text-red-900',
      '5차': 'bg-red-300 text-red-900',
    };
    
    const reminderColor = reminderColors[reminderStatus as keyof typeof reminderColors] || 'bg-gray-100 text-gray-800';
    
    reminderBadge = (
      <span className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium ${reminderColor}`}>
        {reminderStatus.charAt(0)}
      </span>
    );
  }
  
  return (
    <div className="flex items-center">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
        {status}
      </span>
      {reminderBadge}
    </div>
  );
};

export default TodaysCallsTable;