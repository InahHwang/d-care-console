// src/components/v2/patients/ClosePatientModal.tsx
'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { ClosedReason, CLOSED_REASON_OPTIONS, PatientStatus, PATIENT_STATUS_CONFIG } from '@/types/v2';

interface ClosePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: ClosedReason, customReason?: string) => void;
  patientName: string;
  currentStatus: PatientStatus;
}

export function ClosePatientModal({
  isOpen,
  onClose,
  onConfirm,
  patientName,
  currentStatus,
}: ClosePatientModalProps) {
  const [selectedReason, setSelectedReason] = useState<ClosedReason | null>(null);
  const [customReason, setCustomReason] = useState('');

  if (!isOpen) return null;

  const currentStatusLabel = PATIENT_STATUS_CONFIG[currentStatus]?.label || currentStatus;

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason, selectedReason === '기타' ? customReason : undefined);
      setSelectedReason(null);
      setCustomReason('');
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setCustomReason('');
    onClose();
  };

  // 기타 선택 시 사유 입력 필요
  const isConfirmDisabled = !selectedReason || (selectedReason === '기타' && !customReason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-gray-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">환자 종결 처리</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="mb-5 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">환자 정보</p>
            <p className="font-medium text-gray-900">{patientName}</p>
            <p className="text-sm text-gray-500 mt-2">
              현재 상태: <span className="font-medium text-gray-700">{currentStatusLabel}</span>
            </p>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-3">종결 사유를 선택해주세요</p>
            <div className="space-y-2">
              {CLOSED_REASON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedReason(option.value)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    selectedReason === option.value
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`font-medium ${
                    selectedReason === option.value ? 'text-gray-900' : 'text-gray-700'
                  }`}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>

            {/* 기타 선택 시 직접 입력 */}
            {selectedReason === '기타' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="종결 사유를 입력해주세요"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors"
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-700">
            <p>종결 처리된 환자는 기본 목록에서 숨겨지며, 종결 환자 탭에서 확인할 수 있습니다.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-3 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="flex-1 px-4 py-3 text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            종결 처리
          </button>
        </div>
      </div>
    </div>
  );
}
