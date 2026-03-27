// src/app/api/v2/migrate/fix-journey-status-desync/route.ts
// [버그수정] 여정 status와 환자 status 불일치 수정
// 원인: consultations API에서 상담 결과 "동의" 시 환자 status만 덮어쓰고 여정은 안 건드림
// 1회성 실행 — 배포 후 GET 호출로 실행

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

// 상태 진행도 순서 (높을수록 더 진행된 상태)
const STATUS_ORDER: Record<string, number> = {
  consulting: 0, reserved: 1, visited: 2, treatmentBooked: 3,
  treatment: 4, completed: 5, followup: 6, closed: 7,
};

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // 활성 여정이 있는 모든 환자 조회
    const patients = await db.collection('patients_v2').find({
      'journeys.0': { $exists: true },
    }, {
      projection: {
        name: 1, phone: 1, status: 1, activeJourneyId: 1,
        journeys: 1, nextAction: 1, nextActionDate: 1,
      },
    }).toArray();

    const fixes: Array<{
      name: string;
      phone: string;
      patientStatus: string;
      journeyStatus: string;
      fixedTo: string;
    }> = [];

    for (const patient of patients) {
      const activeJourney = patient.journeys?.find(
        (j: any) => j.id === patient.activeJourneyId || j.isActive
      );
      if (!activeJourney) continue;

      const patientStatus = patient.status;
      const journeyStatus = activeJourney.status;

      // 불일치 감지
      if (patientStatus === journeyStatus) continue;

      const patientOrder = STATUS_ORDER[patientStatus] ?? -1;
      const journeyOrder = STATUS_ORDER[journeyStatus] ?? -1;

      // 더 진행된 상태를 정답으로 사용
      const correctStatus = journeyOrder > patientOrder ? journeyStatus : patientStatus;
      const correctOrder = STATUS_ORDER[correctStatus] ?? 0;

      // 환자 레벨 수정
      const patientUpdate: Record<string, unknown> = {};
      if (patientStatus !== correctStatus) {
        patientUpdate.status = correctStatus;
        patientUpdate.statusChangedAt = new Date();
      }

      // 예약 상태(reserved, treatmentBooked)보다 더 진행됐으면 nextActionDate 정리
      if (correctOrder > STATUS_ORDER['treatmentBooked'] && patient.nextActionDate) {
        patientUpdate.nextAction = null;
        patientUpdate.nextActionDate = null;
      }

      if (Object.keys(patientUpdate).length > 0) {
        await db.collection('patients_v2').updateOne(
          { _id: patient._id },
          { $set: patientUpdate }
        );
      }

      // 여정 레벨 수정
      if (journeyStatus !== correctStatus && patient.activeJourneyId) {
        await db.collection('patients_v2').updateOne(
          { _id: patient._id },
          { $set: {
            'journeys.$[journey].status': correctStatus,
            'journeys.$[journey].updatedAt': new Date(),
          } },
          { arrayFilters: [{ 'journey.id': patient.activeJourneyId }] }
        );
      }

      fixes.push({
        name: patient.name,
        phone: patient.phone,
        patientStatus,
        journeyStatus,
        fixedTo: correctStatus,
      });
    }

    return NextResponse.json({
      success: true,
      totalChecked: patients.length,
      totalFixed: fixes.length,
      fixes,
    });
  } catch (error) {
    console.error('[Migration] fix-journey-status-desync 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
