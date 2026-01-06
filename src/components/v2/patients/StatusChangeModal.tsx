// src/components/v2/patients/StatusChangeModal.tsx
'use client';

import React, { useState } from 'react';
import { X, Calendar, ArrowRight } from 'lucide-react';
import { PatientStatus } from '@/types/v2';

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: StatusChangeData) => void;
  currentStatus: PatientStatus;
  newStatus: PatientStatus;
  patientName: string;
  scheduledDate?: string; // 기존 예정일 (있으면)
}

export interface StatusChangeData {
  newStatus: PatientStatus;
  eventDate: string;
  isReservation: boolean; // true면 예약 상태, false면 완료 상태
}

const STATUS_LABELS: Record<PatientStatus, string> = {
  consulting: '전화상담',
  reserved: '내원예약',
  visited: '내원완료',
  treatmentBooked: '치료예약',
  treatment: '치료중',
  completed: '치료완료',
  followup: '사후관리',
  closed: '종결',
};

const STATUS_COLORS: Record<PatientStatus, string> = {
  consulting: 'bg-blue-100 text-blue-700',
  reserved: 'bg-purple-100 text-purple-700',
  visited: 'bg-amber-100 text-amber-700',
  treatmentBooked: 'bg-teal-100 text-teal-700',
  treatment: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-green-100 text-green-700',
  followup: 'bg-slate-100 text-slate-700',
  closed: 'bg-gray-200 text-gray-600',
};

// 예약 상태 (미래 일정)
const RESERVATION_STATUSES: PatientStatus[] = ['reserved', 'treatmentBooked'];

// 상태별 날짜 라벨
const DATE_LABELS: Record<PatientStatus, string> = {
  consulting: '상담일',
  reserved: '내원예약일',
  visited: '내원일',
  treatmentBooked: '치료예약일',
  treatment: '치료시작일',
  completed: '치료완료일',
  followup: '전환일',
  closed: '종결일',
};

export function StatusChangeModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  newStatus,
  patientName,
  scheduledDate,
}: StatusChangeModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [eventDate, setEventDate] = useState(today);

  if (!isOpen) return null;

  // 예약 상태인지 확인
  const isReservation = RESERVATION_STATUSES.includes(newStatus);

  // 예정일과의 차이 계산 (완료 상태일 때만 표시)
  const getDaysDiff = () => {
    if (!scheduledDate || isReservation) return null;

    const scheduled = new Date(scheduledDate);
    const actual = new Date(eventDate);
    scheduled.setHours(0, 0, 0, 0);
    actual.setHours(0, 0, 0, 0);

    const diff = Math.round((scheduled.getTime() - actual.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return { text: '예정대로', style: 'text-green-600' };
    if (diff > 0) return { text: `예정보다 ${diff}일 빠름`, style: 'text-blue-600' };
    return { text: `예정보다 ${Math.abs(diff)}일 늦음`, style: 'text-orange-600' };
  };

  const daysDiff = getDaysDiff();

  const handleConfirm = () => {
    onConfirm({
      newStatus,
      eventDate,
      isReservation,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">상태 변경</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-5">
          {/* 환자명 */}
          <div className="text-center">
            <span className="text-gray-500">환자:</span>
            <span className="ml-2 font-medium text-gray-900">{patientName}</span>
          </div>

          {/* 상태 변경 표시 */}
          <div className="flex items-center justify-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[currentStatus]}`}>
              {STATUS_LABELS[currentStatus]}
            </span>
            <ArrowRight size={20} className="text-gray-400" />
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[newStatus]}`}>
              {STATUS_LABELS[newStatus]}
            </span>
          </div>

          {/* 날짜 선택 */}
          <div className={`rounded-xl p-4 ${isReservation ? 'bg-purple-50' : 'bg-gray-50'}`}>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className={isReservation ? 'text-purple-500' : 'text-gray-500'} />
              {DATE_LABELS[newStatus]}
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* 예정일 대비 표시 (완료 상태일 때만) */}
            {daysDiff && (
              <p className={`mt-2 text-sm ${daysDiff.style}`}>
                ※ {daysDiff.text}
              </p>
            )}
          </div>

          {/* 안내 문구 */}
          <p className="text-xs text-gray-400 text-center">
            {isReservation ? (
              <>
                선택한 날짜가 <span className="text-purple-600 font-medium">다음 일정</span>으로 설정됩니다.
              </>
            ) : (
              <>
                다음 일정이 초기화됩니다.
                <br />
                필요시 상세 페이지에서 다음 일정을 설정해주세요.
              </>
            )}
          </p>
        </div>

        {/* 푸터 */}
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            변경 완료
          </button>
        </div>
      </div>
    </div>
  );
}

export default StatusChangeModal;
