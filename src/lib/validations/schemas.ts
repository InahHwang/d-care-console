import { z } from 'zod';

// ============================================
// 공통 유틸 스키마
// ============================================

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, '유효한 ID 형식이 아닙니다');

export const phoneSchema = z.string().min(10, '전화번호는 최소 10자입니다').max(13, '전화번호는 최대 13자입니다');

export const temperatureSchema = z.enum(['hot', 'warm', 'cold']);

export const patientStatusSchema = z.enum([
  'consulting', 'reserved', 'visited', 'treatmentBooked',
  'treatment', 'completed', 'followup', 'closed',
]);

export const consultationStatusSchema = z.enum(['agreed', 'disagreed', 'pending']);
export const consultationTypeSchema = z.enum(['phone', 'visit']);
export const callbackTypeSchema = z.enum(['callback', 'recall', 'thanks']);
export const callbackStatusSchema = z.enum(['pending', 'completed', 'missed']);
export const paymentStatusSchema = z.enum(['none', 'partial', 'completed']);
export const userRoleSchema = z.enum(['master', 'staff']);

// ============================================
// Auth
// ============================================

export const loginSchema = z.object({
  email: z.string().min(1, '아이디를 입력해주세요.').max(100),
  password: z.string().min(1, '비밀번호를 입력해주세요.').max(100),
});

// ============================================
// Users
// ============================================

export const createUserSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email('유효한 이메일 형식이 아닙니다').max(100),
  name: z.string().min(1).max(50),
  password: z.string().min(4, '비밀번호는 최소 4자입니다').max(100),
  role: userRoleSchema,
  department: z.string().max(100).optional(),
});

// ============================================
// Patients
// ============================================

export const createPatientSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다').max(50),
  phone: phoneSchema,
  consultationType: z.string().max(50).optional(),
  interest: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
  temperature: temperatureSchema.optional().default('warm'),
  nextAction: z.string().max(200).optional(),
  age: z.number().int().min(0).max(150).optional(),
  region: z.object({
    province: z.string().max(50),
    city: z.string().max(50).optional(),
  }).optional(),
});

export const updatePatientSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  phone: phoneSchema.optional(),
  status: patientStatusSchema.optional(),
  temperature: temperatureSchema.optional(),
  interest: z.string().max(100).optional().nullable(),
  source: z.string().max(100).optional(),
  memo: z.string().max(5000).optional().nullable(),
  nextAction: z.string().max(200).optional().nullable(),
  nextActionDate: z.string().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  eventDate: z.string().optional(),
  isReservation: z.boolean().optional(),
  changedBy: z.string().max(50).optional(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  region: z.union([z.string().max(100), z.object({
    province: z.string().max(50),
    city: z.string().max(50).optional(),
  })]).optional().nullable(),
  closedReason: z.string().max(100).optional(),
  isReactivation: z.boolean().optional(),
  estimatedAmount: z.number().min(0).optional().nullable(),
  actualAmount: z.number().min(0).optional().nullable(),
  paymentStatus: paymentStatusSchema.optional(),
  treatmentNote: z.string().max(2000).optional().nullable(),
  treatmentStartDate: z.string().optional().nullable(),
  expectedCompletionDate: z.string().optional().nullable(),
  updateType: z.string().max(50).optional(),
  callbackReason: z.string().max(50).optional(),
  callbackNote: z.string().max(500).optional(),
  newScheduleDate: z.string().optional(),
}).passthrough();

// ============================================
// Journeys
// ============================================

export const createJourneySchema = z.object({
  treatmentType: z.string().min(1, '치료 유형은 필수입니다').max(100),
  estimatedAmount: z.number().min(0).optional(),
  changedBy: z.string().max(50).optional(),
});

export const updateJourneySchema = z.object({
  status: patientStatusSchema.optional(),
  estimatedAmount: z.number().min(0).optional().nullable(),
  actualAmount: z.number().min(0).optional().nullable(),
  paymentStatus: paymentStatusSchema.optional(),
  treatmentNote: z.string().max(2000).optional().nullable(),
  treatmentType: z.string().max(100).optional(),
  closedAt: z.string().optional().nullable(),
  eventDate: z.string().optional(),
  changedBy: z.string().max(50).optional(),
  setActive: z.boolean().optional(),
}).passthrough();

// ============================================
// Consultations
// ============================================

export const createConsultationSchema = z.object({
  patientId: objectIdSchema,
  type: consultationTypeSchema,
  status: consultationStatusSchema,
  consultantName: z.string().min(1, '상담사 이름은 필수입니다').max(50),
  treatment: z.string().max(200).optional(),
  originalAmount: z.number().min(0).optional(),
  discountRate: z.number().min(0).max(100).optional(),
  discountReason: z.string().max(500).optional(),
  disagreeReasons: z.array(z.string().max(200)).max(10).optional(),
  correctionPlan: z.string().max(1000).optional(),
  appointmentDate: z.string().optional().nullable(),
  callbackDate: z.string().optional().nullable(),
  inquiry: z.string().max(2000).optional(),
  memo: z.string().max(5000).optional(),
}).passthrough();

export const updateConsultationSchema = z.object({
  id: objectIdSchema,
  editedBy: z.string().max(50).optional(),
}).passthrough();

// ============================================
// Settings
// ============================================

export const updateSettingsSchema = z.object({
  clinicName: z.string().min(1).max(100).optional(),
  cti: z.object({
    enabled: z.boolean(),
    serverUrl: z.string().max(200),
    agentId: z.string().max(100),
  }).partial().optional(),
  ai: z.object({
    enabled: z.boolean(),
    autoAnalysis: z.boolean(),
    model: z.string().max(50),
  }).partial().optional(),
  notifications: z.object({
    missedCall: z.boolean(),
    newPatient: z.boolean(),
    callback: z.boolean(),
  }).partial().optional(),
  targets: z.object({
    monthlyRevenue: z.number().min(0),
    dailyCalls: z.number().min(0),
    conversionRate: z.number().min(0).max(100),
  }).partial().optional(),
}).passthrough();

// ============================================
// Callbacks
// ============================================

export const createCallbackSchema = z.object({
  patientId: objectIdSchema,
  type: callbackTypeSchema,
  scheduledAt: z.string().min(1, '예정일은 필수입니다'),
  note: z.string().max(1000).optional(),
});

export const updateCallbackSchema = z.object({
  id: z.string().min(1, 'ID는 필수입니다'),
  status: callbackStatusSchema,
  note: z.string().max(1000).optional(),
  source: z.string().max(50).optional(),
});

// ============================================
// Call Logs
// ============================================

export const updateCallLogSchema = z.object({
  callLogId: objectIdSchema,
  classification: z.string().max(50).optional(),
  patientName: z.string().max(50).optional().nullable(),
  interest: z.string().max(100).optional().nullable(),
  temperature: temperatureSchema.optional(),
  summary: z.string().max(5000).optional().nullable(),
  followUp: z.string().max(200).optional(),
  patientId: z.string().max(50).optional().nullable(),
  callbackType: callbackTypeSchema.optional().nullable(),
  callbackId: z.string().max(50).optional(),
}).passthrough();

// ============================================
// Recall Messages
// ============================================

export const createRecallMessageSchema = z.object({
  patientId: objectIdSchema,
  treatment: z.string().min(1).max(200),
  timing: z.string().min(1).max(50),
  timingDays: z.number().int().min(1),
  message: z.string().min(1, '메시지 내용은 필수입니다').max(2000),
  lastVisit: z.string().min(1),
});

export const updateRecallMessageSchema = z.object({
  id: objectIdSchema,
  status: z.string().min(1).max(50),
  bookedAt: z.string().optional(),
});

// ============================================
// Channel Chats
// ============================================

export const createChannelChatSchema = z.object({
  channel: z.string().min(1).max(50),
  channelRoomId: z.string().min(1, 'channelRoomId는 필수입니다'),
  channelUserKey: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  patientName: z.string().max(50).optional(),
});

export const createChatMessageSchema = z.object({
  content: z.string().max(5000).optional(),
  messageType: z.string().max(20).optional().default('text'),
  imageUrl: z.string().max(500).optional(),
  senderName: z.string().max(50).optional(),
  senderId: z.string().max(100).optional(),
});

// ============================================
// Manuals
// ============================================

export const createManualSchema = z.object({
  categoryId: z.string().min(1, '카테고리 ID는 필수입니다'),
  title: z.string().min(1, '제목은 필수입니다').max(200),
  keywords: z.array(z.string().max(50)).optional().default([]),
  script: z.string().min(1, '스크립트 내용은 필수입니다').max(10000),
  shortScript: z.string().max(2000).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateManualSchema = z.object({
  categoryId: z.string().max(200).optional(),
  title: z.string().min(1).max(200).optional(),
  keywords: z.array(z.string().max(50)).optional(),
  script: z.string().min(1).max(10000).optional(),
  shortScript: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// ============================================
// Manual Categories
// ============================================

export const createManualCategorySchema = z.object({
  name: z.string().min(1, '카테고리 이름은 필수입니다').max(100),
  order: z.number().int().min(0).optional(),
});

export const updateManualCategorySchema = z.object({
  id: z.string().min(1, 'ID는 필수입니다'),
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Referrals
// ============================================

export const createReferralSchema = z.object({
  referrerId: objectIdSchema,
  referredId: objectIdSchema,
});

// ============================================
// Thanks
// ============================================

export const createThanksSchema = z.object({
  referrerId: objectIdSchema,
  referredId: objectIdSchema,
  note: z.string().max(1000).optional(),
  referredAt: z.string().optional(),
});

// ============================================
// Alimtalk
// ============================================

export const sendAlimtalkSchema = z.object({
  phone: phoneSchema,
  message: z.string().min(1, '메시지 내용은 필수입니다').max(1000),
  templateCode: z.string().max(100).optional(),
  variables: z.record(z.string()).optional(),
});

// ============================================
// Recall Settings
// ============================================

export const updateRecallSettingsSchema = z.object({
  id: objectIdSchema,
  treatment: z.string().max(200).optional(),
  schedules: z.array(z.object({
    timing: z.string().max(50),
    timingDays: z.number().int().min(0),
    messageTemplate: z.string().max(2000),
    isActive: z.boolean(),
  })).optional(),
}).passthrough();

// ============================================
// Manual Consultations
// ============================================

export const createManualConsultationSchema = z.object({
  type: consultationTypeSchema.optional(),
  date: z.string().optional(),
  content: z.string().min(1, '상담 내용은 필수입니다').max(5000),
  consultantName: z.string().max(50).optional(),
});
