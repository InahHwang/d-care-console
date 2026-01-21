'use client';

import React, { useState, useMemo } from 'react';
import { Search, RefreshCw, Clock, Trash2 } from 'lucide-react';
import { ChannelChatV2, ChannelType, ChatStatus } from '@/types/v2';
import { ChannelChatRoomItem } from './ChannelChat-RoomItem';
import { differenceInMinutes } from 'date-fns';

type ChannelFilter = ChannelType | 'all';
type StatusFilter = 'active' | 'closed';

interface ChannelChatRoomListProps {
  chats: ChannelChatV2[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  selectedChannel: ChannelFilter;
  onChannelChange: (channel: ChannelFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  // 새로 추가
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  onDeleteChat?: (chatId: string) => void;
  activeCount?: number;
  closedCount?: number;
}

const channelTabs: { value: ChannelFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'kakao', label: '카카오' },
  { value: 'naver', label: '네이버' },
  { value: 'instagram', label: '인스타' },
  { value: 'website', label: '홈페이지' },
];

export function ChannelChatRoomList({
  chats,
  selectedChatId,
  onSelectChat,
  selectedChannel,
  onChannelChange,
  searchQuery,
  onSearchChange,
  isLoading,
  onRefresh,
  statusFilter,
  onStatusFilterChange,
  onDeleteChat,
  activeCount = 0,
  closedCount = 0,
}: ChannelChatRoomListProps) {
  const [showAwaitingOnly, setShowAwaitingOnly] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 응답 대기 중인 채팅 필터링
  const filteredChats = useMemo(() => {
    if (!showAwaitingOnly) return chats;

    return chats.filter(chat =>
      chat.lastMessageBy === 'agent' &&
      chat.lastMessageAt &&
      differenceInMinutes(new Date(), new Date(chat.lastMessageAt)) >= 5
    );
  }, [chats, showAwaitingOnly]);

  // 응답 대기 중인 채팅 수
  const awaitingCount = useMemo(() => {
    return chats.filter(chat =>
      chat.lastMessageBy === 'agent' &&
      chat.lastMessageAt &&
      differenceInMinutes(new Date(), new Date(chat.lastMessageAt)) >= 5
    ).length;
  }, [chats]);

  // 삭제 핸들러
  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(chatId);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmId && onDeleteChat) {
      onDeleteChat(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="w-80 bg-white border-r flex flex-col h-full">
      {/* 헤더 */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-bold text-gray-900">대화방</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 진행중/종료됨 탭 */}
      <div className="flex border-b">
        <button
          onClick={() => onStatusFilterChange('active')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            statusFilter === 'active'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          진행중 {activeCount > 0 && <span className="ml-1 text-xs">({activeCount})</span>}
        </button>
        <button
          onClick={() => onStatusFilterChange('closed')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            statusFilter === 'closed'
              ? 'text-gray-600 border-b-2 border-gray-600 bg-gray-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          종료됨 {closedCount > 0 && <span className="ml-1 text-xs">({closedCount})</span>}
        </button>
      </div>

      {/* 채널 필터 탭 */}
      <div className="p-2 border-b">
        <div className="flex gap-1">
          {channelTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onChannelChange(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedChannel === tab.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 전화번호 검색..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* 응답 대기 필터 - 진행중 탭에서만 표시 */}
        {statusFilter === 'active' && (
          <button
            onClick={() => setShowAwaitingOnly(!showAwaitingOnly)}
            className={`mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              showAwaitingOnly
                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock size={12} />
            응답 대기 {awaitingCount > 0 && `(${awaitingCount})`}
          </button>
        )}
      </div>

      {/* 대화방 목록 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={20} className="animate-spin text-gray-400" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            {showAwaitingOnly
              ? '응답 대기 중인 대화방이 없습니다'
              : searchQuery
              ? '검색 결과가 없습니다'
              : statusFilter === 'closed'
              ? '종료된 대화방이 없습니다'
              : '대화방이 없습니다'}
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div key={chat._id?.toString()} className="relative group">
              <ChannelChatRoomItem
                chat={chat}
                isSelected={selectedChatId === chat._id?.toString()}
                onClick={() => onSelectChat(chat._id?.toString() || '')}
              />
              {/* 종료됨 탭에서만 삭제 버튼 표시 */}
              {statusFilter === 'closed' && onDeleteChat && (
                <button
                  onClick={(e) => handleDeleteClick(e, chat._id?.toString() || '')}
                  className="absolute top-2 right-2 p-1.5 bg-white rounded-lg shadow-sm border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-200"
                  title="삭제"
                >
                  <Trash2 size={14} className="text-red-500" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">대화방 삭제</h3>
            <p className="text-sm text-gray-600 mb-4">
              이 대화방과 모든 메시지가 영구적으로 삭제됩니다.<br />
              삭제 후에는 복구할 수 없습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChannelChatRoomList;
