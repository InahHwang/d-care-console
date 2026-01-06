// src/components/v2/dashboard/CallClassificationCard.tsx
'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Card } from '../ui/Card';

interface CallClassificationCardProps {
  newPatients: number;
  existingPatients: number;
  missed: number;
  other: number;
  onViewCallLogs?: () => void;
  loading?: boolean;
}

export function CallClassificationCard({
  newPatients,
  existingPatients,
  missed,
  other,
  onViewCallLogs,
  loading,
}: CallClassificationCardProps) {
  if (loading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </div>
        <div className="flex items-center gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 bg-gray-50 rounded-xl p-4">
              <div className="h-3 w-12 bg-gray-200 rounded mb-2" />
              <div className="h-6 w-8 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const classifications = [
    { label: '신규 환자', count: newPatients, color: 'bg-blue-500' },
    { label: '기존 환자', count: existingPatients, color: 'bg-emerald-500' },
    { label: '부재중', count: missed, color: 'bg-gray-400' },
    { label: '거래처/기타', count: other, color: 'bg-slate-400' },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">오늘의 통화 분류</h3>
        {onViewCallLogs && (
          <button
            onClick={onViewCallLogs}
            className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            통화 기록 보기 <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-6">
        {classifications.map((item) => (
          <div key={item.label} className="flex-1 bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 ${item.color} rounded-full`} />
              <span className="text-gray-600">{item.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{item.count}건</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default CallClassificationCard;
