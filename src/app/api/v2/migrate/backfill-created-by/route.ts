// src/app/api/v2/migrate/backfill-created-by/route.ts
// [상담사별 실적 지원] 3, 4월 환자의 createdByName 백필
// - statusHistory[0].changedBy를 등록자로 간주하여 createdByName 필드 채움
// - '시스템' 등 무의미한 값은 패스 (대시보드에서 "미지정"으로 집계됨)
// - 1회성 실행: GET /api/v2/migrate/backfill-created-by

import { NextResponse } from 'next/server';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

// 등록자로 보기 어려운 값 (statusHistory[0].changedBy가 이 값이면 스킵)
const INVALID_NAMES = new Set(['시스템', 'system', '', 'unknown']);

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    // 3, 4월 범위 (KST)
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const rangeStart = new Date(Date.UTC(2026, 2, 1) - KST_OFFSET);  // 2026-03-01 KST
    const rangeEnd = new Date(Date.UTC(2026, 4, 1) - KST_OFFSET);    // 2026-05-01 KST (exclusive)

    // 대상: createdByName 없거나 빈 값이고, 3~4월 등록 환자
    const candidates = await db.collection('patients_v2').find({
      clinicId,
      deletedAt: { $exists: false },
      createdAt: { $gte: rangeStart, $lt: rangeEnd },
      $or: [
        { createdByName: { $exists: false } },
        { createdByName: null },
        { createdByName: '' },
      ],
    }, {
      projection: { _id: 1, name: 1, statusHistory: 1, createdAt: 1 },
    }).toArray();

    let updated = 0;
    let skippedNoHistory = 0;
    let skippedInvalidName = 0;
    const updatedNames: Record<string, number> = {};

    for (const p of candidates) {
      const firstEntry = Array.isArray(p.statusHistory) && p.statusHistory.length > 0
        ? p.statusHistory[0]
        : null;

      if (!firstEntry || !firstEntry.changedBy) {
        skippedNoHistory++;
        continue;
      }

      const name = String(firstEntry.changedBy).trim();

      if (INVALID_NAMES.has(name) || INVALID_NAMES.has(name.toLowerCase())) {
        skippedInvalidName++;
        continue;
      }

      await db.collection('patients_v2').updateOne(
        { _id: p._id },
        { $set: { createdByName: name } }
      );
      updated++;
      updatedNames[name] = (updatedNames[name] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      range: {
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      },
      summary: {
        candidatesScanned: candidates.length,
        updated,
        skippedNoHistory,
        skippedInvalidName,
      },
      updatedByConsultant: updatedNames,
    });
  } catch (error) {
    console.error('[Migrate] backfill-created-by 실패:', error);
    return NextResponse.json(
      { success: false, message: '마이그레이션 실패' },
      { status: 500 }
    );
  }
}
