// src/app/v2/reports/components/MonthlyReport-PatientConsultationTable.tsx
// V2 환자별 상담 분석 - 주의 필요 환자 하이라이트 + 단계별 그룹핑
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { FileText, AlertTriangle, ChevronDown, ChevronRight, ExternalLink, PhoneCall, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import type { MonthlyStatsV2, PatientSummaryV2 } from './MonthlyReport-Types';
import { PROGRESS_STAGE_CONFIG } from './MonthlyReport-Types';
import type { PatientStatus } from '@/types/v2';

interface MonthlyReportPatientConsultationTableProps {
  stats: MonthlyStatsV2;
  onPatientClick: (patient: PatientSummaryV2) => void;
}

// 단계 표시 순서
const STAGE_ORDER: PatientStatus[] = [
  'consulting', 'reserved', 'visited', 'treatmentBooked',
  'treatment', 'completed', 'followup', 'closed',
];

// 주의 필요 환자 항목
interface AttentionItem {
  patient: PatientSummaryV2;
  reason: string;
  severity: 'high' | 'medium';
}

// 날짜 포맷 (1/25 형태, 마침표 없이)
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 고액환자 자동 감지 (200만원 이상, 결제 완료 제외)
function detectAttentionPatients(patients: PatientSummaryV2[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const p of patients) {
    if (p.estimatedAmount < 2000000) continue;
    // 결제 완료 환자는 제외
    if (p.paymentStatus === 'partial' || p.paymentStatus === 'completed') continue;

    let reason: string;
    let severity: 'high' | 'medium';

    if (p.status === 'closed') {
      reason = '놓친 매출';
      severity = p.estimatedAmount >= 5000000 ? 'high' : 'medium';
    } else if (p.status === 'consulting') {
      reason = p.hasActiveCallback ? '상담 진행중' : '상담 방치';
      severity = p.hasActiveCallback ? 'medium' : 'high';
    } else if (p.status === 'reserved') {
      reason = p.hasActiveCallback ? '예약 관리중' : '예약 후 방치';
      severity = p.hasActiveCallback ? 'medium' : 'high';
    } else if (p.status === 'visited' || p.status === 'treatmentBooked') {
      reason = p.hasActiveCallback ? '내원 후 관리중' : '내원 후 방치';
      severity = p.hasActiveCallback ? 'medium' : 'high';
    } else {
      reason = '고액 진행중';
      severity = 'medium';
    }

    items.push({ patient: p, reason, severity });
  }

  return items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return b.patient.estimatedAmount - a.patient.estimatedAmount;
  });
}

import { formatAmount } from './MonthlyReport-Utils';

const MonthlyReportPatientConsultationTable: React.FC<MonthlyReportPatientConsultationTableProps> = ({
  stats,
  onPatientClick,
}) => {
  const patients = stats.patientSummaries || [];
  const [expandedStages, setExpandedStages] = useState<Set<PatientStatus>>(new Set());
  const [registeringCallback, setRegisteringCallback] = useState<string | null>(null);
  // 콜백 등록 성공한 환자 ID → 등록일 (로컬 상태, 보고서 새로고침 없이 즉시 반영)
  const [registeredCallbacks, setRegisteredCallbacks] = useState<Map<string, string>>(new Map());

  // 콜백 등록 핸들러
  const handleRegisterCallback = useCallback(async (patient: PatientSummaryV2, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`${patient.name} 환자에게 콜백을 등록하시겠습니까?`)) return;
    setRegisteringCallback(patient.patientId);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const res = await fetch('/api/v2/callbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.patientId,
          type: 'callback',
          scheduledAt: tomorrow.toISOString(),
          note: `[월보고서] ${patient.interest} ${formatAmount(patient.estimatedAmount)} - ${patient.consultationSummary?.slice(0, 30) || ''}`,
        }),
      });
      if (res.ok) {
        setRegisteredCallbacks((prev) => new Map(prev).set(patient.patientId, tomorrow.toISOString()));
        alert(`${patient.name} 환자 콜백이 등록되었습니다.\n(내일 오전 10시 예정)`);
      } else {
        alert('콜백 등록에 실패했습니다.');
      }
    } catch {
      alert('콜백 등록 중 오류가 발생했습니다.');
    } finally {
      setRegisteringCallback(null);
    }
  }, []);

  // 단계별 환자 그룹핑
  const groupedPatients = useMemo(() => {
    const groups = new Map<PatientStatus, PatientSummaryV2[]>();
    for (const stage of STAGE_ORDER) {
      groups.set(stage, []);
    }
    for (const p of patients) {
      const list = groups.get(p.status);
      if (list) list.push(p);
    }
    return groups;
  }, [patients]);

  // 주의 필요 환자
  const attentionPatients = useMemo(() => detectAttentionPatients(patients), [patients]);

  // 합계
  const totalEstimated = useMemo(() =>
    patients.reduce((s, p) => s + (p.estimatedAmount || 0), 0), [patients]);
  const totalFinal = useMemo(() =>
    patients.reduce((s, p) => s + (p.finalAmount || 0), 0), [patients]);

  const toggleStage = (stage: PatientStatus) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      {/* 헤더 */}
      <div className="p-6 border-b bg-indigo-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          환자별 상담 분석
          <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
            {patients.length}명
          </span>
        </h2>
      </div>

      <div className="p-6">
        {/* 주의 필요 환자 */}
        {attentionPatients.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              놓치면 아까운 고액환자 ({attentionPatients.length}명)
            </h3>
            <div className="space-y-2">
              {attentionPatients.map((item) => {
                const config = PROGRESS_STAGE_CONFIG[item.patient.status];
                return (
                  <div
                    key={`attention-${item.patient.patientId}`}
                    onClick={() => onPatientClick(item.patient)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
                      item.severity === 'high'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">
                            {item.patient.name}
                          </span>
                          {item.patient.age && (
                            <span className="text-xs text-gray-500">{item.patient.age}세</span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-xs ${config.color} ${config.bgColor}`}>
                            {config.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.patient.interest || '미분류'} · {item.reason}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      {/* 콜백 상태 */}
                      <div className="text-right">
                        {(() => {
                          const justRegistered = registeredCallbacks.get(item.patient.patientId);
                          const hasCallback = item.patient.hasActiveCallback || !!justRegistered;
                          const callbackDate = justRegistered || item.patient.nextCallbackDate;

                          if (item.patient.status === 'closed') {
                            return (
                              <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
                                <XCircle className="w-3 h-3" />
                                <span>종결</span>
                              </div>
                            );
                          }
                          if (hasCallback) {
                            return (
                              <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>콜백 {callbackDate
                                  ? formatShortDate(callbackDate)
                                  : '등록됨'
                                }</span>
                              </div>
                            );
                          }
                          return (
                            <button
                              onClick={(e) => handleRegisterCallback(item.patient, e)}
                              disabled={registeringCallback === item.patient.patientId}
                              className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-1 hover:bg-amber-100 transition-colors no-print"
                            >
                              <AlertCircle className="w-3 h-3" />
                              {registeringCallback === item.patient.patientId ? '등록중...' : '콜백 미등록'}
                            </button>
                          );
                        })()}
                      </div>
                      {/* 금액 + 상세 */}
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatAmount(item.patient.estimatedAmount)}
                        </div>
                        <a
                          href={`/v2/patients/${item.patient.patientId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 justify-end"
                        >
                          상세 <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 단계별 현황 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">단계별 현황</h3>
          <div className="space-y-1">
            {STAGE_ORDER.map((stage) => {
              const stagePatients = groupedPatients.get(stage) || [];
              if (stagePatients.length === 0) return null;

              const config = PROGRESS_STAGE_CONFIG[stage];
              const isExpanded = expandedStages.has(stage);
              const stageEstimated = stagePatients.reduce((s, p) => s + (p.estimatedAmount || 0), 0);
              const stageFinal = stagePatients.reduce((s, p) => s + (p.finalAmount || 0), 0);

              return (
                <div key={stage} className="border rounded-lg overflow-hidden">
                  {/* 단계 헤더 */}
                  <button
                    onClick={() => toggleStage(stage)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                      }
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
                        {config.label}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {stagePatients.length}명
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {stageEstimated > 0 && (
                        <span>정가 {formatAmount(stageEstimated)}</span>
                      )}
                      {stageFinal > 0 && (
                        <>
                          <span className="text-blue-600 font-medium">할인가 {formatAmount(stageFinal)}</span>
                          <span className="text-amber-600">
                            ({Math.round((1 - stageFinal / stageEstimated) * 100)}%↓)
                          </span>
                        </>
                      )}
                    </div>
                  </button>

                  {/* 환자 목록 */}
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {stagePatients.map((patient) => (
                        <div
                          key={patient.patientId}
                          onClick={() => onPatientClick(patient)}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{patient.name}</span>
                              {patient.age && <span className="text-xs text-gray-400">{patient.age}세</span>}
                              {patient.gender && <span className="text-xs text-gray-400">{patient.gender}</span>}
                              <span className="text-xs text-gray-500">· {patient.interest || '미분류'}</span>
                            </div>
                            <div className="text-xs text-gray-400 truncate mt-0.5">
                              {patient.consultationSummary || '상담내용 없음'}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            {patient.estimatedAmount > 0 && (
                              <span className="text-xs text-gray-500">
                                {formatAmount(patient.estimatedAmount)}
                              </span>
                            )}
                            {patient.finalAmount > 0 && patient.estimatedAmount > 0 && (
                              <>
                                <span className="text-xs text-blue-600 font-medium">
                                  → {formatAmount(patient.finalAmount)}
                                </span>
                                <span className="text-xs text-amber-600">
                                  ({Math.round((1 - patient.finalAmount / patient.estimatedAmount) * 100)}%↓)
                                </span>
                              </>
                            )}
                            <a
                              href={`/v2/patients/${patient.patientId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 합계 */}
        <div className="mt-4 flex justify-end gap-6 text-sm border-t pt-4">
          <div className="text-gray-600">
            정가 합계: <span className="font-bold text-gray-900">{formatAmount(totalEstimated)}</span>
          </div>
          {totalFinal > 0 && (
            <>
              <div className="text-gray-600">
                할인가 합계: <span className="font-bold text-blue-700">{formatAmount(totalFinal)}</span>
              </div>
              {totalEstimated > 0 && (
                <div className="text-amber-600 font-medium">
                  할인율 {Math.round((1 - totalFinal / totalEstimated) * 100)}%
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportPatientConsultationTable;
