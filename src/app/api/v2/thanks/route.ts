// src/app/api/v2/thanks/route.ts
// ⚠️ DEPRECATED: 이 API는 더 이상 사용되지 않습니다.
// 감사인사 기능은 소개관리(referrals_v2)의 thanksSent 필드로 통합되었습니다.
// 기존 데이터 호환성을 위해 유지하지만, 신규 기능은 /api/v2/referrals를 사용하세요.

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { createThanksSchema } from '@/lib/validations/schemas';

export type ThanksStatus = 'pending' | 'completed';

export interface Thanks {
  _id?: ObjectId;
  referrerId: string;
  referredId: string;
  status: ThanksStatus;
  note?: string;
  referredAt: Date;
  completedAt?: Date;
  completedMethod?: 'call' | 'message';
  createdAt: string;
}

// GET - 감사인사 목록 조회
export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ThanksStatus | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');

    const { db } = await connectToDatabase();

    // 필터 조건
    const filter: Record<string, unknown> = { clinicId };
    if (status) {
      filter.status = status;
    }

    // 목록 조회 with 환자 정보 조인
    const thanks = await db.collection<Thanks>('thanks')
      .aggregate([
        { $match: filter },
        { $sort: { referredAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: 'patients_v2',
            let: { referrerId: { $toObjectId: '$referrerId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$referrerId'] } } },
              { $project: { name: 1, phone: 1 } }
            ],
            as: 'referrer'
          }
        },
        { $unwind: { path: '$referrer', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'patients_v2',
            let: { referredId: { $toObjectId: '$referredId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$referredId'] } } },
              { $project: { name: 1, phone: 1 } }
            ],
            as: 'referred'
          }
        },
        { $unwind: { path: '$referred', preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    // 검색 필터링 (환자명, 전화번호)
    let filteredThanks = thanks;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredThanks = thanks.filter(t => {
        const referrer = t as any;
        return (
          referrer.referrer?.name?.toLowerCase().includes(searchLower) ||
          referrer.referrer?.phone?.includes(search) ||
          referrer.referred?.name?.toLowerCase().includes(searchLower) ||
          referrer.referred?.phone?.includes(search)
        );
      });
    }

    // 통계
    const pendingCount = await db.collection('thanks').countDocuments({ clinicId, status: 'pending' });
    const completedCount = await db.collection('thanks').countDocuments({ clinicId, status: 'completed' });
    const totalCount = await db.collection('thanks').countDocuments(filter);

    return NextResponse.json({
      success: true,
      deprecated: true,
      deprecationMessage: '이 API는 더 이상 사용되지 않습니다. /api/v2/referrals를 사용하세요.',
      data: {
        thanks: filteredThanks.map(t => {
          const item = t as any;
          return {
            id: t._id?.toString(),
            referrerId: t.referrerId,
            referrerName: item.referrer?.name || '알 수 없음',
            referrerPhone: item.referrer?.phone || '',
            referredId: t.referredId,
            referredName: item.referred?.name || '알 수 없음',
            referredPhone: item.referred?.phone || '',
            status: t.status,
            note: t.note,
            referredAt: t.referredAt,
            completedAt: t.completedAt,
            completedMethod: t.completedMethod,
          };
        }),
        stats: {
          pending: pendingCount,
          completed: completedCount,
          total: pendingCount + completedCount,
        },
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Thanks API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 감사인사 생성
export async function POST(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const body = await request.json();
    const validation = validateBody(createThanksSchema, body);
    if (!validation.success) return validation.response;
    const { referrerId, referredId, note, referredAt } = validation.data;

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const newThanks: Thanks & { clinicId: string } = {
      clinicId,
      referrerId,
      referredId,
      status: 'pending',
      note,
      referredAt: referredAt ? new Date(referredAt) : new Date(),
      createdAt: now,
    };

    const result = await db.collection('thanks').insertOne(newThanks);

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...newThanks,
      },
    });
  } catch (error) {
    console.error('[Thanks API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - 상태 업데이트 (완료 처리)
export async function PATCH(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const body = await request.json();
    const { id, status, method, note } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (status) updateData.status = status;
    if (method) updateData.completedMethod = method;
    if (note !== undefined) updateData.note = note;

    if (status === 'completed') {
      updateData.completedAt = now;
    }

    const result = await db.collection('thanks').findOneAndUpdate(
      { _id: new ObjectId(id), clinicId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Thanks not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Thanks API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
