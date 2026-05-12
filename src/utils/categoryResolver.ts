// src/utils/categoryResolver.ts
// 카테고리 id → label 자동 변환 가드
// 환자 등록/수정 시 외부에서 id 형식이 들어와도 시스템 일관성 유지

import type { Db } from 'mongodb';

type CategoryField = 'consultationTypes' | 'referralSources' | 'interestedServices' | 'treatmentTypes';

interface CategoryItem {
  id: string;
  label: string;
  isActive?: boolean;
}

/**
 * 값이 카테고리의 id이면 label로 변환, 이미 label이거나 알 수 없으면 그대로 반환.
 * 환자 데이터는 label로 저장되는 것이 시스템 규약이므로
 * 외부 임포트/마이그레이션 등으로 id가 들어와도 강제 변환.
 *
 * @param db MongoDB 인스턴스
 * @param value 변환할 값 (id 또는 label)
 * @param field 어떤 카테고리에서 찾을지
 * @returns label 문자열 (빈 값이면 '')
 */
export async function resolveCategoryLabel(
  db: Db,
  value: string | null | undefined,
  field: CategoryField
): Promise<string> {
  if (!value || typeof value !== 'string') return '';

  const settings = await db.collection('settings').findOne({ type: 'categories' });
  if (!settings) return value;

  const items: CategoryItem[] = (settings[field] as CategoryItem[]) || [];

  // id 매칭 시 label 반환
  const foundById = items.find((c) => c.id === value);
  if (foundById) return foundById.label;

  // 이미 label이거나 카테고리에 없는 값 → 그대로 (자유 입력 허용)
  return value;
}
