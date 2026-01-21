'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChannelType, ChannelChatV2, ChannelMessageV2, PatientV2, Temperature, ChatStatus } from '@/types/v2';
import {
  ChannelChatRoomList,
  ChannelChatMessageArea,
  ChannelChatPatientPanel,
  ChannelChatPatientMatchModal,
  ChannelChatNewPatientModal,
} from '@/components/v2/channel-chat';
import { useChannelChat } from '@/hooks/useChannelChat';

// ============================================
// 채널 상담 페이지
// ============================================

type ChannelFilter = ChannelType | 'all';
type StatusFilter = 'active' | 'closed';

interface NewPatientData {
  name: string;
  phone: string;
  interest: string;
  temperature: Temperature;
  memo: string;
}

export default function ChannelChatPage() {
  // 상태
  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>('all');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  // 카운트
  const [activeCount, setActiveCount] = useState(0);
  const [closedCount, setClosedCount] = useState(0);

  // 데이터
  const [chats, setChats] = useState<ChannelChatV2[]>([]);
  const [currentChat, setCurrentChat] = useState<ChannelChatV2 | null>(null);
  const [messages, setMessages] = useState<ChannelMessageV2[]>([]);
  const [patient, setPatient] = useState<PatientV2 | null>(null);

  // 로딩 상태
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 모달 상태
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);

  // 매뉴얼 텍스트 삽입 상태
  const [insertManualText, setInsertManualText] = useState<string | undefined>(undefined);

  // 실시간 통신 훅
  const { connected, unreadTotal } = useChannelChat({
    onNewMessage: (event) => {
      // 현재 선택된 채팅에 새 메시지 추가
      if (event.chatId === selectedChatId) {
        // 상담사(agent)가 보낸 메시지는 handleSendMessage에서 이미 추가됨 - 무시
        if (event.message.senderType === 'agent') {
          return;
        }
        // 고객 메시지만 추가
        setMessages((prev) => [...prev, event.message]);
      }
      // 대화방 목록 업데이트
      setChats((prev) =>
        prev.map((chat) =>
          chat._id?.toString() === event.chatId
            ? {
                ...chat,
                lastMessageAt: event.message.createdAt,
                lastMessagePreview: event.message.content.substring(0, 50),
                lastMessageBy: event.message.senderType,
                unreadCount: chat._id?.toString() === selectedChatId ? 0 : (chat.unreadCount || 0) + 1,
              }
            : chat
        )
      );
    },
    onNewChat: (event) => {
      // 새 대화방 추가
      setChats((prev) => [event.chat, ...prev]);
    },
    onMessagesRead: (event) => {
      if (event.chatId === selectedChatId) {
        // 현재 대화방 메시지 읽음 상태 업데이트
        setMessages((prev) =>
          prev.map((msg) => ({ ...msg, status: 'read' as const }))
        );
      }
    },
    onPatientMatched: (event) => {
      // 환자 매칭 업데이트
      setChats((prev) =>
        prev.map((chat) =>
          chat._id?.toString() === event.chatId
            ? { ...chat, patientId: event.patientId, patientName: event.patientName }
            : chat
        )
      );
      if (event.chatId === selectedChatId) {
        setCurrentChat((prev) =>
          prev ? { ...prev, patientId: event.patientId, patientName: event.patientName } : prev
        );
      }
    },
    onChatClosed: (event) => {
      // 상담 종료 업데이트
      setChats((prev) =>
        prev.map((chat) =>
          chat._id?.toString() === event.chatId ? { ...chat, status: 'closed' as const } : chat
        )
      );
    },
    onAIAnalysisComplete: (event) => {
      // AI 분석 결과 업데이트
      if (event.chatId === selectedChatId) {
        setCurrentChat((prev) => (prev ? { ...prev, aiAnalysis: event.analysis } : prev));
      }
    },
  });

  // 대화방 목록 조회
  const fetchChats = useCallback(async () => {
    setIsLoadingChats(true);
    try {
      const params = new URLSearchParams();
      if (selectedChannel !== 'all') params.set('channel', selectedChannel);
      if (searchQuery) params.set('search', searchQuery);
      params.set('status', statusFilter);

      const res = await fetch(`/api/v2/channel-chats?${params}`);
      const data = await res.json();

      if (data.success) {
        setChats(data.data);
      }
    } catch (error) {
      console.error('대화방 목록 조회 오류:', error);
    } finally {
      setIsLoadingChats(false);
    }
  }, [selectedChannel, searchQuery, statusFilter]);

  // 카운트 조회 (진행중/종료됨)
  const fetchCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedChannel !== 'all') params.set('channel', selectedChannel);
      if (searchQuery) params.set('search', searchQuery);

      // 진행중 카운트
      const activeRes = await fetch(`/api/v2/channel-chats?${params}&status=active&limit=1`);
      const activeData = await activeRes.json();
      if (activeData.success) {
        setActiveCount(activeData.total || 0);
      }

      // 종료됨 카운트
      const closedRes = await fetch(`/api/v2/channel-chats?${params}&status=closed&limit=1`);
      const closedData = await closedRes.json();
      if (closedData.success) {
        setClosedCount(closedData.total || 0);
      }
    } catch (error) {
      console.error('카운트 조회 오류:', error);
    }
  }, [selectedChannel, searchQuery]);

  // 대화방 상세 및 메시지 조회
  const fetchChatDetail = useCallback(async (chatId: string) => {
    setIsLoadingMessages(true);
    try {
      const [chatRes, messagesRes] = await Promise.all([
        fetch(`/api/v2/channel-chats/${chatId}`),
        fetch(`/api/v2/channel-chats/${chatId}/messages`),
      ]);

      const chatData = await chatRes.json();
      const messagesData = await messagesRes.json();

      if (chatData.success) {
        setCurrentChat(chatData.data);
        setPatient(chatData.data.patient || null);
      }

      if (messagesData.success) {
        setMessages(messagesData.data);
      }

      // 읽음 처리
      if (chatData.data?.unreadCount > 0) {
        await fetch(`/api/v2/channel-chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unreadCount: 0 }),
        });
        // 로컬 상태 업데이트
        setChats((prev) =>
          prev.map((chat) =>
            chat._id?.toString() === chatId ? { ...chat, unreadCount: 0 } : chat
          )
        );
      }
    } catch (error) {
      console.error('대화방 상세 조회 오류:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // 메시지 전송
  const handleSendMessage = async (content: string) => {
    if (!selectedChatId || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/v2/channel-chats/${selectedChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (data.success) {
        // 메시지 목록에 추가 (Pusher로도 받지만 즉시 반영, id 정규화)
        const normalizedMessage = {
          ...data.data,
          id: data.data._id?.toString() || data.data.id,
        };
        setMessages((prev) => [...prev, normalizedMessage]);
        // 목록 업데이트
        setChats((prev) =>
          prev.map((chat) =>
            chat._id?.toString() === selectedChatId
              ? {
                  ...chat,
                  lastMessageAt: data.data.createdAt,
                  lastMessagePreview: content.substring(0, 50),
                  lastMessageBy: 'agent',
                }
              : chat
          )
        );
      }
    } catch (error) {
      console.error('메시지 전송 오류:', error);
    } finally {
      setIsSending(false);
    }
  };

  // 대화방 선택
  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    fetchChatDetail(chatId);
  };

  // 환자 매칭
  const handleMatchPatient = async (patientId: string) => {
    if (!selectedChatId) return;

    try {
      const res = await fetch(`/api/v2/channel-chats/${selectedChatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      });

      const data = await res.json();

      if (data.success) {
        fetchChatDetail(selectedChatId);
        fetchChats();
      }
    } catch (error) {
      console.error('환자 매칭 오류:', error);
    }
  };

  // 신규 환자 등록
  const handleRegisterPatient = async (patientData: NewPatientData) => {
    try {
      const patientRes = await fetch('/api/v2/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: patientData.name,
          phone: patientData.phone.replace(/-/g, ''),
          interest: patientData.interest,
          temperature: patientData.temperature,
          memo: patientData.memo,
          status: 'consulting',
          source: '채팅상담',
          aiRegistered: false,
        }),
      });

      const patientResult = await patientRes.json();

      if (patientResult.success && selectedChatId) {
        await handleMatchPatient(patientResult.data._id);
      }
    } catch (error) {
      console.error('환자 등록 오류:', error);
    }
  };

  // 상담 결과 입력
  const handleInputConsultation = () => {
    alert('상담 결과 입력은 기존 모달과 연동 예정입니다.');
  };

  // 대화방 삭제
  const handleDeleteChat = async (chatId: string) => {
    try {
      const res = await fetch(`/api/v2/channel-chats/${chatId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        // 목록에서 제거
        setChats((prev) => prev.filter((chat) => chat._id?.toString() !== chatId));
        // 현재 선택된 채팅이면 선택 해제
        if (selectedChatId === chatId) {
          setSelectedChatId(null);
          setCurrentChat(null);
          setMessages([]);
          setPatient(null);
        }
        // 카운트 업데이트
        fetchCounts();
      }
    } catch (error) {
      console.error('대화방 삭제 오류:', error);
    }
  };

  // 상담 종료
  const handleCloseChat = async (chatId: string) => {
    try {
      const res = await fetch(`/api/v2/channel-chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });

      const data = await res.json();

      if (data.success) {
        // 목록에서 상태 업데이트
        setChats((prev) =>
          prev.map((chat) =>
            chat._id?.toString() === chatId ? { ...chat, status: 'closed' as const } : chat
          )
        );
        // 현재 선택된 채팅이면 상태 업데이트
        if (selectedChatId === chatId) {
          setCurrentChat((prev) => prev ? { ...prev, status: 'closed' as const } : prev);
        }
        // 진행중 탭이면 목록에서 제거 (종료된 건 종료됨 탭에서만 보임)
        if (statusFilter === 'active') {
          setChats((prev) => prev.filter((chat) => chat._id?.toString() !== chatId));
          // 선택 해제
          if (selectedChatId === chatId) {
            setSelectedChatId(null);
            setCurrentChat(null);
            setMessages([]);
            setPatient(null);
          }
        }
        // 카운트 업데이트
        fetchCounts();
      }
    } catch (error) {
      console.error('상담 종료 오류:', error);
    }
  };

  // 초기 로드
  useEffect(() => {
    fetchChats();
    fetchCounts();
  }, [fetchChats, fetchCounts]);

  // 검색어 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchChats();
      fetchCounts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchChats, fetchCounts]);

  return (
    <>
      <div className="h-[calc(100vh-2rem)] flex bg-gray-50">
        {/* 좌측: 대화방 목록 */}
        <ChannelChatRoomList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLoading={isLoadingChats}
          onRefresh={fetchChats}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onDeleteChat={handleDeleteChat}
          activeCount={activeCount}
          closedCount={closedCount}
        />

        {/* 중앙: 채팅 영역 */}
        <ChannelChatMessageArea
          chat={currentChat}
          messages={messages}
          isLoading={isLoadingMessages}
          onSendMessage={handleSendMessage}
          isSending={isSending}
          insertText={insertManualText}
          onInsertComplete={() => setInsertManualText(undefined)}
          onCloseChat={handleCloseChat}
        />

        {/* 우측: 환자 정보 패널 */}
        <ChannelChatPatientPanel
          chat={currentChat}
          patient={patient}
          onMatchPatient={() => setIsMatchModalOpen(true)}
          onRegisterPatient={() => setIsNewPatientModalOpen(true)}
          onInputConsultation={handleInputConsultation}
          onInsertManualText={(text) => setInsertManualText(text)}
        />
      </div>

      {/* 환자 매칭 모달 */}
      <ChannelChatPatientMatchModal
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        onMatch={handleMatchPatient}
        initialPhone={currentChat?.phone}
      />

      {/* 신규 환자 등록 모달 */}
      <ChannelChatNewPatientModal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        onRegister={handleRegisterPatient}
        initialPhone={currentChat?.phone}
        initialName={currentChat?.patientName}
      />

      {/* 실시간 연결 상태 표시 (디버그용) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 text-xs">
          <span
            className={`px-2 py-1 rounded-full ${
              connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {connected ? 'Realtime Connected' : 'Disconnected'}
          </span>
        </div>
      )}
    </>
  );
}
