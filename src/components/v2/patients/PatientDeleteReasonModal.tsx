// src/components/v2/patients/PatientDeleteReasonModal.tsx
'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Trash2, Send } from 'lucide-react';

interface PatientDeleteReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  patientName: string;
  // 재사용 확장 (모두 선택 — 미지정 시 기존 "환자 즉시 삭제" 동작)
  mode?: 'delete' | 'request';            // request: 관리자 승인 대기 흐름
  title?: string;                          // 헤더 제목
  targetName?: string;                     // "삭제 대상" 표시명 (기본: patientName)
  warningTitle?: string;
  warningBody?: string;
  confirmLabel?: string;
  submittingLabel?: string;
}

export function PatientDeleteReasonModal({
  isOpen,
  onClose,
  onConfirm,
  patientName,
  mode = 'delete',
  title,
  targetName,
  warningTitle,
  warningBody,
  confirmLabel,
  submittingLabel,
}: PatientDeleteReasonModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const isRequest = mode === 'request';

  // 모드별 기본 문구
  const resolvedTitle = title ?? (isRequest ? '삭제 요청' : '환자 삭제');
  const resolvedWarningTitle =
    warningTitle ?? (isRequest ? '관리자 승인 후 삭제됩니다.' : '삭제하면 복원할 수 없습니다.');
  const resolvedWarningBody =
    warningBody ??
    '환자 정보와 함께 통화기록, 콜백, 상담내역, 채널 대화, 리콜 메시지가 모두 영구 삭제됩니다.';
  const resolvedConfirmLabel = confirmLabel ?? (isRequest ? '삭제 요청' : '삭제하기');
  const resolvedSubmittingLabel = submittingLabel ?? (isRequest ? '요청 중...' : '삭제 중...');

  const trimmed = reason.trim();
  const isDisabled = trimmed.length < 2 || submitting;

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    onClose();
  };

  const handleConfirm = async () => {
    if (isDisabled) return;
    try {
      setSubmitting(true);
      await onConfirm(trimmed);
      setReason('');
    } finally {
      setSubmitting(false);
    }
  };

  // 색상 테마 (request=amber, delete=red)
  const accent = isRequest
    ? { iconBg: 'bg-amber-100', iconText: 'text-amber-600', warnBg: 'bg-amber-50', warnBorder: 'border-amber-200', warnText: 'text-amber-700', warnSub: 'text-amber-600/90', btn: 'bg-amber-600 hover:bg-amber-700' }
    : { iconBg: 'bg-red-100', iconText: 'text-red-600', warnBg: 'bg-red-50', warnBorder: 'border-red-200', warnText: 'text-red-700', warnSub: 'text-red-600/90', btn: 'bg-red-600 hover:bg-red-700' };

  const HeaderIcon = isRequest ? Send : Trash2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${accent.iconBg} flex items-center justify-center`}>
              <HeaderIcon size={20} className={accent.iconText} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{resolvedTitle}</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="mb-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">삭제 대상</p>
            <p className="font-medium text-gray-900">{targetName ?? patientName}</p>
          </div>

          {/* 경고 */}
          <div className={`mb-5 p-4 ${accent.warnBg} border ${accent.warnBorder} rounded-xl`}>
            <div className="flex gap-2">
              <AlertTriangle size={18} className={`${accent.iconText} flex-shrink-0 mt-0.5`} />
              <div className={`text-sm ${accent.warnText} leading-relaxed`}>
                <p className="font-semibold mb-1">{resolvedWarningTitle}</p>
                <p className={accent.warnSub}>{resolvedWarningBody}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isRequest ? '요청 사유' : '삭제 사유'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="사유를 입력해주세요 (예: 중복 등록, 환자 요청, 테스트 데이터 등)"
              rows={4}
              autoFocus
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors resize-none text-sm"
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              입력한 사유는 활동 로그에 기록되어 관리자가 확인할 수 있습니다. ({trimmed.length}/500)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t bg-gray-50">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 px-4 py-3 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDisabled}
            className={`flex-1 px-4 py-3 text-white ${accent.btn} rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {submitting ? resolvedSubmittingLabel : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
