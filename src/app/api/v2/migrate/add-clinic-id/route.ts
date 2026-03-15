// src/app/api/v2/migrate/add-clinic-id/route.ts
// [상용화 Step 4-1] 기존 데이터에 clinicId 추가 마이그레이션
// 1회성 실행 — 운영 환경에서 GET 호출로 실행

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

const CLINIC_ID = 'default'; // settings_v2와 동일

// clinicId 추가 대상 컬렉션 목록
const TARGET_COLLECTIONS = [
  'patients_v2',
  'callLogs_v2',
  'callbacks_v2',
  'consultations_v2',
  'manualConsultations_v2',
  'channelChats_v2',
  'channelMessages_v2',
  'callRecordings_v2',
  'recall_messages',
  'referrals_v2',
  'reports_v2',
  'thanks',
  'alimtalk_logs',
  'manuals_v2',
  'manual_categories_v2',
  // settings_v2는 이미 clinicId 있음 (제외)
  // users는 clinicId 별도 추가 예정 (Step 4-2에서)
];

// clinicId 포함 복합 인덱스 (조회 성능 유지)
const INDEXES_TO_CREATE: Array<{ collection: string; index: Record<string, 1 | -1>; name: string }> = [
  { collection: 'patients_v2', index: { clinicId: 1, status: 1, createdAt: -1 }, name: 'idx_clinic_status_date' },
  { collection: 'patients_v2', index: { clinicId: 1, phone: 1 }, name: 'idx_clinic_phone' },
  { collection: 'callLogs_v2', index: { clinicId: 1, startedAt: -1 }, name: 'idx_clinic_started' },
  { collection: 'callLogs_v2', index: { clinicId: 1, phone: 1, startedAt: -1 }, name: 'idx_clinic_phone_started' },
  { collection: 'callbacks_v2', index: { clinicId: 1, scheduledAt: 1 }, name: 'idx_clinic_scheduled' },
  { collection: 'consultations_v2', index: { clinicId: 1, createdAt: -1 }, name: 'idx_clinic_created' },
  { collection: 'channelChats_v2', index: { clinicId: 1, updatedAt: -1 }, name: 'idx_clinic_updated' },
];

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const results: Array<{ collection: string; modified: number; total: number }> = [];

    // 1. clinics 컬렉션 생성 (없으면)
    const existingClinic = await db.collection('clinics').findOne({ clinicId: CLINIC_ID });
    if (!existingClinic) {
      await db.collection('clinics').insertOne({
        clinicId: CLINIC_ID,
        name: 'DSB르치과',
        slug: 'dsbr-dental',
        plan: 'basic',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('[Migration] clinics 컬렉션 생성 완료');
    } else {
      console.log('[Migration] clinics 이미 존재, 스킵');
    }

    // 2. 각 컬렉션에 clinicId 추가
    for (const collName of TARGET_COLLECTIONS) {
      try {
        const total = await db.collection(collName).countDocuments({});
        const result = await db.collection(collName).updateMany(
          { clinicId: { $exists: false } },
          { $set: { clinicId: CLINIC_ID } }
        );
        results.push({
          collection: collName,
          modified: result.modifiedCount,
          total,
        });
        console.log(`[Migration] ${collName}: ${result.modifiedCount}/${total}건 업데이트`);
      } catch (err) {
        console.error(`[Migration] ${collName} 오류:`, err);
        results.push({ collection: collName, modified: -1, total: 0 });
      }
    }

    // 3. 인덱스 생성
    const indexResults: Array<{ collection: string; name: string; status: string }> = [];
    for (const idx of INDEXES_TO_CREATE) {
      try {
        await db.collection(idx.collection).createIndex(idx.index, { name: idx.name });
        indexResults.push({ collection: idx.collection, name: idx.name, status: 'created' });
      } catch (err: any) {
        // 이미 존재하는 인덱스는 무시
        indexResults.push({ collection: idx.collection, name: idx.name, status: err.code === 85 ? 'exists' : 'error' });
      }
    }

    return NextResponse.json({
      success: true,
      clinicId: CLINIC_ID,
      migration: results,
      indexes: indexResults,
      summary: {
        totalCollections: TARGET_COLLECTIONS.length,
        totalModified: results.reduce((sum, r) => sum + Math.max(r.modified, 0), 0),
      },
    });
  } catch (error) {
    console.error('[Migration] clinicId 마이그레이션 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Migration failed' },
      { status: 500 }
    );
  }
}
