// 임시 디버그 API - 환자 nextActionDate vs callbacks_v2 비교
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    if (!name) {
      return NextResponse.json({ error: 'name 파라미터 필요' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 1. 환자 조회
    const patient = await db.collection('patients_v2').findOne(
      { name, deletedAt: { $exists: false } },
      { projection: { name: 1, nextAction: 1, nextActionDate: 1, activeJourneyId: 1, journeys: 1, status: 1 } }
    );

    if (!patient) {
      return NextResponse.json({ error: '환자를 찾을 수 없음' }, { status: 404 });
    }

    // 2. 해당 환자의 callbacks_v2 조회
    const callbacks = await db.collection('callbacks_v2')
      .find({ patientId: patient._id.toString() })
      .sort({ scheduledAt: -1 })
      .limit(10)
      .toArray();

    // 3. 활성 여정 정보
    const activeJourney = patient.journeys?.find((j: { id: string }) => j.id === patient.activeJourneyId);

    return NextResponse.json({
      patient: {
        _id: patient._id,
        name: patient.name,
        status: patient.status,
        nextAction: patient.nextAction,
        nextActionDate: patient.nextActionDate,
        activeJourneyId: patient.activeJourneyId,
      },
      activeJourney: activeJourney ? {
        id: activeJourney.id,
        treatmentType: activeJourney.treatmentType,
        nextActionDate: activeJourney.nextActionDate,
        isActive: activeJourney.isActive,
      } : null,
      allJourneys: patient.journeys?.map((j: { id: string; treatmentType?: string; nextActionDate?: string; isActive?: boolean }) => ({
        id: j.id,
        treatmentType: j.treatmentType,
        nextActionDate: j.nextActionDate,
        isActive: j.isActive,
      })),
      callbacks: callbacks.map(cb => ({
        _id: cb._id,
        type: cb.type,
        status: cb.status,
        scheduledAt: cb.scheduledAt,
        note: cb.note,
        createdAt: cb.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Debug] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
