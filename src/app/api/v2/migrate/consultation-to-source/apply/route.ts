// src/app/api/v2/migrate/consultation-to-source/apply/route.ts
// 마이그레이션 적용 API
// 상담타입 '팀플DB' / '홈페이지DB'를 아웃바운드 + 유입경로로 이전
//
// POST body: { dryRun: true | false }
//   dryRun=true: 실제 변경 없이 결과만 반환
//   dryRun=false: 실제 적용
//
// 변환 규칙:
//   consultationType: '팀플DB' or '홈페이지DB'  →  '아웃바운드'
//   source / referralSource:  →  '팀플DB' or '홈페이지DB' (덮어쓰기)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const TARGETS = ['팀플DB', '홈페이지DB'];
const NEW_CONSULTATION_TYPE = '아웃바운드';

interface MigrationSummary {
  target: string; // 팀플DB or 홈페이지DB
  matched: number;
  willUpdate: number;
  samples: Array<{
    patientId: string;
    name: string;
    before: { consultationType: string; source: string };
    after: { consultationType: string; source: string };
    sourceWasOverwritten: boolean;
  }>;
}

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
    const dryRun = body.dryRun !== false; // 기본 dry-run

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const summaries: MigrationSummary[] = [];
    const now = new Date().toISOString();

    for (const target of TARGETS) {
      const patients = await db.collection('patients_v2').find({
        clinicId,
        consultationType: target,
        deletedAt: { $exists: false },
      }, {
        projection: { _id: 1, name: 1, referralSource: 1, source: 1, consultationType: 1 },
      }).toArray();

      const samples: MigrationSummary['samples'] = patients.slice(0, 5).map((p) => {
        const beforeSrc = (p.referralSource || p.source || '').toString();
        return {
          patientId: p._id.toString(),
          name: p.name || '',
          before: { consultationType: p.consultationType || '', source: beforeSrc },
          after: { consultationType: NEW_CONSULTATION_TYPE, source: target },
          sourceWasOverwritten: !!beforeSrc && beforeSrc !== target,
        };
      });

      // 실제 적용
      let updatedCount = 0;
      if (!dryRun && patients.length > 0) {
        const ids = patients.map((p) => p._id);
        const result = await db.collection('patients_v2').updateMany(
          { _id: { $in: ids }, clinicId },
          {
            $set: {
              consultationType: NEW_CONSULTATION_TYPE,
              source: target,
              referralSource: target,
              lastModifiedAt: now,
              lastModifiedBy: auth.user.id,
              lastModifiedByName: auth.user.name || 'Migration',
            },
          }
        );
        updatedCount = result.modifiedCount;

        // 활동로그 1건 (전체 변경 요약)
        await db.collection('activityLogs_v2').insertOne({
          clinicId,
          action: 'migrate.consultation_to_source',
          targetType: 'patient',
          targetId: target,
          description: `[마이그레이션] 상담타입 '${target}' → 아웃바운드 + 유입경로 '${target}' 일괄 변경 (${updatedCount}건)`,
          metadata: {
            target,
            patientIds: patients.map((p) => p._id.toString()),
            previousSourceConflicts: samples.filter((s) => s.sourceWasOverwritten).length,
          },
          performedBy: auth.user.id,
          performedByName: auth.user.name || 'Migration',
          performedAt: now,
        });
      }

      summaries.push({
        target,
        matched: patients.length,
        willUpdate: dryRun ? patients.length : updatedCount,
        samples,
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      mode: dryRun ? 'dry-run (실제 변경 없음)' : 'applied (실제 적용 완료)',
      summaries,
      totals: {
        matched: summaries.reduce((s, x) => s + x.matched, 0),
        willUpdate: summaries.reduce((s, x) => s + x.willUpdate, 0),
      },
    });
  } catch (error) {
    console.error('[migrate/consultation-to-source/apply] error', error);
    return NextResponse.json({ success: false, message: '마이그레이션 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
