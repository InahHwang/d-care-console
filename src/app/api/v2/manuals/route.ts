// src/app/api/v2/manuals/route.ts
// 상담 매뉴얼 목록 조회 및 생성 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { Manual, ManualCategory } from '@/types/v2/manual';

const COLLECTION = 'manuals_v2';

// 매뉴얼 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const keyword = searchParams.get('keyword');
    const isActive = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const { db } = await connectToDatabase();
    const clinicId = 'default';

    // 쿼리 빌드
    const query: Record<string, unknown> = { clinicId };

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (isActive !== null && isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (keyword) {
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { keywords: { $regex: keyword, $options: 'i' } },
        { script: { $regex: keyword, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    // 매뉴얼 조회
    const [manuals, total] = await Promise.all([
      db
        .collection<Manual>(COLLECTION)
        .find(query)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection<Manual>(COLLECTION).countDocuments(query),
    ]);

    // 카테고리 정보 조회 (조인)
    const categoryIds = Array.from(new Set(manuals.map((m) => m.categoryId)));
    const categories = await db
      .collection<ManualCategory>('manual_categories_v2')
      .find({ _id: { $in: categoryIds.map((id) => {
        try {
          const { ObjectId } = require('mongodb');
          return new ObjectId(id);
        } catch {
          return id;
        }
      }) } })
      .toArray();

    const categoryMap = new Map(
      categories.map((c) => [c._id?.toString(), c.name])
    );

    // 카테고리명 추가
    const manualsWithCategory = manuals.map((m) => ({
      ...m,
      categoryName: categoryMap.get(m.categoryId) || '미분류',
    }));

    return NextResponse.json({
      success: true,
      data: manualsWithCategory,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[Manuals API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 매뉴얼 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId, title, keywords, script, shortScript, order } = body;

    // 유효성 검사
    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: '카테고리를 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, error: '매뉴얼 제목은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!script || typeof script !== 'string') {
      return NextResponse.json(
        { success: false, error: '매뉴얼 스크립트는 필수입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const clinicId = 'default';
    const now = new Date().toISOString();

    // 마지막 순서 조회
    const lastManual = await db
      .collection<Manual>(COLLECTION)
      .findOne({ clinicId, categoryId }, { sort: { order: -1 } });

    const newManual = {
      clinicId,
      categoryId,
      title: title.trim(),
      keywords: Array.isArray(keywords) ? keywords.map((k: string) => k.trim()) : [],
      script: script.trim(),
      shortScript: shortScript?.trim() || '',
      isActive: true,
      order: order ?? (lastManual?.order ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(COLLECTION).insertOne(newManual);

    return NextResponse.json({
      success: true,
      data: { ...newManual, _id: result.insertedId },
    });
  } catch (error) {
    console.error('[Manuals API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
