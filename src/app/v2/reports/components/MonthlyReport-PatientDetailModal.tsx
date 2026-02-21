// src/app/v2/reports/components/MonthlyReport-PatientDetailModal.tsx
// V2 환자 상담 내용 상세 모달
'use client';

import React from 'react';
import { X, Phone, MapPin } from 'lucide-react';
import type { PatientSummaryV2 } from './MonthlyReport-Types';
import { PROGRESS_STAGE_CONFIG } from './MonthlyReport-Types';

interface MonthlyReportPatientDetailModalProps {
  patient: PatientSummaryV2 | null;
  onClose: () => void;
}

const CONSULTATION_TYPE_LABELS: Record<string, string> = {
  inbound: '인바운드',
  outbound: '아웃바운드',
  returning: '구신환',
  unknown: '미분류',
};

const MonthlyReportPatientDetailModal: React.FC<MonthlyReportPatientDetailModalProps> = ({
  patient,
  onClose,
}) => {
  if (!patient) return null;

  const stageConfig = PROGRESS_STAGE_CONFIG[patient.status];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">환자 상담 상세</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 기본 정보 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="font-medium text-gray-900">
                {patient.name}
                {patient.age && <span className="text-sm text-gray-500 ml-1">({patient.age}세{patient.gender ? `, ${patient.gender}` : ''})</span>}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Phone className="w-3 h-3" />
                {patient.phone}
              </div>
            </div>
          </div>

          {/* 배지 */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stageConfig.color} ${stageConfig.bgColor}`}>
              {stageConfig.label}
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {CONSULTATION_TYPE_LABELS[patient.consultationType] || '미분류'}
            </span>
            {patient.hasPhoneConsultation && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                전화상담
              </span>
            )}
            {patient.hasVisitConsultation && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                내원상담
              </span>
            )}
          </div>

          {/* 관심분야 & 금액 */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">관심분야</span>
              <span className="font-medium">{patient.interest || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">예상 금액</span>
              <span className="font-medium">{patient.estimatedAmount > 0 ? `${patient.estimatedAmount.toLocaleString()}원` : '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">최종 금액</span>
              <span className="font-medium text-blue-700">{patient.finalAmount > 0 ? `${patient.finalAmount.toLocaleString()}원` : '-'}</span>
            </div>
          </div>

          {/* 상담 내용 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">상담 내용</h4>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-line max-h-48 overflow-y-auto">
              {patient.fullConsultation || patient.consultationSummary || '상담 내용 없음'}
            </div>
          </div>

          {/* 등록일 */}
          <div className="text-xs text-gray-400">
            등록일: {new Date(patient.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportPatientDetailModal;
