// src/app/api/v2/marketing-targets/route.ts
// 이벤트 타겟 환자 목록 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import type { MarketingTargetReason } from '@/types/v2';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 쿼리 파라미터 파싱
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const reasons = searchParams.getAll('reason') as MarketingTargetReason[];
    const categories = searchParams.getAll('category');
    const sortBy = searchParams.get('sortBy') || 'scheduledDate'; // 'name' | 'scheduledDate' | 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'asc'; // 'asc' | 'desc'

    const { db } = await connectToDatabase();

    // 기본 필터: 이벤트 타겟으로 지정된 환자만
    const filter: Record<string, unknown> = {
      'marketingInfo.isTarget': true,
    };

    // 사유 필터
    if (reasons.length > 0) {
      filter['marketingInfo.targetReason'] = { $in: reasons };
    }

    // 카테고리 필터 (OR 조건)
    if (categories.length > 0) {
      filter['marketingInfo.categories'] = { $in: categories };
    }

    // 검색 (이름 또는 전화번호)
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch } },
        { 'marketingInfo.note': { $regex: escapedSearch, $options: 'i' } },
        { 'marketingInfo.customReason': { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    // 정렬 설정
    const sortOptions: Record<string, 1 | -1> = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    switch (sortBy) {
      case 'name':
        sortOptions.name = sortDirection;
        break;
      case 'scheduledDate':
        sortOptions['marketingInfo.scheduledDate'] = sortDirection;
        // null/undefined 값을 뒤로 보내기 위해 2차 정렬
        sortOptions['marketingInfo.createdAt'] = -1;
        break;
      case 'createdAt':
      default:
        sortOptions['marketingInfo.createdAt'] = sortDirection;
        break;
    }

    // 전체 개수 조회
    const total = await db.collection('patients_v2').countDocuments(filter);

    // 페이지네이션 적용하여 조회
    const skip = (page - 1) * limit;
    const patients = await db
      .collection('patients_v2')
      .find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .project({
        _id: 1,
        name: 1,
        phone: 1,
        status: 1,
        temperature: 1,
        interest: 1,
        marketingInfo: 1,
        createdAt: 1,
      })
      .toArray();

    // 응답 포맷팅
    const formattedPatients = patients.map((p) => ({
      id: p._id.toString(),
      _id: p._id.toString(),
      name: p.name,
      phone: p.phone,
      status: p.status,
      temperature: p.temperature,
      interest: p.interest,
      marketingInfo: p.marketingInfo,
      createdAt: p.createdAt,
    }));

    // 통계 정보 계산
    const stats = await db.collection('patients_v2').aggregate([
      { $match: { 'marketingInfo.isTarget': true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byReason: {
            $push: '$marketingInfo.targetReason',
          },
        },
      },
    ]).toArray();

    const reasonCounts: Record<string, number> = {};
    if (stats.length > 0 && stats[0].byReason) {
      for (const reason of stats[0].byReason) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        patients: formattedPatients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          total: stats[0]?.total || 0,
          byReason: reasonCounts,
        },
      },
    });
  } catch (error) {
    console.error('Marketing targets GET error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 타겟 목록 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
