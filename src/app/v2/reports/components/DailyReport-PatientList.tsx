// src/app/v2/reports/components/DailyReport-PatientList.tsx
// 일별 리포트 환자 목록 컴포넌트
'use client';

import React from 'react';
import { DailyReportPatient, getPatientStatusConfig } from './types';

interface DailyReportPatientListProps {
  patients: DailyReportPatient[];
  selectedId: string | null;
  onSelect: (patient: DailyReportPatient) => void;
  filter: 'all' | 'agreed' | 'disagreed' | 'pending' | 'no_answer' | 'no_consultation' | 'closed';
  onFilterChange: (filter: 'all' | 'agreed' | 'disagreed' | 'pending' | 'no_answer' | 'no_consultation' | 'closed') => void;
  summary: {
    total: number;
    agreed: number;
    disagreed: number;
    pending: number;
    noAnswer: number;
    noConsultation: number;
    closed?: number;
  };
}

export function DailyReportPatientList({
  patients,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  summary,
}: DailyReportPatientListProps) {
  // 필터 적용
  const filteredPatients = patients.filter(
    (p) => filter === 'all' || p.status === filter
  );

  // 정렬: 미동의 → 보류 → 결과미입력 → 동의 순서
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const order: Record<string, number> = { disagreed: 0, pending: 1, no_answer: 2, no_consultation: 3, closed: 4, agreed: 5 };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });

  const filterButtons = [
    { key: 'all' as const, label: '전체', count: summary.total },
    { key: 'disagreed' as const, label: '미동의', count: summary.disagreed },
    { key: 'pending' as const, label: '보류', count: summary.pending },
    { key: 'no_answer' as const, label: '부재중', count: summary.noAnswer },
    { key: 'no_consultation' as const, label: '미입력', count: summary.noConsultation },
    { key: 'agreed' as const, label: '동의', count: summary.agreed },
    ...((summary.closed ?? 0) > 0 ? [{ key: 'closed' as const, label: '종결', count: summary.closed! }] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 필터 버튼 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => onFilterChange(btn.key)}
              className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filter === btn.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {btn.label} ({btn.count})
            </button>
          ))}
        </div>
      </div>

      {/* 환자 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {sortedPatients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            해당 조건의 상담 내역이 없습니다.
          </div>
        ) : (
          sortedPatients.map((patient) => (
            <PatientListItem
              key={patient.id}
              patient={patient}
              isSelected={selectedId === patient.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

// 환자 목록 아이템
function PatientListItem({
  patient,
  isSelected,
  onSelect,
}: {
  patient: DailyReportPatient;
  isSelected: boolean;
  onSelect: (patient: DailyReportPatient) => void;
}) {
  const config = getPatientStatusConfig(patient);
  const hasDiscount = patient.discountRate > 0;

  return (
    <button
      onClick={() => onSelect(patient)}
      className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
      }`}
    >
      {/* 1행: 상태뱃지 + 이름 + 성별/나이 + 회차 + 시간 */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.lightBadge}`}>
            {config.label}
          </span>
          <span className="font-semibold text-gray-900">{patient.name}</span>
          {patient.gender && patient.age && (
            <span className="text-sm text-gray-500">
              {patient.gender}/{patient.age}세
            </span>
          )}
          {patient.consultationNumber && patient.consultationNumber > 1 && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
              {patient.consultationNumber}차
            </span>
          )}
          {patient.consultations && patient.consultations.length > 1 && (
            <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-xs rounded font-medium">
              상담 {patient.consultations.length}건
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{patient.time}</span>
      </div>

      {/* 2행: 치료명 */}
      <div className="text-sm text-gray-700 mb-2">{patient.treatment}</div>

      {/* 3행: 미동의/보류 사유 (태그) */}
      {(patient.status === 'disagreed' || patient.status === 'pending') &&
        patient.disagreeReasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {patient.disagreeReasons.slice(0, 2).map((reason, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 text-xs rounded-full ${
                  patient.status === 'disagreed'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {reason}
              </span>
            ))}
            {patient.disagreeReasons.length > 2 && (
              <span className="text-xs text-gray-400">
                +{patient.disagreeReasons.length - 2}
              </span>
            )}
          </div>
        )}

      {/* 4행: 예약일 (동의 시) 또는 콜백 예정일 (부재중/미동의/보류 시) */}
      {patient.status === 'agreed' && patient.appointmentDate && (
        <div className="text-sm text-emerald-600 mb-2">
          예약 {patient.appointmentDate}
        </div>
      )}
      {(patient.status === 'no_answer' || patient.status === 'disagreed' || patient.status === 'pending') &&
        patient.callbackDate && (
          <div className={`text-sm mb-2 ${
            patient.status === 'no_answer' ? 'text-slate-600' :
            patient.status === 'disagreed' ? 'text-rose-600' :
            'text-amber-600'
          }`}>
            📞 콜백 {patient.callbackDate}
          </div>
        )}

      {/* 5행: 금액 */}
      <div className="flex items-center gap-2">
        {hasDiscount ? (
          <>
            <span className="text-sm text-gray-400 line-through">
              {patient.originalAmount}만
            </span>
            <span className="text-sm font-semibold text-blue-600">
              {patient.finalAmount}만원
            </span>
            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
              -{patient.discountRate}%
            </span>
          </>
        ) : patient.originalAmount > 0 ? (
          <span className="text-sm font-semibold text-gray-700">
            {patient.originalAmount}만원
          </span>
        ) : null}
      </div>
    </button>
  );
}
