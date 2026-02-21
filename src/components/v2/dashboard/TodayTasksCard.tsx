// src/components/v2/dashboard/TodayTasksCard.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, CalendarClock, ChevronRight } from 'lucide-react';

export interface TodayTasks {
  overdue: {
    callback: number;    // 콜백 미처리 (전화상담/내원완료)
    noShow: number;      // 미내원 (내원예약 경과)
    treatmentNoShow: number; // 치료 노쇼 (치료예약 경과)
    total: number;
  };
  today: {
    callback: number;    // 오늘 콜백 예정
    appointment: number; // 오늘 내원 예정
    treatment: number;   // 오늘 치료 예정
    total: number;
  };
  tomorrow: {
    total: number;
  };
}

interface TodayTasksCardProps {
  tasks: TodayTasks | null;
  loading?: boolean;
}

export function TodayTasksCard({ tasks, loading }: TodayTasksCardProps) {
  const router = useRouter();
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  const handleNavigate = (urgency: string, status?: string) => {
    const params = new URLSearchParams();
    params.set('period', 'all');
    params.set('urgency', urgency);
    if (status) params.set('status', status);
    router.push(`/v2/patients?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const overdueTotal = tasks?.overdue.total ?? 0;
  const todayTotal = tasks?.today.total ?? 0;
  const tomorrowTotal = tasks?.tomorrow.total ?? 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 text-lg">오늘 할 일</h3>
        <span className="text-sm text-gray-500">{dateStr}</span>
      </div>

      <div className="space-y-3">
        {/* 즉시 연락 필요 (경과) */}
        {overdueTotal > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <button
              onClick={() => handleNavigate('noshow')}
              className="w-full flex items-center justify-between mb-2 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-lg">
                  <AlertTriangle size={16} className="text-red-600" />
                </div>
                <span className="font-medium text-red-700">즉시 연락 필요</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xl font-bold text-red-600">{overdueTotal}명</span>
                <ChevronRight size={16} className="text-red-400" />
              </div>
            </button>
            <div className="space-y-1 text-sm">
              {(tasks?.overdue.callback ?? 0) > 0 && (
                <button
                  onClick={() => handleNavigate('noshow', 'consulting,visited')}
                  className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-red-100 transition-colors"
                >
                  <span className="text-red-600">콜백 미처리 (전화상담/내원완료)</span>
                  <div className="flex items-center gap-1 text-red-600 font-medium">
                    {tasks?.overdue.callback}명
                    <ChevronRight size={14} />
                  </div>
                </button>
              )}
              {(tasks?.overdue.noShow ?? 0) > 0 && (
                <button
                  onClick={() => handleNavigate('noshow', 'reserved')}
                  className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-red-100 transition-colors"
                >
                  <span className="text-red-600">미내원 (내원예약 경과)</span>
                  <div className="flex items-center gap-1 text-red-600 font-medium">
                    {tasks?.overdue.noShow}명
                    <ChevronRight size={14} />
                  </div>
                </button>
              )}
              {(tasks?.overdue.treatmentNoShow ?? 0) > 0 && (
                <button
                  onClick={() => handleNavigate('noshow', 'treatmentBooked')}
                  className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-red-100 transition-colors"
                >
                  <span className="text-red-600">치료 노쇼 (치료예약 경과)</span>
                  <div className="flex items-center gap-1 text-red-600 font-medium">
                    {tasks?.overdue.treatmentNoShow}명
                    <ChevronRight size={14} />
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 오늘 예정 */}
        <div className={`rounded-xl p-4 ${todayTotal > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
          <button
            onClick={() => todayTotal > 0 && handleNavigate('today')}
            className={`w-full flex items-center justify-between mb-2 ${todayTotal > 0 ? 'hover:opacity-80 transition-opacity cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${todayTotal > 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <Clock size={16} className={todayTotal > 0 ? 'text-blue-600' : 'text-gray-400'} />
              </div>
              <span className={`font-medium ${todayTotal > 0 ? 'text-blue-700' : 'text-gray-500'}`}>오늘 예정</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-xl font-bold ${todayTotal > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{todayTotal}명</span>
              {todayTotal > 0 && <ChevronRight size={16} className="text-blue-400" />}
            </div>
          </button>
          {todayTotal > 0 && (
            <div className="space-y-1 text-sm">
              {(tasks?.today.callback ?? 0) > 0 && (
                <button
                  onClick={() => handleNavigate('today', 'consulting,visited')}
                  className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-blue-100 transition-colors"
                >
                  <span className="text-blue-600">콜백 예정</span>
                  <div className="flex items-center gap-1 text-blue-600 font-medium">
                    {tasks?.today.callback}명
                    <ChevronRight size={14} />
                  </div>
                </button>
              )}
              {(tasks?.today.appointment ?? 0) > 0 && (
                <button
                  onClick={() => handleNavigate('today', 'reserved')}
                  className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-blue-100 transition-colors"
                >
                  <span className="text-blue-600">내원 예정</span>
                  <div className="flex items-center gap-1 text-blue-600 font-medium">
                    {tasks?.today.appointment}명
                    <ChevronRight size={14} />
                  </div>
                </button>
              )}
              {(tasks?.today.treatment ?? 0) > 0 && (
                <button
                  onClick={() => handleNavigate('today', 'treatmentBooked')}
                  className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-blue-100 transition-colors"
                >
                  <span className="text-blue-600">치료 예정</span>
                  <div className="flex items-center gap-1 text-blue-600 font-medium">
                    {tasks?.today.treatment}명
                    <ChevronRight size={14} />
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 내일 예정 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <button
            onClick={() => {
              if (tomorrowTotal > 0) {
                const tmr = new Date();
                tmr.setDate(tmr.getDate() + 1);
                const tmrStr = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`;
                router.push(`/v2/schedules?date=${tmrStr}`);
              }
            }}
            className={`w-full flex items-center justify-between ${tomorrowTotal > 0 ? 'hover:opacity-80 transition-opacity cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-lg">
                <CalendarClock size={16} className="text-gray-500" />
              </div>
              <span className="font-medium text-gray-600">내일 예정</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold text-gray-500">{tomorrowTotal}명</span>
              {tomorrowTotal > 0 && <ChevronRight size={16} className="text-gray-400" />}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default TodayTasksCard;
