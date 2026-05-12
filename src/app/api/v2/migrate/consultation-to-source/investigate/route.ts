// src/app/api/v2/migrate/consultation-to-source/investigate/route.ts
// 조사 전용 API (read-only)
// 상담타입 '팀플DB' / '홈페이지DB'를 유입경로로 옮기기 전, 영향 범위 파악

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 조사 대상 상담타입 값 (label 그대로)
const TARGET_CONSULTATION_TYPES = ['팀플DB', '홈페이지DB'];

interface ConsultationTypeReport {
  total: number;
  sourceEmpty: number;
  sourceSame: number; // source가 이미 동일 값 (이미 옮긴 케이스 등)
  sourceConflict: number; // source가 다른 값 (덮어쓰면 손실)
  conflictValues: Record<string, number>; // 충돌 값 분포
  patientStatuses: Record<string, number>; // 환자 상태별 분포 (개수 영향 파악)
}

export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }
    const roleErr = requireRole(auth.user, 'master', 'admin');
    if (roleErr) {
      return NextResponse.json({ success: false, message: roleErr.error }, { status: roleErr.status });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const report: Record<string, ConsultationTypeReport> = {};

    for (const target of TARGET_CONSULTATION_TYPES) {
      const patients = await db.collection('patients_v2').find({
        clinicId,
        consultationType: target,
        deletedAt: { $exists: false },
      }, {
        projection: { _id: 1, referralSource: 1, source: 1, status: 1 },
      }).toArray();

      const row: ConsultationTypeReport = {
        total: patients.length,
        sourceEmpty: 0,
        sourceSame: 0,
        sourceConflict: 0,
        conflictValues: {},
        patientStatuses: {},
      };

      for (const p of patients) {
        // 두 후보 필드 모두 점검 (구버전: source, 신버전: referralSource)
        const src = (p.referralSource || p.source || '').toString().trim();

        if (!src) {
          row.sourceEmpty += 1;
        } else if (src === target) {
          row.sourceSame += 1;
        } else {
          row.sourceConflict += 1;
          row.conflictValues[src] = (row.conflictValues[src] || 0) + 1;
        }

        const status = p.status || '미지정';
        row.patientStatuses[status] = (row.patientStatuses[status] || 0) + 1;
      }

      report[target] = row;
    }

    // 추가: 다른 상담타입인데 referralSource/source에 '팀플DB' 또는 '홈페이지DB' 값이 들어있는 환자
    //       (이미 일부 수동으로 이동했거나, 자유 입력으로 들어간 케이스)
    const reverseCheck: Record<string, number> = {};
    for (const target of TARGET_CONSULTATION_TYPES) {
      const count = await db.collection('patients_v2').countDocuments({
        clinicId,
        consultationType: { $ne: target },
        $or: [{ referralSource: target }, { source: target }],
        deletedAt: { $exists: false },
      });
      reverseCheck[target] = count;
    }

    // 추가: 전체 환자 수 (퍼센티지 가늠용)
    const totalPatients = await db.collection('patients_v2').countDocuments({
      clinicId,
      deletedAt: { $exists: false },
    });

    // 현재 카테고리 설정 상태도 함께 반환
    const categoriesDoc = await db.collection('settings').findOne({ type: 'categories' });
    const consultationTypeCategories = (categoriesDoc?.consultationTypes || []).map((c: { id: string; label: string; isActive: boolean }) => ({
      id: c.id, label: c.label, isActive: c.isActive,
    }));
    const referralSourceCategories = (categoriesDoc?.referralSources || []).map((c: { id: string; label: string; isActive: boolean; parentCategory?: string }) => ({
      id: c.id, label: c.label, isActive: c.isActive, parentCategory: c.parentCategory,
    }));

    return NextResponse.json({
      success: true,
      data: {
        clinicId,
        totalPatients,
        targets: report,
        reverseCheck,
        categoriesNow: {
          consultationTypes: consultationTypeCategories,
          referralSources: referralSourceCategories,
        },
      },
    });
  } catch (error) {
    console.error('[migrate/consultation-to-source/investigate] error', error);
    return NextResponse.json({ success: false, message: '조사 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
