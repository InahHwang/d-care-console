// src/components/v2/ai-chat/AIChat-ConversationList.tsx
// AI 채팅 대화 목록 사이드패널

'use client';

import React from 'react';
import { Plus, MessageSquare, Trash2, ArrowLeft } from 'lucide-react';
import type { AIChatConversation } from '@/types/aiChat';

interface Props {
  conversations: AIChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

export default function AIChatConversationList({
  conversations, activeId, onSelect, onNew, onDelete, onClose, isLoading,
}: Props) {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="font-medium text-sm text-gray-700">대화 이력</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            title="새 대화"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            title="닫기"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 대화 목록 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-gray-400">로딩 중...</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">
            대화가 없습니다.
            <br />새 대화를 시작해보세요.
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv._id}
              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-gray-100 transition-colors ${
                activeId === conv._id
                  ? 'bg-orange-50 border-l-2 border-l-orange-500'
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => onSelect(conv._id)}
            >
              <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate">
                  {conv.title}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(conv.updatedAt).toLocaleDateString('ko-KR', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv._id); }}
                className="hidden group-hover:block p-1 text-gray-300 hover:text-red-500 transition-colors"
                title="삭제"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
