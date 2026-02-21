// src/app/api/v2/migrate/clinic-id/route.ts
// 기존 데이터에 clinicId 필드 추가 마이그레이션
// 멀티테넌시 적용 후 기존 데이터에 clinicId가 없는 경우 'default'로 설정

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

const TARGET_COLLECTIONS = [
  'patients_v2',
  'callLogs_v2',
  'callbacks_v2',
  'consultations_v2',
  'referrals_v2',
  'channel_chats_v2',
  'recall_messages',
  'recall_settings',
  'manual_categories_v2',
  'manuals_v2',
  'settings_v2',
  'manualConsultations_v2',
  'users',
];

// POST: clinicId 백필 마이그레이션 실행
export async function POST() {
  try {
    const { db } = await connectToDatabase();

    const results: Record<string, number> = {};
    let totalUpdated = 0;

    for (const name of TARGET_COLLECTIONS) {
      const result = await db.collection(name).updateMany(
        { clinicId: { $exists: false } },
        { $set: { clinicId: 'default' } }
      );
      results[name] = result.modifiedCount;
      totalUpdated += result.modifiedCount;
    }

    return NextResponse.json({
      success: true,
      message: `clinicId 백필 완료: ${totalUpdated}건 업데이트`,
      results,
    });
  } catch (error) {
    console.error('[Migrate clinicId] Error:', error);
    return NextResponse.json(
      { success: false, error: 'clinicId 마이그레이션 실패' },
      { status: 500 }
    );
  }
}

// GET: clinicId 없는 문서 현황 조회
export async function GET() {
  try {
    const { db } = await connectToDatabase();

    const results: Record<string, { total: number; missingClinicId: number }> = {};

    for (const name of TARGET_COLLECTIONS) {
      const total = await db.collection(name).countDocuments();
      const missingClinicId = await db.collection(name).countDocuments({
        clinicId: { $exists: false },
      });
      results[name] = { total, missingClinicId };
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('[Migrate clinicId] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'clinicId 현황 조회 실패' },
      { status: 500 }
    );
  }
}
