// src/types/callLog.ts
// 통화 기록 타입 정의

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus = 'ringing' | 'answered' | 'missed' | 'ended' | 'rejected';

export type CallEventType =
  | 'INCOMING_CALL'
  | 'OUTGOING_CALL'
  | 'CALL_ANSWERED'
  | 'CALL_ENDED'
  | 'MISSED_CALL';

export interface CallLog {
  _id?: string;
  callId: string;
  callDirection: CallDirection;
  phoneNumber: string;      // 환자 번호 (방향 무관)
  callerNumber: string;     // 발신자 번호
  calledNumber: string;     // 착신자 번호
  callStatus: CallStatus;
  callStartTime?: string;
  callEndTime?: string;
  duration?: number;        // 통화 시간 (초)
  patientId?: string;
  patientName?: string;
  isNewPatient?: boolean;   // 이 통화로 자동 등록됨
  analysisId?: string;      // AI 분석 결과 ID
  createdAt: string;
  updatedAt?: string;
}

export interface CTIEventData {
  id: string;
  eventType: CallEventType;
  callerNumber: string;
  calledNumber: string;
  timestamp: string;
  receivedAt: string;
  patient?: PatientInfo | null;
  legacyPatient?: LegacyPatientInfo | null;
  isNewCustomer?: boolean;
  isNewPatient?: boolean;
}

export interface PatientInfo {
  id: string;
  name: string;
  phoneNumber: string;
  lastVisit?: string;
  notes?: string;
  callCount?: number;
}

export interface LegacyPatientInfo {
  name: string;
  isLegacy: true;
}
