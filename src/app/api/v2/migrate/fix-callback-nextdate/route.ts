// src/app/api/v2/migrate/fix-callback-nextdate/route.ts
// 콜백필요/부재중 상태 환자들의 nextActionDate를 예약일→콜백일로 수정

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

// GET: 잘못된 nextActionDate 환자 미리보기
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

    // V1에서 콜백필요/부재중 상태이면서 reservationDate와 nextCallbackDate 둘 다 있는 환자
    const v1Patients = await v1Collection.find({
      status: { $in: ['콜백필요', '부재중'] },
      reservationDate: { $exists: true, $ne: null },
      nextCallbackDate: { $exists: true, $ne: null }
    }).toArray();

    const candidates: any[] = [];

    for (const v1Patient of v1Patients) {
      if (!v1Patient.phoneNumber) continue;

      // V2 환자 찾기
      const v2Patient = await v2Collection.findOne({ phone: v1Patient.phoneNumber });
      if (!v2Patient || !v2Patient.nextActionDate) continue;

      const reservationDateStr = v1Patient.reservationDate.split('T')[0];
      const currentNextAction = new Date(v2Patient.nextActionDate).toISOString().split('T')[0];

      // V2의 nextActionDate가 예약일과 같으면 잘못된 것
      if (currentNextAction === reservationDateStr) {
        candidates.push({
          name: v1Patient.name,
          phone: v1Patient.phoneNumber,
          v1Status: v1Patient.status,
          v2Status: v2Patient.status,
          currentNextActionDate: currentNextAction,
          v1ReservationDate: v1Patient.reservationDate,
          v1NextCallbackDate: v1Patient.nextCallbackDate,
          shouldBe: v1Patient.nextCallbackDate.split('T')[0],
        });
      }
    }

    if (productionClient) await productionClient.close();

    return NextResponse.json({
      success: true,
      database: useProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      totalV1CallbackPatients: v1Patients.length,
      wrongNextActionDate: candidates.length,
      samples: candidates.slice(0, 20),
    });
  } catch (error) {
    if (productionClient) await productionClient.close();
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// POST: nextActionDate 수정
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

    const now = new Date();
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // V1에서 콜백필요/부재중 상태이면서 reservationDate와 nextCallbackDate 둘 다 있는 환자
    const v1Patients = await v1Collection.find({
      status: { $in: ['콜백필요', '부재중'] },
      reservationDate: { $exists: true, $ne: null },
      nextCallbackDate: { $exists: true, $ne: null }
    }).toArray();

    for (const v1Patient of v1Patients) {
      try {
        if (!v1Patient.phoneNumber) {
          skipped++;
          continue;
        }

        // V2 환자 찾기
        const v2Patient = await v2Collection.findOne({ phone: v1Patient.phoneNumber });
        if (!v2Patient || !v2Patient.nextActionDate) {
          skipped++;
          continue;
        }

        const reservationDateStr = v1Patient.reservationDate.split('T')[0];
        const currentNextAction = new Date(v2Patient.nextActionDate).toISOString().split('T')[0];

        // V2의 nextActionDate가 예약일과 같으면 콜백일로 수정
        if (currentNextAction === reservationDateStr) {
          await v2Collection.updateOne(
            { _id: v2Patient._id },
            {
              $set: {
                nextActionDate: new Date(v1Patient.nextCallbackDate),
                updatedAt: now,
                'migrateFixedAt.callbackNextDate': now,
              }
            }
          );
          updated++;
        } else {
          skipped++;
        }
      } catch (err) {
        errors.push(`${v1Patient.name}: ${(err as Error).message}`);
      }
    }

    if (productionClient) await productionClient.close();

    return NextResponse.json({
      success: true,
      database: useProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      results: {
        totalProcessed: v1Patients.length,
        updated,
        skipped,
        errors: errors.slice(0, 10),
      },
    });
  } catch (error) {
    if (productionClient) await productionClient.close();
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
