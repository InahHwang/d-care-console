// src/hooks/useCategories.ts
// 카테고리 설정을 가져오는 커스텀 훅

import { useQuery } from '@tanstack/react-query';

export interface CategoryItem {
  id: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface Categories {
  consultationTypes: CategoryItem[];
  referralSources: CategoryItem[];
  interestedServices: CategoryItem[];
}

// 기본 카테고리 값들 (API 실패 시 폴백)
const DEFAULT_CATEGORIES: Categories = {
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

// 카테고리 데이터 fetch 함수
const fetchCategories = async (): Promise<Categories> => {
  const response = await fetch('/api/settings/categories');

  if (!response.ok) {
    throw new Error('카테고리를 불러오는데 실패했습니다.');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || '카테고리를 불러오는데 실패했습니다.');
  }

  return data.categories;
};

// 카테고리 훅
export function useCategories() {
  const query = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
    retry: 2,
  });

  // 활성화된 항목만 필터링하여 반환
  const getActiveItems = (items: CategoryItem[] | undefined): CategoryItem[] => {
    if (!items) return [];
    return items.filter(item => item.isActive);
  };

  // select 옵션 형식으로 변환
  const toSelectOptions = (items: CategoryItem[] | undefined): { value: string; label: string }[] => {
    return getActiveItems(items).map(item => ({
      value: item.id,
      label: item.label,
    }));
  };

  return {
    // 원본 데이터
    categories: query.data || DEFAULT_CATEGORIES,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,

    // 활성화된 항목만 가져오기
    activeConsultationTypes: getActiveItems(query.data?.consultationTypes || DEFAULT_CATEGORIES.consultationTypes),
    activeReferralSources: getActiveItems(query.data?.referralSources || DEFAULT_CATEGORIES.referralSources),
    activeInterestedServices: getActiveItems(query.data?.interestedServices || DEFAULT_CATEGORIES.interestedServices),

    // select 옵션 형식
    consultationTypeOptions: toSelectOptions(query.data?.consultationTypes || DEFAULT_CATEGORIES.consultationTypes),
    referralSourceOptions: [
      { value: '', label: '선택 안함' },
      ...toSelectOptions(query.data?.referralSources || DEFAULT_CATEGORIES.referralSources),
    ],
    interestedServiceOptions: toSelectOptions(query.data?.interestedServices || DEFAULT_CATEGORIES.interestedServices),

    // 유틸리티
    getActiveItems,
    toSelectOptions,
  };
}
