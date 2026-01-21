'use client';

import React from 'react';
import { ChannelChatV2, CHANNEL_CONFIG, ChannelType } from '@/types/v2';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Clock } from 'lucide-react';

interface ChannelChatRoomItemProps {
  chat: ChannelChatV2;
  isSelected: boolean;
  onClick: () => void;
}

export function ChannelChatRoomItem({ chat, isSelected, onClick }: ChannelChatRoomItemProps) {
  const channelConfig = CHANNEL_CONFIG[chat.channel as ChannelType];

  const timeAgo = chat.lastMessageAt
    ? formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true, locale: ko })
    : '';

  // 고객 미응답 상태 확인: 마지막 메시지가 상담사(agent)이고 5분 이상 경과
  const isAwaitingCustomerResponse = chat.lastMessageBy === 'agent' && chat.lastMessageAt
    && differenceInMinutes(new Date(), new Date(chat.lastMessageAt)) >= 5;

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-lg text-left transition-colors ${
        isSelected
          ? 'bg-blue-50 border border-blue-200'
          : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 채널 아이콘 */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${channelConfig.bgColor}`}
        >
          {channelConfig.icon}
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-gray-900 truncate">
              {chat.patientName || chat.phone || '알 수 없음'}
            </span>
            <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo}</span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-sm text-gray-500 truncate">
              {chat.lastMessagePreview || '새 대화'}
            </p>
            {chat.unreadCount > 0 && (
              <span className="flex-shrink-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
              </span>
            )}
          </div>

          {/* 상태 배지 */}
          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
            {/* 고객 미응답 표시 */}
            {isAwaitingCustomerResponse && (
              <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                <Clock size={10} />
                응답 대기
              </span>
            )}
            {/* 환자 연결 상태 */}
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                chat.patientId
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {chat.patientId ? '환자 연결됨' : '미연결'}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${channelConfig.bgColor}`}>
              {channelConfig.label}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default ChannelChatRoomItem;
