'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react';
import Pusher from 'pusher-js';

// ============================================
// 웹사이트 채팅 위젯 (환자용)
// 치과 홈페이지에 삽입하여 사용
// ============================================

interface Message {
  id: string;
  content: string;
  senderType: 'customer' | 'staff' | 'system';
  createdAt: string;
}

interface ChatWidgetProps {
  // 위젯 설정
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  welcomeMessage?: string;
  clinicName?: string;
  // API 엔드포인트 (외부 사이트에서 사용 시)
  apiBaseUrl?: string;
}

export function ChatWidget({
  primaryColor = '#3B82F6',
  position = 'bottom-right',
  welcomeMessage = '안녕하세요! 무엇을 도와드릴까요?',
  clinicName = '치과 상담',
  apiBaseUrl = '',
}: ChatWidgetProps) {
  // 상태
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [step, setStep] = useState<'info' | 'chat'>('info');
  const [chatId, setChatId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 사용자 정보
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');

  // 메시지
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pusherRef = useRef<Pusher | null>(null);

  // 세션 ID 생성/복원
  useEffect(() => {
    const storedSession = localStorage.getItem('chat-widget-session');
    if (storedSession) {
      const session = JSON.parse(storedSession);
      setSessionId(session.sessionId);
      setChatId(session.chatId);
      setUserName(session.userName || '');
      setUserPhone(session.userPhone || '');
      if (session.chatId) {
        setStep('chat');
        // 기존 메시지 로드
        loadMessages(session.chatId);
      }
    } else {
      const newSessionId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
    }
  }, []);

  // 메시지 로드
  const loadMessages = async (cId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v2/channel-chats/${cId}/messages`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages || []);
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error);
    }
  };

  // Pusher 연결
  useEffect(() => {
    if (!chatId) return;

    pusherRef.current = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusherRef.current.subscribe('channel-chat-v2');

    channel.bind('new-message', (data: { chatId: string; message: Message }) => {
      if (data.chatId === chatId) {
        setMessages((prev) => {
          // 중복 방지
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    });

    return () => {
      channel.unbind_all();
      pusherRef.current?.unsubscribe('channel-chat-v2');
      pusherRef.current?.disconnect();
    };
  }, [chatId]);

  // 스크롤 하단 유지
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 세션 저장
  const saveSession = useCallback((cId: string) => {
    localStorage.setItem('chat-widget-session', JSON.stringify({
      sessionId,
      chatId: cId,
      userName,
      userPhone,
    }));
  }, [sessionId, userName, userPhone]);

  // 채팅 시작
  const startChat = async () => {
    if (!userName.trim() || !userPhone.trim()) {
      alert('이름과 연락처를 입력해주세요.');
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/v2/webhooks/website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'start',
          sessionId,
          customerName: userName,
          customerPhone: userPhone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setChatId(data.chatId);
        saveSession(data.chatId);
        setStep('chat');
        // 환영 메시지 추가
        setMessages([{
          id: 'welcome',
          content: welcomeMessage,
          senderType: 'system',
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch (error) {
      console.error('채팅 시작 실패:', error);
      alert('채팅 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 메시지 전송
  const sendMessage = async () => {
    if (!inputValue.trim() || !chatId || isSending) return;

    const content = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    // 낙관적 업데이트
    const tempId = `temp_${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      content,
      senderType: 'customer',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v2/webhooks/website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          sessionId,
          chatId,
          content,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        // 임시 메시지를 실제 메시지로 교체
        setMessages((prev) =>
          prev.map((m) => m.id === tempId ? { ...data.message, senderType: 'customer' } : m)
        );
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      // 실패 시 임시 메시지 제거
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert('메시지 전송에 실패했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  // 전화번호 포맷
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // 시간 포맷
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // 위치 스타일
  const positionStyles = position === 'bottom-right'
    ? 'right-4 sm:right-6'
    : 'left-4 sm:left-6';

  return (
    <div className={`fixed bottom-4 sm:bottom-6 ${positionStyles} z-[9999] font-sans`}>
      {/* 채팅 창 */}
      {isOpen && !isMinimized && (
        <div
          className="mb-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: '360px', height: '520px' }}
        >
          {/* 헤더 */}
          <div
            className="px-4 py-3 text-white flex items-center justify-between"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle size={20} />
              <span className="font-medium">{clinicName}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Minimize2 size={18} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 내용 */}
          {step === 'info' ? (
            // 정보 입력 단계
            <div className="p-6 h-[calc(100%-56px)] flex flex-col">
              <div className="text-center mb-6">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <MessageCircle size={32} style={{ color: primaryColor }} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">상담 시작하기</h3>
                <p className="text-sm text-gray-500">
                  간단한 정보를 입력하시면<br />
                  상담사가 빠르게 연결됩니다.
                </p>
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    연락처 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={userPhone}
                    onChange={(e) => setUserPhone(formatPhone(e.target.value))}
                    placeholder="010-1234-5678"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  />
                </div>
              </div>

              <button
                onClick={startChat}
                className="w-full py-3 text-white font-medium rounded-xl transition-opacity hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                상담 시작하기
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                상담 내용은 서비스 개선을 위해 저장될 수 있습니다.
              </p>
            </div>
          ) : (
            // 채팅 단계
            <div className="h-[calc(100%-56px)] flex flex-col">
              {/* 메시지 영역 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.senderType === 'system' ? (
                      <div className="bg-gray-100 text-gray-600 text-sm px-4 py-2 rounded-xl max-w-[85%]">
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        className={`max-w-[85%] ${
                          msg.senderType === 'customer'
                            ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md'
                        }`}
                      >
                        <div className="px-4 py-2.5">
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <div className={`px-4 pb-2 text-xs ${
                          msg.senderType === 'customer' ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* 입력 영역 */}
              <div className="p-3 border-t bg-gray-50">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                    style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isSending}
                    className="p-2.5 text-white rounded-xl transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 최소화 상태 */}
      {isOpen && isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="mb-4 px-4 py-2 bg-white rounded-full shadow-lg flex items-center gap-2 hover:shadow-xl transition-shadow"
        >
          <MessageCircle size={18} style={{ color: primaryColor }} />
          <span className="text-sm font-medium text-gray-700">채팅 계속하기</span>
        </button>
      )}

      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
          style={{ backgroundColor: primaryColor }}
        >
          <MessageCircle size={26} />
        </button>
      )}
    </div>
  );
}

export default ChatWidget;
