// src/app/api/v2/call-logs/migrate-classifications/route.ts
// 기존 신환/구신환/구환/부재중 분류를 환자로 마이그레이션하는 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { db } = await connectToDatabase();
    const collection = db.collection('callLogs_v2');

    // 신환, 구신환, 구환을 환자로 변경
    const patientResult = await collection.updateMany(
      {
        clinicId,
        'aiAnalysis.classification': { $in: ['신환', '구신환', '구환'] }
      },
      {
        $set: {
          'aiAnalysis.classification': '환자',
          'aiAnalysis.migratedAt': new Date().toISOString(),
          'aiAnalysis.migratedFrom': 'patient-types'
        }
      }
    );

    // 부재중 분류 제거 (분류 자체를 기타로 변경하고, duration으로 부재중 판단)
    const missedResult = await collection.updateMany(
      {
        clinicId,
        'aiAnalysis.classification': '부재중'
      },
      {
        $set: {
          'aiAnalysis.classification': '기타',
          'aiAnalysis.migratedAt': new Date().toISOString(),
          'aiAnalysis.migratedFrom': 'missed-call'
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: '마이그레이션 완료',
      results: {
        patientTypesUpdated: patientResult.modifiedCount,
        missedCallsUpdated: missedResult.modifiedCount
      }
    });
  } catch (error) {
    console.error('마이그레이션 오류:', error);
    return NextResponse.json(
      { error: '마이그레이션 실패' },
      { status: 500 }
    );
  }
}
