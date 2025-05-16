// src/types/messageLog.ts

import { EventCategory } from '@/store/slices/patientsSlice';

// 메시지 상태 타입
export type MessageStatus = 'success' | 'failed' | 'pending'; 

// 메시지 타입
export type MessageType = 'SMS' | 'LMS' | 'MMS' | 'RCS';

export interface RcsButton {
  buttonType: 'url' | 'phone' | 'map';
  buttonName: string;
  buttonUrl?: string;
  phoneNumber?: string;
  address?: string;
}

// RCS 옵션 타입 정의
export interface RcsOptions {
  cardType: 'basic' | 'carousel' | 'commerce';
  buttons?: RcsButton[];
  thumbnails?: string[]; // 이미지 URL 배열 (캐러셀용)
  productInfo?: {
    productName: string;
    price: string;
    currencyUnit: string;
  };
}

// 템플릿 타입 정의
export interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  category: EventCategory;
  type: MessageType;
  imageUrl?: string; // MMS용 이미지 URL
  rcsOptions?: RcsOptions;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// 메시지 로그 타입
export interface MessageLog {
  id: string;
  patientId: string;
  patientName: string;
  phoneNumber: string;
  content: string;
  messageType: MessageType;
  status: MessageStatus;
  createdAt: string;
  templateName?: string;
  category?: EventCategory;
  messageId?: string;
  errorMessage?: string;
  operator?: string;
  imageUrl?: string;      // MMS용 이미지 URL 추가
  rcsOptions?: RcsOptions; // RCS 옵션 필드 추가
}

// 정렬 필드 타입
export type MessageLogSortField = 'createdAt' | 'patientName' | 'status';

// 정렬 방향
export type SortDirection = 'asc' | 'desc';

// 정렬 옵션
export interface MessageLogSort {
  field: MessageLogSortField;
  direction: SortDirection;
}