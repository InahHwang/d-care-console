// src/app/api/v2/migrate/fix-treatment-date/route.ts
// 마이그레이션된 "치료중" 환자들의 statusHistory.eventDate를 nextActionDate로 수정

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

// GET: 미리보기 (수정 대상 환자 목록)
export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const v2Collection = db.collection('patients_v2');

    // 마이그레이션된 치료중 환자 조회
    const patients = await v2Collection.find({
      migratedFrom: 'v1',
      status: 'treatment',
    }).toArray();

    const previewList = patients.map(p => {
      const currentEventDate = p.journeys?.[0]?.statusHistory?.[0]?.eventDate;
      const nextActionDate = p.nextActionDate;

      return {
        name: p.name,
        phone: p.phone,
        currentEventDate: currentEventDate ? new Date(currentEventDate).toISOString().split('T')[0] : null,
        nextActionDate: nextActionDate ? new Date(nextActionDate).toISOString().split('T')[0] : null,
        needsUpdate: currentEventDate && nextActionDate &&
          new Date(currentEventDate).toISOString().split('T')[0] !== new Date(nextActionDate).toISOString().split('T')[0],
      };
    });

    const needsUpdateCount = previewList.filter(p => p.needsUpdate).length;

    return NextResponse.json({
      success: true,
      preview: {
        total: patients.length,
        needsUpdate: needsUpdateCount,
        patients: previewList,
      },
    });
  } catch (error) {
    console.error('[Fix Treatment Date GET] Error:', error);
    return NextResponse.json(
      { error: '미리보기 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: 실제 수정 실행
export async function POST() {
  try {
    const { db } = await connectToDatabase();
    const v2Collection = db.collection('patients_v2');

    // 마이그레이션된 치료중 환자 조회
    const patients = await v2Collection.find({
      migratedFrom: 'v1',
      status: 'treatment',
      nextActionDate: { $exists: true, $ne: null },
    }).toArray();

    const results = {
      total: patients.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      details: [] as { name: string; phone: string; oldDate: string; newDate: string }[],
      errors: [] as string[],
    };

    for (const patient of patients) {
      try {
        const nextActionDate = patient.nextActionDate;
        if (!nextActionDate) {
          results.skipped++;
          continue;
        }

        const treatmentStartDate = new Date(nextActionDate);
        const journeys = patient.journeys || [];

        if (journeys.length === 0) {
          results.skipped++;
          continue;
        }

        // 첫 번째 Journey의 statusHistory 업데이트
        const updatedJourneys = journeys.map((journey: any, index: number) => {
          if (index === 0 && journey.statusHistory && journey.statusHistory.length > 0) {
            const oldEventDate = journey.statusHistory[0].eventDate;

            // statusHistory의 첫 번째 항목 eventDate를 치료시작일로 변경
            const updatedStatusHistory = journey.statusHistory.map((sh: any, shIndex: number) => {
              if (shIndex === 0) {
                return {
                  ...sh,
                  eventDate: treatmentStartDate,
                };
              }
              return sh;
            });

            results.details.push({
              name: patient.name,
              phone: patient.phone,
              oldDate: oldEventDate ? new Date(oldEventDate).toISOString().split('T')[0] : 'null',
              newDate: treatmentStartDate.toISOString().split('T')[0],
            });

            return {
              ...journey,
              statusHistory: updatedStatusHistory,
            };
          }
          return journey;
        });

        // DB 업데이트
        await v2Collection.updateOne(
          { _id: patient._id },
          {
            $set: {
              journeys: updatedJourneys,
              treatmentStartDate: treatmentStartDate, // treatmentStartDate 필드도 설정
              updatedAt: new Date(),
            },
          }
        );

        results.updated++;
      } catch (patientError) {
        results.failed++;
        results.errors.push(`${patient.name} (${patient.phone}): ${(patientError as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: '치료중 환자 상태변경이력 날짜 수정 완료',
      results,
    });
  } catch (error) {
    console.error('[Fix Treatment Date POST] Error:', error);
    return NextResponse.json(
      { error: '수정 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}
