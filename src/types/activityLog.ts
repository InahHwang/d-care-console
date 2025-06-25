// src/types/activityLog.ts

// 활동 유형 정의
export type ActivityAction = 
  // 환자 관리
  | 'patient_create'
  | 'patient_update' 
  | 'patient_delete'
  | 'patient_view'
  | 'patient_complete'
  | 'patient_complete_cancel'
  | 'patient_reset_post_visit'
  // 콜백 관리
  | 'callback_create'
  | 'callback_update'
  | 'callback_delete'
  | 'callback_complete'
  | 'callback_cancel'
  | 'callback_reschedule'
  // 환자 상태 변경
  | 'patient_status_change'
  | 'visit_confirmation_toggle'
  // 메시지 관리
  | 'message_send'
  | 'message_template_used'
  | 'message_log_view'
  // 이벤트 타겟
  | 'event_target_create'
  | 'event_target_update'
  | 'event_target_delete'
  // 시스템 접근
  | 'login'
  | 'logout'
  // 사용자 관리 (마스터만)
  | 'user_create'
  | 'user_update'
  | 'user_delete'

// 활동 대상 타입
export type ActivityTarget = 
  | 'patient'
  | 'callback'
  | 'message'
  | 'event_target'
  | 'user'
  | 'system'

// 활동 로그 인터페이스
export interface ActivityLog {
  _id: string
  source?: string      // 로그 소스 (frontend/backend_api 등)
  userId: string       // 작업을 수행한 사용자 ID
  userName: string     // 작업을 수행한 사용자 이름
  userRole: string     // 사용자 권한
  action: ActivityAction
  target: ActivityTarget
  targetId: string     // 대상 객체의 ID (환자 ID, 콜백 ID 등)
  targetName?: string  // 대상 객체의 이름 (환자 이름 등)
  details: ActivityDetails
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

// 활동 세부사항 (액션별로 다른 정보 저장)
export interface ActivityDetails {
  // 기본 정보
  notes?: string
  metadata?: Record<string, any>
  skipFrontendLog?: boolean
  
  // 환자 관련
  patientId?: string
  patientName?: string
  previousData?: any
  newData?: any
  changeDetails?: string      // 변경사항 요약
  phoneNumber?: string
  age?: number
  status?: string
  consultationType?: string
  referralSource?: string
  interestedServices?: string[]
  region?: any
  callInDate?: string
  
  // 콜백 관련
  callbackId?: string
  callbackType?: string       // 1차, 2차, 3차, 4차, 5차
  callbackDate?: string
  callbackStatus?: string     // 예정, 완료, 취소, 부재중
  callbackNumber?: string
  result?: string             // 콜백 결과 (완료, 부재중, 예약확정, 종결처리, 이벤트타겟설정)
  nextStep?: string           // 다음 단계 (2차_콜백, 3차_콜백, 예약_확정, 종결_처리 등)
  consultationNotes?: string  // 상담 내용
  customerResponse?: string   // 고객 반응 (very_positive, positive, neutral, negative, very_negative)
  cancelReason?: string       // 취소 사유
  
  // 메시지 관련
  messageId?: string
  messageType?: string        // SMS, LMS, MMS, RCS
  recipientCount?: number     // 발송 대상 수
  messageContent?: string     // 메시지 내용 (일부)
  templateId?: string
  templateName?: string       // 템플릿 이름
  templateType?: string       // 템플릿 타입
  templateCategory?: string   // 템플릿 카테고리
  contentLength?: number      // 메시지 길이
  hasImage?: boolean          // 이미지 포함 여부
  patientIds?: string[]       // 발송 대상 환자 ID 목록
  patientNames?: string[]     // 발송 대상 환자 이름 목록
  successCount?: number       // 성공 발송 수
  failedCount?: number        // 실패 발송 수
  totalRecipients?: number    // 총 발송 대상 수
  successRate?: string        // 성공률
  
  // 예약 관련
  reservationDate?: string    // 예약 날짜
  reservationTime?: string    // 예약 시간
  
  // 이벤트 타겟 관련
  targetReason?: string           // 타겟 사유
  eventTargetReason?: string      // 이벤트 타겟 사유 (별칭)
  eventTargetCategory?: string    // 이벤트 타겟 카테고리
  categories?: string[]           // 카테고리 목록
  scheduledDate?: string          // 예정일
  
  // 상태 변경 관련
  previousStatus?: string     // 이전 상태
  newStatus?: string          // 새 상태
  statusType?: string         // 상태 타입
  oldValue?: string           // 이전 값
  newValue?: string           // 새 값
  reason?: string             // 변경 사유
  terminationReason?: string  // 종결 사유
  
  // 처리자 정보
  handledBy?: string          // 처리자 이름
  handledByName?: string      // 처리자 이름 (별칭)
  attemptedBy?: string        // 시도자 (실패 시)
  createdBy?: string          // 생성자 ID
  createdByName?: string      // 생성자 이름
  
  // 오류 정보
  error?: string              // 에러 메시지
  errorMessage?: string       // 에러 메시지 (별칭)
  
  // 사용자 관련
  userName?: string
  userRole?: string
}

// 로그 필터 옵션
export interface ActivityLogFilters {
  userId?: string
  userRole?: string
  action?: ActivityAction
  target?: ActivityTarget
  targetId?: string
  startDate?: string
  endDate?: string
  searchTerm?: string
}

// 로그 조회 요청
export interface ActivityLogQuery extends ActivityLogFilters {
  page?: number
  limit?: number
  skip?: number
  sortBy?: 'timestamp' | 'action' | 'user'
  sortOrder?: 'asc' | 'desc'
}

// 로그 조회 응답
export interface ActivityLogResponse {
  logs: ActivityLog[]
  total: number
  page?: number
  limit?: number
  hasNext?: boolean
  hasPrevious?: boolean
  targetId?: string
  target?: string
}

// 로그 생성 요청
export interface CreateActivityLogRequest {
  action: ActivityAction
  target: ActivityTarget
  targetId: string
  targetName?: string
  details: ActivityDetails
}

// 로그 통계
export interface ActivityStats {
  totalActions: number
  actionsByType: Record<ActivityAction, number>
  actionsByUser: Record<string, number>
  actionsByDate: Record<string, number>
  mostActiveUsers: Array<{
    userId: string
    userName: string
    actionCount: number
  }>
}