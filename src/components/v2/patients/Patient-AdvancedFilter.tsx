// src/components/v2/patients/Patient-AdvancedFilter.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

export interface AdvancedFilterValues {
  consultationType: string;
  hasCoaching: boolean;
  paymentStatus: string;
  interest: string;
  region: string;
}

const EMPTY_FILTERS: AdvancedFilterValues = {
  consultationType: '',
  hasCoaching: false,
  paymentStatus: '',
  interest: '',
  region: '',
};

interface PatientAdvancedFilterProps {
  values: AdvancedFilterValues;
  onChange: (values: AdvancedFilterValues) => void;
  consultationTypeMap: Record<string, string>;
  treatmentTypeMap: Record<string, string>;
}

const DEFAULT_CONSULTATION_TYPES: { id: string; label: string }[] = [
  { id: 'inbound', label: '인바운드' },
  { id: 'outbound', label: '아웃바운드' },
  { id: 'returning', label: '구신환' },
];

const PAYMENT_OPTIONS = [
  { id: 'none', label: '미수' },
  { id: 'partial', label: '부분납부' },
  { id: 'completed', label: '완납' },
];

const REGION_OPTIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

function getActiveFilterCount(values: AdvancedFilterValues): number {
  let count = 0;
  if (values.consultationType) count++;
  if (values.hasCoaching) count++;
  if (values.paymentStatus) count++;
  if (values.interest) count++;
  if (values.region) count++;
  return count;
}

const DEFAULT_TREATMENT_TYPES: { id: string; label: string }[] = [
  { id: 'implant', label: '임플란트' },
  { id: 'orthodontics', label: '치아교정' },
  { id: 'prosthetics', label: '보철치료' },
  { id: 'gum', label: '잇몸치료' },
  { id: 'cosmetic', label: '심미치료' },
];

export function PatientAdvancedFilter({ values, onChange, consultationTypeMap, treatmentTypeMap }: PatientAdvancedFilterProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<AdvancedFilterValues>(values);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 외부 값 변경 시 로컬 동기화
  useEffect(() => {
    setLocal(values);
  }, [values]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setLocal(values); // 닫을 때 미적용 변경 되돌리기
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, values]);

  const activeCount = getActiveFilterCount(values);

  // 상담타입 목록: 설정에서 가져온 값 우선, 없으면 기본값
  const consultationTypes = Object.keys(consultationTypeMap).length > 0
    ? Object.entries(consultationTypeMap).map(([id, label]) => ({ id, label }))
    : DEFAULT_CONSULTATION_TYPES;

  // 치료과목 목록: 설정에서 가져온 값 우선, 없으면 기본값
  const treatmentTypes = Object.keys(treatmentTypeMap).length > 0
    ? Object.entries(treatmentTypeMap).map(([id, label]) => ({ id, label }))
    : DEFAULT_TREATMENT_TYPES;

  function handleChipToggle(field: 'consultationType' | 'paymentStatus' | 'region' | 'interest', id: string) {
    setLocal(prev => ({
      ...prev,
      [field]: prev[field] === id ? '' : id,
    }));
  }

  function handleApply() {
    onChange(local);
    setOpen(false);
  }

  function handleReset() {
    setLocal(EMPTY_FILTERS);
    onChange(EMPTY_FILTERS);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          activeCount > 0
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
        }`}
      >
        <SlidersHorizontal size={14} />
        필터{activeCount > 0 && ` (${activeCount})`}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-4"
        >
          {/* 상담타입 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">상담타입</p>
            <div className="flex flex-wrap gap-1.5">
              {consultationTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => handleChipToggle('consultationType', type.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    local.consultationType === type.id
                      ? 'bg-purple-100 border-purple-300 text-purple-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* 치료과목 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">치료과목</p>
            <div className="flex flex-wrap gap-1.5">
              {treatmentTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => handleChipToggle('interest', type.label)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    local.interest === type.label
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* 지역 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">지역</p>
            <div className="flex flex-wrap gap-1.5">
              {REGION_OPTIONS.map(region => (
                <button
                  key={region}
                  onClick={() => handleChipToggle('region', region)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    local.region === region
                      ? 'bg-sky-100 border-sky-300 text-sky-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          {/* AI 코칭 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">AI 코칭</p>
            <button
              onClick={() => setLocal(prev => ({ ...prev, hasCoaching: !prev.hasCoaching }))}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                local.hasCoaching
                  ? 'bg-violet-100 border-violet-300 text-violet-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              코칭 완료만
            </button>
          </div>

          {/* 결제상태 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">결제상태</p>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleChipToggle('paymentStatus', opt.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    local.paymentStatus === opt.id
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 버튼들 */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
              초기화
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
