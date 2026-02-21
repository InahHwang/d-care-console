// src/app/api/v2/migrate/fix-treatment-nextdate/route.ts
// "치료중"(treatment) 상태 환자들의 nextActionDate를 null로 수정

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { MongoClient, Db } from 'mongodb';

export const dynamic = 'force-dynamic';

// 프로덕션 DB 직접 연결 함수
async function connectToProductionDb(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI || '';
  if (!uri) {
    throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('d-care-db');
  console.log('✅ 프로덕션 DB (d-care-db) 연결됨');

  return { client, db };
}

// GET: 미리보기
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

    const v2Collection = db.collection('patients_v2');

    // "treatment" 상태이면서 nextActionDate가 있는 환자들 조회
    const treatmentPatientsWithDate = await v2Collection.find({
      status: 'treatment',
      nextActionDate: { $ne: null, $exists: true }
    }).toArray();

    const samples = treatmentPatientsWithDate.slice(0, 10).map(p => ({
      name: p.name,
      phone: p.phone,
      status: p.status,
      nextActionDate: p.nextActionDate,
    }));

    if (productionClient) {
      await productionClient.close();
    }

    return NextResponse.json({
      success: true,
      database: useProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      count: treatmentPatientsWithDate.length,
      message: `${treatmentPatientsWithDate.length}명의 "치료중" 환자가 nextActionDate를 가지고 있습니다.`,
      samples,
    });
  } catch (error) {
    console.error('[Fix Treatment NextDate GET] Error:', error);
    if (productionClient) {
      await productionClient.close();
    }
    return NextResponse.json(
      { error: '미리보기 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: 수정 실행
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

    const v2Collection = db.collection('patients_v2');

    // "treatment" 상태 환자들의 nextActionDate를 null로 설정
    const result = await v2Collection.updateMany(
      { status: 'treatment' },
      {
        $set: {
          nextActionDate: null,
          updatedAt: new Date(),
        }
      }
    );

    if (productionClient) {
      await productionClient.close();
    }

    return NextResponse.json({
      success: true,
      database: useProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      message: '치료중 환자 nextActionDate 수정 완료',
      results: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error('[Fix Treatment NextDate POST] Error:', error);
    if (productionClient) {
      await productionClient.close();
    }
    return NextResponse.json(
      { error: '수정 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}
