// src/app/v2/reports/components/DailyReport-View.tsx
// 일별 리포트 메인 뷰 컴포넌트
'use client';

import React, { useState } from 'react';
import { DailyReportSummaryCards } from './DailyReport-SummaryCards';
import { DailyReportPatientList } from './DailyReport-PatientList';
import { DailyReportPatientDetailPanel } from './DailyReport-PatientDetailPanel';
import { DailyReportData, DailyReportPatient } from './types';

interface DailyReportViewProps {
  data: DailyReportData;
}

export function DailyReportView({ data }: DailyReportViewProps) {
  const { summary, patients } = data;
  const [filter, setFilter] = useState<'all' | 'agreed' | 'disagreed' | 'pending'>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // 선택된 환자
  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || null;

  const handlePatientSelect = (patient: DailyReportPatient) => {
    setSelectedPatientId(patient.id);
  };

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <DailyReportSummaryCards summary={summary} />

      {/* 좌우 분할 - 목록 + 상세 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div
          className="grid grid-cols-2"
          style={{ height: 'calc(100vh - 340px)', minHeight: '500px' }}
        >
          {/* 좌측: 환자 목록 */}
          <div className="border-r border-gray-200">
            <DailyReportPatientList
              patients={patients}
              selectedId={selectedPatientId}
              onSelect={handlePatientSelect}
              filter={filter}
              onFilterChange={setFilter}
              summary={{
                total: summary.total,
                agreed: summary.agreed,
                disagreed: summary.disagreed,
                pending: summary.pending,
              }}
            />
          </div>

          {/* 우측: 환자 상세 */}
          <div className="h-full overflow-hidden">
            <DailyReportPatientDetailPanel patient={selectedPatient} />
          </div>
        </div>
      </div>
    </div>
  );
}
