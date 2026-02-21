// src/app/api/v2/manuals/search/route.ts
// 매뉴얼 키워드 검색 API (자동완성 및 빠른 검색용)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { Manual, ManualCategory } from '@/types/v2/manual';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

const COLLECTION = 'manuals_v2';

export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || searchParams.get('q');
    const categoryId = searchParams.get('categoryId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!keyword || keyword.length < 1) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const { db } = await connectToDatabase();
    const clinicId = authUser.clinicId;

    // 검색 쿼리 (제목, 키워드, 스크립트에서 검색)
    const query: Record<string, unknown> = {
      clinicId,
      isActive: true,
      $or: [
        { title: { $regex: keyword, $options: 'i' } },
        { keywords: { $regex: keyword, $options: 'i' } },
        { script: { $regex: keyword, $options: 'i' } },
      ],
    };

    if (categoryId) {
      query.categoryId = categoryId;
    }

    // 검색 결과 (제목 매치 우선)
    const manuals = await db
      .collection<Manual>(COLLECTION)
      .find(query)
      .sort({ order: 1 })
      .limit(limit)
      .toArray();

    // 카테고리 정보 조회
    const categoryIds = Array.from(new Set(manuals.map((m) => m.categoryId)));
    const { ObjectId } = require('mongodb');
    const categories = await db
      .collection<ManualCategory>('manual_categories_v2')
      .find({
        _id: {
          $in: categoryIds.map((id) => {
            try {
              return new ObjectId(id);
            } catch {
              return id;
            }
          }),
        },
      })
      .toArray();

    const categoryMap = new Map(
      categories.map((c) => [c._id?.toString(), c.name])
    );

    // 결과 포맷팅 (검색 결과용 간략 정보)
    const results = manuals.map((m) => ({
      _id: m._id,
      title: m.title,
      categoryId: m.categoryId,
      categoryName: categoryMap.get(m.categoryId) || '미분류',
      keywords: m.keywords,
      script: m.script,
      shortScript: m.shortScript,
      // 검색어 하이라이트를 위한 스니펫
      snippet: getSnippet(m.script, keyword, 100),
    }));

    return NextResponse.json({
      success: true,
      data: results,
      keyword,
    });
  } catch (error) {
    console.error('[Manuals Search API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 검색어 주변 텍스트 스니펫 추출
function getSnippet(text: string, keyword: string, maxLength: number): string {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);

  if (index === -1) {
    return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + keyword.length + 70);

  let snippet = text.slice(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}
