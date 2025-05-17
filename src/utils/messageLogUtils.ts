
// src/utils/messageLogUtils.ts

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { 
  MessageLog, 
  MessageStatus, 
  MessageType,
  RcsOptions
} from '@/types/messageLog';
import { Patient, EventCategory } from '@/store/slices/patientsSlice';

// 간단한 고유 ID 생성 함수 (uuid 대체)
const generateId = (): string => {
  return 'msg-' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         '-' + Date.now().toString(36);
};

// 메시지 날짜 포맷팅
export const formatMessageDate = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    return format(date, 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
  } catch (e) {
    return dateString;
  }
};

// 메시지 미리보기 생성
export const getMessagePreview = (content: string, maxLength: number = 50): string => {
  if (content.length <= maxLength) return content;
  return `${content.substring(0, maxLength)}...`;
};

// 메시지 상태 텍스트 반환
export const getStatusText = (status: MessageStatus): string => {
  const statusMap: Record<MessageStatus, string> = {
    'success': '성공',
    'failed': '실패',
    'pending': '대기중' 
  };
  return statusMap[status] || '알 수 없음';
};

// 메시지 타입 텍스트 반환
export const getMessageTypeText = (type: MessageType): string => {
  const typeMap: Record<MessageType, string> = {
    'SMS': 'SMS',
    'LMS': 'LMS',
    'MMS': 'MMS',
    'RCS': 'RCS'
  };
  return typeMap[type] || type;
};

// 카테고리 텍스트 반환
export const getCategoryText = (category?: EventCategory): string => {
  if (!category) return '-';
  
  const categoryMap: Record<EventCategory, string> = {
      'discount': '할인 프로모션',
      'new_treatment': '신규 치료법',
      'checkup': '정기 검진',
      'seasonal': '계절 이벤트',
      '': ''
  };
  
  return categoryMap[category] || category;
};

// 새 메시지 로그 생성
export const createMessageLog = (
  patient: Patient,
  content: string,
  messageType: MessageType,
  status: MessageStatus,
  options?: {
    templateName?: string;
    category?: EventCategory;
    messageId?: string;
    errorMessage?: string;
    operator?: string;
    imageUrl?: string;
    rcsOptions?: RcsOptions;
  }
): MessageLog => {
  const now = new Date().toISOString();
  console.log('메시지 로그 생성:', { 
    patient: patient.name, 
    messageType, 
    status, 
    imageUrl: options?.imageUrl,
    hasRcsOptions: !!options?.rcsOptions
  });
  
  // 메시지 로그 생성
  const messageLog: MessageLog = {
    id: generateId(),
    patientId: patient.id,
    patientName: patient.name,
    phoneNumber: patient.phoneNumber,
    content,
    messageType,
    status,
    createdAt: now,
    ...options
  };
  
  // 디버깅용
  console.log('생성된 메시지 로그:', JSON.stringify(messageLog).substring(0, 200) + '...');
  
  return messageLog;
};

// 메시지 내용에 환자명 적용
export const personalizeMessageContent = (
  content: string,
  patientName: string
): string => {
  return content
    .replace(/\[환자명\]/g, patientName)
    .replace(/고객님/g, `${patientName}님`);
};