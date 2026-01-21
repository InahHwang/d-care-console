// src/app/api/v2/manuals/[id]/route.ts
// 개별 매뉴얼 상세/수정/삭제 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { Manual } from '@/types/v2/manual';

const COLLECTION = 'manuals_v2';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 매뉴얼 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 매뉴얼 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const manual = await db
      .collection<Manual>(COLLECTION)
      .findOne({ _id: new ObjectId(id) });

    if (!manual) {
      return NextResponse.json(
        { success: false, error: '매뉴얼을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 카테고리명 조회
    const category = await db
      .collection('manual_categories_v2')
      .findOne({ _id: new ObjectId(manual.categoryId) });

    return NextResponse.json({
      success: true,
      data: {
        ...manual,
        categoryName: category?.name || '미분류',
      },
    });
  } catch (error) {
    console.error('[Manuals API] GET 상세 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 매뉴얼 수정
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 매뉴얼 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { categoryId, title, keywords, script, shortScript, isActive, order } = body;

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = { updatedAt: now };

    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (title !== undefined) updateData.title = title.trim();
    if (keywords !== undefined) {
      updateData.keywords = Array.isArray(keywords)
        ? keywords.map((k: string) => k.trim())
        : [];
    }
    if (script !== undefined) updateData.script = script.trim();
    if (shortScript !== undefined) updateData.shortScript = shortScript.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (order !== undefined) updateData.order = order;

    const result = await db.collection<Manual>(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '매뉴얼을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Manuals API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 매뉴얼 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 매뉴얼 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const result = await db
      .collection(COLLECTION)
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: '매뉴얼을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '매뉴얼이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('[Manuals API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
