// src/utils/treatmentTypes.ts
// 서버사이드에서 치료 과목 목록을 DB에서 가져오는 헬퍼

import { connectToDatabase } from '@/utils/mongodb';

interface CategoryItem {
  id: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
}

// DB에서 활성화된 치료 과목 라벨 목록 반환
const DEFAULT_TREATMENT_LABELS = [
  '임플란트', '치아교정', '보철치료', '잇몸치료',
  '심미치료', '충치치료', '스케일링', '일반진료', '기타',
];

export async function getActiveTreatmentTypeLabels(): Promise<string[]> {
  try {
    const { db } = await connectToDatabase();
    const settings = await db.collection('settings').findOne({ type: 'categories' });

    if (!settings?.treatmentTypes) {
      return DEFAULT_TREATMENT_LABELS;
    }

    const activeLabels = (settings.treatmentTypes as CategoryItem[])
      .filter((item) => item.isActive)
      .map((item) => item.label);

    return activeLabels.length > 0 ? activeLabels : DEFAULT_TREATMENT_LABELS;
  } catch (error) {
    console.error('치료 과목 목록 조회 오류:', error);
    return DEFAULT_TREATMENT_LABELS;
  }
}

// DB에서 활성화된 관심 분야 라벨 목록 반환
const DEFAULT_INTERESTED_SERVICE_LABELS = [
  '단일 임플란트', '다수 임플란트', '무치악 임플란트',
  '틀니', '라미네이트', '충치치료', '기타',
];

export async function getActiveInterestedServiceLabels(): Promise<string[]> {
  try {
    const { db } = await connectToDatabase();
    const settings = await db.collection('settings').findOne({ type: 'categories' });

    if (!settings?.interestedServices) {
      return DEFAULT_INTERESTED_SERVICE_LABELS;
    }

    const activeLabels = (settings.interestedServices as CategoryItem[])
      .filter((item) => item.isActive)
      .map((item) => item.label);

    return activeLabels.length > 0 ? activeLabels : DEFAULT_INTERESTED_SERVICE_LABELS;
  } catch (error) {
    console.error('관심 분야 목록 조회 오류:', error);
    return DEFAULT_INTERESTED_SERVICE_LABELS;
  }
}
