// src/utils/categoryUtils.ts
import { MessageCategory, EventCategory } from '@/types/messageLog'

// 카테고리 ID를 표시명으로 변환하는 함수
export const getCategoryDisplayName = (
  categoryId: string, 
  categories: MessageCategory[]
): string => {
  const category = categories.find(cat => cat.name === categoryId);
  return category?.displayName || categoryId;
};

// 템플릿에서 고유한 카테고리 목록 추출
export const getUniqueCategoriesFromTemplates = (templates: any[]): EventCategory[] => {
  const uniqueCategories = new Set<string>();
  
  templates.forEach(template => {
    if (template.category && typeof template.category === 'string') {
      uniqueCategories.add(template.category);
    }
  });
  
  return Array.from(uniqueCategories);
};

// 카테고리 목록을 라벨과 함께 반환하는 함수
export const getEventCategoryOptions = (
  templates: any[] = [], 
  categories: MessageCategory[] = []
) => {
  // 템플릿에서 사용된 카테고리 추출
  const templateCategories = getUniqueCategoriesFromTemplates(templates);
  
  // 카테고리 옵션 생성
  const categoryOptions: { value: string; label: string }[] = [];
  
  // 설정된 카테고리가 있는 경우 우선 사용
  if (categories.length > 0) {
    categories.forEach(category => {
      if (category.isActive) {
        categoryOptions.push({
          value: category.name,
          label: category.displayName
        });
      }
    });
  } else {
    // 카테고리 설정이 없으면 템플릿에서 추출한 카테고리 사용
    templateCategories.forEach(categoryId => {
      // 기본 카테고리 라벨 매핑 (호환성 위해)
      const defaultLabelMap: Record<string, string> = {
        'discount': '할인/프로모션',
        'new_treatment': '신규 치료법 안내',
        'checkup': '정기 검진 리마인더',
        'seasonal': '계절 이벤트',
      };
      
      categoryOptions.push({
        value: categoryId,
        label: defaultLabelMap[categoryId] || categoryId
      });
    });
  }
  
  // 정렬 (기본 카테고리 우선, 나머지는 알파벳순)
  const defaultOrder = ['discount', 'new_treatment', 'checkup', 'seasonal'];
  return categoryOptions.sort((a, b) => {
    const aIndex = defaultOrder.indexOf(a.value);
    const bIndex = defaultOrder.indexOf(b.value);
    
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    return a.label.localeCompare(b.label);
  });
};

// 카테고리 색상 반환 함수
export const getCategoryColor = (
  categoryId: string, 
  categories: MessageCategory[]
): string => {
  const category = categories.find(cat => cat.name === categoryId);
  return category?.color || 'bg-gray-100 text-gray-800';
};