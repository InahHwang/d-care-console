// src/app/v2/reports/components/DailyReport-View.tsx
// 일별 리포트 메인 뷰 컴포넌트
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { DailyReportSummaryCards } from './DailyReport-SummaryCards';
import { DailyReportPatientList } from './DailyReport-PatientList';
import { DailyReportPatientDetailPanel } from './DailyReport-PatientDetailPanel';
import { DailyReportExistingPatientList } from './DailyReport-ExistingPatientList';
import { DailyReportData, DailyReportPatient, ExistingPatientCall } from './types';

// 환자 상태 한글 레이블
const PATIENT_STATUS_LABELS: Record<string, string> = {
  treatment: '치료중',
  treatmentBooked: '치료예약',
  completed: '치료완료',
  followup: '사후관리',
  closed: '종결',
};

interface DailyReportViewProps {
  data: DailyReportData;
}

export function DailyReportView({ data }: DailyReportViewProps) {
  const { summary, patients, existingPatientCalls = [], existingPatientCallSummary } = data;
  const [activeTab, setActiveTab] = useState<'new' | 'existing'>('new');
  const [filter, setFilter] = useState<'all' | 'agreed' | 'disagreed' | 'pending' | 'no_answer' | 'no_consultation' | 'closed'>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedExistingCallId, setSelectedExistingCallId] = useState<string | null>(null);
  // 모바일에서 상세 패널 표시 여부
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // 선택된 환자 (신환 상담)
  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || null;
  // 선택된 기존 환자 통화
  const selectedExistingCall = existingPatientCalls.find((c) => c.id === selectedExistingCallId) || null;

  const handlePatientSelect = (patient: DailyReportPatient) => {
    setSelectedPatientId(patient.id);
    setShowMobileDetail(true);
  };

  const handleExistingCallSelect = (call: ExistingPatientCall) => {
    setSelectedExistingCallId(call.id);
    setShowMobileDetail(true);
  };

  const handleMobileBack = () => {
    setShowMobileDetail(false);
  };

  const hasExistingCalls = existingPatientCalls.length > 0;

  return (
    <div className="space-y-4">
      {/* 요약 카드 - 신환 상담만 집계 */}
      <DailyReportSummaryCards summary={summary} />

      {/* 기존 환자 통화가 있으면 탭 표시 */}
      {hasExistingCalls && (
        <div className="flex gap-2 px-1">
          <button
            onClick={() => { setActiveTab('new'); setShowMobileDetail(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'new'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            신환 상담 ({patients.length})
          </button>
          <button
            onClick={() => { setActiveTab('existing'); setShowMobileDetail(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'existing'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            기존 환자 통화 ({existingPatientCalls.length})
          </button>
        </div>
      )}

      {/* 좌우 분할 - 목록 + 상세 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* 데스크톱: 2열 그리드 */}
        <div
          className="hidden md:grid grid-cols-2 overflow-hidden"
          style={{ height: 'calc(100vh - 380px)', minHeight: '500px' }}
        >
          {activeTab === 'new' ? (
            <>
              <div className="border-r border-gray-200 h-full overflow-hidden">
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
                    noAnswer: summary.noAnswer ?? 0,
                    noConsultation: summary.noConsultation ?? 0,
                  }}
                />
              </div>
              <div className="h-full overflow-hidden">
                <DailyReportPatientDetailPanel patient={selectedPatient} />
              </div>
            </>
          ) : (
            <>
              <div className="border-r border-gray-200 h-full overflow-hidden">
                <DailyReportExistingPatientList
                  calls={existingPatientCalls}
                  selectedId={selectedExistingCallId}
                  onSelect={handleExistingCallSelect}
                  statusLabels={PATIENT_STATUS_LABELS}
                />
              </div>
              <div className="h-full overflow-y-auto bg-gray-50 p-6">
                <ExistingCallDetail
                  call={selectedExistingCall}
                  statusLabels={PATIENT_STATUS_LABELS}
                />
              </div>
            </>
          )}
        </div>

        {/* 모바일: 목록/상세 전환 */}
        <div
          className="md:hidden overflow-hidden"
          style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}
        >
          {!showMobileDetail ? (
            // 목록
            activeTab === 'new' ? (
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
                  noAnswer: summary.noAnswer ?? 0,
                  noConsultation: summary.noConsultation ?? 0,
                }}
              />
            ) : (
              <DailyReportExistingPatientList
                calls={existingPatientCalls}
                selectedId={selectedExistingCallId}
                onSelect={handleExistingCallSelect}
                statusLabels={PATIENT_STATUS_LABELS}
              />
            )
          ) : (
            // 상세
            <div className="h-full flex flex-col">
              <button
                onClick={handleMobileBack}
                className="flex items-center gap-1 px-4 py-2 text-sm text-blue-600 border-b border-gray-200 bg-gray-50 shrink-0"
              >
                <ArrowLeft size={16} />
                목록으로
              </button>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {activeTab === 'new' ? (
                  <DailyReportPatientDetailPanel patient={selectedPatient} />
                ) : (
                  <div className="p-4">
                    <ExistingCallDetail
                      call={selectedExistingCall}
                      statusLabels={PATIENT_STATUS_LABELS}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 기존 환자 통화 상세 (데스크톱/모바일 공용)
function ExistingCallDetail({
  call,
  statusLabels,
}: {
  call: ExistingPatientCall | null;
  statusLabels: Record<string, string>;
}) {
  if (!call) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>통화를 선택하세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">
            {call.name}
          </span>
          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-sm">
            {statusLabels[call.patientStatus] || call.patientStatus}
          </span>
        </div>
        {call.patientId && (
          <Link
            href={`/v2/patients/${call.patientId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 text-sm rounded-lg border border-gray-200 transition-colors"
          >
            <ExternalLink size={14} />
            <span>상세보기</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">연락처</span>
          <p className="font-medium">{call.phone}</p>
        </div>
        <div>
          <span className="text-gray-500">통화 시간</span>
          <p className="font-medium">{call.time}</p>
        </div>
        {call.duration && (
          <div>
            <span className="text-gray-500">통화 길이</span>
            <p className="font-medium">
              {Math.floor(call.duration / 60)}분 {call.duration % 60}초
            </p>
          </div>
        )}
        {call.treatment && (
          <div>
            <span className="text-gray-500">치료 항목</span>
            <p className="font-medium">{call.treatment}</p>
          </div>
        )}
      </div>

      {call.aiSummary && (
        <div className="mt-4 p-4 bg-white rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-2">AI 통화 요약</h4>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {call.aiSummary}
          </p>
        </div>
      )}

      {call.memo && (
        <div className="mt-4 p-4 bg-white rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-2">메모</h4>
          <p className="text-sm text-gray-600">{call.memo}</p>
        </div>
      )}

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          이 통화는 기존 환자(치료중/완료)와의 통화이므로 상담 성과 지표에 포함되지 않습니다.
        </p>
      </div>
    </div>
  );
}
