// src/lib/v2/db/index.ts
// CatchAll v2 데이터베이스 유틸리티 - 성능 최적화 버전

import { Collection, Db, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import {
  PatientV2,
  PatientStatus,
  CallLogV2,
  CallbackV2,
  ReferralV2,
  ConsultationV2,
  FeedbackV2,
  PatientFilter,
  CallLogFilter,
  PaginatedResponse,
} from '@/types/v2';

// ============================================
// 컬렉션 접근 함수 (캐싱 적용)
// ============================================

let dbInstance: Db | null = null;

async function getDb(): Promise<Db> {
  if (!dbInstance) {
    const { db } = await connectToDatabase();
    dbInstance = db;
  }
  return dbInstance;
}

// V2 컬렉션 이름 (기존 데이터와 분리)
const COLLECTIONS = {
  PATIENTS_V2: 'patients_v2',
  CALL_LOGS_V2: 'callLogs_v2',
  CALLBACKS_V2: 'callbacks_v2',
  REFERRALS_V2: 'referrals_v2',
  CONSULTATIONS_V2: 'consultations_v2',
  FEEDBACKS_V2: 'feedbacks_v2',
} as const;

export async function getPatientsV2Collection(): Promise<Collection<PatientV2>> {
  const db = await getDb();
  return db.collection(COLLECTIONS.PATIENTS_V2);
}

export async function getCallLogsV2Collection(): Promise<Collection<CallLogV2>> {
  const db = await getDb();
  return db.collection(COLLECTIONS.CALL_LOGS_V2);
}

export async function getCallbacksV2Collection(): Promise<Collection<CallbackV2>> {
  const db = await getDb();
  return db.collection(COLLECTIONS.CALLBACKS_V2);
}

export async function getReferralsV2Collection(): Promise<Collection<ReferralV2>> {
  const db = await getDb();
  return db.collection(COLLECTIONS.REFERRALS_V2);
}

export async function getConsultationsV2Collection(): Promise<Collection<ConsultationV2>> {
  const db = await getDb();
  return db.collection(COLLECTIONS.CONSULTATIONS_V2);
}

export async function getFeedbacksV2Collection(): Promise<Collection<FeedbackV2>> {
  const db = await getDb();
  return db.collection(COLLECTIONS.FEEDBACKS_V2);
}

// ============================================
// V2 인덱스 생성 함수
// ============================================

export async function createV2Indexes(): Promise<void> {
  const db = await getDb();

  console.log('🔧 V2 인덱스 생성 시작...');

  try {
    // Patients V2 인덱스
    const patientsV2 = db.collection(COLLECTIONS.PATIENTS_V2);
    await patientsV2.createIndex({ phone: 1 }, { name: 'idx_phone' });
    await patientsV2.createIndex({ status: 1 }, { name: 'idx_status' });
    await patientsV2.createIndex({ createdAt: -1 }, { name: 'idx_created' });
    await patientsV2.createIndex({ clinicId: 1 }, { name: 'idx_clinic' });
    await patientsV2.createIndex({ temperature: 1 }, { name: 'idx_temperature' });
    await patientsV2.createIndex({ aiRegistered: 1 }, { name: 'idx_ai_registered' });
    // 복합 인덱스 (성능 최적화)
    await patientsV2.createIndex(
      { status: 1, createdAt: -1 },
      { name: 'idx_status_created' }
    );
    await patientsV2.createIndex(
      { clinicId: 1, status: 1, createdAt: -1 },
      { name: 'idx_clinic_status_created' }
    );
    // 텍스트 검색 인덱스
    await patientsV2.createIndex(
      { name: 'text', phone: 'text' },
      { name: 'idx_search' }
    );

    // CallLogs V2 인덱스
    const callLogsV2 = db.collection(COLLECTIONS.CALL_LOGS_V2);
    await callLogsV2.createIndex({ phone: 1 }, { name: 'idx_phone' });
    await callLogsV2.createIndex({ createdAt: -1 }, { name: 'idx_created' });
    await callLogsV2.createIndex({ clinicId: 1 }, { name: 'idx_clinic' });
    await callLogsV2.createIndex({ aiStatus: 1 }, { name: 'idx_ai_status' });
    await callLogsV2.createIndex({ direction: 1 }, { name: 'idx_direction' });
    await callLogsV2.createIndex({ patientId: 1 }, { name: 'idx_patient' });
    await callLogsV2.createIndex(
      { 'aiAnalysis.classification': 1 },
      { name: 'idx_classification' }
    );
    // 복합 인덱스
    await callLogsV2.createIndex(
      { clinicId: 1, createdAt: -1 },
      { name: 'idx_clinic_created' }
    );
    await callLogsV2.createIndex(
      { clinicId: 1, aiStatus: 1, createdAt: -1 },
      { name: 'idx_clinic_ai_created' }
    );

    // Callbacks V2 인덱스
    const callbacksV2 = db.collection(COLLECTIONS.CALLBACKS_V2);
    await callbacksV2.createIndex({ scheduledAt: 1 }, { name: 'idx_scheduled' });
    await callbacksV2.createIndex({ status: 1 }, { name: 'idx_status' });
    await callbacksV2.createIndex({ clinicId: 1 }, { name: 'idx_clinic' });
    await callbacksV2.createIndex({ patientId: 1 }, { name: 'idx_patient' });
    await callbacksV2.createIndex({ type: 1 }, { name: 'idx_type' });
    // 복합 인덱스
    await callbacksV2.createIndex(
      { clinicId: 1, scheduledAt: 1, status: 1 },
      { name: 'idx_clinic_scheduled_status' }
    );

    // Referrals V2 인덱스
    const referralsV2 = db.collection(COLLECTIONS.REFERRALS_V2);
    await referralsV2.createIndex({ referrerId: 1 }, { name: 'idx_referrer' });
    await referralsV2.createIndex({ referredId: 1 }, { name: 'idx_referred' });
    await referralsV2.createIndex({ clinicId: 1 }, { name: 'idx_clinic' });

    // Consultations V2 인덱스
    const consultationsV2 = db.collection(COLLECTIONS.CONSULTATIONS_V2);
    await consultationsV2.createIndex({ date: -1 }, { name: 'idx_date' });
    await consultationsV2.createIndex({ patientId: 1 }, { name: 'idx_patient' });
    await consultationsV2.createIndex({ clinicId: 1 }, { name: 'idx_clinic' });
    await consultationsV2.createIndex({ status: 1 }, { name: 'idx_status' });
    await consultationsV2.createIndex(
      { clinicId: 1, date: -1 },
      { name: 'idx_clinic_date' }
    );

    // Feedbacks V2 인덱스
    const feedbacksV2 = db.collection(COLLECTIONS.FEEDBACKS_V2);
    await feedbacksV2.createIndex({ yearMonth: 1 }, { name: 'idx_year_month' });
    await feedbacksV2.createIndex({ clinicId: 1 }, { name: 'idx_clinic' });
    await feedbacksV2.createIndex(
      { clinicId: 1, yearMonth: 1 },
      { name: 'idx_clinic_year_month' }
    );

    console.log('✅ V2 인덱스 생성 완료');
  } catch (error) {
    console.error('❌ V2 인덱스 생성 오류:', error);
    throw error;
  }
}

// ============================================
// 환자 데이터 접근 함수 (최적화)
// ============================================

/**
 * 환자 목록 조회 (페이지네이션 + 필터)
 * 성능 최적화: projection으로 필요한 필드만 조회
 */
export async function getPatientsV2(
  filter: PatientFilter = {}
): Promise<PaginatedResponse<PatientV2>> {
  const collection = await getPatientsV2Collection();

  const { status, search, page = 1, limit = 50 } = filter;
  const skip = (page - 1) * limit;

  // 쿼리 조건 구성
  const query: any = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  // 필요한 필드만 projection (성능 최적화)
  const projection = {
    _id: 1,
    name: 1,
    phone: 1,
    status: 1,
    statusChangedAt: 1,
    temperature: 1,
    interest: 1,
    source: 1,
    aiRegistered: 1,
    nextAction: 1,
    nextActionDate: 1,
    createdAt: 1,
  };

  // 병렬 쿼리 실행 (count + find)
  const [total, data] = await Promise.all([
    collection.countDocuments(query),
    collection
      .find(query, { projection })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  return {
    data: data as PatientV2[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 환자 상세 조회
 */
export async function getPatientV2ById(id: string): Promise<PatientV2 | null> {
  const collection = await getPatientsV2Collection();
  const patient = await collection.findOne({ _id: new ObjectId(id) });
  return patient as PatientV2 | null;
}

/**
 * 전화번호로 환자 찾기
 */
export async function getPatientV2ByPhone(phone: string): Promise<PatientV2 | null> {
  const collection = await getPatientsV2Collection();
  const patient = await collection.findOne({ phone });
  return patient as PatientV2 | null;
}

/**
 * 환자 상태별 카운트 (대시보드용)
 */
export async function getPatientStatusCounts(): Promise<Record<string, number>> {
  const collection = await getPatientsV2Collection();

  const result = await collection.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  const counts: Record<string, number> = {
    consulting: 0,
    reserved: 0,
    visited: 0,
    treatment: 0,
    completed: 0,
    followup: 0,
  };

  result.forEach(item => {
    counts[item._id] = item.count;
  });

  return counts;
}

// ============================================
// 통화 기록 데이터 접근 함수 (최적화)
// ============================================

/**
 * 통화 기록 목록 조회 (페이지네이션 + 필터)
 */
export async function getCallLogsV2(
  filter: CallLogFilter = {}
): Promise<PaginatedResponse<CallLogV2>> {
  const collection = await getCallLogsV2Collection();

  const { classification, search, startDate, endDate, page = 1, limit = 50 } = filter;
  const skip = (page - 1) * limit;

  const query: any = {};

  if (classification && classification !== 'all') {
    query['aiAnalysis.classification'] = classification;
  }

  if (search) {
    query.$or = [
      { phone: { $regex: search, $options: 'i' } },
      { 'aiAnalysis.patientName': { $regex: search, $options: 'i' } },
    ];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // 필요한 필드만 projection
  const projection = {
    _id: 1,
    phone: 1,
    patientId: 1,
    direction: 1,
    status: 1,
    duration: 1,
    startedAt: 1,
    endedAt: 1,
    aiStatus: 1,
    aiAnalysis: 1,
    createdAt: 1,
  };

  const [total, data] = await Promise.all([
    collection.countDocuments(query),
    collection
      .find(query, { projection })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  return {
    data: data as CallLogV2[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * AI 분석 대기 중인 통화 기록 조회
 */
export async function getPendingAnalysisCallLogs(): Promise<CallLogV2[]> {
  const collection = await getCallLogsV2Collection();

  const result = await collection
    .find(
      { aiStatus: { $in: ['pending', 'processing'] } },
      { projection: { _id: 1, phone: 1, createdAt: 1, aiStatus: 1 } }
    )
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  return result as CallLogV2[];
}

// ============================================
// 대시보드 통계 함수 (최적화)
// ============================================

/**
 * 오늘의 통화 통계 조회
 */
export async function getTodayCallStats(): Promise<{
  totalCalls: number;
  analyzed: number;
  analyzing: number;
  newPatients: number;
  existingPatients: number;
  missed: number;
  other: number;
}> {
  const collection = await getCallLogsV2Collection();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await collection.aggregate([
    {
      $match: {
        createdAt: { $gte: today, $lt: tomorrow }
      }
    },
    {
      $facet: {
        total: [{ $count: 'count' }],
        byAiStatus: [
          {
            $group: {
              _id: '$aiStatus',
              count: { $sum: 1 }
            }
          }
        ],
        byClassification: [
          {
            $match: { 'aiAnalysis.classification': { $exists: true } }
          },
          {
            $group: {
              _id: '$aiAnalysis.classification',
              count: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]).toArray();

  const data = result[0];
  const totalCalls = data.total[0]?.count || 0;

  const aiStatusCounts: Record<string, number> = {};
  data.byAiStatus.forEach((item: any) => {
    aiStatusCounts[item._id] = item.count;
  });

  const classificationCounts: Record<string, number> = {};
  data.byClassification.forEach((item: any) => {
    classificationCounts[item._id] = item.count;
  });

  return {
    totalCalls,
    analyzed: aiStatusCounts['completed'] || 0,
    analyzing: (aiStatusCounts['pending'] || 0) + (aiStatusCounts['processing'] || 0),
    newPatients: classificationCounts['신규환자'] || 0,
    existingPatients: classificationCounts['기존환자'] || 0,
    missed: classificationCounts['부재중'] || 0,
    other: (classificationCounts['거래처'] || 0) + (classificationCounts['스팸'] || 0),
  };
}

/**
 * 주의 필요 환자 조회 (대시보드용)
 */
export async function getAlertPatients(): Promise<{
  visitedLong: PatientV2[];
  consultingLong: PatientV2[];
  noshowRisk: PatientV2[];
}> {
  const collection = await getPatientsV2Collection();

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [visitedLong, consultingLong, noshowRisk] = await Promise.all([
    // 내원완료 7일+ (치료 미결정)
    collection
      .find({
        status: 'visited',
        statusChangedAt: { $lte: sevenDaysAgo }
      })
      .project({ _id: 1, name: 1, phone: 1, statusChangedAt: 1 })
      .limit(10)
      .toArray(),

    // 전화상담 14일+ (장기 미진행)
    collection
      .find({
        status: 'consulting',
        statusChangedAt: { $lte: fourteenDaysAgo }
      })
      .project({ _id: 1, name: 1, phone: 1, statusChangedAt: 1 })
      .limit(10)
      .toArray(),

    // 내원예약 노쇼 위험 (예약일 지남)
    collection
      .find({
        status: 'reserved',
        nextActionDate: { $lt: now }
      })
      .project({ _id: 1, name: 1, phone: 1, nextActionDate: 1 })
      .limit(10)
      .toArray(),
  ]);

  return {
    visitedLong: visitedLong as PatientV2[],
    consultingLong: consultingLong as PatientV2[],
    noshowRisk: noshowRisk as PatientV2[],
  };
}

/**
 * 오늘의 콜백 목록 조회
 */
export async function getTodayCallbacks(): Promise<CallbackV2[]> {
  const collection = await getCallbacksV2Collection();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await collection
    .find({
      scheduledAt: { $gte: today, $lt: tomorrow },
      status: 'pending'
    })
    .sort({ scheduledAt: 1 })
    .toArray();

  return result as CallbackV2[];
}

// ============================================
// 데이터 생성/수정 함수
// ============================================

/**
 * 환자 생성
 */
export async function createPatientV2(patient: Omit<PatientV2, '_id'>): Promise<string> {
  const collection = await getPatientsV2Collection();

  const now = new Date().toISOString();
  const result = await collection.insertOne({
    ...patient,
    createdAt: now,
    updatedAt: now,
    statusChangedAt: now,
  } as any);

  return result.insertedId.toString();
}

/**
 * 환자 상태 변경
 */
export async function updatePatientV2Status(
  id: string,
  status: PatientStatus,
  nextAction?: string,
  nextActionDate?: Date
): Promise<boolean> {
  const collection = await getPatientsV2Collection();

  const now = new Date().toISOString();
  const result = await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status,
        statusChangedAt: now,
        updatedAt: now,
        ...(nextAction && { nextAction }),
        ...(nextActionDate && { nextActionDate }),
      }
    }
  );

  return result.modifiedCount > 0;
}

/**
 * 통화 기록 생성 (CTI에서 호출)
 */
export async function createCallLogV2(callLog: Omit<CallLogV2, '_id'>): Promise<string> {
  const collection = await getCallLogsV2Collection();

  const now = new Date().toISOString();
  const result = await collection.insertOne({
    ...callLog,
    aiStatus: 'pending',
    createdAt: now,
  } as any);

  return result.insertedId.toString();
}

/**
 * AI 분석 결과 업데이트
 */
export async function updateCallLogV2AIAnalysis(
  id: string,
  aiAnalysis: any,
  aiStatus: 'completed' | 'failed'
): Promise<boolean> {
  const collection = await getCallLogsV2Collection();

  const result = await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        aiAnalysis,
        aiStatus,
        aiCompletedAt: new Date().toISOString(),
      }
    }
  );

  return result.modifiedCount > 0;
}

export { COLLECTIONS };
