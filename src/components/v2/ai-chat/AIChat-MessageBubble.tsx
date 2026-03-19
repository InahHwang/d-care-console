// src/components/v2/ai-chat/AIChat-MessageBubble.tsx
// AI 채팅 메시지 버블

'use client';

import React from 'react';
import { User, Sparkles } from 'lucide-react';
import type { AIChatMessage } from '@/types/aiChat';

interface Props {
  message: AIChatMessage;
}

export default function AIChatMessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 아바타 */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-100' : 'bg-purple-100'
      }`}>
        {isUser ? (
          <User className="w-3.5 h-3.5 text-blue-600" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
        )}
      </div>

      {/* 메시지 내용 */}
      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
        isUser
          ? 'bg-blue-500 text-white rounded-tr-sm'
          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
      }`}>
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </div>
        <div className={`text-[10px] mt-1 ${
          isUser ? 'text-blue-200' : 'text-gray-400'
        }`}>
          {new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
