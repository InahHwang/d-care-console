// src/types/messageLog.ts

// 동적 카테고리 관련 타입들
export interface MessageCategory {
  id: string;
  name: string;
  displayName: string;
  color: string;
  isDefault: boolean; // 기본 카테고리는 삭제 불가
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// EventCategory를 동적으로 만들 수 있도록 string으로 변경
export type EventCategory = string;

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
  category: EventCategory; // 이제 동적 카테고리 ID
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
  category?: EventCategory; // 동적 카테고리 ID
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

// 이미지 URL이 유효한지 확인하는 함수
export const validateImageUrl = (imageUrl: string): boolean => {
  if (!imageUrl) return false;
  
  // Base64 데이터 URL인 경우
  if (imageUrl.startsWith('data:image/')) {
    return true;
  }
  
  // 파일 경로인 경우
  if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('/')) {
    return true;
  }
  
  // HTTP URL인 경우
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return true;
  }
  
  return false;
};

// 이미지 URL을 표시용으로 변환하는 함수
export const getDisplayImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return '';
  
  // Base64 데이터 URL은 그대로 반환
  if (imageUrl.startsWith('data:image/')) {
    return imageUrl;
  }
  
  // 상대 경로인 경우 그대로 반환 (브라우저가 자동으로 처리)
  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }
  
  // uploads/로 시작하는 경우 앞에 / 추가
  if (imageUrl.startsWith('uploads/')) {
    return '/' + imageUrl;
  }
  
  // HTTP URL은 그대로 반환
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // 기타 경우 uploads 폴더로 처리
  return '/uploads/' + imageUrl;
};
