// src/constants/activityLogConstants.ts

// 활동 로그 액션 타입
export const ACTIVITY_ACTIONS = {
  // 환자 관련
  PATIENT_CREATE: 'patient_create',
  PATIENT_UPDATE: 'patient_update',
  PATIENT_DELETE: 'patient_delete',
  PATIENT_VIEW: 'patient_view',
  PATIENT_COMPLETE: 'patient_complete',
  PATIENT_COMPLETE_CANCEL: 'patient_complete_cancel',
  
  // 콜백 관련
  CALLBACK_CREATE: 'callback_create',
  CALLBACK_UPDATE: 'callback_update',
  CALLBACK_DELETE: 'callback_delete',
  CALLBACK_COMPLETE: 'callback_complete',
  CALLBACK_CANCEL: 'callback_cancel',
  CALLBACK_RESCHEDULE: 'callback_reschedule',
  
  // 상태 변경
  STATUS_CHANGE: 'status_change',
  PATIENT_STATUS_CHANGE: 'patient_status_change',
  VISIT_CONFIRMATION_TOGGLE: 'visit_confirmation_toggle',
  
  // 메시지 관련
  MESSAGE_SEND: 'message_send',
  MESSAGE_TEMPLATE_USED: 'message_template_used',
  
  // 이벤트 타겟 관련
  EVENT_TARGET_CREATE: 'event_target_create',
  EVENT_TARGET_UPDATE: 'event_target_update',
  EVENT_TARGET_DELETE: 'event_target_delete',
  
  // 기타
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data'
} as const;

// 활동 로그 대상 타입
export const ACTIVITY_TARGETS = {
  PATIENT: 'patient',
  CALLBACK: 'callback',
  MESSAGE: 'message',
  USER: 'user',
  SYSTEM: 'system',
  CONSULTATION_STATUS: 'consultation_status',
  PATIENT_STATUS: 'patient_status',
  EVENT_TARGET: 'event_target'
} as const;

// 활동 로그 메시지 템플릿
export const ACTIVITY_MESSAGES = {
  // 환자 관련
  [ACTIVITY_ACTIONS.PATIENT_CREATE]: (details: any) => 
    `새 환자 "${details.patientName}"을(를) 등록했습니다.`,
  [ACTIVITY_ACTIONS.PATIENT_UPDATE]: (details: any) => 
    `환자 "${details.patientName}"의 정보를 수정했습니다.`,
  [ACTIVITY_ACTIONS.PATIENT_DELETE]: (details: any) => 
    `환자 "${details.patientName}"을(를) 삭제했습니다.`,
  [ACTIVITY_ACTIONS.PATIENT_VIEW]: (details: any) => 
    `환자 "${details.patientName}"의 상세 정보를 조회했습니다.`,
  [ACTIVITY_ACTIONS.PATIENT_COMPLETE]: (details: any) => 
    `환자 "${details.patientName}"을(를) 종결 처리했습니다.`,
  [ACTIVITY_ACTIONS.PATIENT_COMPLETE_CANCEL]: (details: any) => 
    `환자 "${details.patientName}"의 종결 처리를 취소했습니다.`,
  
  // 콜백 관련
  [ACTIVITY_ACTIONS.CALLBACK_CREATE]: (details: any) => 
    `환자 "${details.patientName}"의 ${details.callbackType || ''} 콜백을 등록했습니다.`,
  [ACTIVITY_ACTIONS.CALLBACK_UPDATE]: (details: any) => 
    `환자 "${details.patientName}"의 ${details.callbackType || ''} 콜백을 수정했습니다.`,
  [ACTIVITY_ACTIONS.CALLBACK_DELETE]: (details: any) => 
    `환자 "${details.patientName}"의 ${details.callbackType || ''} 콜백을 삭제했습니다.`,
  [ACTIVITY_ACTIONS.CALLBACK_COMPLETE]: (details: any) => 
    `환자 "${details.patientName}"의 ${details.callbackType || ''} 콜백을 완료했습니다.`,
  [ACTIVITY_ACTIONS.CALLBACK_CANCEL]: (details: any) => 
    `환자 "${details.patientName}"의 ${details.callbackType || ''} 콜백을 취소했습니다.`,
  [ACTIVITY_ACTIONS.CALLBACK_RESCHEDULE]: (details: any) => 
    `환자 "${details.patientName}"의 ${details.callbackType || ''} 콜백 일정을 변경했습니다.`,
  
  // 상태 변경
  [ACTIVITY_ACTIONS.STATUS_CHANGE]: (details: any) => 
    `환자 "${details.patientName}"의 ${details.statusType}을(를) "${details.oldValue}"에서 "${details.newValue}"로 변경했습니다.`,
  [ACTIVITY_ACTIONS.PATIENT_STATUS_CHANGE]: (details: any) => 
    `환자 "${details.patientName}"의 상태를 "${details.previousStatus}"에서 "${details.newStatus}"로 변경했습니다.`,
  [ACTIVITY_ACTIONS.VISIT_CONFIRMATION_TOGGLE]: (details: any) => 
    `환자 "${details.patientName}"의 내원 확정을 ${details.newStatus === '내원확정' ? '설정' : '해제'}했습니다.`,
  
  // 메시지 관련
  [ACTIVITY_ACTIONS.MESSAGE_SEND]: (details: any) => 
    details.recipientCount && details.recipientCount > 1 
      ? `${details.recipientCount}명의 환자에게 ${details.messageType || ''} 메시지를 전송했습니다.`
      : `환자 "${details.patientName}"에게 ${details.messageType || ''} 메시지를 전송했습니다.`,
  [ACTIVITY_ACTIONS.MESSAGE_TEMPLATE_USED]: (details: any) => 
    `환자 "${details.patientName}"에게 "${details.templateName}" 템플릿을 사용했습니다.`,
  
  // 이벤트 타겟 관련
  [ACTIVITY_ACTIONS.EVENT_TARGET_CREATE]: (details: any) => 
    `환자 "${details.patientName}"을(를) 이벤트 타겟으로 등록했습니다.`,
  [ACTIVITY_ACTIONS.EVENT_TARGET_UPDATE]: (details: any) => 
    `환자 "${details.patientName}"의 이벤트 타겟 정보를 수정했습니다.`,
  [ACTIVITY_ACTIONS.EVENT_TARGET_DELETE]: (details: any) => 
    `환자 "${details.patientName}"을(를) 이벤트 타겟에서 제외했습니다.`,
  
  // 기타
  [ACTIVITY_ACTIONS.LOGIN]: () => '로그인했습니다.',
  [ACTIVITY_ACTIONS.LOGOUT]: () => '로그아웃했습니다.',
  [ACTIVITY_ACTIONS.EXPORT_DATA]: (details: any) => 
    `${details.dataType} 데이터를 내보냈습니다.`,
  [ACTIVITY_ACTIONS.IMPORT_DATA]: (details: any) => 
    `${details.dataType} 데이터를 가져왔습니다.`
};

// 활동 로그 우선순위 (중요도)
export const ACTIVITY_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

// 액션별 우선순위 매핑
export const ACTION_PRIORITY_MAP = {
  [ACTIVITY_ACTIONS.PATIENT_CREATE]: ACTIVITY_PRIORITY.HIGH,
  [ACTIVITY_ACTIONS.PATIENT_UPDATE]: ACTIVITY_PRIORITY.MEDIUM,
  [ACTIVITY_ACTIONS.PATIENT_DELETE]: ACTIVITY_PRIORITY.CRITICAL,
  [ACTIVITY_ACTIONS.PATIENT_VIEW]: ACTIVITY_PRIORITY.LOW,
  [ACTIVITY_ACTIONS.PATIENT_COMPLETE]: ACTIVITY_PRIORITY.HIGH,
  [ACTIVITY_ACTIONS.PATIENT_COMPLETE_CANCEL]: ACTIVITY_PRIORITY.MEDIUM,
  
  [ACTIVITY_ACTIONS.CALLBACK_CREATE]: ACTIVITY_PRIORITY.HIGH,
  [ACTIVITY_ACTIONS.CALLBACK_UPDATE]: ACTIVITY_PRIORITY.MEDIUM,
  [ACTIVITY_ACTIONS.CALLBACK_DELETE]: ACTIVITY_PRIORITY.MEDIUM,
  [ACTIVITY_ACTIONS.CALLBACK_COMPLETE]: ACTIVITY_PRIORITY.HIGH,
  [ACTIVITY_ACTIONS.CALLBACK_CANCEL]: ACTIVITY_PRIORITY.MEDIUM,
  [ACTIVITY_ACTIONS.CALLBACK_RESCHEDULE]: ACTIVITY_PRIORITY.MEDIUM,
  
  [ACTIVITY_ACTIONS.STATUS_CHANGE]: ACTIVITY_PRIORITY.MEDIUM,
  [ACTIVITY_ACTIONS.PATIENT_STATUS_CHANGE]: ACTIVITY_PRIORITY.MEDIUM,
  [ACTIVITY_ACTIONS.VISIT_CONFIRMATION_TOGGLE]: ACTIVITY_PRIORITY.MEDIUM,
  
  [ACTIVITY_ACTIONS.MESSAGE_SEND]: ACTIVITY_PRIORITY.MEDIUM,
  [ACTIVITY_ACTIONS.MESSAGE_TEMPLATE_USED]: ACTIVITY_PRIORITY.LOW,
  
  [ACTIVITY_ACTIONS.EVENT_TARGET_CREATE]: ACTIVITY_PRIORITY.MEDIUM,
  [ACTIVITY_ACTIONS.EVENT_TARGET_UPDATE]: ACTIVITY_PRIORITY.LOW,
  [ACTIVITY_ACTIONS.EVENT_TARGET_DELETE]: ACTIVITY_PRIORITY.MEDIUM,
  
  [ACTIVITY_ACTIONS.LOGIN]: ACTIVITY_PRIORITY.LOW,
  [ACTIVITY_ACTIONS.LOGOUT]: ACTIVITY_PRIORITY.LOW,
  [ACTIVITY_ACTIONS.EXPORT_DATA]: ACTIVITY_PRIORITY.MEDIUM,
  [ACTIVITY_ACTIONS.IMPORT_DATA]: ACTIVITY_PRIORITY.HIGH
} as const;

// 활동 로그 필터 옵션
export const ACTIVITY_FILTER_OPTIONS = {
  actions: Object.values(ACTIVITY_ACTIONS),
  targets: Object.values(ACTIVITY_TARGETS),
  priorities: Object.values(ACTIVITY_PRIORITY)
};

// 활동 로그 표시용 라벨
export const ACTIVITY_LABELS = {
  // 액션 라벨
  [ACTIVITY_ACTIONS.PATIENT_CREATE]: '환자 등록',
  [ACTIVITY_ACTIONS.PATIENT_UPDATE]: '환자 수정',
  [ACTIVITY_ACTIONS.PATIENT_DELETE]: '환자 삭제',
  [ACTIVITY_ACTIONS.PATIENT_VIEW]: '환자 조회',
  [ACTIVITY_ACTIONS.PATIENT_COMPLETE]: '환자 종결',
  [ACTIVITY_ACTIONS.PATIENT_COMPLETE_CANCEL]: '종결 취소',
  
  [ACTIVITY_ACTIONS.CALLBACK_CREATE]: '콜백 등록',
  [ACTIVITY_ACTIONS.CALLBACK_UPDATE]: '콜백 수정',
  [ACTIVITY_ACTIONS.CALLBACK_DELETE]: '콜백 삭제',
  [ACTIVITY_ACTIONS.CALLBACK_COMPLETE]: '콜백 완료',
  [ACTIVITY_ACTIONS.CALLBACK_CANCEL]: '콜백 취소',
  [ACTIVITY_ACTIONS.CALLBACK_RESCHEDULE]: '콜백 일정변경',
  
  [ACTIVITY_ACTIONS.STATUS_CHANGE]: '상태 변경',
  [ACTIVITY_ACTIONS.PATIENT_STATUS_CHANGE]: '환자 상태 변경',
  [ACTIVITY_ACTIONS.VISIT_CONFIRMATION_TOGGLE]: '내원 확정',
  
  [ACTIVITY_ACTIONS.MESSAGE_SEND]: '메시지 전송',
  [ACTIVITY_ACTIONS.MESSAGE_TEMPLATE_USED]: '템플릿 사용',
  
  [ACTIVITY_ACTIONS.EVENT_TARGET_CREATE]: '이벤트 타겟 등록',
  [ACTIVITY_ACTIONS.EVENT_TARGET_UPDATE]: '이벤트 타겟 수정',
  [ACTIVITY_ACTIONS.EVENT_TARGET_DELETE]: '이벤트 타겟 삭제',
  
  [ACTIVITY_ACTIONS.LOGIN]: '로그인',
  [ACTIVITY_ACTIONS.LOGOUT]: '로그아웃',
  [ACTIVITY_ACTIONS.EXPORT_DATA]: '데이터 내보내기',
  [ACTIVITY_ACTIONS.IMPORT_DATA]: '데이터 가져오기',
  
  // 대상 라벨
  [ACTIVITY_TARGETS.PATIENT]: '환자',
  [ACTIVITY_TARGETS.CALLBACK]: '콜백',
  [ACTIVITY_TARGETS.MESSAGE]: '메시지',
  [ACTIVITY_TARGETS.USER]: '사용자',
  [ACTIVITY_TARGETS.SYSTEM]: '시스템',
  [ACTIVITY_TARGETS.CONSULTATION_STATUS]: '상담상태',
  [ACTIVITY_TARGETS.PATIENT_STATUS]: '환자상태',
  [ACTIVITY_TARGETS.EVENT_TARGET]: '이벤트대상',
  
  // 우선순위 라벨
  [ACTIVITY_PRIORITY.LOW]: '낮음',
  [ACTIVITY_PRIORITY.MEDIUM]: '보통',
  [ACTIVITY_PRIORITY.HIGH]: '높음',
  [ACTIVITY_PRIORITY.CRITICAL]: '긴급'
};

export type ActivityAction = typeof ACTIVITY_ACTIONS[keyof typeof ACTIVITY_ACTIONS];
export type ActivityTarget = typeof ACTIVITY_TARGETS[keyof typeof ACTIVITY_TARGETS];
export type ActivityPriority = typeof ACTIVITY_PRIORITY[keyof typeof ACTIVITY_PRIORITY];