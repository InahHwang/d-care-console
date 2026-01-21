'use client';

import React, { useRef, useEffect, useState } from 'react';
import { MessageCircle, RefreshCw, X } from 'lucide-react';
import { ChannelChatV2, ChannelMessageV2, CHANNEL_CONFIG, ChannelType } from '@/types/v2';
import { ChannelChatMessageBubble } from './ChannelChat-MessageBubble';
import { ChannelChatMessageInput } from './ChannelChat-MessageInput';
import { format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ChannelChatMessageAreaProps {
  chat: ChannelChatV2 | null;
  messages: ChannelMessageV2[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  isSending: boolean;
  insertText?: string;
  onInsertComplete?: () => void;
  onCloseChat?: (chatId: string) => void;
}

// 날짜 구분선 포맷
function formatDateDivider(date: Date): string {
  if (isToday(date)) return '오늘';
  if (isYesterday(date)) return '어제';
  return format(date, 'yyyy년 M월 d일 EEEE', { locale: ko });
}

// 메시지를 날짜별로 그룹화
function groupMessagesByDate(messages: ChannelMessageV2[]) {
  const groups: { date: string; messages: ChannelMessageV2[] }[] = [];

  messages.forEach((msg) => {
    const dateKey = format(new Date(msg.createdAt), 'yyyy-MM-dd');
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ date: dateKey, messages: [msg] });
    }
  });

  return groups;
}

export function ChannelChatMessageArea({
  chat,
  messages,
  isLoading,
  onSendMessage,
  isSending,
  insertText,
  onInsertComplete,
  onCloseChat,
}: ChannelChatMessageAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // 새 메시지 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 선택된 채팅이 없는 경우
  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <MessageCircle size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">대화방을 선택하세요</p>
          <p className="text-sm mt-1">좌측에서 대화방을 선택하면 메시지가 표시됩니다</p>
        </div>
      </div>
    );
  }

  const channelConfig = CHANNEL_CONFIG[chat.channel as ChannelType];
  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* 헤더 */}
      <div className="p-4 border-b flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${channelConfig.bgColor}`}>
          {channelConfig.icon}
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">
            {chat.patientName || chat.phone || '알 수 없음'}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded ${channelConfig.bgColor}`}>
              {channelConfig.label}
            </span>
            {chat.phone && <span>{chat.phone}</span>}
          </div>
        </div>
        {/* 상담 종료 버튼 - 진행중인 상담만 */}
        {chat.status !== 'closed' && onCloseChat && (
          <button
            onClick={() => setShowCloseConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X size={16} />
            상담종료
          </button>
        )}
      </div>

      {/* 상담 종료 확인 모달 */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">상담 종료</h3>
            <p className="text-sm text-gray-600 mb-4">
              이 대화를 종료하시겠습니까?<br />
              종료된 대화는 &apos;종료됨&apos; 탭에서 확인할 수 있습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  onCloseChat?.(chat._id?.toString() || '');
                  setShowCloseConfirm(false);
                }}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                종료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={24} className="animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p>아직 메시지가 없습니다</p>
            </div>
          </div>
        ) : (
          <>
            {messageGroups.map((group) => (
              <div key={group.date}>
                {/* 날짜 구분선 */}
                <div className="flex items-center justify-center my-4">
                  <div className="bg-gray-200 text-gray-500 text-xs px-3 py-1 rounded-full">
                    {formatDateDivider(new Date(group.date))}
                  </div>
                </div>

                {/* 메시지들 */}
                {group.messages.map((msg) => (
                  <ChannelChatMessageBubble key={msg._id?.toString()} message={msg} />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 메시지 입력 */}
      <ChannelChatMessageInput
        onSend={onSendMessage}
        disabled={isSending}
        placeholder={isSending ? '전송 중...' : '메시지를 입력하세요...'}
        insertText={insertText}
        onInsertComplete={onInsertComplete}
      />
    </div>
  );
}

export default ChannelChatMessageArea;
