// src/app/api/settings/categories/route.ts
// 카테고리 설정 API - 상담타입, 유입경로, 관심분야 관리

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

// 기본 카테고리 값들
const DEFAULT_CATEGORIES = {
  consultationTypes: [
    { id: 'inbound', label: '인바운드', isDefault: true, isActive: true },
    { id: 'outbound', label: '아웃바운드', isDefault: true, isActive: true },
    { id: 'returning', label: '구신환', isDefault: true, isActive: true },
  ],
  referralSources: [
    { id: 'naver_place', label: '네이버 플레이스', isDefault: true, isActive: true },
    { id: 'naver_ad', label: '네이버 광고', isDefault: true, isActive: true },
    { id: 'google', label: '구글', isDefault: true, isActive: true },
    { id: 'instagram', label: '인스타그램', isDefault: true, isActive: true },
    { id: 'facebook', label: '페이스북', isDefault: true, isActive: true },
    { id: 'youtube', label: '유튜브', isDefault: true, isActive: true },
    { id: 'referral', label: '지인소개', isDefault: true, isActive: true },
    { id: 'signage', label: '간판', isDefault: true, isActive: true },
    { id: 'flyer', label: '전단지', isDefault: true, isActive: true },
    { id: 'revisit', label: '재내원', isDefault: true, isActive: true },
    { id: 'other', label: '기타', isDefault: true, isActive: true },
  ],
  interestedServices: [
    { id: 'single_implant', label: '단일 임플란트', isDefault: true, isActive: true },
    { id: 'multiple_implant', label: '다수 임플란트', isDefault: true, isActive: true },
    { id: 'full_implant', label: '무치악 임플란트', isDefault: true, isActive: true },
    { id: 'denture', label: '틀니', isDefault: true, isActive: true },
    { id: 'laminate', label: '라미네이트', isDefault: true, isActive: true },
    { id: 'cavity', label: '충치치료', isDefault: true, isActive: true },
    { id: 'other', label: '기타', isDefault: true, isActive: true },
  ],
};

// GET: 카테고리 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    // settings 컬렉션에서 categories 문서 조회
    let categories: any = await db.collection('settings').findOne({ type: 'categories' });

    // 없으면 기본값으로 생성
    if (!categories) {
      const newCategories = {
        type: 'categories',
        ...DEFAULT_CATEGORIES,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('settings').insertOne(newCategories);
      categories = newCategories;
    }

    return NextResponse.json({
      success: true,
      categories: {
        consultationTypes: categories?.consultationTypes || DEFAULT_CATEGORIES.consultationTypes,
        referralSources: categories?.referralSources || DEFAULT_CATEGORIES.referralSources,
        interestedServices: categories?.interestedServices || DEFAULT_CATEGORIES.interestedServices,
      },
    });
  } catch (error) {
    console.error('카테고리 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '카테고리를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 카테고리 업데이트
export async function PUT(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    const { categoryType, categories } = body;

    if (!categoryType || !categories) {
      return NextResponse.json(
        { success: false, error: '카테고리 타입과 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 유효한 카테고리 타입인지 확인
    const validTypes = ['consultationTypes', 'referralSources', 'interestedServices'];
    if (!validTypes.includes(categoryType)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 카테고리 타입입니다.' },
        { status: 400 }
      );
    }

    // 업데이트
    const updateResult = await db.collection('settings').updateOne(
      { type: 'categories' },
      {
        $set: {
          [categoryType]: categories,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    console.log(`카테고리 업데이트: ${categoryType}`, categories.length, '개');

    return NextResponse.json({
      success: true,
      message: '카테고리가 업데이트되었습니다.',
      categoryType,
      count: categories.length,
    });
  } catch (error) {
    console.error('카테고리 업데이트 오류:', error);
    return NextResponse.json(
      { success: false, error: '카테고리 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 카테고리 항목 추가
export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    const { categoryType, item } = body;

    if (!categoryType || !item || !item.label) {
      return NextResponse.json(
        { success: false, error: '카테고리 타입과 항목 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    // 유효한 카테고리 타입인지 확인
    const validTypes = ['consultationTypes', 'referralSources', 'interestedServices'];
    if (!validTypes.includes(categoryType)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 카테고리 타입입니다.' },
        { status: 400 }
      );
    }

    // 새 항목 생성
    const newItem = {
      id: item.id || `custom_${Date.now()}`,
      label: item.label,
      isDefault: false,
      isActive: true,
    };

    // 배열에 추가
    const updateResult = await db.collection('settings').updateOne(
      { type: 'categories' },
      {
        $push: { [categoryType]: newItem } as any,
        $set: { updatedAt: new Date().toISOString() },
      },
      { upsert: true }
    );

    console.log(`새 카테고리 항목 추가: ${categoryType} - ${newItem.label}`);

    return NextResponse.json({
      success: true,
      message: '카테고리 항목이 추가되었습니다.',
      item: newItem,
    });
  } catch (error) {
    console.error('카테고리 항목 추가 오류:', error);
    return NextResponse.json(
      { success: false, error: '카테고리 항목 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 카테고리 항목 삭제 (기본 항목은 삭제 불가, 비활성화만 가능)
export async function DELETE(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const categoryType = searchParams.get('categoryType');
    const itemId = searchParams.get('itemId');

    if (!categoryType || !itemId) {
      return NextResponse.json(
        { success: false, error: '카테고리 타입과 항목 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 현재 카테고리 조회
    const settings = await db.collection('settings').findOne({ type: 'categories' });
    if (!settings || !settings[categoryType]) {
      return NextResponse.json(
        { success: false, error: '카테고리를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const items = settings[categoryType];
    const itemIndex = items.findIndex((item: any) => item.id === itemId);

    if (itemIndex === -1) {
      return NextResponse.json(
        { success: false, error: '항목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const item = items[itemIndex];

    // 기본 항목은 삭제 불가, 비활성화만
    if (item.isDefault) {
      items[itemIndex].isActive = false;
    } else {
      // 커스텀 항목은 완전 삭제
      items.splice(itemIndex, 1);
    }

    // 업데이트
    await db.collection('settings').updateOne(
      { type: 'categories' },
      {
        $set: {
          [categoryType]: items,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    console.log(`카테고리 항목 ${item.isDefault ? '비활성화' : '삭제'}: ${categoryType} - ${itemId}`);

    return NextResponse.json({
      success: true,
      message: item.isDefault ? '기본 항목이 비활성화되었습니다.' : '항목이 삭제되었습니다.',
      wasDefault: item.isDefault,
    });
  } catch (error) {
    console.error('카테고리 항목 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '카테고리 항목 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
