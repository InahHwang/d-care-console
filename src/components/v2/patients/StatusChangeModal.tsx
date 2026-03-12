// src/components/v2/patients/StatusChangeModal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, ArrowRight, Bell, BellOff } from 'lucide-react';
import { PatientStatus } from '@/types/v2';

interface RecallScheduleItem {
  id: string;
  timing: string;
  timingDays: number;
  message: string;
  enabled: boolean;
}

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: StatusChangeData) => void;
  currentStatus: PatientStatus;
  newStatus: PatientStatus;
  patientName: string;
  scheduledDate?: string;
  patientInterest?: string;
  completedDate?: string;
}

export interface StatusChangeData {
  newStatus: PatientStatus;
  eventDate: string;
  isReservation: boolean;
  recallEnabled?: boolean;
  recallBaseDate?: string;
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

const RESERVATION_STATUSES: PatientStatus[] = ['reserved', 'treatmentBooked'];

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function StatusChangeModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  newStatus,
  patientName,
  scheduledDate,
  patientInterest,
  completedDate,
}: StatusChangeModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [eventDate, setEventDate] = useState(today);

  // 리콜 관련 상태 (사후관리 전환 시)
  const [recallEnabled, setRecallEnabled] = useState(true);
  const [recallBaseDate, setRecallBaseDate] = useState(completedDate || today);
  const [recallSchedules, setRecallSchedules] = useState<RecallScheduleItem[]>([]);
  const [loadingRecall, setLoadingRecall] = useState(false);
  const [showDateEdit, setShowDateEdit] = useState(false);

  const isFollowup = newStatus === 'followup';

  // 사후관리 전환 시 리콜 설정 조회
  const fetchRecallSettings = useCallback(async () => {
    if (!isFollowup || !patientInterest) return;
    setLoadingRecall(true);
    try {
      const response = await fetch('/api/v2/recall-settings');
      const result = await response.json();
      if (result.success && result.data) {
        const matched = result.data.find((s: { treatment: string }) => s.treatment === patientInterest);
        if (matched) {
          setRecallSchedules(matched.schedules.filter((s: RecallScheduleItem) => s.enabled));
        }
      }
    } catch (error) {
      console.error('리콜 설정 조회 실패:', error);
    } finally {
      setLoadingRecall(false);
    }
  }, [isFollowup, patientInterest]);

  useEffect(() => {
    if (isOpen && isFollowup) {
      setRecallBaseDate(completedDate || today);
      fetchRecallSettings();
    }
  }, [isOpen, isFollowup, completedDate, today, fetchRecallSettings]);

  if (!isOpen) return null;

  const isReservation = RESERVATION_STATUSES.includes(newStatus);

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
      ...(isFollowup && {
        recallEnabled,
        recallBaseDate,
      }),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">상태 변경</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
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
            {daysDiff && (
              <p className={`mt-2 text-sm ${daysDiff.style}`}>※ {daysDiff.text}</p>
            )}
          </div>

          {/* 사후관리: 리콜 설정 영역 */}
          {isFollowup && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              {/* 리콜 토글 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {recallEnabled ? (
                    <Bell size={16} className="text-blue-600" />
                  ) : (
                    <BellOff size={16} className="text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-900">리콜 문자 발송</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recallEnabled}
                    onChange={(e) => setRecallEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              {recallEnabled && (
                <>
                  {/* 기준일 */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">기준일 (치료완료일)</span>
                    {showDateEdit ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          value={recallBaseDate}
                          onChange={(e) => setRecallBaseDate(e.target.value)}
                          className="text-sm border border-blue-300 rounded px-2 py-0.5"
                        />
                        <button
                          onClick={() => setShowDateEdit(false)}
                          className="text-xs text-blue-600 hover:underline ml-1"
                        >
                          확인
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDateEdit(true)}
                        className="text-blue-600 hover:underline"
                      >
                        {formatDate(recallBaseDate)} ✎
                      </button>
                    )}
                  </div>

                  {/* 리콜 스케줄 목록 */}
                  {loadingRecall ? (
                    <p className="text-xs text-gray-400 text-center py-2">리콜 설정 확인 중...</p>
                  ) : recallSchedules.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">발송 예정:</p>
                      {recallSchedules.map((schedule) => (
                        <div key={schedule.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                          <span className="text-gray-700 font-medium">{schedule.timing}</span>
                          <span className="text-gray-500">{formatDate(addDays(recallBaseDate, schedule.timingDays))}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-2">
                      {patientInterest
                        ? `"${patientInterest}"에 매칭되는 리콜 설정이 없습니다.`
                        : '환자의 관심진료가 설정되지 않았습니다.'}
                      <br />
                      설정 &gt; 리콜 발송 설정에서 추가할 수 있습니다.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* 안내 문구 */}
          {!isFollowup && (
            <p className="text-xs text-gray-400 text-center">
              {isReservation ? (
                <>선택한 날짜가 <span className="text-purple-600 font-medium">다음 일정</span>으로 설정됩니다.</>
              ) : (
                <>다음 일정이 초기화됩니다.<br />필요시 상세 페이지에서 다음 일정을 설정해주세요.</>
              )}
            </p>
          )}
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
