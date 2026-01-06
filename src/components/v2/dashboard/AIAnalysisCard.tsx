// src/components/v2/dashboard/AIAnalysisCard.tsx
'use client';

import React from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';

interface AnalysisQueueItem {
  id: string;
  phone: string;
  time: string;
  progress: number;
}

interface AIAnalysisCardProps {
  analyzed: number;
  analyzing: number;
  queue: AnalysisQueueItem[];
  loading?: boolean;
}

export function AIAnalysisCard({ analyzed, analyzing, queue, loading }: AIAnalysisCardProps) {
  if (loading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-24 bg-gray-200 rounded" />
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 bg-gray-100 rounded-xl p-3 h-16" />
          <div className="flex-1 bg-gray-100 rounded-xl p-3 h-16" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="AI 분석 현황"
        icon={<Sparkles size={18} />}
        iconColor="text-purple-500"
        action={<span className="text-xs text-gray-400">오늘</span>}
      />

      {/* 분석 통계 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 bg-purple-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{analyzed}</div>
          <div className="text-xs text-purple-500">분석 완료</div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-600">{analyzing}</div>
          <div className="text-xs text-gray-500">분석 중</div>
        </div>
      </div>

      {/* 분석 대기열 */}
      {queue.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 mb-2">분석 중인 통화</div>
          {queue.map((item) => (
            <div key={item.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{item.phone}</span>
                <span className="text-xs text-gray-400">{item.time}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400 text-sm">
          <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400" />
          모든 분석 완료
        </div>
      )}
    </Card>
  );
}

export default AIAnalysisCard;
