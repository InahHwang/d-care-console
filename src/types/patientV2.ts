// src/types/patientV2.ts
// 개선된 환자 데이터 구조 (v2) - 테스트용

// 콜백 결과 타입
export type CallbackResult = '부재중' | '통화완료' | '콜백재요청' | '예약확정' | '예약취소' | '치료동의' | '치료거부' | '보류';

// 콜백 기록
export interface CallbackRecord {
  attempt: number;              // 콜백 차수 (1, 2, 3...)
  date: string;                 // 콜백 날짜 (YYYY-MM-DD)
  time: string;                 // 콜백 시간 (HH:mm)
  result: CallbackResult;       // 콜백 결과
  notes: string;                // 상담 메모
  counselorId: string;          // 상담사 ID
  counselorName?: string;       // 상담사 이름 (조회 시 조인)
  createdAt: string;            // 기록 생성 시간
}

// 상태 변경 이력
export interface StatusHistoryRecord {
  date: string;
  time: string;
  fromPhase: PatientPhase;
  toPhase: PatientPhase;
  fromStatus: PatientStatus | null;
  toStatus: PatientStatus | null;
  changedBy: string;            // 변경한 사람 ID
  changedByName?: string;       // 변경한 사람 이름
  note: string;                 // 변경 사유
}

// 환자 단계 (큰 흐름)
export type PatientPhase = '전화상담' | '예약확정' | '내원완료' | '종결';

// 환자 현재 상태 (세부 상태)
export type PatientStatus = '신규' | '콜백필요' | '부재중' | '잠재고객' | '예약취소' | '노쇼' | '재콜백필요';

// 종결 결과 (레거시 - 하위호환용)
export type PatientResult = '동의' | '미동의' | '보류';

// 내원 후 상태 (5단계 분류)
export type PostVisitStatus =
  | '치료진행'    // 실제로 치료가 시작됨 (매출 확정)
  | '치료예정'    // 동의 + 치료 날짜 확정 (매출 예정)
  | '결정대기'    // 아직 결정 못함 (기존 보류)
  | '장기보류'    // 동의는 했지만 계속 미룸 (문제 케이스!)
  | '종결';       // 치료 거부/연락두절/타병원

// 미동의/보류 사유 (공통)
export type ResultReason =
  | '예산초과'
  | '분납조건불가'
  | '치료계획이견'
  | '치료거부'
  | '치료기간부담'
  | '가족상의필요'
  | '타병원비교'
  | '추가정보필요'
  | '일정조율어려움'
  | '치료두려움'
  | '연락두절'
  | '기타';

// 내원 후 상태별 사유 그룹
export const POST_VISIT_REASONS = {
  결정대기: ['가족상의필요', '타병원비교', '추가정보필요', '치료두려움', '예산초과', '기타'] as ResultReason[],
  장기보류: ['일정조율어려움', '예산초과', '분납조건불가', '치료기간부담', '치료두려움', '기타'] as ResultReason[],
  종결: ['치료거부', '연락두절', '타병원비교', '예산초과', '치료계획이견', '기타'] as ResultReason[]
};

// 내원 후 상태 상세 정보
export interface PostVisitStatusInfo {
  status: PostVisitStatus;

  // 치료진행/치료예정
  treatmentStartDate?: string;      // 치료 시작일 (치료진행) 또는 예정일 (치료예정)
  nextVisitDate?: string;           // 다음 내원 예약일
  depositPaid?: boolean;            // 계약금 수납 여부 (치료예정)
  treatmentNotes?: string;          // 치료/준비 메모

  // 결정대기/장기보류
  reason?: ResultReason;            // 보류/미룸 사유
  reasonDetail?: string;            // 상세 사유
  nextCallbackDate?: string;        // 다음 콜백일
  expectedDecisionDate?: string;    // 예상 결정 시기 (결정대기)
  expectedStartDate?: string;       // 예상 시작 시기 (장기보류)
  needsSpecialOffer?: boolean;      // 추가 할인 필요 여부 (장기보류)
  agreedDate?: string;              // 최초 동의일 (장기보류 - 얼마나 미뤘는지 계산용)

  // 종결
  canRecontact?: boolean;           // 재연락 가능성

  // 공통
  callbackNotes?: string;           // 콜백/상담 메모
  updatedAt?: string;               // 마지막 업데이트
}

// 견적 정보
export interface EstimateInfoV2 {
  regularPrice: number;         // 정가 (원)
  discountPrice: number;        // 할인가 (원)
  discountRate: number;         // 할인율 (%)
  discountReason: string;       // 할인 사유
  treatmentPlan: string;        // 치료 계획 설명
  estimateDate: string;         // 견적 제시일
}

// 상담 정보 (전화상담)
export interface ConsultationInfoV2 {
  selectedTeeth: number[];      // 선택된 치아 번호 (FDI)
  teethUnknown: boolean;        // 치아 번호 미확인
  interestedServices: string[]; // 관심 서비스 (임플란트, 교정 등)
  consultationNotes: string;    // 상담 메모
  estimatedAmount: number;      // 예상 견적 (원)
  consultationDate: string;     // 최초 상담일
}

// 내원 상담 정보
export interface PostVisitConsultationV2 {
  visitDate: string;            // 내원일
  doctorName: string;           // 담당 의사
  diagnosisNotes: string;       // 진단 내용
  treatmentRecommendation: string; // 권장 치료
  estimateInfo: EstimateInfoV2; // 견적 정보
  patientResponse: string;      // 환자 반응
  followUpPlan: string;         // 후속 계획
}

// 예약 정보
export interface ReservationInfo {
  date: string;                 // 예약일 (YYYY-MM-DD)
  time: string;                 // 예약 시간 (HH:mm)
  type: '초진' | '재진' | '상담';
  notes: string;                // 예약 메모
  confirmedAt: string;          // 예약 확정 시간
  confirmedBy: string;          // 예약 확정자 ID
}

// 환자 정보 (v2)
export interface PatientV2 {
  _id?: string;

  // === 기본 정보 ===
  name: string;
  phone: string;
  gender: '남' | '여' | '';
  age: number | null;
  address: string;

  // === 유입 정보 ===
  callInDate: string;           // 최초 인입일
  source: string;               // 유입 경로 (네이버, 굿닥 등)
  consultationType: string;     // 상담 유형 (인바운드, 아웃바운드)

  // === 관리 영역 구분 ===
  visitConfirmed: boolean;      // false = 상담관리, true = 내원관리
  firstVisitDate: string | null; // 첫 내원일

  // === 상태 관리 ===
  phase: PatientPhase;          // 현재 단계
  currentStatus: PatientStatus | null; // 현재 세부 상태
  result: PatientResult | null; // 종결 결과
  resultReason: ResultReason | null; // 미동의/보류 사유
  resultReasonDetail: string;   // 사유 상세 (기타 선택 시)

  // === 담당자 ===
  assignedTo: string;           // 담당 상담사 ID
  assignedToName?: string;      // 담당 상담사 이름
  createdBy: string;            // 등록자 ID

  // === 상담 정보 ===
  consultation: ConsultationInfoV2;

  // === 예약 정보 ===
  reservation: ReservationInfo | null;

  // === 콜백 기록 ===
  preVisitCallbacks: CallbackRecord[];   // 전화상담 콜백 (상담관리)
  postVisitCallbacks: CallbackRecord[];  // 내원 후 콜백 (내원관리)

  // === 내원 상담 정보 ===
  postVisitConsultation: PostVisitConsultationV2 | null;

  // === 내원 후 상태 관리 ===
  postVisitStatusInfo: PostVisitStatusInfo | null;

  // === 상태 변경 이력 ===
  statusHistory: StatusHistoryRecord[];

  // === 메타 정보 ===
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

// 일별 보고서용 환자 데이터
export interface DailyReportPatientV2 {
  id: string;
  name: string;
  gender: string;
  age: number | null;
  phone: string;

  // 상태
  phase: PatientPhase;
  currentStatus: PatientStatus | null;
  result: PatientResult | null;
  resultReason: ResultReason | null;

  // 치료 정보
  treatment: string;            // "임플란트 #36, #37 (2본)"
  selectedTeeth: number[];
  teethUnknown: boolean;

  // 콜백 정보 (상담관리)
  preVisitCallbackCount: number;        // 전화상담 콜백 횟수
  lastPreVisitCallback: CallbackRecord | null;
  nextPreVisitCallbackDate: string | null;

  // 콜백 정보 (내원관리)
  postVisitCallbackCount: number;       // 내원 후 콜백 횟수
  lastPostVisitCallback: CallbackRecord | null;
  nextPostVisitCallbackDate: string | null;

  // 견적 정보
  originalAmount: number;       // 정가 (만원)
  discountRate: number;         // 할인율 (%)
  discountAmount: number;       // 할인액 (만원)
  finalAmount: number;          // 최종가 (만원)
  discountReason: string;

  // 예약 정보
  appointmentDate: string;
  appointmentTime: string;

  // 담당자
  counselorName: string;
  counselorId: string;

  // 상담 메모
  consultationNotes: string;
  postVisitNotes: string;

  // 시정 계획 (미동의/보류 시)
  correctionPlan: string;

  // 시간
  time: string;
}

// 일별 보고서 요약
export interface DailyReportSummaryV2 {
  total: number;

  // 상담관리 (전화상담)
  consultation: {
    total: number;
    newPatients: number;        // 신규
    callbackNeeded: number;     // 콜백필요
    reservationConfirmed: number; // 예약확정
    potential: number;          // 잠재고객
  };

  // 내원관리
  visit: {
    total: number;
    visited: number;            // 내원완료
    reCallbackNeeded: number;   // 재콜백필요
    agreed: number;             // 동의
    disagreed: number;          // 미동의
    pending: number;            // 보류
  };

  // 금액
  expectedRevenue: number;      // 예상 매출 (만원)
  actualRevenue: number;        // 실제 매출 (만원)
  totalDiscount: number;        // 총 할인액 (만원)
  avgDiscountRate: number;      // 평균 할인율 (%)

  // 콜백 현황
  preVisitCallbackCount: number;  // 전화상담 콜백 총 횟수
  postVisitCallbackCount: number; // 내원 후 콜백 총 횟수
}

// 일별 보고서 응답
export interface DailyReportResponseV2 {
  date: string;
  dayOfWeek: string;
  clinicName: string;
  summary: DailyReportSummaryV2;
  consultationPatients: DailyReportPatientV2[]; // 상담관리 환자
  visitPatients: DailyReportPatientV2[];        // 내원관리 환자
}
