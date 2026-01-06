// src/app/api/v2/referrals/route.ts
// 소개 환자 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import type { ReferralV2 } from '@/types/v2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const thanksSent = searchParams.get('thanksSent'); // 'true' | 'false' | null

    const { db } = await connectToDatabase();

    // 필터 조건 구성
    const filter: Record<string, unknown> = {};
    if (thanksSent !== null) {
      filter.thanksSent = thanksSent === 'true';
    }

    // 소개 기록 조회 (referrer와 referred 환자 정보 조인)
    const referrals = await db.collection<ReferralV2>('referrals_v2')
      .aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
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
        {
          $lookup: {
            from: 'patients_v2',
            let: { referredId: { $toObjectId: '$referredId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$referredId'] } } },
              { $project: { name: 1, phone: 1, status: 1, interest: 1, createdAt: 1 } }
            ],
            as: 'referred'
          }
        },
        { $unwind: { path: '$referrer', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$referred', preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    // 총 개수
    const totalCount = await db.collection('referrals_v2').countDocuments(filter);

    // 통계
    const [stats] = await db.collection('referrals_v2').aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          thanksSent: { $sum: { $cond: ['$thanksSent', 1, 0] } },
          thanksPending: { $sum: { $cond: ['$thanksSent', 0, 1] } },
        }
      }
    ]).toArray();

    // 소개자별 통계 (상위 10명)
    const topReferrers = await db.collection('referrals_v2').aggregate([
      {
        $group: {
          _id: '$referrerId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'patients_v2',
          let: { referrerId: { $toObjectId: '$_id' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$referrerId'] } } },
            { $project: { name: 1, phone: 1 } }
          ],
          as: 'referrer'
        }
      },
      { $unwind: '$referrer' }
    ]).toArray();

    return NextResponse.json({
      success: true,
      data: {
        referrals: referrals.map((r) => ({
          id: r._id?.toString(),
          referrerId: r.referrerId,
          referrerName: r.referrer?.name || '알 수 없음',
          referrerPhone: r.referrer?.phone || '',
          referredId: r.referredId,
          referredName: r.referred?.name || '알 수 없음',
          referredPhone: r.referred?.phone || '',
          referredStatus: r.referred?.status || '',
          referredInterest: r.referred?.interest || '',
          referredCreatedAt: r.referred?.createdAt,
          thanksSent: r.thanksSent,
          thanksSentAt: r.thanksSentAt,
          createdAt: r.createdAt,
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        stats: {
          total: stats?.total ?? 0,
          thanksSent: stats?.thanksSent ?? 0,
          thanksPending: stats?.thanksPending ?? 0,
        },
        topReferrers: topReferrers.map((r) => ({
          id: r._id,
          name: r.referrer.name,
          phone: r.referrer.phone,
          count: r.count,
        })),
      },
    });
  } catch (error) {
    console.error('[Referrals API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 소개 관계 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referrerId, referredId } = body;

    if (!referrerId || !referredId) {
      return NextResponse.json(
        { success: false, error: 'referrerId and referredId are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 이미 등록된 관계인지 확인
    const existing = await db.collection('referrals_v2').findOne({
      referrerId,
      referredId,
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 등록된 소개 관계입니다' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const newReferral = {
      referrerId,
      referredId,
      thanksSent: false,
      createdAt: now,
    };

    const result = await db.collection('referrals_v2').insertOne(newReferral);

    // 피소개자의 referrerId 필드 업데이트
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(referredId) },
      {
        $set: {
          referrerId,
          source: '지인소개',
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...newReferral,
      },
    });
  } catch (error) {
    console.error('[Referrals API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - 감사 연락 상태 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, thanksSent } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {};

    if (thanksSent !== undefined) {
      updateData.thanksSent = thanksSent;
      if (thanksSent) {
        updateData.thanksSentAt = now;
      } else {
        updateData.thanksSentAt = null;
      }
    }

    const result = await db.collection('referrals_v2').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Referral not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Referrals API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 소개 관계 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('referrals_v2').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Referral not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Referral deleted',
    });
  } catch (error) {
    console.error('[Referrals API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
