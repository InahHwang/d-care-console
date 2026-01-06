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

// 구환 정보
export interface LegacyPatientInfo {
  name: string;
  isLegacy: true;
}

export interface CTIEvent {
  id: string;
  eventType: 'INCOMING_CALL' | 'OUTGOING_CALL' | 'CALL_ANSWERED' | 'CALL_ENDED' | 'MISSED_CALL';
  callerNumber: string;
  calledNumber: string;
  timestamp: string;
  receivedAt: string;
  patient?: PatientInfo | null;
  legacyPatient?: LegacyPatientInfo | null;  // 구환 정보
  isNewCustomer?: boolean;
  isNewPatient?: boolean;  // 발신 시 자동 등록된 환자
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

    // CTI 이벤트 수신 (인바운드)
    channel.bind('incoming-call', async (data: any) => {
      console.log('[CTI Hook] 전화 수신:', data);

      const { isNewPatient, callLog } = data;

      // 구환 정보 조회 (기존 환자가 없고 신규 등록도 아닌 경우만)
      let legacyPatient: LegacyPatientInfo | null = null;
      if (data.callerNumber && !data.patient && !isNewPatient) {
        try {
          const response = await fetch(`/api/legacy-patients?phone=${encodeURIComponent(data.callerNumber)}`);
          const result = await response.json();
          if (result.found) {
            legacyPatient = { name: result.name, isLegacy: true };
            console.log('[CTI Hook] 구환 매칭:', legacyPatient.name);
          }
        } catch (error) {
          console.error('[CTI Hook] 구환 조회 오류:', error);
        }
      }

      const incomingEvent: CTIEvent = {
        id: callLog?.callId || data.id || `incoming-${Date.now()}`,
        eventType: 'INCOMING_CALL',
        callerNumber: data.callerNumber || '',
        calledNumber: data.calledNumber || '',
        timestamp: data.timestamp || new Date().toISOString(),
        receivedAt: data.receivedAt || new Date().toISOString(),
        patient: data.patient,
        legacyPatient: legacyPatient,
        isNewCustomer: isNewPatient || data.isNewCustomer,
        isNewPatient: isNewPatient,
      };

      setState(prev => {
        const newEvents = [incomingEvent, ...prev.events].slice(0, 50);
        let newCurrentCall = prev.currentCall;

        if (data.eventType === 'INCOMING_CALL') {
          newCurrentCall = incomingEvent;
        } else if (data.eventType === 'CALL_ENDED' || data.eventType === 'MISSED_CALL') {
          newCurrentCall = null;
        }

        return {
          ...prev,
          events: newEvents,
          currentCall: newCurrentCall,
        };
      });

      // 신규 환자 자동 등록 알림
      if (isNewPatient && data.patient) {
        console.log(`[CTI Hook] 신규 환자 자동 등록됨 (수신): ${data.patient.name} (${data.patient.phoneNumber})`);
      }
    });

    // CTI 이벤트 수신 (아웃바운드 - 발신)
    channel.bind('outgoing-call', async (data: any) => {
      console.log('[CTI Hook] 발신 통화:', data);

      const { patient, callLog, isNewPatient } = data;

      // PatientInfo 형식으로 변환
      const patientInfo: PatientInfo | null = patient ? {
        id: patient._id || patient.id,
        name: patient.name,
        phoneNumber: patient.phoneNumber,
        lastVisit: patient.lastVisit || patient.callInDate,
        notes: patient.memo || patient.notes,
        callCount: patient.callCount,
      } : null;

      const outgoingEvent: CTIEvent = {
        id: callLog?.callId || `outgoing-${Date.now()}`,
        eventType: 'OUTGOING_CALL',
        callerNumber: callLog?.callerNumber || '',  // 치과 번호
        calledNumber: callLog?.phoneNumber || patient?.phoneNumber || '',  // 환자 번호
        timestamp: callLog?.callStartTime || new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        patient: patientInfo,
        isNewCustomer: isNewPatient,
        isNewPatient: isNewPatient,
      };

      setState(prev => {
        const newEvents = [outgoingEvent, ...prev.events].slice(0, 50);

        return {
          ...prev,
          events: newEvents,
          currentCall: outgoingEvent,  // 발신도 현재 통화로 표시
        };
      });

      // 신규 환자 자동 등록 알림
      if (isNewPatient && patient) {
        console.log(`[CTI Hook] 신규 환자 자동 등록됨: ${patient.name} (${patient.phoneNumber})`);
      }
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
