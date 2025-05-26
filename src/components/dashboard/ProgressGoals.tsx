// src/components/dashboard/ProgressGoals.tsx
import React from 'react';
import Link from 'next/link';
import { HiOutlineAdjustments } from 'react-icons/hi';
import { Icon } from '@/components/common/Icon';

const ProgressGoals: React.FC = () => {
  // 🔥 Redux, hooks 완전 제거한 단순 버전
  
  return (
    <div className="card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-semibold text-text-primary flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            이번달 목표 달성률
          </h3>
          
          <Link href="/settings?tab=goals">
            <button className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary hover:bg-gray-50 rounded transition-colors">
              <Icon icon={HiOutlineAdjustments} size={14} />
              목표 수정
            </button>
          </Link>
        </div>
      </div>
      
      <div className="p-4">
        {/* 🔥 하드코딩된 데이터로 테스트 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-text-primary">신규 환자 목표</span>
            <span className="text-sm text-text-primary font-semibold">0/30명</span>
          </div>
          
          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: '0%' }}></div>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-text-muted">달성률</span>
            <span className="text-xs font-medium text-green-600">0%</span>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-text-primary">예약 목표</span>
            <span className="text-sm text-text-primary font-semibold">0/50건</span>
          </div>
          
          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: '0%' }}></div>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-text-muted">달성률</span>
            <span className="text-xs font-medium text-blue-600">0%</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="text-xs text-text-muted text-center">
            목표 기능 테스트 중 - 배포 성공 후 실제 기능 구현 예정
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressGoals;