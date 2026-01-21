// src/hooks/useChannelChat.ts
// 채널 상담 실시간 통신 훅 (Pusher 기반)

import { useState, useEffect, useCallback, useRef } from 'react';
import Pusher from 'pusher-js';
import {
  ChannelChatV2,
  ChannelMessageV2,
  NewMessageEvent,
  NewChatEvent,
  MessagesReadEvent,
  PatientMatchedEvent,
  ChatClosedEvent,
  AIAnalysisCompleteEvent,
} from '@/types/v2';

// ============================================
// 상태 타입
// ============================================

interface ChannelChatState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  unreadTotal: number;
}

interface UseChannelChatOptions {
  onNewMessage?: (event: NewMessageEvent) => void;
  onNewChat?: (event: NewChatEvent) => void;
  onMessagesRead?: (event: MessagesReadEvent) => void;
  onPatientMatched?: (event: PatientMatchedEvent) => void;
  onChatClosed?: (event: ChatClosedEvent) => void;
  onAIAnalysisComplete?: (event: AIAnalysisCompleteEvent) => void;
}

// ============================================
// 채널 상담 훅
// ============================================

export const useChannelChat = (options: UseChannelChatOptions = {}) => {
  const [state, setState] = useState<ChannelChatState>({
    connected: false,
    connecting: false,
    error: null,
    unreadTotal: 0,
  });

  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<ReturnType<Pusher['subscribe']> | null>(null);
  const optionsRef = useRef(options);

  // 옵션 최신 상태 유지
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Pusher 연결
  const connect = useCallback(() => {
    if (pusherRef.current) {
      return; // 이미 연결됨
    }

    setState((prev) => ({ ...prev, connecting: true, error: null }));
    console.log('[ChannelChat] Pusher 연결 시작...');

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.error('[ChannelChat] Pusher 설정이 없습니다');
      setState((prev) => ({ ...prev, connecting: false, error: 'Pusher 설정 오류' }));
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    pusherRef.current = pusher;

    // 채널 구독
    const channel = pusher.subscribe('channel-chat-v2');
    channelRef.current = channel;

    // 연결 성공
    channel.bind('pusher:subscription_succeeded', () => {
      console.log('[ChannelChat] Pusher 채널 구독 성공');
      setState((prev) => ({ ...prev, connected: true, connecting: false }));
    });

    // 연결 에러
    channel.bind('pusher:subscription_error', (error: Error) => {
      console.error('[ChannelChat] Pusher 구독 에러:', error);
      setState((prev) => ({ ...prev, connected: false, connecting: false, error: '연결 실패' }));
    });

    // 이벤트 바인딩
    channel.bind('new-message', (data: NewMessageEvent) => {
      console.log('[ChannelChat] 새 메시지:', data);
      optionsRef.current.onNewMessage?.(data);
    });

    channel.bind('new-chat', (data: NewChatEvent) => {
      console.log('[ChannelChat] 새 대화방:', data);
      optionsRef.current.onNewChat?.(data);
    });

    channel.bind('messages-read', (data: MessagesReadEvent) => {
      console.log('[ChannelChat] 읽음 처리:', data);
      optionsRef.current.onMessagesRead?.(data);
    });

    channel.bind('patient-matched', (data: PatientMatchedEvent) => {
      console.log('[ChannelChat] 환자 매칭:', data);
      optionsRef.current.onPatientMatched?.(data);
    });

    channel.bind('chat-closed', (data: ChatClosedEvent) => {
      console.log('[ChannelChat] 상담 종료:', data);
      optionsRef.current.onChatClosed?.(data);
    });

    channel.bind('ai-analysis-complete', (data: AIAnalysisCompleteEvent) => {
      console.log('[ChannelChat] AI 분석 완료:', data);
      optionsRef.current.onAIAnalysisComplete?.(data);
    });

    // Pusher 연결 상태 모니터링
    pusher.connection.bind('state_change', (states: { current: string; previous: string }) => {
      console.log('[ChannelChat] Pusher 상태 변경:', states.previous, '->', states.current);
      if (states.current === 'connected') {
        setState((prev) => ({ ...prev, connected: true, connecting: false }));
      } else if (states.current === 'disconnected' || states.current === 'failed') {
        setState((prev) => ({ ...prev, connected: false, connecting: false }));
      }
    });
  }, []);

  // Pusher 연결 해제
  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unbind_all();
      channelRef.current = null;
    }

    if (pusherRef.current) {
      pusherRef.current.unsubscribe('channel-chat-v2');
      pusherRef.current.disconnect();
      pusherRef.current = null;
    }

    setState({
      connected: false,
      connecting: false,
      error: null,
      unreadTotal: 0,
    });

    console.log('[ChannelChat] Pusher 연결 해제');
  }, []);

  // 읽지 않은 메시지 수 조회
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/channel-chats?limit=1');
      const data = await res.json();
      if (data.success) {
        setState((prev) => ({ ...prev, unreadTotal: data.unreadTotal || 0 }));
      }
    } catch (error) {
      console.error('[ChannelChat] 읽지 않은 메시지 수 조회 오류:', error);
    }
  }, []);

  // 컴포넌트 마운트 시 자동 연결
  useEffect(() => {
    connect();
    fetchUnreadCount();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, fetchUnreadCount]);

  return {
    ...state,
    connect,
    disconnect,
    fetchUnreadCount,
  };
};

export default useChannelChat;
