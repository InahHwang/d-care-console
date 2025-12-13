// src/app/api/referrals/route.ts
// 소개환자 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// 소개 상태 타입
export type ReferralStatus = 'registered' | 'visited' | 'treating' | 'completed';

// 소개 기록 인터페이스
export interface Referral {
  _id?: ObjectId;
  referrerId: string;          // 소개자 환자 ID
  referrerName: string;        // 소개자 이름 (조회 편의)
  referrerPhone: string;       // 소개자 전화번호
  referredId: string;          // 피소개자 환자 ID
  referredName: string;        // 피소개자 이름
  referredPhone: string;       // 피소개자 전화번호
  referralDate: string;        // 소개 등록일
  referredStatus: ReferralStatus; // 피소개자 상태
  treatmentType?: string;      // 진료 유형
  thanksSent: boolean;         // 감사인사 전달 여부
  thanksSentDate?: string;     // 감사인사 전달일
  nextVisitAlert: boolean;     // 다음 내원 시 알림 여부
  alertMessage?: string;       // 알림 메시지
  notes?: string;              // 메모
  createdAt: string;
  updatedAt: string;
}

// GET - 소개 기록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'list' | 'stats' | 'ranking' | 'detail'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const thanksSent = searchParams.get('thanksSent'); // 'true' | 'false' | null (전체)
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const referrerId = searchParams.get('referrerId'); // 특정 소개자의 소개 목록

    const { db } = await connectToDatabase();

    // 통계 조회
    if (type === 'stats') {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthStr = thisMonth.toISOString();

      // 전체 소개 건수
      const totalReferrals = await db.collection('referrals').countDocuments();

      // 이번달 소개 건수
      const monthReferrals = await db.collection('referrals').countDocuments({
        referralDate: { $gte: thisMonthStr }
      });

      // 감사인사 미전달 건수
      const pendingThanks = await db.collection('referrals').countDocuments({
        thanksSent: false
      });

      // 총 소개자 수 (중복 제거)
      const uniqueReferrers = await db.collection('referrals').distinct('referrerId');

      return NextResponse.json({
        success: true,
        data: {
          totalReferrals,
          monthReferrals,
          pendingThanks,
          totalReferrers: uniqueReferrers.length
        }
      });
    }

    // 소개왕 랭킹
    if (type === 'ranking') {
      const rankingLimit = parseInt(searchParams.get('limit') || '10');

      const ranking = await db.collection('referrals').aggregate([
        {
          $group: {
            _id: '$referrerId',
            referrerName: { $first: '$referrerName' },
            referrerPhone: { $first: '$referrerPhone' },
            count: { $sum: 1 },
            lastReferralDate: { $max: '$referralDate' }
          }
        },
        { $sort: { count: -1, lastReferralDate: -1 } },
        { $limit: rankingLimit }
      ]).toArray();

      return NextResponse.json({
        success: true,
        data: ranking
      });
    }

    // 특정 소개자의 소개 상세
    if (type === 'detail' && referrerId) {
      const referrals = await db.collection('referrals')
        .find({ referrerId })
        .sort({ referralDate: -1 })
        .toArray();

      // 소개자 정보
      const referrer = referrals.length > 0 ? {
        id: referrerId,
        name: referrals[0].referrerName,
        phone: referrals[0].referrerPhone,
        totalReferrals: referrals.length,
        pendingThanks: referrals.filter(r => !r.thanksSent).length
      } : null;

      return NextResponse.json({
        success: true,
        data: {
          referrer,
          referrals
        }
      });
    }

    // 기본: 소개 기록 목록 조회
    const filter: any = {};

    if (thanksSent === 'true') {
      filter.thanksSent = true;
    } else if (thanksSent === 'false') {
      filter.thanksSent = false;
    }

    if (startDate || endDate) {
      filter.referralDate = {};
      if (startDate) filter.referralDate.$gte = startDate;
      if (endDate) filter.referralDate.$lte = endDate + 'T23:59:59.999Z';
    }

    if (search) {
      filter.$or = [
        { referrerName: { $regex: search, $options: 'i' } },
        { referredName: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await db.collection('referrals').countDocuments(filter);
    const referrals = await db.collection('referrals')
      .find(filter)
      .sort({ referralDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      data: referrals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[Referrals API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 소개 기록 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      referrerId,
      referrerName,
      referrerPhone,
      referredId,
      referredName,
      referredPhone,
      referralDate,
      referredStatus,
      treatmentType,
      notes
    } = body;

    if (!referrerId || !referredId) {
      return NextResponse.json(
        { success: false, error: 'referrerId and referredId are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 중복 체크 (같은 소개자-피소개자 쌍)
    const existing = await db.collection('referrals').findOne({
      referrerId,
      referredId
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 등록된 소개 기록입니다.' },
        { status: 400 }
      );
    }

    const newReferral: Referral = {
      referrerId,
      referrerName: referrerName || '',
      referrerPhone: referrerPhone || '',
      referredId,
      referredName: referredName || '',
      referredPhone: referredPhone || '',
      referralDate: referralDate || now,
      referredStatus: referredStatus || 'registered',
      treatmentType,
      thanksSent: false,
      nextVisitAlert: true, // 기본적으로 알림 활성화
      alertMessage: `${referredName || '환자'} 소개해주신 분입니다. 감사인사 전달해주세요.`,
      notes,
      createdAt: now,
      updatedAt: now
    };

    const result = await db.collection('referrals').insertOne(newReferral);

    return NextResponse.json({
      success: true,
      message: 'Referral created',
      data: { ...newReferral, _id: result.insertedId }
    });

  } catch (error) {
    console.error('[Referrals API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - 소개 기록 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 감사인사 완료 처리
    if (action === 'markThanksSent') {
      const result = await db.collection('referrals').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            thanksSent: true,
            thanksSentDate: now,
            nextVisitAlert: false, // 알림 비활성화
            updatedAt: now
          }
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json(
          { success: false, error: 'Referral not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Thanks sent marked'
      });
    }

    // 알림 메시지 설정
    if (action === 'setAlert') {
      const { alertMessage, nextVisitAlert } = body;

      const result = await db.collection('referrals').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            alertMessage,
            nextVisitAlert: nextVisitAlert ?? true,
            updatedAt: now
          }
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json(
          { success: false, error: 'Referral not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Alert updated'
      });
    }

    // 일반 업데이트
    const result = await db.collection('referrals').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updateData,
          updatedAt: now
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Referral not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Referral updated'
    });

  } catch (error) {
    console.error('[Referrals API] PUT 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 소개 기록 삭제
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

    const result = await db.collection('referrals').deleteOne({
      _id: new ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Referral not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Referral deleted'
    });

  } catch (error) {
    console.error('[Referrals API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
