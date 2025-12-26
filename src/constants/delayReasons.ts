// 미룸 사유 카테고리 정의

export interface DelayReasonOption {
  value: string;
  label: string;
}

export interface DelayReasonCategory {
  id: string;
  label: string;
  icon: string;
  options: DelayReasonOption[];
}

export const DELAY_REASON_CATEGORIES: DelayReasonCategory[] = [
  {
    id: 'price',
    label: '가격/비용',
    icon: '💰',
    options: [
      { value: 'budget_exceeded', label: '예산 초과' },
      { value: 'expensive_vs_others', label: '타 병원 대비 비쌈' },
      { value: 'installment_mismatch', label: '분납/할부 조건 안 맞음' },
      { value: 'no_budget_now', label: '당장 여유가 안 됨' },
    ],
  },
  {
    id: 'treatment',
    label: '치료 계획',
    icon: '🦷',
    options: [
      { value: 'plan_disagreement', label: '치료 계획 이견 (타 병원과 다름)' },
      { value: 'treatment_rejection', label: '제안 치료 거부 (임플란트→틀니 등)' },
      { value: 'over_treatment_concern', label: '치료 범위 과다 (과잉진료 우려)' },
      { value: 'duration_burden', label: '치료 기간 부담' },
    ],
  },
  {
    id: 'pending',
    label: '결정 보류',
    icon: '⏳',
    options: [
      { value: 'family_discussion', label: '가족 상의 필요' },
      { value: 'comparing_others', label: '타 병원 비교 중' },
      { value: 'need_more_info', label: '추가 상담/정보 필요' },
      { value: 'just_inquiry', label: '단순 정보 문의' },
    ],
  },
  {
    id: 'etc',
    label: '기타',
    icon: '📋',
    options: [
      { value: 'schedule_issue', label: '일정 조율 어려움' },
      { value: 'treatment_anxiety', label: '치료 두려움/불안' },
      { value: 'other', label: '기타' },
    ],
  },
];

// 모든 사유를 flat하게 가져오기
export const getAllDelayReasons = (): DelayReasonOption[] => {
  return DELAY_REASON_CATEGORIES.flatMap(category => category.options);
};

// value로 label 찾기
export const getDelayReasonLabel = (value: string | null | undefined): string => {
  if (!value) return '';
  const allReasons = getAllDelayReasons();
  const found = allReasons.find(r => r.value === value);
  return found?.label || value;
};

// value로 카테고리 찾기
export const getDelayReasonCategory = (value: string | null | undefined): DelayReasonCategory | null => {
  if (!value) return null;
  return DELAY_REASON_CATEGORIES.find(category =>
    category.options.some(option => option.value === value)
  ) || null;
};

// 카테고리 아이콘과 함께 label 반환
export const getDelayReasonWithIcon = (value: string | null | undefined): string => {
  if (!value) return '';
  const category = getDelayReasonCategory(value);
  const label = getDelayReasonLabel(value);
  if (category) {
    return `${category.icon} ${label}`;
  }
  return label;
};
