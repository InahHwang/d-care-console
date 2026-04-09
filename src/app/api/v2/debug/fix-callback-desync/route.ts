// 임시 마이그레이션: pending 콜백과 nextActionDate 불일치 수정 (유형 2만)
// nextActionDate가 있지만 콜백 날짜와 다른 경우 → 콜백 날짜로 동기화
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    const pendingCallbacks = await db.collection('callbacks_v2')
      .find({ status: 'pending' })
      .toArray();

    const fixed = [];

    for (const cb of pendingCallbacks) {
      const patient = await db.collection('patients_v2').findOne(
        { _id: new ObjectId(cb.patientId), deletedAt: { $exists: false } },
        { projection: { name: 1, nextActionDate: 1, activeJourneyId: 1, journeys: 1 } }
      );

      if (!patient || !patient.nextActionDate) continue; // 유형 1은 건너뜀

      const activeJourney = patient.journeys?.find((j: { id: string }) => j.id === patient.activeJourneyId);
      const patientDate = new Date(patient.nextActionDate).toISOString().slice(0, 10);
      const callbackDate = new Date(cb.scheduledAt).toISOString().slice(0, 10);

      if (patientDate === callbackDate) continue; // 이미 일치

      // nextActionDate를 콜백 날짜로 동기화
      const callbackScheduledAt = new Date(cb.scheduledAt).toISOString();

      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(cb.patientId) },
        { $set: { nextActionDate: callbackScheduledAt, updatedAt: new Date().toISOString() } }
      );

      if (patient.activeJourneyId) {
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(cb.patientId) },
          { $set: { 'journeys.$[journey].nextActionDate': callbackScheduledAt } },
          { arrayFilters: [{ 'journey.id': patient.activeJourneyId }] }
        );
      }

      fixed.push({
        name: patient.name,
        patientId: cb.patientId,
        before: patientDate,
        after: callbackDate,
      });
    }

    return NextResponse.json({ fixed: fixed.length, list: fixed });
  } catch (error) {
    console.error('[Fix callback desync] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
