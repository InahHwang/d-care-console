// src/app/api/v2/migrate/consultation-to-source/fix-id-format/route.ts
// 보강 마이그레이션 — consultationType이 id 형식으로 저장된 환자 처리
//
// 배경: 일반 환자 등록은 label로 저장하지만,
//       자동등록 로직 등 일부 경로는 id로 저장하여 마이그레이션에서 빠짐.
//
// 대상 id:
//   custom_1765509393204  →  팀플DB 카테고리의 id
//   custom_1765634245849  →  홈페이지DB 카테고리의 id

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// id → 변환할 source(유입경로) 라벨
const ID_TO_SOURCE: Record<string, string> = {
  custom_1765509393204: '팀플DB',
  custom_1765634245849: '홈페이지DB',
};

const NEW_CONSULTATION_TYPE = '아웃바운드';

export async function POST(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }
    const roleErr = requireRole(auth.user, 'master', 'admin');
    if (roleErr) {
      return NextResponse.json({ success: false, message: roleErr.error }, { status: roleErr.status });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const targetIds = Object.keys(ID_TO_SOURCE);
    const now = new Date().toISOString();

    const summaries: Array<{
      targetId: string;
      newSource: string;
      matched: number;
      willUpdate: number;
      samples: Array<{
        patientId: string;
        name: string;
        before: { consultationType: string; source: string };
        after: { consultationType: string; source: string };
      }>;
    }> = [];

    for (const targetId of targetIds) {
      const newSource = ID_TO_SOURCE[targetId];

      const patients = await db.collection('patients_v2').find({
        clinicId,
        consultationType: targetId,
        deletedAt: { $exists: false },
      }, {
        projection: { _id: 1, name: 1, referralSource: 1, source: 1, consultationType: 1, createdByName: 1 },
      }).toArray();

      const samples = patients.slice(0, 5).map((p) => ({
        patientId: p._id.toString(),
        name: p.name || '',
        before: {
          consultationType: p.consultationType || '',
          source: (p.referralSource || p.source || '').toString(),
        },
        after: {
          consultationType: NEW_CONSULTATION_TYPE,
          source: newSource,
        },
        createdByName: p.createdByName || '',
      }));

      let updatedCount = 0;
      if (!dryRun && patients.length > 0) {
        const ids = patients.map((p) => p._id);
        const result = await db.collection('patients_v2').updateMany(
          { _id: { $in: ids }, clinicId },
          {
            $set: {
              consultationType: NEW_CONSULTATION_TYPE,
              source: newSource,
              referralSource: newSource,
              lastModifiedAt: now,
              lastModifiedBy: auth.user.id,
              lastModifiedByName: auth.user.name || 'Migration',
            },
          }
        );
        updatedCount = result.modifiedCount;

        await db.collection('activityLogs_v2').insertOne({
          clinicId,
          action: 'migrate.consultation_to_source.fix_id',
          targetType: 'patient',
          targetId,
          description: `[보강 마이그레이션] consultationType=${targetId} → 아웃바운드 + ${newSource} (${updatedCount}건)`,
          metadata: {
            targetId,
            newSource,
            patientIds: patients.map((p) => p._id.toString()),
          },
          performedBy: auth.user.id,
          performedByName: auth.user.name || 'Migration',
          performedAt: now,
        });
      }

      summaries.push({
        targetId,
        newSource,
        matched: patients.length,
        willUpdate: dryRun ? patients.length : updatedCount,
        samples,
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      mode: dryRun ? 'dry-run (실제 변경 없음)' : 'applied',
      summaries,
      totals: {
        matched: summaries.reduce((s, x) => s + x.matched, 0),
        willUpdate: summaries.reduce((s, x) => s + x.willUpdate, 0),
      },
    });
  } catch (error) {
    console.error('[migrate/fix-id-format] error', error);
    return NextResponse.json({ success: false, message: '보강 마이그레이션 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
