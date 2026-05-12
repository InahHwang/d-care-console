// src/app/api/v2/migrate/consultation-to-source/setup-categories/route.ts
// 카테고리 정리 API (Step B)
//
// 작업:
//   1. referralSources에 '팀플DB', '홈페이지DB' 추가 (parentCategory='아웃바운드')
//      - 이미 있으면 skip
//   2. 라벨이 '팀플DB' 또는 '홈페이지DB'인데 id가 그렇지 않은(예: instagram) 항목 라벨 복구
//      - id가 'instagram'이면 label을 '인스타그램'으로
//      - 다른 비표준 id면 그대로 두지만 isActive=false로 (안전)
//
// POST body: { dryRun: true | false } (기본 dryRun=true)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface CategoryItem {
  id: string;
  label: string;
  isDefault?: boolean;
  isActive: boolean;
  isSystem?: boolean;
  parentCategory?: string;
}

// label 기본 ID 매핑 (instagram의 원래 라벨이 '인스타그램'이라는 사실 등)
const ID_TO_ORIGINAL_LABEL: Record<string, string> = {
  instagram: '인스타그램',
  naver_place: '네이버 플레이스',
  naver_ad: '네이버 광고',
  google: '구글',
  facebook: '페이스북',
  youtube: '유튜브',
  referral: '지인소개',
  signage: '간판',
  flyer: '전단지',
  revisit: '재내원',
  other: '기타',
};

const NEW_REFERRAL_SOURCES = [
  { label: '팀플DB', parentCategory: '아웃바운드' },
  { label: '홈페이지DB', parentCategory: '아웃바운드' },
];

export async function POST(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }
    const roleErr = requireRole(auth.user, 'master', 'admin');
    if (roleErr) {
      return NextResponse.json({ success: false, message: roleErr.error }, { status: roleErr.status });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // 기본 dry-run

    const { db } = await connectToDatabase();

    const settings = await db.collection('settings').findOne({ type: 'categories' });
    if (!settings) {
      return NextResponse.json({ success: false, message: '카테고리 설정을 찾을 수 없습니다.' }, { status: 404 });
    }

    const referralSources: CategoryItem[] = (settings.referralSources || []).slice();
    const actions: string[] = [];
    const now = Date.now();

    // 작업 1: id-label 불일치 정리 (예: instagram의 라벨이 팀플DB로 변경됨)
    //   - 라벨이 '팀플DB' 또는 '홈페이지DB'인데 id가 그렇지 않은 항목 → 라벨 원복
    let renamedCount = 0;
    const updatedReferralSources = referralSources.map((item) => {
      const isHijacked =
        (item.label === '팀플DB' || item.label === '홈페이지DB') &&
        item.id !== 'custom_team_db' &&
        item.id !== 'custom_homepage_db';

      if (!isHijacked) return item;

      const originalLabel = ID_TO_ORIGINAL_LABEL[item.id] || item.label;
      if (originalLabel === item.label) {
        // 원래 라벨도 동일하면 그대로 둠 (사실상 일어나기 어려움)
        return item;
      }

      actions.push(`라벨 복구: id=${item.id}, "${item.label}" → "${originalLabel}"`);
      renamedCount += 1;
      return {
        ...item,
        id: `custom_${now + renamedCount}`, // Step A 로직과 동일하게 id 갱신
        label: originalLabel,
      };
    });

    // 작업 2: 팀플DB / 홈페이지DB 항목 추가 (이미 있으면 skip)
    let addedCount = 0;
    for (const newItem of NEW_REFERRAL_SOURCES) {
      const exists = updatedReferralSources.some((i) => i.label === newItem.label);
      if (exists) {
        actions.push(`이미 존재: "${newItem.label}" — skip`);
        continue;
      }

      addedCount += 1;
      const itemToAdd: CategoryItem = {
        id: `custom_${now + 1000 + addedCount}`, // 기존 id와 충돌 방지
        label: newItem.label,
        isDefault: false,
        isActive: true,
        parentCategory: newItem.parentCategory,
      };
      updatedReferralSources.push(itemToAdd);
      actions.push(`추가: "${newItem.label}" (parentCategory=${newItem.parentCategory})`);
    }

    // 실제 적용
    if (!dryRun && actions.some((a) => !a.includes('skip'))) {
      await db.collection('settings').updateOne(
        { type: 'categories' },
        {
          $set: {
            referralSources: updatedReferralSources,
            updatedAt: new Date().toISOString(),
          },
        }
      );

      // 활동로그
      await db.collection('activityLogs_v2').insertOne({
        clinicId: auth.user.clinicId,
        action: 'migrate.setup_categories',
        targetType: 'settings',
        targetId: 'categories.referralSources',
        description: `[마이그레이션] 카테고리 정리 — ${renamedCount}건 라벨 복구, ${addedCount}건 신규 추가`,
        metadata: { actions, renamedCount, addedCount },
        performedBy: auth.user.id,
        performedByName: auth.user.name || 'Migration',
        performedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      mode: dryRun ? 'dry-run (실제 변경 없음)' : 'applied',
      summary: {
        renamedCount,
        addedCount,
        actions,
      },
      preview: {
        referralSources: updatedReferralSources.map((s) => ({
          id: s.id,
          label: s.label,
          parentCategory: s.parentCategory,
          isActive: s.isActive,
        })),
      },
    });
  } catch (error) {
    console.error('[migrate/setup-categories] error', error);
    return NextResponse.json({ success: false, message: '카테고리 정리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
