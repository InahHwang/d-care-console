// src/components/v2/dashboard/CallbacksCard.tsx
'use client';

import React from 'react';
import { Bell, PhoneCall } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { TemperatureIcon } from '../ui/TemperatureIcon';
import { CallButton } from '../ui/Button';
import { Temperature } from '@/types/v2';

interface CallbackItem {
  id: string;
  name: string;
  phone: string;
  time: string;
  interest: string;
  temperature: Temperature;
}

interface CallbacksCardProps {
  callbacks: CallbackItem[];
  onCall?: (callback: CallbackItem) => void;
  onViewAll?: () => void;
  loading?: boolean;
}

export function CallbacksCard({ callbacks, onCall, onViewAll, loading }: CallbacksCardProps) {
  if (loading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-24 bg-gray-200 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="오늘의 콜백"
        icon={<Bell size={18} />}
        iconColor="text-amber-500"
        action={
          onViewAll && (
            <button
              onClick={onViewAll}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              전체보기
            </button>
          )
        }
      />

      {callbacks.length > 0 ? (
        <div className="space-y-3">
          {callbacks.map((cb) => (
            <div key={cb.id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <span className="font-bold text-amber-600">
                  {cb.time.split(':')[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {cb.name || cb.phone}
                  </span>
                  <TemperatureIcon temperature={cb.temperature} />
                </div>
                <div className="text-sm text-gray-500">
                  {cb.time} · {cb.interest}
                </div>
              </div>
              <CallButton onClick={() => onCall?.(cb)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 text-sm">
          오늘 예정된 콜백이 없습니다
        </div>
      )}
    </Card>
  );
}

export default CallbacksCard;
