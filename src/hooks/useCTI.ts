// src/hooks/useCTI.ts
// SSE 기반 CTI 이벤트 수신 훅

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PatientInfo {
  id: string;
  name: string;
  phoneNumber: string;
  lastVisit?: string;
  notes?: string;
  callCount?: number;
}

export interface CTIEvent {
  id: string;
  eventType: 'INCOMING_CALL' | 'CALL_ANSWERED' | 'CALL_ENDED' | 'MISSED_CALL';
  callerNumber: string;
  calledNumber: string;
  timestamp: string;
  receivedAt: string;
  patient?: PatientInfo | null;
  isNewCustomer?: boolean;
}

interface CTIState {
  connected: boolean;
  connecting: boolean;
  events: CTIEvent[];
  currentCall: CTIEvent | null;
  error: string | null;
}

export const useCTI = () => {
  const [state, setState] = useState<CTIState>({
    connected: false,
    connecting: false,
    events: [],
    currentCall: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const connect = useCallback(() => {
    // 이미 연결 중이거나 연결된 상태면 무시
    if (eventSourceRef.current) {
      return;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));
    console.log('[CTI Hook] SSE 연결 시작...');

    const eventSource = new EventSource('/api/cti/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[CTI Hook] SSE 연결 성공');
      reconnectAttempts.current = 0;
      setState(prev => ({ ...prev, connected: true, connecting: false, error: null }));
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[CTI Hook] 이벤트 수신:', data);

        // 연결 확인 메시지
        if (data.type === 'connected') {
          console.log('[CTI Hook] 연결 확인됨:', data.clientId);
          return;
        }

        // Heartbeat
        if (data.type === 'heartbeat') {
          console.log('[CTI Hook] Heartbeat:', data.timestamp);
          return;
        }

        // 히스토리 (초기 로드)
        if (data.type === 'history') {
          console.log('[CTI Hook] 히스토리 수신:', data.events?.length, '건');
          setState(prev => ({
            ...prev,
            events: data.events || [],
          }));
          return;
        }

        // CTI 이벤트 (전화 수신 등)
        if (data.eventType) {
          const ctiEvent = data as CTIEvent;
          console.log('[CTI Hook] CTI 이벤트:', ctiEvent.eventType, ctiEvent.callerNumber);

          setState(prev => {
            const newEvents = [ctiEvent, ...prev.events].slice(0, 50);
            let newCurrentCall = prev.currentCall;

            if (ctiEvent.eventType === 'INCOMING_CALL') {
              newCurrentCall = ctiEvent;
              // 브라우저 알림 제거 - CTI 패널과 환자 상세 모달로 대체
            } else if (ctiEvent.eventType === 'CALL_ENDED' || ctiEvent.eventType === 'MISSED_CALL') {
              newCurrentCall = null;
            }

            return {
              ...prev,
              events: newEvents,
              currentCall: newCurrentCall,
            };
          });
        }
      } catch (err) {
        console.error('[CTI Hook] 이벤트 파싱 오류:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[CTI Hook] SSE 오류:', error);

      eventSource.close();
      eventSourceRef.current = null;

      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: '연결이 끊어졌습니다',
      }));

      // 재연결 시도
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`[CTI Hook] ${delay}ms 후 재연결 시도 (${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      } else {
        setState(prev => ({
          ...prev,
          error: '연결 재시도 횟수를 초과했습니다. 페이지를 새로고침해주세요.',
        }));
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    console.log('[CTI Hook] 연결 종료');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
    }));
  }, []);

  const clearCurrentCall = useCallback(() => {
    setState(prev => ({ ...prev, currentCall: null }));
  }, []);

  const clearEvents = useCallback(() => {
    setState(prev => ({ ...prev, events: [] }));
  }, []);

  // 컴포넌트 마운트 시 자동 연결
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    clearCurrentCall,
    clearEvents,
  };
};
