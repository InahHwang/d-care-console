// src/components/v2/dashboard/RecentPatientsCard.tsx
'use client';

import React from 'react';
import { Users, ChevronRight } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { TemperatureIcon } from '../ui/TemperatureIcon';
import { NewBadge } from '../ui/Badge';
import { Temperature } from '@/types/v2';

interface RecentPatient {
  id: string;
  name: string;
  time: string;
  interest: string;
  temperature: Temperature;
  status: 'new' | 'existing';
}

interface RecentPatientsCardProps {
  patients: RecentPatient[];
  onPatientClick?: (patient: RecentPatient) => void;
  onViewAll?: () => void;
  loading?: boolean;
}

export function RecentPatientsCard({
  patients,
  onPatientClick,
  onViewAll,
  loading,
}: RecentPatientsCardProps) {
  if (loading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-24 bg-gray-200 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="h-4 w-20 bg-gray-200 rounded mb-1" />
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
        title="최근 등록 환자"
        icon={<Users size={18} />}
        iconColor="text-blue-500"
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

      {patients.length > 0 ? (
        <div className="space-y-3">
          {patients.map((patient) => (
            <div
              key={patient.id}
              onClick={() => onPatientClick?.(patient)}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{patient.name}</span>
                  <TemperatureIcon temperature={patient.temperature} />
                  {patient.status === 'new' && <NewBadge />}
                </div>
                <div className="text-sm text-gray-500">
                  {patient.interest} · {patient.time}
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 text-sm">
          오늘 등록된 환자가 없습니다
        </div>
      )}
    </Card>
  );
}

export default RecentPatientsCard;
