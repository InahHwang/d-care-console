// src/components/dashboard/QuickActions.tsx
import React from 'react';
import Link from 'next/link';

const QuickActions: React.FC = () => {
  return (
    <div className="card">
      <div className="p-4 border-b border-border">
        <h3 className="text-md font-semibold text-text-primary flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          빠른 액션
        </h3>
      </div>
      
      <div className="p-4 space-y-3">
        {/* 신규 환자 등록 */}
        <Link href="/management?action=addPatient" className="flex items-center p-3 rounded-md hover:bg-light-bg transition-colors">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-text-primary">신규 환자 등록</p>
            <p className="text-xs text-text-secondary">새로운 환자 정보를 등록합니다.</p>
          </div>
        </Link>
        
        {/* 콜백 관리 */}
        <Link href="/management?tab=callbacks" className="flex items-center p-3 rounded-md hover:bg-light-bg transition-colors">
          <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-text-primary">콜백 관리</p>
            <p className="text-xs text-text-secondary">예정된 모든 콜백을 관리합니다.</p>
          </div>
        </Link>
        
        {/* 메시지 발송 */}
        <Link href="/management?tab=message-logs" className="flex items-center p-3 rounded-md hover:bg-light-bg transition-colors">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-text-primary">메시지 발송</p>
            <p className="text-xs text-text-secondary">환자에게 문자 메시지를 발송합니다.</p>
          </div>
        </Link>
        
        {/* 이벤트 타겟 관리 */}
        <Link href="/management?tab=event-targets" className="flex items-center p-3 rounded-md hover:bg-light-bg transition-colors">
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-text-primary">이벤트 타겟 관리</p>
            <p className="text-xs text-text-secondary">타겟 환자 그룹을 관리합니다.</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default QuickActions;