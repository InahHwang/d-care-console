// src/hooks/useCTI.ts
// Pusher 기반 CTI 이벤트 수신 훅 (실시간)

import { useState, useEffect, useCallback, useRef } from 'react';
import Pusher from 'pusher-js';

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

  const pusherRef = useRef<Pusher | null>(null);

  const connect = useCallback(() => {
    // 이미 연결된 상태면 무시
    if (pusherRef.current) {
      return;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));
    console.log('[CTI Hook] Pusher 연결 시작...');

    // Pusher 클라이언트 생성
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.error('[CTI Hook] Pusher 설정이 없습니다');
      setState(prev => ({ ...prev, connecting: false, error: 'Pusher 설정 오류' }));
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    pusherRef.current = pusher;

    // CTI 채널 구독
    const channel = pusher.subscribe('cti-channel');

    // 연결 상태 이벤트
    pusher.connection.bind('connected', () => {
      console.log('[CTI Hook] Pusher 연결 성공');
      setState(prev => ({ ...prev, connected: true, connecting: false, error: null }));
    });

    pusher.connection.bind('error', (error: any) => {
      console.error('[CTI Hook] Pusher 연결 오류:', error);
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: '연결 오류가 발생했습니다',
      }));
    });

    pusher.connection.bind('disconnected', () => {
      console.log('[CTI Hook] Pusher 연결 끊김');
      setState(prev => ({ ...prev, connected: false }));
    });

    // CTI 이벤트 수신
    channel.bind('incoming-call', (data: CTIEvent) => {
      console.log('[CTI Hook] 전화 수신:', data);

      setState(prev => {
        const newEvents = [data, ...prev.events].slice(0, 50);
        let newCurrentCall = prev.currentCall;

        if (data.eventType === 'INCOMING_CALL') {
          newCurrentCall = data;
        } else if (data.eventType === 'CALL_ENDED' || data.eventType === 'MISSED_CALL') {
          newCurrentCall = null;
        }

        return {
          ...prev,
          events: newEvents,
          currentCall: newCurrentCall,
        };
      });
    });

  }, []);

  const disconnect = useCallback(() => {
    console.log('[CTI Hook] Pusher 연결 종료');

    if (pusherRef.current) {
      pusherRef.current.unsubscribe('cti-channel');
      pusherRef.current.disconnect();
      pusherRef.current = null;
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
