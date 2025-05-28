// src/utils/messageLogUtils.ts
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { 
  MessageLog, 
  MessageStatus, 
  MessageType,
  RcsOptions
} from '@/types/messageLog';
import { Patient } from '@/store/slices/patientsSlice';
import { EventCategory } from '@/types/messageLog'
import { saveMessageLog } from '@/store/slices/messageLogsSlice';
import { store } from '@/store'; // 스토어 임포트 추가

// 간단한 고유 ID 생성 함수 (uuid 대체)
export const generateId = (): string => {
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

// 카테고리 텍스트 반환 - 동적으로 템플릿에서 가져오도록 수정
export const getCategoryText = (category?: EventCategory): string => {
  if (!category) return '-';
  
  // Redux 스토어에서 템플릿 정보 가져오기
  const state = store.getState();
  const templates = state.templates?.templates || [];
  
  // 템플릿에서 해당 카테고리의 라벨 찾기
  const template = templates.find(t => t.category === category);
  if (template) {
    // 템플릿에서 카테고리 라벨 추출 (실제 구현에 따라 조정 필요)
    // 만약 템플릿에 categoryLabel 필드가 있다면 그것을 사용
    // 없다면 기본 매핑 사용
  }
  
  // 기본 카테고리 매핑 (하위 호환성 유지)
  const categoryMap: Record<string, string> = {
    'discount': '할인 프로모션',
    'new_treatment': '신규 치료법',
    'checkup': '정기 검진',
    'seasonal': '계절 이벤트',
    '': ''
  };
  
  return categoryMap[category] || category;
};

// 템플릿에서 카테고리 옵션 가져오기 (유틸리티 함수)
export const getEventCategoryOptions = () => {
  const state = store.getState();
  const templates = state.templates?.templates || [];
  
  if (templates.length === 0) {
    // 템플릿이 없는 경우 기본 카테고리 반환
    return [
      { value: 'discount', label: '할인 프로모션' },
      { value: 'new_treatment', label: '신규 치료법 안내' },
      { value: 'checkup', label: '정기 검진 리마인더' },
      { value: 'seasonal', label: '계절 이벤트' },
    ];
  }
  
  // 템플릿에서 카테고리 추출 및 중복 제거
  const uniqueCategories = new Set<string>();
  const categoryOptions: { value: string; label: string }[] = [];
  
  templates.forEach(template => {
    if (template.category && !uniqueCategories.has(template.category)) {
      uniqueCategories.add(template.category);
      
      // 카테고리 라벨 매핑 (기존 하드코딩된 라벨과 호환성 유지)
      const categoryLabelMap: Record<string, string> = {
        'discount': '할인 프로모션',
        'new_treatment': '신규 치료법 안내',
        'checkup': '정기 검진 리마인더',
        'seasonal': '계절 이벤트',
      };
      
      categoryOptions.push({
        value: template.category,
        label: categoryLabelMap[template.category] || template.category
      });
    }
  });
  
  // 정렬 (기본 카테고리 우선, 나머지는 알파벳순)
  const defaultOrder = ['discount', 'new_treatment', 'checkup', 'seasonal'];
  return categoryOptions.sort((a, b) => {
    const aIndex = defaultOrder.indexOf(a.value);
    const bIndex = defaultOrder.indexOf(b.value);
    
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    return a.label.localeCompare(b.label);
  });
};

// 새 메시지 로그 생성
export const createMessageLog = (
  patient: Patient | {
    id: string;
    name: string;
    phoneNumber: string;
  },
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
  
  // 보다 고유한 ID 생성
  const uniqueId = options?.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${patient.id.substring(0, 8)}`;
  
  // 메시지 로그 생성
  const messageLog: MessageLog = {
    id: uniqueId,
    patientId: patient.id,
    patientName: patient.name,
    phoneNumber: patient.phoneNumber,
    content,
    messageType,
    status,
    createdAt: now,
    category: options?.category,
    templateName: options?.templateName,
    errorMessage: options?.errorMessage,
    operator: options?.operator,
    imageUrl: options?.imageUrl,
    rcsOptions: options?.rcsOptions
  };
  
  // 디버깅용
  console.log('생성된 메시지 로그:', JSON.stringify(messageLog).substring(0, 200) + '...');
  
  // Redux 스토어에 직접 저장 (비동기 작업)
  store.dispatch(saveMessageLog(messageLog));
  
  return messageLog;
};

// 메시지 내용에 환자명 적용
export const personalizeMessageContent = (
  content: string,
  patientName: string,
  hospitalName: string = '다산바른치과'
): string => {
  return content
    .replace(/\[환자명\]/g, patientName)
    .replace(/\[병원명\]/g, hospitalName)
    .replace(/고객님/g, `${patientName}님`);
};