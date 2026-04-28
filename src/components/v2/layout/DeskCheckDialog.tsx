// src/components/v2/layout/DeskCheckDialog.tsx
// 데스크(전화기 자리) 선택 다이얼로그
// - 로그인 후 하루 1회 자동 표시
// - 사이드바 "변경" 버튼으로도 호출 가능

'use client';

import React, { useEffect, useState } from 'react';
import { Phone, X } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';
import { useAppDispatch } from '@/hooks/reduxHooks';
import { updateUserInfo } from '@/store/slices/authSlice';
import { DESK_OPTIONS, NO_DESK_VALUE } from '@/constants/desks';

interface DeskCheckDialogProps {
  open: boolean;
  onClose: () => void;
  initialDeskNumber?: string; // 기본 선택값 (마지막 자리)
  /** true면 X 버튼으로 닫기 차단 (자동 표시 시 강제 선택) */
  forceSelect?: boolean;
}

export function DeskCheckDialog({ open, onClose, initialDeskNumber, forceSelect }: DeskCheckDialogProps) {
  const dispatch = useAppDispatch();
  const [selected, setSelected] = useState<string>(initialDeskNumber ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(initialDeskNumber ?? '');
      setError(null);
    }
  }, [open, initialDeskNumber]);

  if (!open) return null;

  const handleSubmit = async (deskNumber: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/v2/users/me/desk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deskNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || '저장에 실패했습니다.');
      }
      // Redux user 정보 갱신
      dispatch(updateUserInfo({
        currentDeskNumber: deskNumber || undefined,
        currentDeskUpdatedAt: data.data.currentDeskUpdatedAt,
      }));
      onClose();
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Phone size={20} className="text-orange-500" />
            <h3 className="font-bold text-gray-900">오늘 사용할 자리를 선택해주세요</h3>
          </div>
          {!forceSelect && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-700 rounded"
              title="닫기"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* 본문 */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 mb-4">
            선택한 자리(전화번호)로 들어오는 통화는 자동으로 본인 등록 환자로 잡힙니다.
          </p>

          <div className="space-y-2">
            {DESK_OPTIONS.map((desk) => (
              <button
                key={desk.number}
                disabled={submitting}
                onClick={() => setSelected(desk.number)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
                  selected === desk.number
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                } disabled:opacity-50`}
              >
                <Phone size={18} className={selected === desk.number ? 'text-orange-500' : 'text-gray-400'} />
                <span className={`font-medium ${selected === desk.number ? 'text-orange-700' : 'text-gray-700'}`}>
                  {desk.display}
                </span>
              </button>
            ))}

            {/* 자리 없이 시작 */}
            <button
              disabled={submitting}
              onClick={() => setSelected(NO_DESK_VALUE)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
                selected === NO_DESK_VALUE
                  ? 'border-gray-400 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              } disabled:opacity-50`}
            >
              <span className="text-gray-500 text-sm">자리 없이 시작 (자동 매핑 비활성)</span>
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* 액션 */}
        <div className="px-6 pb-5 pt-1">
          <button
            disabled={submitting}
            onClick={() => handleSubmit(selected)}
            className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60"
          >
            {submitting ? '저장 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeskCheckDialog;
