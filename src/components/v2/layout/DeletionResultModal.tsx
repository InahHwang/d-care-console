// src/components/v2/layout/DeletionResultModal.tsx
// 삭제 요청 결과 알림 — 요청자(매니저)에게 승인/반려 결과를 로그인 시 알린다.
// 읽기 전용. 확인 시 서버에 ack 기록되어 다시 뜨지 않는다.

'use client';

import React from 'react';
import { CheckCircle2, XCircle, Bell } from 'lucide-react';
import type { DeletionResultItem } from '@/hooks/useDeletionResults';

interface DeletionResultModalProps {
  open: boolean;
  onClose: () => void;
  results: DeletionResultItem[];
}

export function DeletionResultModal({ open, onClose, results }: DeletionResultModalProps) {
  if (!open || results.length === 0) return null;

  const targetLabel = (r: DeletionResultItem) =>
    r.type === 'journey'
      ? `${r.patientName} — ${r.journeyLabel || '여정'} (여정)`
      : `${r.patientName} (환자)`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Bell size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">삭제 요청 결과</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              요청하신 삭제 건의 처리 결과입니다.
            </p>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {results.map((r) => {
            const approved = r.status === 'approved';
            return (
              <div
                key={r.id}
                className={`p-3 rounded-xl border ${
                  approved ? 'border-green-100 bg-green-50/60' : 'border-red-100 bg-red-50/60'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {approved ? (
                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-600 flex-shrink-0" />
                  )}
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                      approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {approved ? '승인 (삭제 완료)' : '반려'}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">{targetLabel(r)}</span>
                </div>

                {/* 반려 사유 */}
                {!approved && r.rejectReason && (
                  <p className="text-sm text-red-700 ml-6">
                    사유: {r.rejectReason}
                  </p>
                )}
                {!approved && !r.rejectReason && (
                  <p className="text-sm text-gray-500 ml-6">사유: (미입력)</p>
                )}

                {r.reviewedByName && (
                  <p className="mt-1 text-xs text-gray-400 ml-6">처리: {r.reviewedByName}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 text-white bg-gray-800 rounded-xl hover:bg-gray-900 transition-colors font-medium"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeletionResultModal;
