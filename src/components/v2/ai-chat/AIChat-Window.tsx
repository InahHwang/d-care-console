// src/components/v2/ai-chat/AIChat-Window.tsx
// AI 채팅 윈도우 — 메인 채팅 UI

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, List, Loader2, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/hooks/reduxHooks';
import { getPageTitle } from './AIChat-PageContext';
import AIChatMessageBubble from './AIChat-MessageBubble';
import AIChatConversationList from './AIChat-ConversationList';
import type { AIChatMessage, AIChatConversation } from '@/types/aiChat';

interface Props {
  onClose: () => void;
}

export default function AIChatWindow({ onClose }: Props) {
  const pathname = usePathname();
  const { user } = useAppSelector((state) => state.auth);

  // 상태
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIChatConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showList, setShowList] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [pageContextData, setPageContextData] = useState<Record<string, unknown> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 현재 페이지 컨텍스트 데이터 자동 로드 (환자 상세 등)
  useEffect(() => {
    const loadPageContext = async () => {
      // 환자 상세 페이지: /v2/patients/[id]
      const patientMatch = pathname?.match(/^\/v2\/patients\/([a-f0-9]{24})$/);
      if (patientMatch) {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/v2/patients/${patientMatch[1]}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.patient) {
            const p = data.patient;
            setPageContextData({
              환자명: p.name,
              상태: p.status,
              온도: p.temperature,
              관심치료: p.interest,
              유입경로: p.source,
              나이: p.age,
              지역: p.region,
              메모: p.memo,
              AI요약: p.summary,
              AI분류: p.classification,
              후속조치: p.followUp,
              다음액션: p.nextAction,
              다음액션날짜: p.nextActionDate,
              통화횟수: p.callCount,
              태그: p.tags,
              등록일: p.createdAt,
              마지막연락: p.lastContactAt,
              상태변경일: p.statusChangedAt,
              상태이력: (p.statusHistory || []).slice(-5).map((h: any) => `${h.from}→${h.to} (${h.changedAt})`),
              콜백이력: (p.callbackHistory || []).slice(-3).map((h: any) => `${h.reason}: ${h.note || ''} (${h.scheduledDate})`),
              종결사유: p.closedReason,
              예상금액: p.estimatedAmount,
              실제금액: p.actualAmount,
              최근통화: (data.callLogs || []).slice(0, 3).map((c: any) => ({
                날짜: c.startedAt,
                방향: c.direction,
                통화시간: c.duration,
                AI요약: c.aiAnalysis?.summary,
              })),
            });
            return;
          }
        } catch (err) {
          console.error('[AI Chat] 페이지 컨텍스트 로드 오류:', err);
        }
      }
      setPageContextData(null);
    };
    loadPageContext();
  }, [pathname]);

  // 채팅창 열릴 때 최근 대화 자동 로드
  useEffect(() => {
    const loadRecentConversation = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v2/ai-chat?limit=1', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.conversations?.length > 0) {
          const recent = data.conversations[0];
          // 마지막 대화가 오늘 것이면 자동 로드
          const lastUpdate = new Date(recent.updatedAt);
          const now = new Date();
          const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
          if (hoursDiff < 24) {
            await loadConversation(recent._id);
            return;
          }
        }
      } catch (err) {
        console.error('[AI Chat] 최근 대화 로드 오류:', err);
      }
    };
    loadRecentConversation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 대화 목록 로드
  const loadConversations = useCallback(async () => {
    setListLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v2/ai-chat?limit=30', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('[AI Chat] 목록 로드 오류:', err);
    } finally {
      setListLoading(false);
    }
  }, []);

  // 대화 상세 로드
  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v2/ai-chat/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.conversation) {
        setMessages(data.conversation.messages || []);
        setConversationId(id);
        setShowList(false);
      }
    } catch (err) {
      console.error('[AI Chat] 대화 로드 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 메시지 전송
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isSending) return;

    const userMsg: AIChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      pageContext: pathname || '',
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v2/ai-chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          message: userMsg.content,
          pageContext: pathname || '',
          pageTitle: getPageTitle(pathname || ''),
          ...(pageContextData ? { contextData: pageContextData } : {}),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error || '오류가 발생했습니다. 다시 시도해주세요.',
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, conversationId, pathname, pageContextData]);

  // 대화 삭제
  const deleteConversation = useCallback(async (id: string) => {
    if (!confirm('이 대화를 삭제하시겠습니까?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/v2/ai-chat?conversationId=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setConversations(prev => prev.filter(c => c._id !== id));
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('[AI Chat] 삭제 오류:', err);
    }
  }, [conversationId]);

  // 새 대화
  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setShowList(false);
    inputRef.current?.focus();
  }, []);

  // 스크롤 하단 유지
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 목록 토글 시 데이터 로드
  useEffect(() => {
    if (showList) {
      loadConversations();
    }
  }, [showList, loadConversations]);

  // Enter로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const pageTitle = getPageTitle(pathname || '');

  return (
    <div className="fixed bottom-20 right-5 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-[60]">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <div>
            <div className="font-semibold text-sm">AI 어시스턴트</div>
            <div className="text-[10px] text-purple-200">
              {pageTitle}{pageContextData?.환자명 ? ` · ${pageContextData.환자명}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowList(!showList)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="대화 이력"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 본문 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 대화 목록 (사이드) */}
        {showList && (
          <div className="w-[200px] border-r border-gray-200 flex-shrink-0">
            <AIChatConversationList
              conversations={conversations}
              activeId={conversationId}
              onSelect={loadConversation}
              onNew={handleNewConversation}
              onDelete={deleteConversation}
              onClose={() => setShowList(false)}
              isLoading={listLoading}
            />
          </div>
        )}

        {/* 메시지 영역 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <Sparkles className="w-10 h-10 mb-3 text-purple-300" />
                <p className="text-sm font-medium mb-1">무엇이든 물어보세요</p>
                <p className="text-xs">환자 상담, 치료 정보, 업무 관련<br />질문에 답변해드립니다.</p>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            )}

            {messages.map((msg, i) => (
              <AIChatMessageBubble key={i} message={msg} />
            ))}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                AI가 답변을 작성하고 있습니다...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                rows={1}
                className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none max-h-20"
                disabled={isSending}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isSending}
                className="flex-shrink-0 p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
