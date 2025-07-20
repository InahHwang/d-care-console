// src/components/common/EventTargetBadge.tsx

import React from 'react';
import { HiOutlineTag } from 'react-icons/hi';
import { Patient } from '@/types/patient';

interface EventTargetBadgeProps {
  patient: Patient;
  context?: 'management' | 'visit-management';
}

const EventTargetBadge: React.FC<EventTargetBadgeProps> = ({ patient, context = 'management' }) => {
  // 이벤트 타겟이 아니면 아무것도 표시하지 않음
  if (!patient.eventTargetInfo?.isEventTarget) {
    return null;
  }

  // 상담관리 메뉴에서의 구분
  if (context === 'management') {
    const hasVisitCompleted = patient.visitConfirmed === true;
    
    if (hasVisitCompleted) {
      // 내원완료 후 이벤트 타겟 - 파란색
      return (
        <span 
          className="inline-flex items-center justify-center w-4 h-4 ml-1 text-blue-600"
          title="내원완료 후 이벤트 타겟 관리 대상"
        >
          <HiOutlineTag size={14} />
        </span>
      );
    } else {
      // 일반 이벤트 타겟 - 주황색
      return (
        <span 
          className="inline-flex items-center justify-center w-4 h-4 ml-1 text-orange-600"
          title="전화상담 단계 이벤트 타겟 관리 대상"
        >
          <HiOutlineTag size={14} />
        </span>
      );
    }
  }

  // 내원관리 메뉴에서의 표시 (내원완료 후 이벤트 타겟과 동일한 색상)
  if (context === 'visit-management') {
    return (
      <span 
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-blue-600"
        title="이벤트 타겟 관리 대상"
      >
        <HiOutlineTag size={14} />
      </span>
    );
  }

  return null;
};

export default EventTargetBadge;