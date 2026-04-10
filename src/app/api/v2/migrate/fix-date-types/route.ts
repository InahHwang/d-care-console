// src/app/api/v2/migrate/fix-date-types/route.ts
// 자동등록 환자의 문자열 날짜 필드를 Date 객체로 변환

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function POST() {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('patients_v2');

    // 자동등록 환자 중 createdAt이 문자열인 것 찾기
    const patients = await collection.find({
      isAutoRegistered: true,
      createdAt: { $type: 'string' },
    }).toArray();

    let fixedCount = 0;

    for (const patient of patients) {
      const updates: Record<string, any> = {};

      // 문자열 날짜 필드를 Date 객체로 변환
      const dateFields = ['createdAt', 'updatedAt', 'statusChangedAt', 'lastContactAt'];
      for (const field of dateFields) {
        if (typeof patient[field] === 'string') {
          updates[field] = new Date(patient[field]);
        }
      }

      // journeys 내 날짜 필드도 수정
      if (patient.journeys && Array.isArray(patient.journeys)) {
        const fixedJourneys = patient.journeys.map((j: any) => ({
          ...j,
          startedAt: typeof j.startedAt === 'string' ? new Date(j.startedAt) : j.startedAt,
          createdAt: typeof j.createdAt === 'string' ? new Date(j.createdAt) : j.createdAt,
          updatedAt: typeof j.updatedAt === 'string' ? new Date(j.updatedAt) : j.updatedAt,
          statusHistory: j.statusHistory?.map((h: any) => ({
            ...h,
            eventDate: typeof h.eventDate === 'string' ? new Date(h.eventDate) : h.eventDate,
            changedAt: typeof h.changedAt === 'string' ? new Date(h.changedAt) : h.changedAt,
          })),
        }));
        updates.journeys = fixedJourneys;
      }

      if (Object.keys(updates).length > 0) {
        await collection.updateOne({ _id: patient._id }, { $set: updates });
        fixedCount++;
        console.log(`[fix-date-types] ${patient.name} (${patient._id}) 수정 완료`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `자동등록 환자 ${patients.length}명 중 ${fixedCount}명 날짜 타입 수정 완료`,
      total: patients.length,
      fixed: fixedCount,
    });
  } catch (error: any) {
    console.error('[fix-date-types] 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
