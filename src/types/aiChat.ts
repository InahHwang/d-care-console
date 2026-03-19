// src/types/aiChat.ts
// AI 채팅 위젯 관련 타입 정의

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  pageContext?: string;
}

export interface AIChatConversation {
  _id: string;
  userId: string;
  userName: string;
  title: string;
  pageContext: string;
  pageTitle: string;
  messages: AIChatMessage[];
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export interface AIChatSendRequest {
  conversationId?: string;
  message: string;
  pageContext: string;
  pageTitle: string;
  contextData?: Record<string, unknown>;
}

export interface AIChatSendResponse {
  success: boolean;
  conversationId: string;
  message: AIChatMessage;
  title?: string;
  error?: string;
}

export interface AIChatListResponse {
  success: boolean;
  conversations: AIChatConversation[];
  total: number;
}
