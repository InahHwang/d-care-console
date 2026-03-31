// src/app/api/v2/migrate/map-treatment-categories/route.ts
// 1회성 마이그레이션: 기존 치료 과목에 parentCategory 매핑 + "미분류" 시스템 항목 추가

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

// MVP 치과 기본 매핑: 치료 과목 id → 대분류(interestedServices label)
const DEFAULT_MAPPING: Record<string, string> = {
  implant: '단일 임플란트',     // 임플란트 → 단일 임플란트 대분류
  orthodontics: '',             // 치아교정 → 매핑 없음 (관심 분야에 교정 없음)
  prosthetics: '',              // 보철치료 → 매핑 없음
  gum: '',                      // 잇몸치료 → 매핑 없음
  cosmetic: '라미네이트',       // 심미치료 → 라미네이트 대분류
  cavity: '충치치료',           // 충치치료 → 충치치료 대분류
  scaling: '',                  // 스케일링 → 매핑 없음
  general: '',                  // 일반진료 → 매핑 없음
  other: '기타',                // 기타 → 기타 대분류
};

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    const settings = await db.collection('settings').findOne({ type: 'categories' });
    if (!settings?.treatmentTypes) {
      return NextResponse.json(
        { success: false, error: 'settings에 treatmentTypes가 없습니다.' },
        { status: 404 }
      );
    }

    const treatmentTypes = settings.treatmentTypes;
    let mappedCount = 0;

    // 1. 기존 치료 과목에 parentCategory 매핑
    const updatedTypes = treatmentTypes.map((item: any) => {
      // 이미 parentCategory가 있으면 스킵
      if (item.parentCategory) return item;

      const mapping = DEFAULT_MAPPING[item.id];
      if (mapping) {
        mappedCount++;
        return { ...item, parentCategory: mapping };
      }
      return item;
    });

    // 2. "미분류" 시스템 항목 1개 추가 (없으면)
    const hasUncategorized = updatedTypes.some((t: any) => t.id === 'uncategorized');
    if (!hasUncategorized) {
      updatedTypes.push({
        id: 'uncategorized',
        label: '미분류',
        isDefault: false,
        isActive: true,
        isSystem: true,
      });
    }

    // 3. 기존 대분류별 "미분류 (XXX)" 항목 제거 (이전 버전에서 생성된 것)
    const cleanedTypes = updatedTypes.filter((t: any) =>
      !(t.isSystem && t.id.startsWith('uncategorized_'))
    );

    // 4. DB 업데이트
    await db.collection('settings').updateOne(
      { type: 'categories' },
      {
        $set: {
          treatmentTypes: cleanedTypes,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: '치료 과목 대분류 매핑 완료',
      mappedCount,
      removedOldUncategorized: updatedTypes.length - cleanedTypes.length,
      totalTreatmentTypes: cleanedTypes.length,
    });
  } catch (error) {
    console.error('치료 과목 매핑 마이그레이션 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
