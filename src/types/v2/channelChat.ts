// src/types/v2/channelChat.ts
// 채널 상담 관련 타입 정의

import { ObjectId } from 'mongodb';
import { Temperature, FollowUpType } from './index';

// ============================================
// 채널 상담 관련 타입
// ============================================

export type ChannelType = 'kakao' | 'naver' | 'website' | 'instagram';
export type ChatStatus = 'active' | 'closed' | 'pending';
export type MessageDirection = 'incoming' | 'outgoing';
export type MessageType = 'text' | 'image' | 'file' | 'system';
export type SenderType = 'customer' | 'agent' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

// ============================================
// AI 분석 결과 타입
// ============================================

export interface ChatAIAnalysis {
  interest: string;                    // "임플란트", "교정" 등
  temperature: Temperature;            // 'hot' | 'warm' | 'cold'
  summary: string;                     // "비용과 기간 문의, 다음주 내원 희망"
  followUp: FollowUpType;              // '콜백필요' | '예약확정' | '종결'
  concerns: string[];                  // ["가격", "통증"]
  confidence: number;                  // 0-1 신뢰도
}

// ============================================
// 채널 대화방 타입
// ============================================

export interface ChannelChatV2 {
  _id?: ObjectId | string;
  clinicId?: string;

  // 채널 정보
  channel: ChannelType;
  channelRoomId: string;               // 채널 고유 ID
  channelUserKey?: string;             // 채널 사용자 식별자

  // 환자 연결
  patientId?: string;
  patientName?: string;
  phone?: string;

  // 상태
  status: ChatStatus;
  unreadCount: number;
  lastMessageAt: Date | string;
  lastMessagePreview: string;
  lastMessageBy: SenderType;

  // AI 분석
  aiAnalysis?: ChatAIAnalysis;
  aiAnalyzedAt?: Date | string;

  // 메타
  assignedTo?: string;                 // 담당 상담사
  tags?: string[];

  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================
// 채널 메시지 타입
// ============================================

export interface ChannelMessageV2 {
  _id?: ObjectId | string;
  chatId: string;                      // channelChats_v2 참조

  // 메시지 정보
  direction: MessageDirection;
  messageType: MessageType;
  content: string;
  fileUrl?: string;

  // 발신자
  senderType: SenderType;
  senderName?: string;
  senderId?: string;

  // 상태
  status: MessageStatus;

  createdAt: Date | string;
}

// ============================================
// 채널 설정
// ============================================

export const CHANNEL_CONFIG = {
  kakao: {
    label: '카카오톡',
    icon: '📱',
    color: 'yellow',
    bgColor: 'bg-yellow-100 text-yellow-700',
    borderColor: 'border-yellow-300',
  },
  naver: {
    label: '네이버 톡톡',
    icon: '🌐',
    color: 'green',
    bgColor: 'bg-green-100 text-green-700',
    borderColor: 'border-green-300',
  },
  website: {
    label: '홈페이지',
    icon: '💬',
    color: 'blue',
    bgColor: 'bg-orange-100 text-orange-700',
    borderColor: 'border-orange-300',
  },
  instagram: {
    label: '인스타그램',
    icon: '📸',
    color: 'pink',
    bgColor: 'bg-pink-100 text-pink-700',
    borderColor: 'border-pink-300',
  },
} as const;

export const CHAT_STATUS_CONFIG = {
  active: { label: '진행중', color: 'green', bgColor: 'bg-green-100 text-green-700' },
  pending: { label: '대기중', color: 'amber', bgColor: 'bg-amber-100 text-amber-700' },
  closed: { label: '종료', color: 'gray', bgColor: 'bg-gray-100 text-gray-500' },
} as const;

// ============================================
// API 필터 타입
// ============================================

export interface ChannelChatFilter {
  channel?: ChannelType | 'all';
  status?: ChatStatus | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

export interface ChannelMessageFilter {
  chatId: string;
  page?: number;
  limit?: number;
}

// ============================================
// Pusher 이벤트 타입
// ============================================

export interface NewMessageEvent {
  chatId: string;
  message: ChannelMessageV2;
  chat: Partial<ChannelChatV2>;
}

export interface NewChatEvent {
  chat: ChannelChatV2;
}

export interface MessagesReadEvent {
  chatId: string;
  readAt: string;
}

export interface PatientMatchedEvent {
  chatId: string;
  patientId: string;
  patientName: string;
}

export interface ChatClosedEvent {
  chatId: string;
}

export interface AIAnalysisCompleteEvent {
  chatId: string;
  analysis: ChatAIAnalysis;
}
