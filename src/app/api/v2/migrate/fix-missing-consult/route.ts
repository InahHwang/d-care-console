// src/app/api/v2/migrate/fix-missing-consult/route.ts
// V1의 consultation.consultationNotes가 있는데 V2에 수동상담이력이 없는 환자들 수정

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { MongoClient, Db } from 'mongodb';

export const dynamic = 'force-dynamic';

async function connectToProductionDb(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI || '';
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db('d-care-db') };
}

// 최초 상담 메모 추출 (수정된 버전)
function getFirstConsultationMemo(v1Patient: any): string | null {
  // 1. consultation 필드의 상담 내용
  if (v1Patient.consultation?.consultationNotes) {
    const notes = v1Patient.consultation.consultationNotes;
    const plan = v1Patient.consultation.treatmentPlan;
    if (plan) {
      return `${notes}\n\n[치료계획] ${plan}`;
    }
    return notes;
  }

  // 2. 첫 번째 콜백의 상담 내용
  if (v1Patient.callbackHistory && v1Patient.callbackHistory.length > 0) {
    const firstCallback = v1Patient.callbackHistory[0];
    if (firstCallback.consultationRecord?.consultationContent) {
      return firstCallback.consultationRecord.consultationContent;
    }
    if (firstCallback.firstConsultationResult?.consultationContent) {
      return firstCallback.firstConsultationResult.consultationContent;
    }
    if (firstCallback.notes) {
      return firstCallback.notes;
    }
  }

  // 3. 환자 메모
  if (v1Patient.notes) {
    return v1Patient.notes;
  }

  // 4. memo 필드
  if (v1Patient.memo) {
    return v1Patient.memo;
  }

  return null;
}

// GET: 누락된 상담 내용 미리보기
export async function GET(request: NextRequest) {
  let productionClient: MongoClient | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const useProduction = searchParams.get('production') === 'true';

    let db: Db;
    if (useProduction) {
      const connection = await connectToProductionDb();
      productionClient = connection.client;
      db = connection.db;
    } else {
      const connection = await connectToDatabase();
      db = connection.db;
    }

    const v1Collection = db.collection('patients');
    const v2Collection = db.collection('patients_v2');
    const manualCollection = db.collection('manualConsultations_v2');

    // V1 환자 중 consultation.consultationNotes가 있는 환자들
    const v1Patients = await v1Collection.find({
      'consultation.consultationNotes': { $exists: true, $nin: ['', null] }
    }).toArray();

    const missingConsults: any[] = [];

    for (const v1Patient of v1Patients) {
      // V2 환자 찾기
      const v2Patient = await v2Collection.findOne({ phone: v1Patient.phoneNumber });
      if (!v2Patient) continue;

      // 이미 마이그레이션된 상담이 있는지 확인
      const existingManual = await manualCollection.findOne({
        patientId: v2Patient._id.toString(),
        migratedFrom: 'v1',
        type: 'phone',
      });

      if (!existingManual) {
        const memo = getFirstConsultationMemo(v1Patient);
        if (memo) {
          missingConsults.push({
            name: v1Patient.name,
            phone: v1Patient.phoneNumber,
            v2PatientId: v2Patient._id.toString(),
            consultationNotes: v1Patient.consultation?.consultationNotes?.substring(0, 100) + '...',
            memoToInsert: memo.substring(0, 100) + '...',
          });
        }
      }
    }

    if (productionClient) await productionClient.close();

    return NextResponse.json({
      success: true,
      database: useProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      totalV1WithConsultNotes: v1Patients.length,
      missingCount: missingConsults.length,
      samples: missingConsults.slice(0, 10),
    });
  } catch (error) {
    if (productionClient) await productionClient.close();
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// POST: 누락된 상담 내용 추가
export async function POST(request: NextRequest) {
  let productionClient: MongoClient | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const useProduction = searchParams.get('production') === 'true';

    let db: Db;
    if (useProduction) {
      const connection = await connectToProductionDb();
      productionClient = connection.client;
      db = connection.db;
    } else {
      const connection = await connectToDatabase();
      db = connection.db;
    }

    const v1Collection = db.collection('patients');
    const v2Collection = db.collection('patients_v2');
    const manualCollection = db.collection('manualConsultations_v2');

    const now = new Date();
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    // 모든 V1 환자 순회
    const v1Patients = await v1Collection.find({}).toArray();

    for (const v1Patient of v1Patients) {
      try {
        if (!v1Patient.phoneNumber) continue;

        const memo = getFirstConsultationMemo(v1Patient);
        if (!memo) {
          skipped++;
          continue;
        }

        // V2 환자 찾기
        const v2Patient = await v2Collection.findOne({ phone: v1Patient.phoneNumber });
        if (!v2Patient) {
          skipped++;
          continue;
        }

        // 이미 마이그레이션된 상담이 있는지 확인
        const existingManual = await manualCollection.findOne({
          patientId: v2Patient._id.toString(),
          migratedFrom: 'v1',
          type: 'phone',
        });

        if (existingManual) {
          skipped++;
          continue;
        }

        // 상담 내용 추가
        await manualCollection.insertOne({
          patientId: v2Patient._id.toString(),
          type: 'phone',
          date: v1Patient.consultation?.consultationDate
            ? new Date(v1Patient.consultation.consultationDate)
            : (v1Patient.createdAt ? new Date(v1Patient.createdAt) : now),
          content: memo,
          consultantName: v1Patient.createdByName || v1Patient.lastModifiedByName || '마이그레이션',
          source: 'manual',
          migratedFrom: 'v1',
          migratedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        inserted++;
      } catch (err) {
        errors.push(`${v1Patient.name}: ${(err as Error).message}`);
      }
    }

    if (productionClient) await productionClient.close();

    return NextResponse.json({
      success: true,
      database: useProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      results: {
        inserted,
        skipped,
        errors: errors.slice(0, 10),
      },
    });
  } catch (error) {
    if (productionClient) await productionClient.close();
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
