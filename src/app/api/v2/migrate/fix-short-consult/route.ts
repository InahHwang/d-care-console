// src/app/api/v2/migrate/fix-short-consult/route.ts
// 내용이 짧은 상담이력을 V1의 실제 상담내용으로 업데이트

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

// V1에서 실제 상담 내용 추출
function getFullConsultationContent(v1Patient: any): string | null {
  // 1순위: consultation.consultationNotes (가장 상세한 상담 내용)
  if (v1Patient.consultation?.consultationNotes) {
    const notes = v1Patient.consultation.consultationNotes.trim();
    const plan = v1Patient.consultation.treatmentPlan?.trim();
    if (notes.length > 20) {  // 의미있는 내용인 경우
      if (plan && plan.length > 0) {
        return `${notes}\n\n[치료계획] ${plan}`;
      }
      return notes;
    }
  }

  // 2순위: 첫 번째 콜백의 상세 상담 내용
  if (v1Patient.callbackHistory && v1Patient.callbackHistory.length > 0) {
    const firstCallback = v1Patient.callbackHistory[0];
    if (firstCallback.consultationRecord?.consultationContent) {
      const content = firstCallback.consultationRecord.consultationContent.trim();
      if (content.length > 20) return content;
    }
    if (firstCallback.firstConsultationResult?.consultationContent) {
      const content = firstCallback.firstConsultationResult.consultationContent.trim();
      if (content.length > 20) return content;
    }
  }

  // 3순위: notes 필드
  if (v1Patient.notes && v1Patient.notes.trim().length > 20) {
    return v1Patient.notes.trim();
  }

  return null;
}

// GET: 짧은 상담이력 미리보기
export async function GET(request: NextRequest) {
  let productionClient: MongoClient | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const useProduction = searchParams.get('production') === 'true';
    const minLength = parseInt(searchParams.get('minLength') || '50'); // 이 길이 이하면 "짧음"으로 판단

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
    const manualCollection = db.collection('manualConsultations_v2');

    // 마이그레이션된 phone 타입 상담이력 중 내용이 짧은 것 찾기
    const shortConsults = await manualCollection.find({
      migratedFrom: 'v1',
      type: 'phone',
      $expr: { $lte: [{ $strLenCP: '$content' }, minLength] }
    }).toArray();

    const candidates: any[] = [];

    for (const consult of shortConsults) {
      // V2 환자 ID로 V1 환자 찾기
      const v2Patient = await db.collection('patients_v2').findOne({
        _id: new (require('mongodb').ObjectId)(consult.patientId)
      });

      if (!v2Patient) continue;

      // V1 환자 찾기
      const v1Patient = await v1Collection.findOne({ phoneNumber: v2Patient.phone });
      if (!v1Patient) continue;

      // V1에 더 긴 상담 내용이 있는지 확인
      const fullContent = getFullConsultationContent(v1Patient);
      if (fullContent && fullContent.length > consult.content.length) {
        candidates.push({
          name: v1Patient.name,
          phone: v1Patient.phoneNumber,
          consultId: consult._id.toString(),
          currentContent: consult.content.substring(0, 50) + (consult.content.length > 50 ? '...' : ''),
          currentLength: consult.content.length,
          newContentPreview: fullContent.substring(0, 100) + (fullContent.length > 100 ? '...' : ''),
          newLength: fullContent.length,
        });
      }
    }

    if (productionClient) await productionClient.close();

    return NextResponse.json({
      success: true,
      database: useProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      totalShortConsults: shortConsults.length,
      candidatesForUpdate: candidates.length,
      samples: candidates.slice(0, 15),
    });
  } catch (error) {
    if (productionClient) await productionClient.close();
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// POST: 짧은 상담이력 업데이트
export async function POST(request: NextRequest) {
  let productionClient: MongoClient | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const useProduction = searchParams.get('production') === 'true';
    const minLength = parseInt(searchParams.get('minLength') || '50');

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
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // 마이그레이션된 phone 타입 상담이력 중 내용이 짧은 것 찾기
    const shortConsults = await manualCollection.find({
      migratedFrom: 'v1',
      type: 'phone',
      $expr: { $lte: [{ $strLenCP: '$content' }, minLength] }
    }).toArray();

    for (const consult of shortConsults) {
      try {
        // V2 환자 찾기
        const v2Patient = await v2Collection.findOne({
          _id: new (require('mongodb').ObjectId)(consult.patientId)
        });

        if (!v2Patient) {
          skipped++;
          continue;
        }

        // V1 환자 찾기
        const v1Patient = await v1Collection.findOne({ phoneNumber: v2Patient.phone });
        if (!v1Patient) {
          skipped++;
          continue;
        }

        // V1에서 더 긴 상담 내용 가져오기
        const fullContent = getFullConsultationContent(v1Patient);
        if (!fullContent || fullContent.length <= consult.content.length) {
          skipped++;
          continue;
        }

        // 상담이력 업데이트
        await manualCollection.updateOne(
          { _id: consult._id },
          {
            $set: {
              content: fullContent,
              date: v1Patient.consultation?.consultationDate
                ? new Date(v1Patient.consultation.consultationDate)
                : consult.date,
              updatedAt: now,
              fixedAt: now,
              previousContent: consult.content, // 이전 내용 백업
            }
          }
        );

        updated++;
      } catch (err) {
        errors.push(`${consult.patientId}: ${(err as Error).message}`);
      }
    }

    if (productionClient) await productionClient.close();

    return NextResponse.json({
      success: true,
      database: useProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      results: {
        totalShortConsults: shortConsults.length,
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
