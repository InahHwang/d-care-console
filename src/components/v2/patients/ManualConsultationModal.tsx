// src/components/v2/patients/ManualConsultationModal.tsx
// 수동 상담 이력 입력 모달
'use client';

import React, { useState, useEffect } from 'react';
import { X, Phone, Building, MessageCircle, Calendar, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ManualConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  consultantName?: string;
  onSuccess: () => void;
}

type ConsultationType = 'phone' | 'visit' | 'other';

const TYPE_OPTIONS: { value: ConsultationType; label: string; icon: React.ReactNode }[] = [
  { value: 'phone', label: '전화', icon: <Phone size={16} /> },
  { value: 'visit', label: '내원', icon: <Building size={16} /> },
  { value: 'other', label: '기타', icon: <MessageCircle size={16} /> },
];

export function ManualConsultationModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  consultantName = '',
  onSuccess,
}: ManualConsultationModalProps) {
  const [type, setType] = useState<ConsultationType>('phone');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [content, setContent] = useState('');
  const [consultant, setConsultant] = useState(consultantName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setDate(format(now, 'yyyy-MM-dd'));
      setTime(format(now, 'HH:mm'));
      setType('phone');
      setContent('');
      setConsultant(consultantName);
      setError(null);
    }
  }, [isOpen, consultantName]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('상담 내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const consultationDate = new Date(`${date}T${time}`);

      const response = await fetch(`/api/v2/patients/${patientId}/manual-consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          date: consultationDate.toISOString(),
          content: content.trim(),
          consultantName: consultant.trim() || '미지정',
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('수동 상담 저장 오류:', err);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">상담 이력 수동 입력</h2>
            <p className="text-sm text-gray-500">{patientName} 님</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-4">
          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 상담 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상담 유형</label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setType(option.value)}
                  disabled={isSaving}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    type === option.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 상담 일시 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar size={14} className="inline mr-1" />
                날짜
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock size={14} className="inline mr-1" />
                시간
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* 상담 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상담 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="상담 내용을 입력하세요..."
              disabled={isSaving}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* 상담자 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상담자</label>
            <input
              type="text"
              value={consultant}
              onChange={(e) => setConsultant(e.target.value)}
              placeholder="상담자 이름"
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !content.trim()}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 min-w-[80px] flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManualConsultationModal;
