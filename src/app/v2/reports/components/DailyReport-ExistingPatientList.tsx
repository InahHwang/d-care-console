// src/app/v2/reports/components/DailyReport-ExistingPatientList.tsx
// 기존 환자 통화 목록 컴포넌트
'use client';

import React from 'react';
import { ExistingPatientCall } from './types';

interface DailyReportExistingPatientListProps {
  calls: ExistingPatientCall[];
  selectedId: string | null;
  onSelect: (call: ExistingPatientCall) => void;
  statusLabels: Record<string, string>;
}

export function DailyReportExistingPatientList({
  calls,
  selectedId,
  onSelect,
  statusLabels,
}: DailyReportExistingPatientListProps) {
  // 통화 시간(초)을 포맷팅
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 bg-orange-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">기존 환자 통화</h3>
          <span className="text-sm text-orange-600 font-medium">
            {calls.length}건
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          치료중/완료 환자와의 통화 (성과 지표 제외)
        </p>
      </div>

      {/* 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {calls.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            기존 환자 통화가 없습니다
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {calls.map((call) => (
              <li
                key={call.id}
                onClick={() => onSelect(call)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  selectedId === call.id
                    ? 'bg-orange-100 border-l-4 border-orange-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{call.name}</span>
                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                      {statusLabels[call.patientStatus] || call.patientStatus}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{call.time}</span>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {call.treatment && (
                    <span>{call.treatment}</span>
                  )}
                  {call.duration && (
                    <span>통화 {formatDuration(call.duration)}</span>
                  )}
                </div>

                {call.aiSummary && (
                  <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                    {call.aiSummary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
