// src/components/v2/call-logs/CallLogList.tsx
'use client';

import React from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Sparkles, Clock, MessageSquare } from 'lucide-react';
import { TemperatureIcon } from '../ui/TemperatureIcon';
import { ClassificationBadge } from '../ui/Badge';
import { Temperature } from '@/types/v2';

interface CallLog {
  id: string;
  callTime: string;
  callType: 'inbound' | 'outbound';
  duration: number;
  phone: string;
  callerName: string;
  patientId: string | null;
  patientName: string;
  classification: string;
  interest: string;
  summary: string;
  temperature: Temperature;
  status: 'pending' | 'analyzing' | 'completed';
}

interface CallLogListProps {
  callLogs: CallLog[];
  onCallLogClick?: (callLog: CallLog) => void;
  onPatientClick?: (patientId: string) => void;
  onCallClick?: (phone: string) => void;
  loading?: boolean;
}

function TableSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-8 w-8 bg-gray-200 rounded" /></td>
    </tr>
  );
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDuration(seconds: number) {
  if (seconds === 0) return '부재중';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}초`;
  return `${mins}분 ${secs}초`;
}

function formatPhone(phone: string) {
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
  }
  return phone;
}

function getCallIcon(callType: string, duration: number) {
  if (duration === 0) {
    return <PhoneMissed size={20} className="text-red-500" />;
  }
  if (callType === 'inbound') {
    return <PhoneIncoming size={20} className="text-blue-500" />;
  }
  return <PhoneOutgoing size={20} className="text-emerald-500" />;
}

function getCallTypeLabel(callType: string, duration: number) {
  if (duration === 0) return '부재중';
  return callType === 'inbound' ? '수신' : '발신';
}

export function CallLogList({
  callLogs,
  onCallLogClick,
  onPatientClick,
  onCallClick,
  loading,
}: CallLogListProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">전화번호</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">환자명</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">분류</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">통화시간</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI 요약</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <TableSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (callLogs.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
        <Phone size={48} className="mx-auto text-gray-300 mb-4" />
        <div className="text-gray-400 mb-2">통화 기록이 없습니다</div>
        <div className="text-sm text-gray-300">다른 날짜나 필터를 선택해보세요</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">유형</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">전화번호</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">환자명</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">분류</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">통화시간</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI 요약</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {callLogs.map((log) => (
            <tr
              key={log.id}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onCallLogClick?.(log)}
            >
              {/* 시간 */}
              <td className="px-4 py-3 text-sm text-gray-600">
                {formatTime(log.callTime)}
              </td>

              {/* 유형 */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {getCallIcon(log.callType, log.duration)}
                  <span className={`text-sm font-medium ${
                    log.duration === 0 ? 'text-red-500' :
                    log.callType === 'inbound' ? 'text-blue-600' : 'text-emerald-600'
                  }`}>
                    {getCallTypeLabel(log.callType, log.duration)}
                  </span>
                </div>
              </td>

              {/* 전화번호 */}
              <td className="px-4 py-3 text-sm text-gray-600">
                {formatPhone(log.phone)}
              </td>

              {/* 환자명 */}
              <td className="px-4 py-3">
                {log.patientName ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (log.patientId) onPatientClick?.(log.patientId);
                    }}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {log.patientName}
                  </button>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
                {log.temperature && (
                  <div className="mt-1">
                    <TemperatureIcon temperature={log.temperature} size={14} />
                  </div>
                )}
              </td>

              {/* 분류 */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <ClassificationBadge classification={log.classification} />
                  {log.status === 'analyzing' && (
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full animate-pulse">
                      분석 중
                    </span>
                  )}
                </div>
              </td>

              {/* 통화시간 */}
              <td className="px-4 py-3">
                <span className={`text-sm ${log.duration === 0 ? 'text-red-500' : 'text-gray-600'}`}>
                  {formatDuration(log.duration)}
                </span>
              </td>

              {/* AI 요약 */}
              <td className="px-4 py-3 max-w-xs">
                {log.summary ? (
                  <div className="flex items-start gap-1.5">
                    <Sparkles size={12} className="text-purple-500 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-gray-600 line-clamp-2">{log.summary}</span>
                  </div>
                ) : log.interest ? (
                  <span className="text-xs text-blue-600">{log.interest}</span>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>

              {/* 액션 */}
              <td className="px-4 py-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCallClick?.(log.phone);
                  }}
                  className="w-8 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center justify-center transition-colors"
                  title="전화 걸기"
                >
                  <Phone size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CallLogList;
