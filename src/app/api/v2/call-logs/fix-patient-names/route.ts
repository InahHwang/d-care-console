// src/app/api/v2/call-logs/fix-patient-names/route.ts
// 발신 통화기록에 환자 이름이 없는 경우 환자 정보에서 가져와 채움

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { db } = await connectToDatabase();

    // patientId가 있지만 aiAnalysis.patientName이 없는 통화 찾기
    const callsNeedingNames = await db.collection('callLogs_v2').find({
      patientId: { $exists: true, $ne: null },
      $or: [
        { 'aiAnalysis.patientName': { $exists: false } },
        { 'aiAnalysis.patientName': null },
        { 'aiAnalysis.patientName': '' },
        { aiAnalysis: null }
      ]
    }).toArray();

    console.log(`[Fix Patient Names] 수정할 통화: ${callsNeedingNames.length}건`);

    if (callsNeedingNames.length === 0) {
      return NextResponse.json({
        success: true,
        message: '수정할 통화가 없습니다.',
        fixed: 0
      });
    }

    let fixedCount = 0;
    const results: { callLogId: string; patientName: string }[] = [];

    for (const call of callsNeedingNames) {
      try {
        // 환자 정보 조회
        if (!ObjectId.isValid(call.patientId)) continue;

        const patient = await db.collection('patients_v2').findOne({
          _id: new ObjectId(call.patientId)
        });

        if (patient?.name) {
          // 통화기록에 환자 이름 추가
          await db.collection('callLogs_v2').updateOne(
            { _id: call._id },
            [
              {
                $set: {
                  aiAnalysis: {
                    $mergeObjects: [
                      { $ifNull: ['$aiAnalysis', {}] },
                      { patientName: patient.name }
                    ]
                  },
                  updatedAt: new Date().toISOString()
                }
              }
            ]
          );

          fixedCount++;
          results.push({
            callLogId: call._id.toString(),
            patientName: patient.name
          });
        }
      } catch (err) {
        console.error(`[Fix Patient Names] 오류 (${call._id}):`, err);
      }
    }

    console.log(`[Fix Patient Names] ${fixedCount}건 수정됨`);

    return NextResponse.json({
      success: true,
      message: `${fixedCount}건의 통화에 환자 이름이 추가되었습니다.`,
      fixed: fixedCount,
      found: callsNeedingNames.length,
      results
    });

  } catch (error) {
    console.error('[Fix Patient Names] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET으로 현재 상태 확인
export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { db } = await connectToDatabase();

    // patientId가 있지만 이름이 없는 통화 수
    const needsFix = await db.collection('callLogs_v2').countDocuments({
      patientId: { $exists: true, $ne: null },
      $or: [
        { 'aiAnalysis.patientName': { $exists: false } },
        { 'aiAnalysis.patientName': null },
        { 'aiAnalysis.patientName': '' },
        { aiAnalysis: null }
      ]
    });

    return NextResponse.json({
      needsFix
    });

  } catch (error) {
    console.error('[Fix Patient Names GET] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
