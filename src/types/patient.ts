// src/types/patient.ts - 환자 반응 타입 수정

import { EventCategory } from '@/types/messageLog';

// 🔥 상담 타입 추가
export type ConsultationType = 'inbound' | 'outbound';

// 🔥 유입경로 타입 추가
export type ReferralSource = 
  | '유튜브'
  | '블로그'
  | '홈페이지'
  | '소개환자'
  | '제휴'
  | '기타'
  | '';

  // 내원 후 상태 타입 추가
export type PostVisitStatus = 
  | '재콜백필요'    // 내원했지만 추가 상담 필요
  | '치료시작'      // 치료 시작
  | '보류'          // 환자 요청으로 보류
  | '종결'          // 환자 요청으로 보류
  | '';

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

// 🔥 납부 방식 타입 추가
export interface PaymentInfo {
  paymentType: 'installment' | 'lump_sum';  // 분할납 | 일시납
  downPayment?: number;        // 선입금 (분할납일 때)
  installmentPlan?: string;    // 분할 계획
}

// 🔥 내원 후 상담 정보 타입 추가
export interface PostVisitConsultationInfo {
  consultationContent: string;   // 상담 내용
  estimateInfo: EstimateInfo;    // 견적 정보
  nextCallbackDate?: string;     // 다음 콜백 예정일 (재콜백필요일 때)
  nextConsultationPlan?: string; // 다음 상담 계획 (재콜백필요일 때)
  paymentInfo?: PaymentInfo;     // 납부 방식 (치료시작일 때)
  nextVisitDate?: string;        // 다음 내원 예정일 (치료시작일 때)
  completionNotes?: string;      // 완료 메모 (치료완료일 때)
}

// 🔥 상담/결제 정보 타입 정의 (대폭 단순화) - 호환성 유지
export interface ConsultationInfo {
  estimatedAmount: number;           // 견적 금액
  consultationDate: string;         // 상담 날짜 (YYYY-MM-DD)
  consultationNotes?: string;       // 상담 메모
  treatmentPlan?: string;           // 치료 계획
  
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

// 🔥 콜백 아이템 타입 정의 - 담당자 정보 추가
export interface CallbackItem {
  completedAt?: string;  // 선택적 필드로 변경 (물음표 추가)
  time: string | undefined; 
  id: string;
  date: string;
  status: CallbackStatus;
  notes?: string;          
  resultNotes?: string;   
  customerResponse?: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  type: '1차' | '2차' | '3차' | '4차' | '5차';
  cancelReason?: string;
  cancelDate?: string;
  isCompletionRecord?: boolean;
  // 🔥 이벤트 타겟 설정 단계 추가
  nextStep?: '2차_콜백' | '3차_콜백' | '4차_콜백' | '5차_콜백' | '예약_확정' | '종결_처리' | '이벤트_타겟_설정' | '';
  
  // 🔥 담당자 정보 추가
  handledBy?: string;          // 처리한 담당자 ID
  handledByName?: string;      // 처리한 담당자 이름
  createdBy?: string;          // 콜백을 생성한 담당자 ID
  createdByName?: string;      // 콜백을 생성한 담당자 이름
  // 🔥 새로 추가할 필드들
  originalScheduledDate?: string;  // 원래 예정일 보존
  actualCompletedDate?: string;    // 실제 처리일
  isDelayed?: boolean;             // 지연 처리 여부
  delayReason?: string;            // 지연 사유
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

// 🔥 환자 타입 정의 (MongoDB ID 추가) - consultationType, referralSource, 담당자 필드, 결제 정보 추가
export interface Patient {
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
  
  // 기존 필드들 유지
  postVisitNotes?: string;           // 내원 후 메모 (호환성 유지)
  treatmentStartDate?: string;       // 치료 시작일
  nextVisitDate?: string;           // 다음 내원 예정일
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

// 🔥 환자 수정을 위한 타입 - referralSource, 담당자 정보, 결제 정보 추가
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
}