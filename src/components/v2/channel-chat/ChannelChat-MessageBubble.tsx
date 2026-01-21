'use client';

import React from 'react';
import { ChannelMessageV2 } from '@/types/v2';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, CheckCheck } from 'lucide-react';

interface ChannelChatMessageBubbleProps {
  message: ChannelMessageV2;
}

export function ChannelChatMessageBubble({ message }: ChannelChatMessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing';
  const time = format(new Date(message.createdAt), 'HH:mm', { locale: ko });

  // 시스템 메시지
  if (message.senderType === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[70%] ${isOutgoing ? 'order-2' : ''}`}>
        {/* 발신자 이름 (수신 메시지만) */}
        {!isOutgoing && message.senderName && (
          <div className="text-xs text-gray-500 mb-1 ml-1">{message.senderName}</div>
        )}

        <div className="flex items-end gap-1">
          {/* 시간 (발신 메시지는 왼쪽에) */}
          {isOutgoing && (
            <div className="flex items-center gap-0.5 text-xs text-gray-400">
              {message.status === 'read' ? (
                <CheckCheck size={12} className="text-blue-500" />
              ) : message.status === 'delivered' ? (
                <CheckCheck size={12} />
              ) : (
                <Check size={12} />
              )}
              <span>{time}</span>
            </div>
          )}

          {/* 메시지 버블 */}
          <div
            className={`px-3 py-2 rounded-2xl ${
              isOutgoing
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-gray-100 text-gray-900 rounded-bl-md'
            }`}
          >
            {message.messageType === 'image' && message.fileUrl ? (
              <img
                src={message.fileUrl}
                alt="이미지"
                className="max-w-full rounded-lg"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>

          {/* 시간 (수신 메시지는 오른쪽에) */}
          {!isOutgoing && <span className="text-xs text-gray-400">{time}</span>}
        </div>
      </div>
    </div>
  );
}

export default ChannelChatMessageBubble;
