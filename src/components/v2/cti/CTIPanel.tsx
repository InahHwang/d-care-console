// src/components/v2/cti/CTIPanel.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneCall,
  X,
  User,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CalendarCheck,
  UserPlus,
  BookOpen,
} from 'lucide-react';
import ManualSidePanel from '../manual/ManualSidePanel';
import Pusher from 'pusher-js';
import { TemperatureIcon } from '../ui/TemperatureIcon';
import type { Temperature } from '@/types/v2';

// CTIBridge 로컬 서버 URL
const CTI_BRIDGE_URL = 'http://localhost:5080';

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

// 콜백 타입 정의
type CallbackType = 'callback' | 'recall' | 'thanks';

interface PendingCallback {
  id: string;
  patientId: string;
  type: CallbackType;
  scheduledAt: string;
  note?: string;
  source: 'callbacks_v2' | 'patient';
}

const CALLBACK_TYPE_LABELS: Record<CallbackType, string> = {
  callback: '콜백',
  recall: '리콜',
  thanks: '감사전화',
};

const CALLBACK_TYPE_COLORS: Record<CallbackType, string> = {
  callback: 'bg-blue-500 hover:bg-blue-600',
  recall: 'bg-purple-500 hover:bg-purple-600',
  thanks: 'bg-amber-500 hover:bg-amber-600',
};

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

  // ★ ClickCall 발신 관련 상태
  const [dialNumber, setDialNumber] = useState('');
  const [isDialing, setIsDialing] = useState(false);
  const [dialError, setDialError] = useState<string | null>(null);
  const [ctiStatus, setCtiStatus] = useState<{
    ctiConnected: boolean;
    clickCallActive: boolean;
  } | null>(null);

  // ★ 콜백 처리 관련 상태
  const [pendingCallbacks, setPendingCallbacks] = useState<PendingCallback[]>([]);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [processingCallback, setProcessingCallback] = useState(false);

  // ★ 매뉴얼 패널 상태
  const [showManualPanel, setShowManualPanel] = useState(false);

  // CTIBridge 상태 확인
  const checkCtiStatus = useCallback(async () => {
    try {
      const res = await fetch(`${CTI_BRIDGE_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setCtiStatus(data);
      } else {
        setCtiStatus(null);
      }
    } catch {
      setCtiStatus(null);
    }
  }, []);

  // 주기적으로 CTI 상태 확인
  useEffect(() => {
    checkCtiStatus();
    const interval = setInterval(checkCtiStatus, 5000);
    return () => clearInterval(interval);
  }, [checkCtiStatus]);

  // 환자에게 예정된 콜백이 있는지 확인
  const checkPendingCallbacks = useCallback(async (patientId: string) => {
    try {
      // 오늘 날짜를 기준으로 콜백 조회 (예정일 이전/이후 모두)
      const res = await fetch(`/api/v2/callbacks?patientId=${patientId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.callbacks) {
          const callbacks = data.data.callbacks
            .filter((cb: PendingCallback & { patientId: string; status: string }) =>
              cb.patientId === patientId && cb.status === 'pending'
            )
            .map((cb: PendingCallback & { patientId: string }) => ({
              id: cb.id,
              patientId: cb.patientId,
              type: cb.type,
              scheduledAt: cb.scheduledAt,
              note: cb.note,
              source: cb.source || 'callbacks_v2',
            }));
          setPendingCallbacks(callbacks);
        }
      }
    } catch (error) {
      console.error('[CTI v2] 콜백 조회 실패:', error);
    }
  }, []);

  // 콜백으로 처리
  const handleMarkAsCallback = useCallback(async (callback: PendingCallback) => {
    if (!currentCall?.callLogId) return;

    setProcessingCallback(true);
    try {
      // 1. 통화 기록에 callbackType 태그 추가
      const callLogRes = await fetch('/api/v2/call-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: currentCall.callLogId,
          callbackType: callback.type,
          callbackId: callback.id,
        }),
      });

      if (!callLogRes.ok) {
        console.error('[CTI v2] 통화 기록 태그 추가 실패');
        return;
      }

      // 2. 콜백 완료 처리
      const callbackRes = await fetch('/api/v2/callbacks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: callback.id,
          status: 'completed',
          source: callback.source,
        }),
      });

      if (callbackRes.ok) {
        // 성공 시 해당 콜백을 목록에서 제거
        setPendingCallbacks((prev) => prev.filter((cb) => cb.id !== callback.id));
        console.log('[CTI v2] 콜백 처리 완료:', callback.type);
      }
    } catch (error) {
      console.error('[CTI v2] 콜백 처리 실패:', error);
    } finally {
      setProcessingCallback(false);
    }
  }, [currentCall]);

  // ClickCall 발신
  const handleClickCall = useCallback(async (phoneNumber?: string) => {
    const numberToDial = phoneNumber || dialNumber;
    if (!numberToDial.trim()) {
      setDialError('전화번호를 입력하세요');
      return;
    }

    setIsDialing(true);
    setDialError(null);

    try {
      const res = await fetch(`${CTI_BRIDGE_URL}/api/click-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: numberToDial.replace(/\D/g, '') }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setDialNumber('');
        // 발신 중 상태 표시
        setCurrentCall({
          callLogId: `dial-${Date.now()}`,
          phone: numberToDial,
          isNewPatient: true,
          callTime: new Date().toISOString(),
          direction: 'outbound',
        });
        setIsExpanded(true);
      } else {
        setDialError(data.error || '발신 실패');
      }
    } catch (err) {
      setDialError('CTI 연결 실패 - CTIBridge가 실행 중인지 확인하세요');
    } finally {
      setIsDialing(false);
    }
  }, [dialNumber]);

  // 전화번호 입력 핸들러
  const handleDialNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d-]/g, '');
    setDialNumber(value);
    setDialError(null);
  };

  // Enter 키로 발신
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isDialing) {
      handleClickCall();
    }
  };

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
      setIsCallEnded(false);
      setPendingCallbacks([]);

      // 5초 후 링잉 효과 종료
      setTimeout(() => setIsRinging(false), 5000);

      // 최근 통화 목록에 추가
      setRecentCalls((prev) => [inboundCall, ...prev].slice(0, 5));

      // 환자ID가 있으면 콜백 확인
      if (data.patientId) {
        checkPendingCallbacks(data.patientId);
      }
    });

    // 발신 전화
    channel.bind('outgoing-call', (data: IncomingCall) => {
      console.log('[CTI v2] 발신 전화:', data);
      const outboundCall: IncomingCall = { ...data, direction: 'outbound' as const };
      setCurrentCall(outboundCall);
      setIsExpanded(true);
      setIsCallEnded(false);
      setPendingCallbacks([]);

      // 최근 통화 목록에 추가
      setRecentCalls((prev) => [outboundCall, ...prev].slice(0, 5));

      // 환자ID가 있으면 콜백 확인
      if (data.patientId) {
        checkPendingCallbacks(data.patientId);
      }
    });

    // 통화 종료
    channel.bind('call-ended', (data: { callLogId: string; duration: number; patientId?: string }) => {
      console.log('[CTI v2] 통화 종료:', data);
      if (currentCall?.callLogId === data.callLogId) {
        setIsRinging(false);
        setIsCallEnded(true);

        // 환자ID가 있으면 콜백 확인 (통화 종료 후에도)
        const patientId = data.patientId || currentCall.patientId;
        if (patientId) {
          checkPendingCallbacks(patientId);
        }
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
  }, [currentCall, checkPendingCallbacks]);

  // 전화 걸기 (CTI 이벤트 수신) - 다른 컴포넌트에서 발신 요청
  useEffect(() => {
    const handleCtiCall = (e: CustomEvent<{ phone: string }>) => {
      console.log('[CTI v2] 발신 요청:', e.detail.phone);
      handleClickCall(e.detail.phone);
    };

    window.addEventListener('cti-call', handleCtiCall as EventListener);
    return () => {
      window.removeEventListener('cti-call', handleCtiCall as EventListener);
    };
  }, [handleClickCall]);

  const handleDismiss = () => {
    setCurrentCall(null);
    setIsRinging(false);
    setLatestAnalysis(null);
    setIsCallEnded(false);
    setPendingCallbacks([]);
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
    <div className="fixed bottom-4 left-64 z-50 flex gap-2">
      {/* 매뉴얼 패널 */}
      {showManualPanel && (
        <div className="w-80 h-[500px] bg-white rounded-xl shadow-xl overflow-hidden">
          <ManualSidePanel
            isOpen={showManualPanel}
            onClose={() => setShowManualPanel(false)}
            mode="phone"
          />
        </div>
      )}

      {/* CTI 메인 패널 */}
      <div className="w-80">
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
            {/* CTI 연결 상태 표시 */}
            {ctiStatus ? (
              <span className={`w-2 h-2 rounded-full ${ctiStatus.ctiConnected ? 'bg-green-500' : 'bg-red-500'}`} title={ctiStatus.ctiConnected ? 'CTI 연결됨' : 'CTI 연결 안됨'} />
            ) : (
              <span className="w-2 h-2 rounded-full bg-gray-300" title="CTIBridge 연결 안됨" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowManualPanel(!showManualPanel)}
              className={`p-1.5 rounded transition-colors ${showManualPanel ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-500'}`}
              title="상담 매뉴얼"
            >
              <BookOpen size={16} />
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <ChevronDown size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* 발신 입력 */}
        <div className="p-3 border-b bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={dialNumber}
              onChange={handleDialNumberChange}
              onKeyDown={handleKeyDown}
              placeholder="전화번호 입력"
              className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              disabled={isDialing}
            />
            <button
              onClick={() => handleClickCall()}
              disabled={isDialing || !dialNumber.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1
                ${isDialing || !dialNumber.trim()
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }
              `}
            >
              {isDialing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <PhoneOutgoing size={16} />
              )}
              발신
            </button>
          </div>
          {dialError && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle size={12} />
              {dialError}
            </div>
          )}
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

            {/* 콜백으로 처리 버튼 - 통화 종료 후 예정된 콜백이 있을 때 표시 */}
            {isCallEnded && pendingCallbacks.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarCheck size={14} className="text-blue-500" />
                  <span className="text-xs font-medium text-blue-600">
                    예정된 콜백이 있습니다
                  </span>
                </div>
                <div className="space-y-2">
                  {pendingCallbacks.map((callback) => (
                    <button
                      key={callback.id}
                      onClick={() => handleMarkAsCallback(callback)}
                      disabled={processingCallback}
                      className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-white text-sm font-medium transition-colors ${CALLBACK_TYPE_COLORS[callback.type]} disabled:opacity-50`}
                    >
                      {processingCallback ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      {CALLBACK_TYPE_LABELS[callback.type]}으로 처리
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 신규 환자 등록 버튼 - 신규 환자일 때만 표시 */}
            {currentCall.isNewPatient && !currentCall.patientId && (
              <button
                onClick={() => {
                  // 전화번호를 가지고 환자 등록 모달 열기
                  window.dispatchEvent(new CustomEvent('open-patient-modal', {
                    detail: { phone: currentCall.phone }
                  }));
                }}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-sm font-medium transition-colors"
              >
                <UserPlus size={14} />
                신규 환자 등록
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
    </div>
  );
}

export default CTIPanel;
