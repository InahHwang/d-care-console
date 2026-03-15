// src/components/v2/schedules/CallbackDetailPanel.tsx
// 콜백 상세 패널 - 상담 컨텍스트 정보 포함
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  CheckCircle,
  XCircle,
  RefreshCw,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  MessageSquareText,
  StickyNote,
  Hash,
  CalendarClock,
} from 'lucide-react';
import { TemperatureIcon } from '@/components/v2/common/TemperatureIcon';
import { ConsultationHistory } from '@/components/v2/patients/ConsultationHistory';
import type { Temperature, CallbackStatus, PatientStatus } from '@/types/v2';
import { PATIENT_STATUS_CONFIG } from '@/types/v2';

// ============= Types =============
interface CallbackItem {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientInterest: string;
  patientTemperature: Temperature;
  patientStatus: string;
  type: 'callback' | 'recall' | 'thanks';
  scheduledAt: string;
  status: CallbackStatus;
  note?: string;
  completedAt?: string;
}

interface CallLogEntry {
  id: string;
  callTime: string;
  callType: 'inbound' | 'outbound';
  duration: number;
  summary: string;
}

interface ConsultationRecord {
  id: string;
  type?: 'phone' | 'visit';
  status: 'agreed' | 'disagreed' | 'pending' | 'no_answer' | 'closed';
  treatment: string;
  originalAmount: number;
  finalAmount: number;
  disagreeReasons?: string[];
  correctionPlan?: string;
  appointmentDate?: string;
  callbackDate?: string;
  consultantName: string;
  memo?: string;
  date: string;
  createdAt: string;
}

interface PatientContext {
  memo: string;
  callCount: number;
  lastContactAt?: string;
  createdAt: string;
  callLogs: CallLogEntry[];
  consultations: ConsultationRecord[];
}

interface CallbackDetailPanelProps {
  callback: CallbackItem;
  onCall: (phone: string) => void;
  onStatusChange: (id: string, status: CallbackStatus) => void;
  onPatientClick: (id: string) => void;
}

// ============= Constants =============
const CONSULTATION_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  agreed: { label: '동의', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  disagreed: { label: '미동의', color: 'text-rose-700', bg: 'bg-rose-100' },
  pending: { label: '보류', color: 'text-amber-700', bg: 'bg-amber-100' },
  no_answer: { label: '부재중', color: 'text-gray-700', bg: 'bg-gray-100' },
  closed: { label: '종결', color: 'text-gray-500', bg: 'bg-gray-100' },
};

// ============= Helpers =============
function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return '0초';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}초`;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function getDaysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

// ============= Component =============
export function CallbackDetailPanel({
  callback,
  onCall,
  onStatusChange,
  onPatientClick,
}: CallbackDetailPanelProps) {
  const [context, setContext] = useState<PatientContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const prevPatientIdRef = useRef<string>('');

  const statusConfig = PATIENT_STATUS_CONFIG[callback.patientStatus as PatientStatus];
  const statusLabel = statusConfig?.label || callback.patientStatus || '신규';
  const interestLabel = callback.patientInterest;
  const subtitle = [statusLabel, interestLabel].filter(Boolean).join(' · ');

  // 환자 컨텍스트 데이터 fetch (환자가 바뀔 때만)
  useEffect(() => {
    if (!callback.patientId || callback.patientId === prevPatientIdRef.current) return;
    prevPatientIdRef.current = callback.patientId;

    let cancelled = false;
    setContextLoading(true);

    Promise.all([
      fetch(`/api/v2/patients/${callback.patientId}`).then(r => r.json()),
      fetch(`/api/v2/consultations?patientId=${callback.patientId}&limit=10`).then(r => r.json()),
    ])
      .then(([patientRes, consultRes]) => {
        if (cancelled) return;
        const p = patientRes?.patient;
        const consultations = consultRes?.data?.consultations || [];

        setContext({
          memo: p?.memo || '',
          callCount: p?.callCount || 0,
          lastContactAt: p?.lastContactAt || undefined,
          createdAt: p?.createdAt || '',
          callLogs: (patientRes?.callLogs || []).map((log: Record<string, unknown>) => ({
            id: log.id as string,
            callTime: log.callTime as string,
            callType: log.callType as string,
            duration: log.duration as number,
            summary: log.summary as string,
          })),
          consultations: consultations.map((c: Record<string, unknown>) => ({
            id: c.id as string,
            type: c.type as string,
            status: c.status as string,
            treatment: c.treatment as string,
            originalAmount: c.originalAmount as number,
            finalAmount: c.finalAmount as number,
            disagreeReasons: c.disagreeReasons as string[],
            correctionPlan: c.correctionPlan as string,
            appointmentDate: c.appointmentDate as string,
            callbackDate: c.callbackDate as string,
            consultantName: c.consultantName as string,
            memo: c.memo as string,
            date: c.date as string,
            createdAt: c.createdAt as string,
          })),
        });
      })
      .catch(err => {
        if (!cancelled) console.error('Failed to fetch patient context:', err);
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });

    return () => { cancelled = true; };
  }, [callback.patientId]);

  // 직전 상담 결과
  const lastConsultation = context?.consultations?.[0];
  const lastConsultStatus = lastConsultation
    ? CONSULTATION_STATUS_CONFIG[lastConsultation.status] || CONSULTATION_STATUS_CONFIG.pending
    : null;

  // 최근 통화 3건
  const recentCalls = context?.callLogs?.slice(0, 3) || [];

  return (
    <div className="h-full flex flex-col">
      {/* ===== 헤더: 환자 정보 + 액션 ===== */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{callback.patientName}</h2>
              <TemperatureIcon temperature={callback.patientTemperature} size={18} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={() => onPatientClick(callback.patientId)}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex-shrink-0 mt-1"
          >
            환자 상세 →
          </button>
        </div>

        {/* 전화번호 + 액션 버튼 */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onCall(callback.patientPhone)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Phone size={14} />
            {callback.patientPhone}
          </button>
          {callback.status === 'pending' && (
            <>
              <button
                onClick={() => onStatusChange(callback.id, 'completed')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle size={14} />
                완료
              </button>
              <button
                onClick={() => onStatusChange(callback.id, 'missed')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                <XCircle size={14} />
                미연결
              </button>
            </>
          )}
          {callback.status === 'missed' && (
            <button
              onClick={() => onStatusChange(callback.id, 'pending')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              <RefreshCw size={14} />
              대기로
            </button>
          )}
          {callback.status === 'completed' && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle size={14} />
              {callback.completedAt ? `${callback.completedAt.slice(0, 16).replace('T', ' ')} 완료` : '완료됨'}
            </span>
          )}
        </div>
      </div>

      {/* ===== 스크롤 영역: 콜백 정보 + 컨텍스트 ===== */}
      <div className="flex-1 overflow-y-auto">

        {/* 콜백 정보 */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-gray-500">
              <CalendarClock size={14} />
              <span>{formatDateTime(callback.scheduledAt)}</span>
            </div>
            <span className={`inline-flex items-center gap-1 text-sm font-medium ${
              callback.status === 'pending' ? 'text-amber-600' :
              callback.status === 'completed' ? 'text-emerald-600' :
              'text-red-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                callback.status === 'pending' ? 'bg-amber-500' :
                callback.status === 'completed' ? 'bg-emerald-500' :
                'bg-red-500'
              }`} />
              {callback.status === 'pending' ? '대기' : callback.status === 'completed' ? '완료' : '미연결'}
            </span>
          </div>
          {callback.note && (
            <p className="text-sm text-gray-600 mt-1.5 pl-5">{callback.note}</p>
          )}
        </div>

        {/* 로딩 상태 */}
        {contextLoading && (
          <div className="px-4 py-6 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              환자 정보 불러오는 중...
            </div>
          </div>
        )}

        {/* 컨텍스트 정보 (로딩 완료 후) */}
        {context && !contextLoading && (
          <>
            {/* ===== 퀵 컨텍스트 카드 (3칸 그리드) ===== */}
            <div className="px-4 py-3 border-b">
              <div className="grid grid-cols-3 gap-2">
                {/* 직전 상담 결과 */}
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-[11px] text-gray-400 mb-1">직전 상담</p>
                  {lastConsultation ? (
                    <>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${lastConsultStatus!.bg} ${lastConsultStatus!.color}`}>
                        {lastConsultStatus!.label}
                      </span>
                      {lastConsultation.status === 'disagreed' && lastConsultation.disagreeReasons?.[0] && (
                        <p className="text-[11px] text-rose-500 mt-1 truncate" title={lastConsultation.disagreeReasons[0]}>
                          {lastConsultation.disagreeReasons[0]}
                        </p>
                      )}
                      {lastConsultation.status === 'agreed' && lastConsultation.appointmentDate && (
                        <p className="text-[11px] text-emerald-600 mt-1">
                          예약 {formatShortDate(lastConsultation.appointmentDate)}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-300">없음</span>
                  )}
                </div>

                {/* 통화 횟수 */}
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-[11px] text-gray-400 mb-1">통화 이력</p>
                  <div className="flex items-center justify-center gap-1">
                    <Hash size={13} className="text-blue-500" />
                    <span className="text-lg font-bold text-gray-800">{context.callCount}</span>
                    <span className="text-xs text-gray-400">회</span>
                  </div>
                </div>

                {/* 마지막 통화 */}
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-[11px] text-gray-400 mb-1">마지막 통화</p>
                  {context.lastContactAt ? (
                    <>
                      <p className="text-sm font-semibold text-gray-800">
                        {getDaysAgo(context.lastContactAt)}
                      </p>
                      {recentCalls[0] && (
                        <p className="text-[11px] text-gray-400">
                          {formatDuration(recentCalls[0].duration)}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-300">기록 없음</span>
                  )}
                </div>
              </div>
            </div>

            {/* ===== 환자 메모 (있을 때만) ===== */}
            {context.memo && (
              <div className="px-4 py-3 border-b">
                <div className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2.5">
                  <StickyNote size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-900 leading-relaxed">{context.memo}</p>
                </div>
              </div>
            )}

            {/* ===== 최근 통화 기록 ===== */}
            {recentCalls.length > 0 && (
              <div className="px-4 py-3 border-b">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Phone size={12} />
                  최근 통화
                </h4>
                <div className="space-y-2">
                  {recentCalls.map((log) => (
                    <div key={log.id} className="bg-gray-50 rounded-lg px-3 py-2">
                      {/* 상단: 날짜 + 방향 + 통화시간 */}
                      <div className="flex items-center gap-2 mb-1">
                        {log.callType === 'inbound' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                            <PhoneIncoming size={12} />
                            수신
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <PhoneOutgoing size={12} />
                            발신
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatShortDate(log.callTime)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDuration(log.duration)}
                        </span>
                      </div>
                      {/* 하단: AI 요약 */}
                      {log.summary && (
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                          {log.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== 상담 이력 ===== */}
            <div className="px-4 py-3">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquareText size={12} />
                상담 이력
              </h4>
              <ConsultationHistory
                consultations={context.consultations}
                loading={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
