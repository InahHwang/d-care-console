// src/components/dashboard/ProgressGoals.tsx
import React from 'react';

// 목표 데이터 타입 정의
interface GoalData {
  newPatients: {
    current: number;
    target: number;
    percentage: number;
  };
  appointments: {
    current: number;
    target: number;
    percentage: number;
  };
}

interface ProgressGoalsProps {
  goals: GoalData;
}

const ProgressGoals: React.FC<ProgressGoalsProps> = ({ goals }) => {
  return (
    <div className="card">
      <div className="p-4 border-b border-border">
        <h3 className="text-md font-semibold text-text-primary flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          이번달 목표 달성률
        </h3>
      </div>
      
      <div className="p-4">
        {/* 신규 환자 목표 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-text-primary">신규 환자 목표</span>
            <span className="text-sm text-text-primary font-semibold">
              {goals.newPatients.current}/{goals.newPatients.target}명
            </span>
          </div>
          
          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-green-500 rounded-full"
              style={{ width: `${goals.newPatients.percentage}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-text-muted">달성률</span>
            <span className="text-xs font-medium text-green-600">{goals.newPatients.percentage}%</span>
          </div>
        </div>
        
        {/* 예약 목표 */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-text-primary">예약 목표</span>
            <span className="text-sm text-text-primary font-semibold">
              {goals.appointments.current}/{goals.appointments.target}건
            </span>
          </div>
          
          <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-blue-500 rounded-full"
              style={{ width: `${goals.appointments.percentage}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-text-muted">달성률</span>
            <span className="text-xs font-medium text-blue-600">{goals.appointments.percentage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressGoals;