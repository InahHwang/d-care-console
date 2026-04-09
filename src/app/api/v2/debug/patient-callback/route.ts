// 임시 디버그 API - 환자 nextActionDate vs callbacks_v2 불일치 전체 조회
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'single';
    const name = searchParams.get('name');

    const { db } = await connectToDatabase();

    // mode=desync: 전체 불일치 조회
    if (mode === 'desync') {
      // pending 콜백이 있는 환자 목록
      const pendingCallbacks = await db.collection('callbacks_v2')
        .find({ status: 'pending' })
        .toArray();

      const desyncList = [];

      for (const cb of pendingCallbacks) {
        const patient = await db.collection('patients_v2').findOne(
          { _id: new (await import('mongodb')).ObjectId(cb.patientId), deletedAt: { $exists: false } },
          { projection: { name: 1, nextActionDate: 1, activeJourneyId: 1, journeys: 1 } }
        );

        if (!patient) continue;

        const activeJourney = patient.journeys?.find((j: { id: string }) => j.id === patient.activeJourneyId);
        const patientDate = patient.nextActionDate ? new Date(patient.nextActionDate).toISOString().slice(0, 10) : null;
        const journeyDate = activeJourney?.nextActionDate ? new Date(activeJourney.nextActionDate).toISOString().slice(0, 10) : null;
        const callbackDate = new Date(cb.scheduledAt).toISOString().slice(0, 10);

        // 불일치: 콜백 날짜와 환자/여정 날짜가 다르면
        if (patientDate !== callbackDate || journeyDate !== callbackDate) {
          desyncList.push({
            patientId: cb.patientId,
            name: patient.name,
            callbackDate,
            patientNextActionDate: patientDate,
            journeyNextActionDate: journeyDate,
            callbackId: cb._id,
            callbackType: cb.type,
          });
        }
      }

      return NextResponse.json({
        total: desyncList.length,
        desyncList,
      });
    }

    // mode=single: 기존 단건 조회
    if (!name) {
      return NextResponse.json({ error: 'name 파라미터 필요' }, { status: 400 });
    }

    const { ObjectId } = await import('mongodb');

    const patient = await db.collection('patients_v2').findOne(
      { name, deletedAt: { $exists: false } },
      { projection: { name: 1, nextAction: 1, nextActionDate: 1, activeJourneyId: 1, journeys: 1, status: 1 } }
    );

    if (!patient) {
      return NextResponse.json({ error: '환자를 찾을 수 없음' }, { status: 404 });
    }

    const callbacks = await db.collection('callbacks_v2')
      .find({ patientId: patient._id.toString() })
      .sort({ scheduledAt: -1 })
      .limit(10)
      .toArray();

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
      callbacks: callbacks.map((cb: Record<string, unknown>) => ({
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
