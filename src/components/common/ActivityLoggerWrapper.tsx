// src/components/common/ActivityLoggerWrapper.tsx
import React, { ReactNode } from 'react';
import { useActivityLogger } from '@/hooks/useActivityLogger';

interface ActivityLoggerWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * 활동 로깅 기능을 제공하는 래퍼 컴포넌트
 * 하위 컴포넌트들이 useActivityLogger 훅을 사용할 수 있도록 지원
 */
export const ActivityLoggerWrapper: React.FC<ActivityLoggerWrapperProps> = ({
  children,
  className
}) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

export default ActivityLoggerWrapper;