// src/components/v2/marketing/MarketingTargetCheckbox.tsx
// 상담 결과 입력 시 이벤트 타겟 지정 체크박스

'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Target } from 'lucide-react';
import {
  MarketingTargetReason,
  MARKETING_TARGET_REASON_OPTIONS,
} from '@/types/v2';

export interface MarketingTargetData {
  reason: MarketingTargetReason;
  customReason?: string;
  categories: string[];
  scheduledDate?: string;
  note?: string;
}

interface MarketingTargetCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  targetData: MarketingTargetData;
  onTargetDataChange: (data: MarketingTargetData) => void;
}

// 기본 이벤트 카테고리 옵션
const DEFAULT_CATEGORY_OPTIONS = [
  '임플란트 이벤트',
  '교정 이벤트',
  '보철 이벤트',
  '정기 프로모션',
  '시즌 이벤트',
  '기타',
];

export function MarketingTargetCheckbox({
  checked,
  onChange,
  targetData,
  onTargetDataChange,
}: MarketingTargetCheckboxProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCheckChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newChecked = e.target.checked;
    onChange(newChecked);
    if (newChecked && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const handleReasonChange = (reason: MarketingTargetReason) => {
    onTargetDataChange({
      ...targetData,
      reason,
      customReason: reason === 'other' ? targetData.customReason : undefined,
    });
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = targetData.categories.includes(category)
      ? targetData.categories.filter((c) => c !== category)
      : [...targetData.categories, category];
    onTargetDataChange({
      ...targetData,
      categories: newCategories,
    });
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/50 overflow-hidden">
      {/* 헤더: 체크박스 + 토글 */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-100/50 transition-colors"
        onClick={() => checked && setIsExpanded(!isExpanded)}
      >
        <label className="flex items-center gap-3 cursor-pointer flex-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={handleCheckChange}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <Target size={18} className="text-blue-600" />
          <span className="font-medium text-gray-700">
            이벤트 타겟으로 지정
          </span>
        </label>
        {checked && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-blue-200 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>
        )}
      </div>

      {/* 확장 영역: 상세 입력 폼 */}
      {checked && isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-blue-200 space-y-4">
          {/* 타겟 사유 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              타겟 사유 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MARKETING_TARGET_REASON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleReasonChange(option.value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                    targetData.reason === option.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* 기타 사유 입력 */}
            {targetData.reason === 'other' && (
              <input
                type="text"
                value={targetData.customReason || ''}
                onChange={(e) =>
                  onTargetDataChange({
                    ...targetData,
                    customReason: e.target.value,
                  })
                }
                placeholder="기타 사유를 입력하세요"
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* 이벤트 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이벤트 카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryToggle(category)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    targetData.categories.includes(category)
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* 발송 예정일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              발송 예정일
            </label>
            <input
              type="date"
              value={targetData.scheduledDate || ''}
              onChange={(e) =>
                onTargetDataChange({
                  ...targetData,
                  scheduledDate: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모
            </label>
            <textarea
              value={targetData.note || ''}
              onChange={(e) =>
                onTargetDataChange({
                  ...targetData,
                  note: e.target.value,
                })
              }
              placeholder="추가 메모를 입력하세요"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketingTargetCheckbox;
