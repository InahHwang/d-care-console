// src/components/v2/layout/PageHeader.tsx
'use client';

import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

interface ActionButton {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showAIStatus?: boolean;
  action?: React.ReactNode | ActionButton;
  onRefresh?: () => void;
}

export function PageHeader({
  title,
  subtitle,
  showAIStatus = false,
  action,
  onRefresh,
}: PageHeaderProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showAIStatus && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
              <Sparkles size={16} />
              <span>AI 분석 활성화</span>
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw size={18} />
            </button>
          )}
          {action && (
            typeof action === 'object' && 'onClick' in action ? (
              <button
                onClick={action.onClick}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ) : (
              action
            )
          )}
        </div>
      </div>
    </div>
  );
}

// 필터 영역이 포함된 페이지 헤더
interface PageHeaderWithFilterProps extends PageHeaderProps {
  filterContent?: React.ReactNode;
}

export function PageHeaderWithFilter({
  title,
  subtitle,
  showAIStatus,
  action,
  filterContent,
}: PageHeaderWithFilterProps) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        showAIStatus={showAIStatus}
        action={action}
      />
      {filterContent && (
        <div className="bg-white border-b px-6 py-3">
          {filterContent}
        </div>
      )}
    </>
  );
}

export default PageHeader;
