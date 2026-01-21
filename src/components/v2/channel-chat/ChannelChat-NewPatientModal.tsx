'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Phone, Thermometer } from 'lucide-react';
import { Temperature } from '@/types/v2';

interface NewPatientData {
  name: string;
  phone: string;
  interest: string;
  temperature: Temperature;
  memo: string;
}

interface ChannelChatNewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: NewPatientData) => void;
  initialPhone?: string;
  initialName?: string;
}

const INTEREST_OPTIONS = [
  '임플란트',
  '교정',
  '충치치료',
  '스케일링',
  '미백',
  '보철',
  '잇몸치료',
  '사랑니',
  '기타',
];

export function ChannelChatNewPatientModal({
  isOpen,
  onClose,
  onRegister,
  initialPhone = '',
  initialName = '',
}: ChannelChatNewPatientModalProps) {
  const [formData, setFormData] = useState<NewPatientData>({
    name: initialName,
    phone: initialPhone,
    interest: '',
    temperature: 'warm',
    memo: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 초기값 설정
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialName,
        phone: initialPhone,
        interest: '',
        temperature: 'warm',
        memo: '',
      });
    }
  }, [isOpen, initialPhone, initialName]);

  const handleChange = (field: keyof NewPatientData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('이름과 전화번호는 필수입니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRegister(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">신규 환자 등록</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-4 space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="환자 이름"
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="010-0000-0000"
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 관심 치료 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">관심 치료</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleChange('interest', option)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    formData.interest === option
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* 온도 (관심도) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">관심도</label>
            <div className="grid grid-cols-3 gap-2">
              {(['hot', 'warm', 'cold'] as Temperature[]).map((temp) => {
                const config = {
                  hot: { label: 'HOT', desc: '즉시 예약 가능', color: 'bg-red-100 border-red-400 text-red-700' },
                  warm: { label: 'WARM', desc: '관심은 있음', color: 'bg-amber-100 border-amber-400 text-amber-700' },
                  cold: { label: 'COLD', desc: '정보 수집 중', color: 'bg-blue-100 border-blue-400 text-blue-700' },
                };
                const { label, desc, color } = config[temp];

                return (
                  <button
                    key={temp}
                    type="button"
                    onClick={() => handleChange('temperature', temp)}
                    className={`p-3 rounded-xl border-2 text-center transition-colors ${
                      formData.temperature === temp
                        ? color
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-sm">{label}</div>
                    <div className="text-xs mt-0.5 opacity-75">{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              value={formData.memo}
              onChange={(e) => handleChange('memo', e.target.value)}
              placeholder="상담 내용, 특이사항 등"
              rows={3}
              className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t flex gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim() || !formData.phone.trim()}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '등록 중...' : '환자 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChannelChatNewPatientModal;
