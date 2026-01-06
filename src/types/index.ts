// src/types/index.ts

export type ConsultationType = 'inbound' | 'outbound';

export interface Patient {
  _id: string;
  name: string;
  phoneNumber: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  address?: string;
  consultationType: ConsultationType; // 추가된 필드
  inboundPhoneNumber?: string; // 인바운드일 때 입력받은 번호 (표시용)
  registeredAt: Date;
  lastContactDate?: Date;
  status: 'pending' | 'contacted' | 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  treatmentCategory?: string;
  priority?: 'high' | 'medium' | 'low';
  
  // 상담 관련 정보
  consultationHistory?: ConsultationRecord[];
  nextCallbackDate?: Date;
  preferredContactTime?: string;
  
  // 메타데이터
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // 등록한 상담사 ID
}

export interface ConsultationRecord {
  _id: string;
  patientId: string;
  date: Date;
  type: 'call' | 'visit' | 'message';
  status: 'completed' | 'missed' | 'rescheduled';
  duration?: number; // 통화 시간 (분)
  notes?: string;
  outcome?: 'scheduled' | 'not_interested' | 'callback_requested' | 'completed';
  nextAction?: string;
  consultantId: string;
}

// 인바운드 환자 빠른 등록용 타입
export interface QuickInboundPatient {
  phoneNumber: string;
  name?: string;
  consultationType: 'inbound';
  registeredAt: Date;
  status: 'pending';
}

// 환자 목록 필터 타입
export interface PatientFilter {
  consultationType?: ConsultationType | 'all';
  status?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  searchTerm?: string;
}

export * from './report';
export * from './callLog';