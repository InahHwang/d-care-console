// src/components/v2/cti/CTIPanel.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  X,
  User,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Clock,
  Loader2,
} from 'lucide-react';
import Pusher from 'pusher-js';
import { TemperatureIcon } from '../ui/TemperatureIcon';
import type { Temperature } from '@/types/v2';

interface IncomingCall {
  callLogId: string;
  phone: string;
  patientId?: string;
  patientName?: string;
  patientStatus?: string;
  temperature?: Temperature;
  isNewPatient: boolean;
  callTime: string;
  direction?: 'inbound' | 'outbound';
}

interface AnalysisResult {
  callLogId: string;
  patientId?: string;
  classification: string;
  temperature: Temperature;
  summary: string;
}

function formatPhone(phone: string): string {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  return phone;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function CTIPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentCall, setCurrentCall] = useState<IncomingCall | null>(null);
  const [recentCalls, setRecentCalls] = useState<IncomingCall[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisResult | null>(null);
  const [isRinging, setIsRinging] = useState(false);

  // Pusher 연결
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.warn('[CTI v2] Pusher 설정 없음');
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    const channel = pusher.subscribe('cti-v2');

    // 수신 전화
    channel.bind('incoming-call', (data: IncomingCall) => {
      console.log('[CTI v2] 수신 전화:', data);
      const inboundCall: IncomingCall = { ...data, direction: 'inbound' as const };
      setCurrentCall(inboundCall);
      setIsRinging(true);
      setIsExpanded(true);

      // 5초 후 링잉 효과 종료
      setTimeout(() => setIsRinging(false), 5000);

      // 최근 통화 목록에 추가
      setRecentCalls((prev) => [inboundCall, ...prev].slice(0, 5));
    });

    // 발신 전화
    channel.bind('outgoing-call', (data: IncomingCall) => {
      console.log('[CTI v2] 발신 전화:', data);
      const outboundCall: IncomingCall = { ...data, direction: 'outbound' as const };
      setCurrentCall(outboundCall);
      setIsExpanded(true);

      // 최근 통화 목록에 추가
      setRecentCalls((prev) => [outboundCall, ...prev].slice(0, 5));
    });

    // 통화 종료
    channel.bind('call-ended', (data: { callLogId: string; duration: number }) => {
      console.log('[CTI v2] 통화 종료:', data);
      if (currentCall?.callLogId === data.callLogId) {
        setIsRinging(false);
      }
    });

    // AI 분석 완료
    channel.bind('analysis-complete', (data: AnalysisResult) => {
      console.log('[CTI v2] 분석 완료:', data);
      setLatestAnalysis(data);

      // 현재 통화의 분석이면 업데이트
      if (currentCall?.callLogId === data.callLogId) {
        setCurrentCall((prev) =>
          prev ? { ...prev, temperature: data.temperature } : null
        );
      }
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [currentCall]);

  // 전화 걸기 (CTI 이벤트 수신)
  useEffect(() => {
    const handleCtiCall = (e: CustomEvent<{ phone: string }>) => {
      console.log('[CTI v2] 발신 요청:', e.detail.phone);
      // TODO: CTI Bridge로 발신 명령 전송
    };

    window.addEventListener('cti-call', handleCtiCall as EventListener);
    return () => {
      window.removeEventListener('cti-call', handleCtiCall as EventListener);
    };
  }, []);

  const handleDismiss = () => {
    setCurrentCall(null);
    setIsRinging(false);
    setLatestAnalysis(null);
  };

  const handlePatientClick = (patientId?: string) => {
    if (patientId) {
      window.location.href = `/v2/patients/${patientId}`;
    }
  };

  // 접힌 상태
  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 left-64 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className={`
            flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg transition-all
            ${isRinging
              ? 'bg-blue-500 text-white animate-pulse'
              : 'bg-white text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          <Phone size={20} />
          <span className="font-medium">CTI</span>
          {recentCalls.length > 0 && (
            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
              {recentCalls.length}
            </span>
          )}
          <ChevronUp size={16} />
        </button>
      </div>
    );
  }

  // 펼쳐진 상태
  return (
    <div className="fixed bottom-4 left-64 z-50 w-80">
      <div
        className={`
          bg-white rounded-xl shadow-xl overflow-hidden
          ${isRinging ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        `}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-gray-500" />
            <span className="font-medium text-gray-700">CTI 패널</span>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <ChevronDown size={18} className="text-gray-500" />
          </button>
        </div>

        {/* 현재 통화 */}
        {currentCall && (
          <div
            className={`
              p-4 border-b
              ${isRinging ? 'bg-blue-50' : 'bg-white'}
            `}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center
                    ${isRinging ? 'bg-blue-500 animate-pulse' : currentCall.direction === 'outbound' ? 'bg-emerald-100' : 'bg-blue-100'}
                  `}
                >
                  {currentCall.direction === 'outbound' ? (
                    <PhoneOutgoing
                      size={20}
                      className="text-emerald-600"
                    />
                  ) : (
                    <PhoneIncoming
                      size={20}
                      className={isRinging ? 'text-white' : 'text-blue-600'}
                    />
                  )}
                </div>
                <div>
                  <div className="font-bold text-gray-900">
                    {currentCall.patientName || formatPhone(currentCall.phone)}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className={currentCall.direction === 'outbound' ? 'text-emerald-600' : ''}>
                      {currentCall.direction === 'outbound' ? '발신' : '수신'}
                    </span>
                    <span className="mx-1">·</span>
                    {currentCall.isNewPatient ? (
                      <span className="text-blue-600">신규</span>
                    ) : (
                      <span>기존</span>
                    )}
                    <span className="mx-1">·</span>
                    <span>{formatTime(currentCall.callTime)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* 환자 정보 */}
            {currentCall.patientId && (
              <button
                onClick={() => handlePatientClick(currentCall.patientId)}
                className="w-full flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <User size={16} className="text-gray-400" />
                <span className="text-sm text-gray-600 flex-1">
                  환자 상세 보기
                </span>
                {currentCall.temperature && (
                  <TemperatureIcon temperature={currentCall.temperature} />
                )}
              </button>
            )}

            {/* AI 분석 결과 */}
            {latestAnalysis?.callLogId === currentCall.callLogId && (
              <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-purple-500" />
                  <span className="text-xs font-medium text-purple-600">
                    AI 분석 완료
                  </span>
                </div>
                <p className="text-sm text-purple-700">{latestAnalysis.summary}</p>
              </div>
            )}
          </div>
        )}

        {/* 분석 중 표시 */}
        {!currentCall && latestAnalysis && (
          <div className="p-4 border-b bg-purple-50">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-purple-500" />
              <span className="text-xs font-medium text-purple-600">
                최근 분석
              </span>
            </div>
            <p className="text-sm text-purple-700 line-clamp-2">
              {latestAnalysis.summary}
            </p>
          </div>
        )}

        {/* 최근 통화 목록 */}
        {recentCalls.length > 0 && (
          <div className="max-h-48 overflow-y-auto">
            {recentCalls.map((call, index) => (
              <div
                key={`${call.callLogId}-${index}`}
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                onClick={() => handlePatientClick(call.patientId)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${call.direction === 'outbound' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                  {call.direction === 'outbound' ? (
                    <PhoneOutgoing size={14} className="text-emerald-500" />
                  ) : (
                    <PhoneIncoming size={14} className="text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 truncate">
                    {call.patientName || formatPhone(call.phone)}
                  </div>
                  <div className="text-xs text-gray-400">
                    <span className={call.direction === 'outbound' ? 'text-emerald-500' : 'text-blue-500'}>
                      {call.direction === 'outbound' ? '발신' : '수신'}
                    </span>
                    <span className="mx-1">·</span>
                    {formatTime(call.callTime)}
                  </div>
                </div>
                {call.temperature && (
                  <TemperatureIcon temperature={call.temperature} size={12} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!currentCall && recentCalls.length === 0 && (
          <div className="p-6 text-center">
            <Phone size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">대기 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CTIPanel;
