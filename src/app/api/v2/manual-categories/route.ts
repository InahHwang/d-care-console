// src/app/api/v2/manual-categories/route.ts
// 매뉴얼 카테고리 CRUD API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { ManualCategory, DEFAULT_MANUAL_CATEGORIES } from '@/types/v2/manual';

const COLLECTION = 'manual_categories_v2';

// 카테고리 목록 조회
export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const clinicId = 'default';

    let categories = await db
      .collection<ManualCategory>(COLLECTION)
      .find({ clinicId })
      .sort({ order: 1 })
      .toArray();

    // 카테고리가 없으면 기본 카테고리 생성
    if (categories.length === 0) {
      const now = new Date().toISOString();
      const defaultCategories = DEFAULT_MANUAL_CATEGORIES.map((cat) => ({
        clinicId,
        name: cat.name,
        order: cat.order,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));

      await db.collection(COLLECTION).insertMany(defaultCategories);
      categories = await db
        .collection<ManualCategory>(COLLECTION)
        .find({ clinicId })
        .sort({ order: 1 })
        .toArray();
    }

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('[ManualCategories API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 카테고리 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, order } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: '카테고리명은 필수입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const clinicId = 'default';
    const now = new Date().toISOString();

    // 마지막 순서 조회
    const lastCategory = await db
      .collection<ManualCategory>(COLLECTION)
      .findOne({ clinicId }, { sort: { order: -1 } });

    const newCategory = {
      clinicId,
      name: name.trim(),
      order: order ?? (lastCategory?.order ?? 0) + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(COLLECTION).insertOne(newCategory);

    return NextResponse.json({
      success: true,
      data: { ...newCategory, _id: result.insertedId },
    });
  } catch (error) {
    console.error('[ManualCategories API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 카테고리 수정
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, order, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '카테고리 ID는 필수입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (name !== undefined) updateData.name = name.trim();
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;

    const result = await db.collection<ManualCategory>(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '카테고리를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[ManualCategories API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 카테고리 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '카테고리 ID는 필수입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 해당 카테고리의 매뉴얼이 있는지 확인
    const manualsCount = await db
      .collection('manuals_v2')
      .countDocuments({ categoryId: id });

    if (manualsCount > 0) {
      return NextResponse.json(
        { success: false, error: `이 카테고리에 ${manualsCount}개의 매뉴얼이 있습니다. 먼저 매뉴얼을 삭제하거나 이동해주세요.` },
        { status: 400 }
      );
    }

    const result = await db
      .collection(COLLECTION)
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: '카테고리를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '카테고리가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('[ManualCategories API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
