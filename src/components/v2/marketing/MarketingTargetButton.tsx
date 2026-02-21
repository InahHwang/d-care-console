// src/components/v2/marketing/MarketingTargetButton.tsx
// 환자 상세 페이지용 이벤트 타겟 버튼

'use client';

import React, { useState } from 'react';
import { Target } from 'lucide-react';
import { MarketingInfo } from '@/types/v2';
import { MarketingTargetModal } from './MarketingTargetModal';

// 환자 정보 중 필요한 필드만 정의 (PatientV2, PatientDetail 모두 호환)
interface PatientForMarketing {
  _id?: string | { toString(): string };
  id?: string;  // PatientDetail에서 사용하는 id 필드
  name: string;
  marketingInfo?: MarketingInfo;
}

interface MarketingTargetButtonProps {
  patient: PatientForMarketing;
  onUpdate: () => void;
  consultantName?: string;
}

export function MarketingTargetButton({
  patient,
  onUpdate,
  consultantName,
}: MarketingTargetButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isTarget = patient.marketingInfo?.isTarget === true;
  // _id 또는 id 중 하나를 사용
  const patientId = patient._id?.toString() || patient.id || '';

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isTarget
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <Target size={16} />
        {isTarget ? '이벤트 타겟' : '타겟 지정'}
      </button>

      <MarketingTargetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientId={patientId}
        patientName={patient.name}
        existingInfo={patient.marketingInfo}
        onSave={onUpdate}
        consultantName={consultantName}
      />
    </>
  );
}

export default MarketingTargetButton;
