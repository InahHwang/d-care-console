// src/components/v2/marketing/MarketingTargetModal.tsx
// 이벤트 타겟 지정/수정 모달

'use client';

import React, { useState, useEffect } from 'react';
import { X, Target, Trash2 } from 'lucide-react';
import {
  MarketingInfo,
  MarketingTargetReason,
  MARKETING_TARGET_REASON_OPTIONS,
} from '@/types/v2';

interface MarketingTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  existingInfo?: MarketingInfo | null;
  onSave: () => void;
  consultantName?: string;
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

export function MarketingTargetModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  existingInfo,
  onSave,
  consultantName,
}: MarketingTargetModalProps) {
  const [reason, setReason] = useState<MarketingTargetReason>('price_hesitation');
  const [customReason, setCustomReason] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditMode = !!existingInfo?.isTarget;

  // 모달 열릴 때 기존 데이터로 초기화
  useEffect(() => {
    if (isOpen) {
      if (existingInfo?.isTarget) {
        setReason(existingInfo.targetReason || 'price_hesitation');
        setCustomReason(existingInfo.customReason || '');
        setCategories(existingInfo.categories || []);
        setScheduledDate(existingInfo.scheduledDate || '');
        setNote(existingInfo.note || '');
      } else {
        setReason('price_hesitation');
        setCustomReason('');
        setCategories([]);
        setScheduledDate('');
        setNote('');
      }
    }
  }, [isOpen, existingInfo]);

  if (!isOpen) return null;

  const handleCategoryToggle = (category: string) => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = async () => {
    if (!reason) {
      alert('타겟 사유를 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/v2/patients/${patientId}/marketing-target`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetReason: reason,
          customReason: reason === 'other' ? customReason : undefined,
          categories,
          scheduledDate: scheduledDate || undefined,
          note: note || undefined,
          createdBy: consultantName,
        }),
      });

      if (!response.ok) {
        throw new Error('저장 실패');
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('마케팅 타겟 저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('이벤트 타겟에서 해제하시겠습니까?')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/v2/patients/${patientId}/marketing-target`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('삭제 실패');
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('마케팅 타겟 해제 실패:', error);
      alert('해제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-blue-50">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                이벤트 타겟 {isEditMode ? '수정' : '지정'}
              </h2>
              <p className="text-sm text-gray-500">{patientName} 환자</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-5">
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
                  onClick={() => setReason(option.value)}
                  className={`px-3 py-2.5 text-sm rounded-lg border transition-colors text-left ${
                    reason === option.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* 기타 사유 입력 */}
            {reason === 'other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
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
                    categories.includes(category)
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
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="추가 메모를 입력하세요"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
          <div>
            {isEditMode && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? '해제 중...' : '타겟 해제'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '저장 중...' : isEditMode ? '수정' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketingTargetModal;
