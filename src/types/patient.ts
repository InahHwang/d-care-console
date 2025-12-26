// src/types/patient.ts - 완전한 수정된 버전

import { EventCategory } from '@/types/messageLog';

// 🔥 환자 필터 타입 정의 (통합) - 내원관리 새로운 필터들 추가
export type PatientFilterType = 
  // 대시보드 필터 타입들
  | 'new_inquiry'           
  | 'reservation_rate'      
  | 'visit_rate'           
  | 'treatment_rate'    
  | 'potential_customer'   
  // 상태별 필터 타입들
  | 'callbackUnregistered' 
  | 'overdueCallbacks' 
  | 'callbackNeeded' 
  | 'absent' 
  | 'todayScheduled'
  // 세분화된 필터 타입들
  | 'overdueCallbacks_consultation'
  | 'overdueCallbacks_visit'
  | 'todayScheduled_consultation'
  | 'todayScheduled_visit'
  | 'callbackUnregistered_consultation'
  | 'callbackUnregistered_visit'
  | 'reminderCallbacks_scheduled'
  | 'reminderCallbacks_registrationNeeded'
  // 🔥 내원관리 새로운 필터 타입들 추가
  | 'unprocessed_callback'           // 미처리 콜백
  | 'treatment_consent_not_started'  // 치료동의 후 미시작
  | 'needs_callback_visit'           // 재콜백 필요 (내원환자)
  | 'no_status_visit';               // 상태 미설정 (내원환자)

// 🔥 내원관리 필터 상태 타입 추가
export type VisitManagementFilterType = 
  | 'all'                           // 전체 보기
  | 'unprocessed_callback'          // 미처리 콜백
  | 'treatment_consent_not_started' // 치료동의 후 미시작
  | 'in_treatment'                  // 치료 시작
  | 'needs_callback'                // 재콜백 필요
  | 'no_status';                    // 상태 미설정

// 🔥 내원관리 필터 설명 매핑
export const VISIT_MANAGEMENT_FILTER_DESCRIPTIONS: Record<VisitManagementFilterType, string> = {
  all: '모든 내원확정 환자',
  unprocessed_callback: '콜백 예정일이 지났는데 아직 추가콜백등록이나 치료동의, 치료 시작 및 종결과 같은 그 이후 팔로업이 되지 않고 방치된 환자',
  treatment_consent_not_started: '치료동의 상태이고 "치료 예정일"이 지났는데 그 이후 팔로업이 되지 않고 방치된 환자',
  in_treatment: '치료가 시작된 환자',
  needs_callback: '재콜백이 필요한 환자',
  no_status: '내원 후 상태가 설정되지 않은 환자'
};

// 🔥 내원관리 필터 우선순위 (긴급도 순)
export const VISIT_MANAGEMENT_FILTER_PRIORITY: VisitManagementFilterType[] = [
  'unprocessed_callback',          // 가장 긴급
  'treatment_consent_not_started', // 두 번째 긴급
  'no_status',                     // 세 번째 긴급
  'needs_callback',                // 네 번째
  'in_treatment',                  // 다섯 번째
  'all'                            // 전체 보기
];

// 🔥 내원관리 필터 색상 매핑
export const VISIT_MANAGEMENT_FILTER_COLORS: Record<VisitManagementFilterType, {
  bg: string;
  text: string;
  hover: string;
}> = {
  all: { bg: 'bg-gray-100', text: 'text-gray-800', hover: 'hover:bg-gray-200' },
  unprocessed_callback: { bg: 'bg-red-100', text: 'text-red-800', hover: 'hover:bg-red-50' },
  treatment_consent_not_started: { bg: 'bg-blue-100', text: 'text-blue-800', hover: 'hover:bg-blue-50' },
  in_treatment: { bg: 'bg-green-100', text: 'text-green-800', hover: 'hover:bg-green-50' },
  needs_callback: { bg: 'bg-yellow-100', text: 'text-yellow-800', hover: 'hover:bg-yellow-50' },
  no_status: { bg: 'bg-gray-100', text: 'text-gray-600', hover: 'hover:bg-gray-50' }
};

// 🔥 상담 타입 추가 - 사용자 정의 타입도 허용
export type ConsultationType = 'inbound' | 'outbound' | 'returning' | string;

// 🔥 내원관리 전용 콜백 타입 추가
export type VisitManagementCallbackType = 
  | '내원1차' | '내원2차' | '내원3차' | '내원4차' | '내원5차' | '내원6차'
  | '내원재콜백필요' | '내원치료동의' | '내원치료시작' | '내원종결';

// 🔥 유입경로 타입 추가
export type ReferralSource = 
  | '유튜브'
  | '블로그'
  | '홈페이지'
  | '소개환자'
  | '제휴'
  | '기타'
  | '';

// 🔥 첫 상담 후 환자 상태 타입 (새로 추가)
export type FirstConsultationStatus = 
  | '예약완료'
  | '상담진행중'
  | '부재중'
  | '종결'
  | '';

// 🔥 예약 후 미내원 환자 상태 타입 수정 - "재콜백등록" → "다음 콜백필요"
export type PostReservationStatus = 
  | '재예약 완료'    // 🔥 새로 추가 - 맨 앞에 위치
  | '다음 콜백필요'  // 🔥 "재콜백등록"에서 변경
  | '부재중'        
  | '종결'
  | '';

// 🔥 N차 콜백 후 환자 상태 타입 (새로 추가)
export type CallbackFollowupStatus = 
  | '예약완료'
  | '상담진행중'
  | '부재중'
  | '종결'
  | '';

// 🔥 내원 후 상태 타입 수정 - 순서와 옵션 변경
export type PostVisitStatus = 
  | '재콜백필요'    // 내원했지만 추가 상담 필요
  | '치료동의'      // 🔥 새로 추가: 치료에 동의했지만 아직 시작하지 않음
  | '치료시작'      // 치료 시작
  | '종결'          // 치료 완료 또는 종결
  | '';            // 🔥 빈 문자열 추가 (상태 미설정)

// 🔥 환자 반응 타입 추가 (견적 동의 대신)
export type PatientReaction = 
  | '동의해요(적당)'     // 기존 견적 동의와 유사
  | '비싸요'            // 가격에 대한 부담
  | '생각보다 저렴해요'   // 가격에 만족
  | '알 수 없음'        // 명확한 반응 없음
  | '';

// 🔥 견적 정보 타입 수정 - estimateAgreed → patientReaction으로 변경
export interface EstimateInfo {
  regularPrice: number;        // 정가
  discountPrice: number;       // 할인가
  discountEvent?: string;      // 적용할인이벤트
  patientReaction: PatientReaction;  // 🔥 환자 반응 (최종 할인가 기준으로)
}

// 🔥 첫 상담 후 상태별 정보 타입들 (새로 추가)
export interface FirstConsultationResult {
  status: FirstConsultationStatus;

  // 예약완료일 때 필요한 정보
  reservationDate?: string;        // 예약 날짜
  reservationTime?: string;        // 예약 시간
  consultationContent?: string;    // 상담 내용

  // 상담진행중/부재중일 때 필요한 정보
  callbackDate?: string;          // 콜백 날짜
  consultationPlan?: string;      // 상담 계획

  // 종결일 때 필요한 정보
  terminationReason?: string;     // 종결 사유 (기타 선택 시 주관식 내용 포함)

  // 🔥 미룸 사유 (상담진행중일 때)
  postponementReason?: string;           // 미룸 사유 코드
  postponementReasonCustom?: string;     // 기타 선택 시 직접 입력 내용

  createdAt: string;
  updatedAt: string;
}

// 🔥 예약 후 미내원 상태 정보 타입 수정
export interface PostReservationResult {
  status: PostReservationStatus;
  
  // 재예약 완료일 때 필요한 정보
  reReservationDate?: string;     // 🔥 새로 추가: 재예약 날짜
  reReservationTime?: string;     // 🔥 새로 추가: 재예약 시간
  
  // 다음 콜백필요/부재중일 때 필요한 정보
  callbackDate?: string;          
  reason?: string;               
  
  // 종결일 때 필요한 정보  
  terminationReason?: string;     // 종결 사유 (기타 선택 시 주관식 내용 포함)
  
  createdAt: string;
  updatedAt: string;
}

// 🔥 콜백 후속 상태 정보 타입 (새로 추가)
export interface CallbackFollowupResult {
  status: CallbackFollowupStatus;
  callbackType: '1차' | '2차' | '3차' | '4차' | '5차'; // 몇 차 콜백인지

  // 예약완료일 때 (첫 상담 후와 동일한 로직)
  reservationDate?: string;
  reservationTime?: string;
  consultationContent?: string;

  // 부재중/상담중일 때
  nextCallbackDate?: string;     // 다음 콜백 날짜
  reason?: string;              // 사유

  // 🔥 종결일 때 추가
  terminationReason?: string;

  // 🔥 미룸 사유 (상담진행중일 때)
  postponementReason?: string;           // 미룸 사유 코드
  postponementReasonCustom?: string;     // 기타 선택 시 직접 입력 내용

  createdAt: string;
  updatedAt: string;
}

// 🔥 납부 방식 타입 추가
export interface PaymentInfo {
  paymentType: 'installment' | 'lump_sum';  // 분할납 | 일시납
  downPayment?: number;        // 선입금 (분할납일 때)
  installmentPlan?: string;    // 분할 계획
}

// 🔥 치료 동의 정보 타입 추가
export interface TreatmentConsentInfo {
  treatmentStartDate?: string;        // 🔥 치료 시작 예정일
  consentNotes?: string;              // 치료 동의 관련 메모
  estimatedTreatmentPeriod?: string;  // 예상 치료 기간
}

// 🔥 내원 후 상담 정보 타입 추가 - 치료 동의 정보 포함
export interface PostVisitConsultationInfo {
  consultationContent: string;          // 기존 상담 내용
  firstVisitConsultationContent?: string; // 🔥 새로 추가: 내원 후 첫 상담 내용
  estimateInfo: EstimateInfo;           // 견적 정보
  nextCallbackDate?: string;            // 다음 콜백 예정일 (재콜백필요일 때)
  nextConsultationPlan?: string;        // 다음 상담 계획 (재콜백필요일 때)
  paymentInfo?: PaymentInfo;            // 납부 방식 (치료시작일 때)
  nextVisitDate?: string;               // 다음 내원 예정일 (치료시작일 때)
  completionNotes?: string;             // 완료 메모 (종결일 때)
  treatmentContent?: string;            // 치료 내용
  treatmentConsentInfo?: TreatmentConsentInfo; // 치료 동의 정보 (치료동의일 때)
}

// 🔥 상담/결제 정보 타입 정의 (대폭 단순화) - 호환성 유지
export interface ConsultationInfo {
  estimatedAmount?: number;           // 견적 금액
  consultationDate: string;         // 상담 날짜 (YYYY-MM-DD)
  consultationNotes?: string;       // 상담 메모
  treatmentPlan?: string;           // 치료 계획 (기존 텍스트 - 호환성 유지)
  selectedTeeth?: number[];         // 🔥 선택된 치아 번호 배열 (FDI 국제 표기법)
  teethUnknown?: boolean;           // 🔥 치아 번호 미확인 여부

  // 🔥 핵심 필드: 견적 동의 여부 (호환성 유지)
  estimateAgreed: boolean;          // 견적 동의 여부 (true = Y, false = N)

  createdAt?: string;               // 생성일시
  updatedAt?: string;               // 수정일시
}

// 이벤트 타겟 사유 타입
export type EventTargetReason = 
  | 'price_hesitation'    // 가격 망설임
  | 'treatment_consideration' // 치료 방법 고민
  | 'scheduling_issue'    // 시간 조율 필요
  | 'competitor_comparison' // 경쟁업체 비교 중
  | 'other'              // 기타 (직접 입력)
  | '';

// 이벤트 타겟 정보 타입
export interface EventTargetInfo {
  isEventTarget: boolean;          // 이벤트 타겟 여부
  targetReason: EventTargetReason; // 타겟 사유 (선택)
  customTargetReason?: string;     // 직접 입력한 타겟 사유 (기타 선택 시)
  categories: EventCategory[];     // 이벤트 카테고리 (다중 선택)
  scheduledDate?: string;          // 발송 가능 시기
  notes?: string;                  // 메모
  createdAt?: string;               // 타겟 지정 일시
  updatedAt?: string;               // 마지막 수정 일시
}

// 환자 상태 타입 정의
export type PatientStatus = 
  | '잠재고객'
  | '콜백필요'
  | '부재중'
  | 'VIP'
  | '예약확정'  // 예약 확정된 환자
  | '재예약확정' // 🔥 재예약한 환자 (한번 미내원 후 재예약)
  | '종결';     // 일반 종결된 환자

// 리마인드 콜 상태 타입 정의
export type ReminderStatus = 
  | '초기'
  | '1차'
  | '2차'
  | '3차'
  | '4차'  // 추가
  | '5차'  // 추가
  | '-';

// 콜백 상태 타입 정의
export type CallbackStatus = 
  | '예정'
  | '완료'
  | '취소'
  | '종결'
  | '부재중'  
  | '예약확정';  // 이 부분을 추가

  export interface CallbackConsultationRecord {
  consultationContent: string;    // 상담 내용
  consultationDate: string;       // 상담 날짜 (YYYY-MM-DD)
  consultationTime: string;       // 상담 시간 (HH:mm)
  createdAt: string;             // 기록 생성 시간
}

// 🔥 콜백 아이템 타입 정의 - 재예약 기록 필드 추가
export interface CallbackItem {
  isDirectVisitCompletion?: boolean;
  id: string;
  date: string;                    // 원래 예정된 날짜 (변경되지 않음)
  time: string | undefined;        // 원래 예정된 시간 (변경되지 않음)
  status: CallbackStatus;
  notes?: string;
  resultNotes?: string;
  customerResponse?: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  type: '1차' | '2차' | '3차' | '4차' | '5차' | '재예약완료' | VisitManagementCallbackType;
  
  // 🔥 새로 추가: 실제 처리 날짜/시간 필드들
  actualCompletedDate?: string;    // 실제 완료 처리한 날짜 (YYYY-MM-DD)
  actualCompletedTime?: string;    // 실제 완료 처리한 시간 (HH:mm)
  
  // 🔥 기존 completedAt은 ISO 문자열로 유지 (기존 로직 호환성)
  completedAt?: string;            // ISO 형식의 완료 시간 (기존 필드 유지)
  completedDate?: string;          // 🔥 DEPRECATED: actualCompletedDate 사용 권장
  completedTime?: boolean;         // 🔥 DEPRECATED: 타입 수정 필요한 기존 필드
  
  // 기존 필드들...
  createdAt: string;
  updatedAt?: string;              // 🔥 추가: 수정 일시
  cancelReason?: string;
  cancelDate?: string;
  isCompletionRecord?: boolean;
  content?: any;
  
  // 🔥 새로운 첫 상담 후 상태 관리 필드들
  firstConsultationResult?: FirstConsultationResult;
  postReservationResult?: PostReservationResult;
  callbackFollowupResult?: CallbackFollowupResult;
  
  // 🔥 재예약 기록 구분 필드
  isReReservationRecord?: boolean;
  
  // 기존 필드들...
  nextStep?: '2차_콜백' | '3차_콜백' | '4차_콜백' | '5차_콜백' | '예약_확정' | '종결_처리' | '이벤트_타겟_설정' | '내원2차_콜백' | '내원3차_콜백' | '';
  handledBy?: string;
  handledByName?: string;
  createdBy?: string;
  createdByName?: string;
  originalScheduledDate?: string;
  isDelayed?: boolean;
  delayReason?: string;
  isVisitManagementCallback?: boolean;
  visitManagementReason?: string;

  // 🔥 미룸 사유 관련 필드 추가
  postponementReason?: string;           // 미룸 사유 코드 (예: 'budget_exceeded')
  postponementReasonCustom?: string;     // 기타 선택 시 직접 입력 내용
  postponementReasonConfirmedAt?: string; // 사유가 확정된 시점 (ISO 문자열)

  consultationRecord?: CallbackConsultationRecord;
}

// 🔥 콜백 완료 처리를 위한 헬퍼 함수들도 추가
export const createCompletedCallback = (
  originalCallback: CallbackItem, 
  completionData: {
    actualCompletedDate: string;
    actualCompletedTime: string;
    status?: CallbackStatus;
    notes?: string;
    firstConsultationResult?: FirstConsultationResult;
    postReservationResult?: PostReservationResult;
    callbackFollowupResult?: CallbackFollowupResult;
  }
): CallbackItem => {
  return {
    ...originalCallback,
    status: completionData.status || '완료',
    actualCompletedDate: completionData.actualCompletedDate,
    actualCompletedTime: completionData.actualCompletedTime,
    completedAt: new Date().toISOString(),
    notes: completionData.notes || originalCallback.notes,
    firstConsultationResult: completionData.firstConsultationResult,
    postReservationResult: completionData.postReservationResult,
    callbackFollowupResult: completionData.callbackFollowupResult,
    updatedAt: new Date().toISOString()
  };
};

// 🔥 콜백 표시용 날짜/시간 추출 헬퍼 함수
export const getCallbackDisplayInfo = (callback: CallbackItem) => {
  return {
    // 원래 예정된 날짜/시간
    scheduledDate: callback.date,
    scheduledTime: callback.time,
    
    // 실제 처리된 날짜/시간 (완료된 경우에만)
    actualCompletedDate: callback.actualCompletedDate,
    actualCompletedTime: callback.actualCompletedTime,
    
    // 표시용 정보
    isCompleted: callback.status === '완료',
    hasActualCompletionTime: !!(callback.actualCompletedDate && callback.actualCompletedTime),
    
    // 표시용 문자열
    scheduledDateTime: callback.time 
      ? `${callback.date} ${callback.time}` 
      : callback.date,
    actualCompletedDateTime: (callback.actualCompletedDate && callback.actualCompletedTime)
      ? `${callback.actualCompletedDate} ${callback.actualCompletedTime}`
      : undefined
  };
};

// 🔥 내원관리 콜백 생성을 위한 타입
export interface CreateVisitCallbackData {
  type: VisitManagementCallbackType;
  date: string;
  status: CallbackStatus;
  notes?: string;
  reason: string; // 내원 후 콜백 사유 (필수)
  isVisitManagementCallback: true;
}

// 종결 처리를 위한 타입 정의
export interface CompletePatientData {
  patientId: string;
  reason: string;
}

// 🔥 인바운드 환자 빠른 등록용 타입 추가
export interface QuickInboundPatient {
  phoneNumber: string;
  name?: string;
  consultationType: 'inbound';
}

// 🔥 환자 타입 정의 (MongoDB ID 추가) - 새로운 첫 상담 후 상태 필드들 추가
export interface Patient {
  isTodayReservationPatient: any;
  paymentAmount: any;
  treatmentCost: any;
  memo: any;
  consultation: any;
  _id: string;
  nextCallbackDate: string;
  id: string;
  patientId: string; // PT-XXXX 형식
  name: string;
  phoneNumber: string;
  interestedServices: string[];
  lastConsultation: string; // YYYY-MM-DD 형식
  status: PatientStatus;
  reminderStatus: ReminderStatus;
  notes?: string;
  callInDate: string;
  firstConsultDate: string;
  callbackHistory?: CallbackItem[];
  age?: number;
  region?: {
    province: string; // 시/도
    city?: string; // 시/군/구
  };
  createdAt: string;
  updatedAt: string;
  isCompleted?: boolean; // 종결 처리 여부
  visitConfirmed?: boolean; // 내원 확정 필드 추가
  completedAt?: string; // 종결 처리 일자
  completedReason?: string; // 종결 사유
  eventTargetInfo?: EventTargetInfo;
  
  // 🔥 기존 필드들
  consultationType: ConsultationType; // 인바운드/아웃바운드 구분
  inboundPhoneNumber?: string; // 인바운드일 때 입력받은 번호 (표시용)
  referralSource?: ReferralSource;
  
  // 🔥 담당자 정보 추가
  createdBy?: string;
  createdByName?: string;
  lastModifiedBy?: string;
  lastModifiedByName?: string;
  lastModifiedAt?: string;
  
  // 계산된 필드 (프론트엔드에서 계산)
  paymentRate?: number;             // 결제율 (paidAmount / estimatedAmount * 100)

  // 🔥 내원 관리를 위한 필드들 수정
  postVisitStatus?: PostVisitStatus;        // 내원 후 상태
  visitDate?: string;                       // 실제 내원 날짜 (YYYY-MM-DD)
  reservationDate?: string;                 // 🔥 예약일 (상담관리에서 표기용)
  reservationTime?: string;                 // 🔥 예약시간
  postVisitConsultation?: PostVisitConsultationInfo; // 🔥 내원 후 상담 정보
  
  // 🔥 새로운 첫 상담 후 상태 관리 필드들 추가
  currentConsultationStage?: 'first' | 'callback' | 'post_reservation' | 'completed'; // 현재 상담 단계
  lastFirstConsultationResult?: FirstConsultationResult;   // 마지막 첫 상담 후 결과
  lastPostReservationResult?: PostReservationResult;       // 마지막 예약 후 미내원 결과
  pendingCallbackCount?: number;                           // 대기 중인 콜백 수
  isPostReservationPatient?: boolean;                      // 예약 후 미내원 환자 여부
  hasBeenPostReservationPatient?: boolean;                 // 🔥 한번이라도 예약 후 미내원이었던 기록 추가
  
  // 기존 필드들 유지
  postVisitNotes?: string;           // 내원 후 메모 (호환성 유지)
  treatmentStartDate?: string;       // 치료 시작일
  nextVisitDate?: string;           // 다음 내원 예정일
  
  // 🔥 임시 데이터 표시용 필드 (Optimistic Update용)
  isTemporary?: boolean;            // 임시 데이터 여부

  // 🔥 미룸 사유 관련 필드 추가 (최근 확정된 사유)
  latestPostponementReason?: string;           // 최근 확정된 미룸 사유 코드
  latestPostponementReasonCustom?: string;     // 기타 선택 시 직접 입력 내용
  latestPostponementReasonConfirmedAt?: string; // 사유가 확정된 시점
  latestPostponementCallbackType?: string;     // 어떤 콜백에서 확정되었는지 (예: '2차', '내원1차')
}

// 🔥 환자 생성을 위한 타입 - consultationType, referralSource, 담당자 정보, 결제 정보 추가
export interface CreatePatientData {
  name: string;
  phoneNumber: string;
  status: PatientStatus;
  interestedServices: string[];
  memo?: string;
  callInDate: string;
  firstConsultDate?: string;
  age?: number;
  region?: {
    province: string; // 시/도
    city?: string; // 시/군/구
  };
  consultationType: ConsultationType; // 🔥 추가
  inboundPhoneNumber?: string; // 🔥 추가
  referralSource?: ReferralSource; // 🔥 유입경로 추가
  consultation?: Partial<ConsultationInfo>; // 🔥 환자 등록 시 상담 정보는 선택적
  
  // 🔥 담당자 정보는 자동으로 설정되므로 CreatePatientData에서는 제외
  // (API에서 현재 로그인한 사용자 정보를 자동으로 설정)
}

// 🔥 환자 수정을 위한 타입 - referralSource, 담당자 정보, 결제 정보, 새로운 상태 관리 필드 추가
export interface UpdatePatientData {
  name?: string;
  phoneNumber?: string;
  status?: PatientStatus;
  interestedServices?: string[];
  notes?: string;
  callInDate?: string;
  firstConsultDate?: string;
  age?: number;
  region?: {
    province: string;
    city?: string;
  };
  reminderStatus?: ReminderStatus; // 리마인더 상태 필드 추가
  isCompleted?: boolean; // 종결 처리 여부 필드 추가
  completedAt?: string; // 종결 처리 일자 필드 추가
  completedReason?: string; // 종결 사유 필드 추가
  callbackHistory?: CallbackItem[];
  consultationType?: ConsultationType; // 🔥 추가
  referralSource?: ReferralSource; // 🔥 유입경로 추가
  consultation?: Partial<ConsultationInfo>; // 🔥 환자 수정 시 상담 정보 업데이트
  
  // 🔥 담당자 정보 (수정 시에는 lastModifiedBy만 업데이트)
  lastModifiedBy?: string;
  lastModifiedByName?: string;
  lastModifiedAt?: string;
  
  // 🔥 새로운 첫 상담 후 상태 관리 필드들 추가
  reservationDate?: string;                 // 🔥 예약일 (상담관리에서 표기용)
  reservationTime?: string;                 // 🔥 예약시간
  currentConsultationStage?: 'first' | 'callback' | 'post_reservation' | 'completed'; // 현재 상담 단계
  lastFirstConsultationResult?: FirstConsultationResult;   // 마지막 첫 상담 후 결과
  lastPostReservationResult?: PostReservationResult;       // 마지막 예약 후 미내원 결과
  pendingCallbackCount?: number;                           // 대기 중인 콜백 수
  isPostReservationPatient?: boolean;                      // 예약 후 미내원 환자 여부
  hasBeenPostReservationPatient?: boolean;                 // 🔥 한번이라도 예약 후 미내원이었던 기록 추가
  nextCallbackDate?: string;                               // 다음 콜백 날짜
  
  // 🔥 내원 관리를 위한 필드들
  visitConfirmed?: boolean; // 내원 확정 필드
  visitDate?: string;       // 실제 내원 날짜 (YYYY-MM-DD)
  postVisitStatus?: PostVisitStatus;        // 내원 후 상태
  postVisitConsultation?: PostVisitConsultationInfo; // 🔥 내원 후 상담 정보
  postVisitNotes?: string;           // 내원 후 메모 (호환성 유지)
  treatmentStartDate?: string;       // 치료 시작일
  nextVisitDate?: string;           // 다음 내원 예정일

  // 🔥 미룸 사유 관련 필드 추가
  latestPostponementReason?: string;
  latestPostponementReasonCustom?: string;
  latestPostponementReasonConfirmedAt?: string;
  latestPostponementCallbackType?: string;
}

// 🔥 내원관리 통계 계산 헬퍼 함수들
export const calculateVisitManagementStats = (patients: Patient[]) => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  const stats = {
    total: patients.length,
    unprocessed_callback: 0,
    treatment_consent_not_started: 0,
    in_treatment: 0,
    needs_callback: 0,
    no_status: 0
  };
  
  patients.forEach(patient => {
    // 미처리 콜백 계산
    if (patient.callbackHistory && patient.callbackHistory.length > 0) {
      const visitCallbacks = patient.callbackHistory.filter(cb => 
        cb.isVisitManagementCallback === true && cb.status === '예정'
      );
      
      if (visitCallbacks.some(callback => callback.date < todayString)) {
        stats.unprocessed_callback++;
        return; // 중복 카운트 방지
      }
    }
    
    // 치료동의 후 미시작 계산
    if (patient.postVisitStatus === '치료동의') {
      const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
      if (treatmentStartDate && treatmentStartDate < todayString) {
        stats.treatment_consent_not_started++;
        return;
      }
    }
    
    // 나머지 상태별 계산
    switch (patient.postVisitStatus) {
      case '치료시작':
        stats.in_treatment++;
        break;
      case '재콜백필요':
        stats.needs_callback++;
        break;
      case '':
      case null:
      case undefined:
        stats.no_status++;
        break;
    }
  });
  
  return stats;
};

// 🔥 내원관리 필터 적용 함수
export const applyVisitManagementFilter = (
  patients: Patient[], 
  filterType: VisitManagementFilterType
): Patient[] => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  switch (filterType) {
    case 'unprocessed_callback':
      return patients.filter(patient => {
        if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
          return false;
        }
        
        const visitCallbacks = patient.callbackHistory.filter(cb => 
          cb.isVisitManagementCallback === true && cb.status === '예정'
        );
        
        if (visitCallbacks.length === 0) {
          return false;
        }
        
        return visitCallbacks.some(callback => callback.date < todayString);
      });
      
    case 'treatment_consent_not_started':
      return patients.filter(patient => {
        if (patient.postVisitStatus !== '치료동의') {
          return false;
        }
        
        const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
        if (!treatmentStartDate) {
          return false;
        }
        
        return treatmentStartDate < todayString;
      });
      
    case 'in_treatment':
      return patients.filter(patient => patient.postVisitStatus === '치료시작');
      
    case 'needs_callback':
      return patients.filter(patient => patient.postVisitStatus === '재콜백필요');
      
    case 'no_status':
      return patients.filter(patient => !patient.postVisitStatus);
      
    case 'all':
    default:
      return patients;
  }
};

// 🔥 내원관리 필터 유틸리티 함수들 추가
export const getVisitManagementFilterName = (filterType: PatientFilterType | VisitManagementFilterType): string => {
  switch (filterType) {
    case 'unprocessed_callback':
      return '미처리 콜백';
    case 'treatment_consent_not_started':
      return '치료동의 후 미시작';
    case 'needs_callback':
    case 'needs_callback_visit':
      return '재콜백 필요';
    case 'no_status':
    case 'no_status_visit':
      return '상태 미설정';
    case 'in_treatment':
      return '치료 시작';
    case 'all':
      return '전체 보기';
    default:
      return '전체 보기';
  }
};

// 🔥 내원관리 필터 검증 함수
export const isValidVisitManagementFilter = (filterType: string): boolean => {
  const validFilters = [
    'all',
    'unprocessed_callback',
    'treatment_consent_not_started',
    'in_treatment',
    'needs_callback',
    'no_status'
  ];
  return validFilters.includes(filterType);
};

// 🔥 내원관리 필터 계산 헬퍼 함수들
export const calculateUnprocessedCallbacks = (patients: Patient[]): Patient[] => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  return patients.filter(patient => {
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
      return false;
    }
    
    const visitCallbacks = patient.callbackHistory.filter(cb => 
      cb.isVisitManagementCallback === true && cb.status === '예정'
    );
    
    if (visitCallbacks.length === 0) {
      return false;
    }
    
    return visitCallbacks.some(callback => callback.date < todayString);
  });
};

export const calculateTreatmentConsentNotStarted = (patients: Patient[]): Patient[] => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  return patients.filter(patient => {
    if (patient.postVisitStatus !== '치료동의') {
      return false;
    }
    
    const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
    if (!treatmentStartDate) {
      return false;
    }
    
    return treatmentStartDate < todayString;
  });
};

export type { EventCategory };