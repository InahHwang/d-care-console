// src/components/v2/dashboard/AlertsCard.tsx
'use client';

import React from 'react';
import { AlertCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { AlertCard, CardHeader } from '../ui/Card';

interface AlertItem {
  id: string;
  type: string;
  label: string;
  count: number;
  patients: string[];
  color: 'amber' | 'red' | 'orange';
}

interface AlertsCardProps {
  alerts: AlertItem[];
  onAlertClick?: (alert: AlertItem) => void;
  loading?: boolean;
}

export function AlertsCard({ alerts, onAlertClick, loading }: AlertsCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 border-l-4 border-amber-400 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-20 bg-gray-200 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between py-2">
              <div>
                <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
              <div className="h-6 w-12 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const colorClass = {
    red: 'text-red-500',
    amber: 'text-amber-500',
    orange: 'text-orange-500',
  };

  return (
    <AlertCard type="warning">
      <CardHeader
        title="주의 필요"
        icon={<AlertCircle size={18} />}
        iconColor="text-amber-500"
      />

      {alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => onAlertClick?.(alert)}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
            >
              <div>
                <div className="text-sm font-medium text-gray-900">{alert.label}</div>
                <div className="text-xs text-gray-400">
                  {alert.patients.slice(0, 2).join(', ')}
                  {alert.count > 2 ? ` 외 ${alert.count - 2}명` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${colorClass[alert.color]}`}>
                  {alert.count}명
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400 text-sm">
          <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400" />
          모든 환자 정상 관리 중
        </div>
      )}
    </AlertCard>
  );
}

export default AlertsCard;
