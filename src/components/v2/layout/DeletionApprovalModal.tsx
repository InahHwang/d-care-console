// src/components/v2/layout/DeletionApprovalModal.tsx
// 삭제 승인 팝업 — 로그인 시 자동 표시 + 사이드바 메뉴로 재오픈.
// master/admin이 매니저의 환자/여정 삭제 요청을 승인/거절한다.

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Check, X, Clock } from 'lucide-react';
import type { DeletionRequestItem } from '@/hooks/useDeletionApprovals';

interface DeletionApprovalModalProps {
  open: boolean;
  onClose: () => void;
  requests: DeletionRequestItem[];
  onApprove: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onReject: (id: string, rejectReason: string) => Promise<{ ok: boolean; error?: string }>;
}

function formatRelativeDate(iso: string): string {
  const created = new Date(iso);
  const diffMin = Math.floor((Date.now() - created.getTime()) / (60 * 1000));
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${created.getMonth() + 1}/${created.getDate()}`;
}

export function DeletionApprovalModal({
  open,
  onClose,
  requests,
  onApprove,
  onReject,
}: DeletionApprovalModalProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!open) return null;

  const handleApprove = async (req: DeletionRequestItem) => {
    const label =
      req.type === 'journey'
        ? `${req.patientName} 님의 '${req.journeyLabel || '여정'}' 여정`
        : `${req.patientName} 님`;
    if (!window.confirm(`${label}을(를) 삭제합니다. 복원할 수 없습니다. 승인하시겠습니까?`)) return;

    setBusyId(req.id);
    const result = await onApprove(req.id);
    setBusyId(null);
    if (!result.ok) alert(result.error || '승인에 실패했습니다.');
  };

  const handleReject = async (req: DeletionRequestItem) => {
    const rejectReason = window.prompt('거절 사유를 입력해주세요. (선택)', '');
    if (rejectReason === null) return; // 취소

    setBusyId(req.id);
    const result = await onReject(req.id, rejectReason);
    setBusyId(null);
    if (!result.ok) alert(result.error || '거절에 실패했습니다.');
  };

  const goToPatient = (patientId: string) => {
    onClose();
    router.push(`/v2/patients/${patientId}`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 size={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">삭제 승인 대기</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                매니저가 요청한 삭제 건입니다. 승인 시 즉시 삭제됩니다.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-auto p-4">
          {requests.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              승인 대기 중인 삭제 요청이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-1.5 mb-0.5 text-sm">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        req.type === 'journey'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {req.type === 'journey' ? '여정' : '환자'}
                    </span>
                    <button
                      onClick={() => goToPatient(req.patientId)}
                      className="font-bold text-gray-900 hover:underline truncate"
                    >
                      {req.patientName}
                    </button>
                    {req.type === 'journey' && req.journeyLabel && (
                      <span className="text-xs text-gray-500 truncate">· {req.journeyLabel}</span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                      <Clock size={11} />
                      {formatRelativeDate(req.requestedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{req.reason}</p>
                  <p className="mt-1 text-xs text-gray-400">요청: {req.requestedByName}</p>

                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={busyId === req.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <Check size={15} />
                      승인 (삭제)
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      disabled={busyId === req.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <X size={15} />
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeletionApprovalModal;
