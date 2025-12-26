// src/components/common/PostponementReasonSelector.tsx
// 미룸 사유 선택 컴포넌트

'use client';

import { useState, useEffect } from 'react';
import {
  DELAY_REASON_CATEGORIES,
  getDelayReasonLabel,
  getDelayReasonCategory
} from '@/constants/delayReasons';

interface PostponementReasonSelectorProps {
  value: string | null;
  customValue?: string;
  onChange: (value: string | null, customValue?: string) => void;
  showNotConfirmedOption?: boolean;  // "아직 파악 안됨" 옵션 표시 여부
  label?: string;
  required?: boolean;
  className?: string;
}

export default function PostponementReasonSelector({
  value,
  customValue,
  onChange,
  showNotConfirmedOption = true,
  label = '미룸 사유 파악 (선택사항)',
  required = false,
  className = ''
}: PostponementReasonSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customText, setCustomText] = useState(customValue || '');

  // value가 변경되면 카테고리 자동 선택
  useEffect(() => {
    if (value) {
      const category = getDelayReasonCategory(value);
      if (category) {
        setSelectedCategory(category.id);
      }
    } else {
      setSelectedCategory(null);
    }
  }, [value]);

  useEffect(() => {
    setCustomText(customValue || '');
  }, [customValue]);

  const handleCategoryClick = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      // 같은 카테고리 클릭 시 접기
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryId);
    }
  };

  const handleReasonSelect = (reasonValue: string) => {
    if (reasonValue === 'other') {
      onChange(reasonValue, customText);
    } else {
      onChange(reasonValue, undefined);
      setCustomText('');
    }
  };

  const handleNotConfirmed = () => {
    onChange(null, undefined);
    setSelectedCategory(null);
    setCustomText('');
  };

  const handleCustomTextChange = (text: string) => {
    setCustomText(text);
    if (value === 'other') {
      onChange('other', text);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* 아직 파악 안됨 옵션 */}
      {showNotConfirmedOption && (
        <button
          type="button"
          onClick={handleNotConfirmed}
          className={`w-full px-4 py-3 text-left rounded-lg border transition-colors ${
            value === null
              ? 'bg-gray-100 border-gray-400 text-gray-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className="text-gray-500 mr-2">❓</span>
          아직 파악 안됨
        </button>
      )}

      {/* 카테고리별 사유 선택 */}
      <div className="space-y-2">
        {DELAY_REASON_CATEGORIES.map((category) => {
          const isExpanded = selectedCategory === category.id;
          const hasSelectedReason = category.options.some(opt => opt.value === value);

          return (
            <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* 카테고리 헤더 */}
              <button
                type="button"
                onClick={() => handleCategoryClick(category.id)}
                className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors ${
                  hasSelectedReason
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{category.icon}</span>
                  <span className="font-medium text-gray-800">{category.label}</span>
                  {hasSelectedReason && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2">
                      {getDelayReasonLabel(value)}
                    </span>
                  )}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 옵션 목록 */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50 p-2">
                  <div className="grid grid-cols-1 gap-1">
                    {category.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleReasonSelect(option.value)}
                        className={`w-full px-3 py-2 text-left text-sm rounded-md transition-colors ${
                          value === option.value
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-blue-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {/* 기타 선택 시 직접 입력 */}
                  {category.id === 'etc' && value === 'other' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={customText}
                        onChange={(e) => handleCustomTextChange(e.target.value)}
                        placeholder="기타 사유를 입력해주세요"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 선택된 사유 표시 (요약) */}
      {value && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <span className="text-blue-600 text-sm font-medium">선택된 사유:</span>
          <span className="text-blue-800 text-sm">
            {value === 'other' && customText
              ? `기타 - ${customText}`
              : getDelayReasonLabel(value)}
          </span>
          <button
            type="button"
            onClick={handleNotConfirmed}
            className="ml-auto text-blue-600 hover:text-blue-800 text-xs"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
