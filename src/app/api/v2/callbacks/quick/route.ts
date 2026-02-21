// src/app/api/v2/callbacks/quick/route.ts
// CTI 패널에서 부재중 후 빠른 콜백 예약 API
// 4곳 업데이트: patients_v2.nextAction/nextActionDate, callbackHistory, journey callbackHistory, callbacks_v2

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, scheduledAt } = body;

    if (!patientId || !scheduledAt) {
      return NextResponse.json(
        { success: false, error: 'patientId와 scheduledAt은 필수입니다' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date();
    const nowISO = now.toISOString();

    // 환자 조회 (activeJourneyId 필요)
    const currentPatient = await db.collection('patients_v2').findOne(
      { _id: new ObjectId(patientId) }
    );
    if (!currentPatient) {
      return NextResponse.json(
        { success: false, error: '환자를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 1. 콜백 이력 엔트리 생성
    const callbackHistoryEntry = {
      scheduledAt: new Date(scheduledAt),
      reason: 'no_answer',
      createdAt: now,
    };

    // 2. patients_v2: nextAction/nextActionDate + callbackHistory push
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(patientId) },
      {
        $set: {
          nextAction: '콜백',
          nextActionDate: scheduledAt,
          updatedAt: nowISO,
        },
        $push: { callbackHistory: callbackHistoryEntry } as any,
      }
    );

    // 3. 활성 여정의 callbackHistory에도 추가
    if (currentPatient.activeJourneyId) {
      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(patientId) },
        { $push: { 'journeys.$[journey].callbackHistory': callbackHistoryEntry } as any },
        { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
      );
    }

    // 4. callbacks_v2에 추가
    const result = await db.collection('callbacks_v2').insertOne({
      patientId,
      type: 'callback',
      scheduledAt: new Date(scheduledAt),
      status: 'pending',
      createdAt: nowISO,
    });

    console.log(`[Quick Callback] 퀵 콜백 생성 완료: 환자=${patientId}, 예정일=${scheduledAt}`);

    return NextResponse.json({
      success: true,
      data: { id: result.insertedId.toString(), scheduledAt },
    });
  } catch (error) {
    console.error('[Quick Callback] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
