// src/app/api/v2/patients/[id]/journeys/route.ts
// 환자 여정(Journey) 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { Journey, PatientStatus } from '@/types/v2';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { createJourneySchema } from '@/lib/validations/schemas';

export const dynamic = 'force-dynamic';

// GET: 환자의 모든 여정 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const patient = await db.collection('patients_v2').findOne(
      { _id: new ObjectId(id) },
      { projection: { journeys: 1, activeJourneyId: 1 } }
    );

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json({
      journeys: patient.journeys || [],
      activeJourneyId: patient.activeJourneyId || null,
    });
  } catch (error) {
    console.error('Error fetching journeys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journeys' },
      { status: 500 }
    );
  }
}

// POST: 새 여정 시작 (구신환)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const body = await request.json();
    const validation = validateBody(createJourneySchema, body);
    if (!validation.success) return validation.response;
    const { treatmentType, estimatedAmount, changedBy } = validation.data;

    const { db } = await connectToDatabase();

    // 환자 존재 확인
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(id),
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const now = new Date();
    const journeyId = new ObjectId().toString();

    // 새 여정 생성
    const newJourney: Journey = {
      id: journeyId,
      treatmentType,
      status: 'consulting' as PatientStatus,
      startedAt: now,
      estimatedAmount: estimatedAmount ? Math.round(Number(estimatedAmount)) : undefined,
      paymentStatus: 'none',
      statusHistory: [{
        from: 'consulting' as PatientStatus,
        to: 'consulting' as PatientStatus,
        eventDate: now,
        changedAt: now,
        changedBy: changedBy || '시스템',
      }],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // 기존 활성 여정 비활성화 + 새 여정 추가 + 환자 상태 업데이트
    const updateResult = await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(id) },
      [
        {
          $set: {
            // 기존 여정들의 isActive를 false로
            journeys: {
              $map: {
                input: { $ifNull: ['$journeys', []] },
                as: 'j',
                in: {
                  $mergeObjects: ['$$j', { isActive: false, updatedAt: now }]
                }
              }
            }
          }
        },
        {
          $set: {
            // 새 여정 추가
            journeys: {
              $concatArrays: ['$journeys', [newJourney]]
            },
            // 활성 여정 ID 업데이트
            activeJourneyId: journeyId,
            // 환자 기본 상태도 업데이트 (하위 호환성)
            status: 'consulting',
            statusChangedAt: now,
            // 금액 초기화 (새 여정)
            estimatedAmount: estimatedAmount ? Math.round(Number(estimatedAmount)) : null,
            actualAmount: null,
            paymentStatus: 'none',
            treatmentNote: null,
            // 관심 시술 업데이트
            interest: treatmentType,
            'aiAnalysis.interest': treatmentType,
            updatedAt: now,
          }
        }
      ]
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Failed to create journey' }, { status: 500 });
    }

    console.log(`[Journey] 새 여정 생성: 환자=${patient.name}, 치료=${treatmentType}, journeyId=${journeyId}`);

    return NextResponse.json({
      success: true,
      journeyId,
      message: `새 여정이 시작되었습니다: ${treatmentType}`,
    });
  } catch (error) {
    console.error('Error creating journey:', error);
    return NextResponse.json(
      { error: 'Failed to create journey' },
      { status: 500 }
    );
  }
}
