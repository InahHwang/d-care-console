// src/components/v2/settings/AIChat-AdminPanel.tsx
// 관리자용 AI 대화 이력 조회 패널

'use client';

import { authFetch } from '@/utils/authFetch';
import React, { useState, useCallback, useEffect } from 'react';
import { Sparkles, Search, ChevronDown, ChevronRight, User, MessageSquare, ChevronUp } from 'lucide-react';
import type { AIChatConversation, AIChatMessage } from '@/types/aiChat';

interface UserOption {
  id: string;
  name: string;
  username: string;
}

const MESSAGES_PER_PAGE = 30;

export default function AIChatAdminPanel() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [conversations, setConversations] = useState<AIChatConversation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<AIChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);

  // 사용자 목록 로드
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v2/users?includeInactive=false', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setUsers((data.users || []).map((u: any) => ({
            id: u.id || u._id,
            name: u.name,
            username: u.username,
          })));
        }
      } catch (err) {
        console.error('[AI Chat Admin] 사용자 로드 오류:', err);
      }
    };
    fetchUsers();
  }, []);

  // 선택한 사용자의 대화 목록 로드
  const loadConversations = useCallback(async (userId: string) => {
    if (!userId) {
      setConversations([]);
      return;
    }
    setLoading(true);
    setExpandedId(null);
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch(`/api/v2/ai-chat?userId=${userId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('[AI Chat Admin] 대화 목록 오류:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 대화 펼치기 — 최근 메시지 로드
  const toggleConversation = useCallback(async (convId: string) => {
    if (expandedId === convId) {
      setExpandedId(null);
      setExpandedMessages([]);
      setHasMore(false);
      setTotalMessages(0);
      return;
    }
    setExpandedId(convId);
    setMessagesLoading(true);
    setExpandedMessages([]);
    try {
      const token = localStorage.getItem('token');
      const res = await authFetch(`/api/v2/ai-chat/${convId}?limit=${MESSAGES_PER_PAGE}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.conversation) {
        setExpandedMessages(data.conversation.messages || []);
        setHasMore(data.hasMore || false);
        setTotalMessages(data.totalMessages || 0);
      }
    } catch (err) {
      console.error('[AI Chat Admin] 대화 상세 오류:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, [expandedId]);

  // 이전 메시지 더 불러오기
  const loadMoreMessages = useCallback(async () => {
    if (!expandedId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const token = localStorage.getItem('token');
      const before = expandedMessages.length;
      const res = await authFetch(`/api/v2/ai-chat/${expandedId}?limit=${MESSAGES_PER_PAGE}&before=${before}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.conversation?.messages?.length > 0) {
        // 이전 메시지를 앞에 추가
        setExpandedMessages(prev => [...data.conversation.messages, ...prev]);
        setHasMore(data.hasMore || false);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[AI Chat Admin] 이전 메시지 로드 오류:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [expandedId, expandedMessages.length, loadingMore, hasMore]);

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    loadConversations(userId);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="font-medium text-gray-900">AI 대화 관리</h3>
        <span className="text-sm text-gray-500">상담사별 AI 대화 이력을 조회합니다</span>
      </div>

      {/* 상담사 선택 */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-gray-700">상담사:</label>
        <select
          value={selectedUserId}
          onChange={(e) => handleUserChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        >
          <option value="">상담사를 선택하세요</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
          ))}
        </select>
        {selectedUserId && (
          <span className="text-sm text-gray-500">
            총 {conversations.length}개 대화
          </span>
        )}
      </div>

      {/* 대화 목록 */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : !selectedUserId ? (
        <div className="text-center py-12 text-gray-400">
          <Search className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">상담사를 선택하면 AI 대화 이력을 조회할 수 있습니다.</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">이 상담사의 AI 대화가 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div key={conv._id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* 대화 헤더 */}
              <button
                onClick={() => toggleConversation(conv._id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                {expandedId === conv._id
                  ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                }
                <MessageSquare className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{conv.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {conv.pageTitle || conv.pageContext} · {new Date(conv.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              </button>

              {/* 대화 내용 */}
              {expandedId === conv._id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 max-h-96 overflow-y-auto">
                  {messagesLoading ? (
                    <div className="text-center text-sm text-gray-400 py-4">메시지 로딩 중...</div>
                  ) : (
                    <div className="space-y-3">
                      {/* 이전 대화 더 보기 */}
                      {hasMore && (
                        <button
                          onClick={loadMoreMessages}
                          disabled={loadingMore}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          {loadingMore ? '불러오는 중...' : `이전 대화 더 보기 (${expandedMessages.length}/${totalMessages})`}
                        </button>
                      )}
                      {expandedMessages.map((msg, i) => (
                        <div key={i} className="flex gap-2">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                            msg.role === 'user' ? 'bg-orange-100' : 'bg-purple-100'
                          }`}>
                            {msg.role === 'user'
                              ? <User className="w-3 h-3 text-orange-600" />
                              : <Sparkles className="w-3 h-3 text-purple-600" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-gray-600">
                                {msg.role === 'user' ? conv.userName : 'AI'}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
