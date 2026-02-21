// src/app/api/v2/migrate/check-patient/route.ts
// 환자 데이터 조회 (V1 vs V2 비교용)

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

export async function GET(request: NextRequest) {
  let productionClient: MongoClient | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const useProduction = searchParams.get('production') === 'true';
    const name = searchParams.get('name');
    const phone = searchParams.get('phone');

    if (!name && !phone) {
      return NextResponse.json({ error: 'name 또는 phone 파라미터 필요' }, { status: 400 });
    }

    let db: Db;
    if (useProduction) {
      const connection = await connectToProductionDb();
      productionClient = connection.client;
      db = connection.db;
    } else {
      const connection = await connectToDatabase();
      db = connection.db;
    }

    // V1 환자 조회
    const v1Query = name ? { name: { $regex: name, $options: 'i' } } : { phoneNumber: phone };
    const v1Patient = await db.collection('patients').findOne(v1Query);

    // V2 환자 조회
    const v2Query = name ? { name: { $regex: name, $options: 'i' } } : { phone: phone };
    const v2Patient = await db.collection('patients_v2').findOne(v2Query);

    // V2 수동 상담이력 조회
    let manualConsultations: any[] = [];
    if (v2Patient) {
      manualConsultations = await db.collection('manualConsultations_v2')
        .find({ patientId: v2Patient._id.toString() })
        .toArray();
    }

    if (productionClient) {
      await productionClient.close();
    }

    return NextResponse.json({
      success: true,
      database: useProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      v1Patient: v1Patient || null,  // 전체 데이터 반환
      v2Patient: v2Patient ? {
        _id: v2Patient._id,
        name: v2Patient.name,
        phone: v2Patient.phone,
        status: v2Patient.status,
        callbackHistory: v2Patient.callbackHistory,
        firstConsultDate: v2Patient.firstConsultDate,
        createdAt: v2Patient.createdAt,
      } : null,
      manualConsultations: manualConsultations.map(c => ({
        _id: c._id,
        type: c.type,
        date: c.date,
        content: c.content,
        consultantName: c.consultantName,
        migratedFrom: c.migratedFrom,
      })),
    });
  } catch (error) {
    if (productionClient) await productionClient.close();
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
