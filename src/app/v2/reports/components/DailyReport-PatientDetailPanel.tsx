// src/app/v2/reports/components/DailyReport-PatientDetailPanel.tsx
// 일별 리포트 환자 상세 패널 컴포넌트
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import {
  DailyReportPatient,
  DISAGREE_REASON_CATEGORIES,
  getPatientStatusConfig,
  getNoConsultationConfig,
} from './types';

// 통화 시간(초)를 분:초 형식으로 변환
function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '-';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}초`;
  if (secs === 0) return `${minutes}분`;
  return `${minutes}분 ${secs}초`;
}

interface DailyReportPatientDetailPanelProps {
  patient: DailyReportPatient | null;
}

// AI 코칭 요약 데이터
interface CoachingSummary {
  overallScore: number;
  overallComment: string;
  nextCallStrategy: string;
}

export function DailyReportPatientDetailPanel({
  patient,
}: DailyReportPatientDetailPanelProps) {
  const [coachingSummary, setCoachingSummary] = useState<CoachingSummary | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);

  // callLogId가 있고 미동의/보류/종결이면 코칭 캐시 조회
  useEffect(() => {
    setCoachingSummary(null);
    if (!patient?.callLogId) return;
    if (!['disagreed', 'pending', 'closed'].includes(patient.status)) return;

    const fetchCoaching = async () => {
      setCoachingLoading(true);
      try {
        const res = await fetch('/api/v2/call-analysis/coaching', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callLogId: patient.callLogId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.cached && data.coaching) {
          setCoachingSummary({
            overallScore: data.coaching.overallScore,
            overallComment: data.coaching.overallComment,
            nextCallStrategy: data.coaching.nextCallStrategy,
          });
        }
      } catch {
        // 코칭 로드 실패는 무시 (보조 기능)
      } finally {
        setCoachingLoading(false);
      }
    };
    fetchCoaching();
  }, [patient?.callLogId, patient?.status]);

  if (!patient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 text-gray-500">
        <div className="text-center">
          <div className="text-5xl mb-4">👈</div>
          <p>환자를 선택하면 상세 정보가 표시됩니다.</p>
        </div>
      </div>
    );
  }

  const config = getPatientStatusConfig(patient);
  const hasDiscount = patient.discountRate > 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* 상단 헤더 (상태별 배경색) */}
      <div className={`${config.bgColor} border-b ${config.borderColor} p-6`}>
        {/* 1행: 상태뱃지 + 이름 + 성별/나이 + 회차 + 상세보기 버튼 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${config.badgeColor} text-white`}
              >
                {config.label}
              </span>
              <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
              {patient.gender && patient.age && (
                <span className="text-gray-500">
                  ({patient.gender}/{patient.age}세)
                </span>
              )}
              {patient.consultationNumber && patient.consultationNumber > 1 && (
                <span className="px-2 py-1 bg-blue-500 text-white text-sm rounded font-medium">
                  {patient.consultationNumber}차 상담
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-lg text-gray-700">{patient.treatment}</p>
              {patient.consultationType && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  patient.consultationType === 'inbound'
                    ? 'bg-blue-100 text-blue-700'
                    : patient.consultationType === 'outbound'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-teal-100 text-teal-700'
                }`}>
                  {patient.consultationType === 'inbound' ? '인바운드'
                    : patient.consultationType === 'outbound' ? '아웃바운드'
                      : patient.consultationType === 'returning' ? '구신환'
                        : patient.consultationType}
                </span>
              )}
            </div>
          </div>
          {/* 환자 상세보기 버튼 */}
          {patient.patientId && (
            <Link
              href={`/v2/patients/${patient.patientId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 text-sm rounded-lg border border-gray-200 transition-colors"
            >
              <ExternalLink size={14} />
              <span>상세보기</span>
            </Link>
          )}
        </div>

        {/* 기본 정보 그리드 */}
        <div className="bg-white rounded-xl p-4 grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">연락처</div>
            <div className="font-medium">{patient.phone}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">금액</div>
            {hasDiscount ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 line-through text-sm">
                  {patient.originalAmount}만
                </span>
                <span className="font-bold text-blue-600">
                  {patient.finalAmount}만원
                </span>
                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                  -{patient.discountRate}%
                </span>
              </div>
            ) : patient.originalAmount > 0 ? (
              <div className="font-bold text-blue-600">
                {patient.originalAmount}만원
              </div>
            ) : (
              <div className="text-gray-400">-</div>
            )}
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">나이</div>
            <div className="font-medium">
              {patient.age ? `${patient.age}세` : '-'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">거주지</div>
            <div className="font-medium">
              {patient.region
                ? typeof patient.region === 'string'
                  ? patient.region
                  : `${patient.region.province}${patient.region.city ? ` ${patient.region.city}` : ''}`
                : '-'}
            </div>
          </div>
        </div>

        {/* 할인 정보 (할인 적용 시) */}
        {hasDiscount && (
          <div className="mt-3 bg-white rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-rose-500 font-medium">할인 적용</span>
              <span className="px-2 py-1 bg-rose-100 text-rose-600 rounded font-medium">
                {patient.discountRate}% (-{patient.discountAmount}만원)
              </span>
            </div>
            {patient.discountReason && (
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
                사유: {patient.discountReason}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 본문 섹션 */}
      <div className="p-6 space-y-4">
        {/* 종결 사유 */}
        {patient.status === 'closed' && patient.closedReason && (
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <span>⊘</span> 종결 사유
            </h3>
            <p className="text-gray-600 text-sm">{patient.closedReason}</p>
          </div>
        )}

        {/* 미입력 안내 (aiSummary 유무에 따라 상담미입력/결과미입력 구분) */}
        {patient.status === 'no_consultation' && (() => {
          const noConsultConfig = getNoConsultationConfig(patient.aiSummary);
          return (
          <div className={`${noConsultConfig.bgColor} rounded-xl p-5 border ${noConsultConfig.borderColor}`}>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <span>📋</span> {noConsultConfig.label}
            </h3>
            <p className="text-gray-600 text-sm">
              {patient.aiSummary
                ? '이 환자는 상담은 진행되었으나 결과(동의/미동의/보류)가 입력되지 않았습니다. 상담 결과를 입력해주세요.'
                : '이 환자는 아직 상담이 진행되지 않았습니다. 상담 완료 후 기록을 입력해주세요.'}
            </p>
          </div>
          );
        })()}

        {/* 상담 내용 - consultations 배열이 있으면 최신순 표시 */}
        {patient.consultations && patient.consultations.length > 0 ? (
          <div className="space-y-3">
            {[...patient.consultations].reverse().map((entry, idx) => (
              <div key={idx} className="bg-white rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <span>{entry.type === 'visit' ? '🏥' : entry.source === 'manual' ? '✏️' : '📞'}</span>
                    {entry.type === 'visit' ? '내원 상담' : '전화 상담'}
                    {entry.source === 'manual' ? (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">수동</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">자동</span>
                    )}
                    {entry.direction && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        entry.direction === 'inbound'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {entry.direction === 'inbound' ? '수신' : '발신'}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-normal">{entry.time}</span>
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    {entry.type !== 'visit' && entry.duration != null && entry.duration > 0 && (
                      <span>{formatDuration(entry.duration)}</span>
                    )}
                    {entry.consultantName && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{entry.consultantName}</span>
                    )}
                  </div>
                </div>
                {entry.content ? (
                  <ul className="space-y-2">
                    {entry.content.split('\n').filter(line => line.trim()).map((line, lineIdx) => (
                      <li key={lineIdx} className="flex items-start gap-2 text-gray-700">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{line.trim()}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400 text-sm">상담 내용 없음</p>
                )}
              </div>
            ))}
          </div>
        ) : patient.aiSummary ? (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📞</span> 상담 내용
              <span className="text-xs text-gray-400 font-normal">(AI 요약)</span>
            </h3>
            <ul className="space-y-2">
              {patient.aiSummary.split('\n').filter(line => line.trim()).map((line, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{line.trim()}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 상담사 메모 (상담 타임라인에 이미 포함된 내용이면 중복 표시 안 함) */}
        {patient.memo && (() => {
          const memoTrimmed = patient.memo.trim();
          const isDuplicate = patient.consultations?.some(
            (entry) => entry.content?.trim() === memoTrimmed || entry.content?.trim().includes(memoTrimmed)
          );
          if (isDuplicate) return null;
          return (
            <div className="bg-amber-50 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>📝</span> 상담사 메모
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">{patient.memo}</p>
            </div>
          );
        })()}

        {/* 미동의/보류 사유 (카테고리별 그리드) */}
        {(patient.status === 'disagreed' || patient.status === 'pending') &&
          patient.disagreeReasons.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>❌</span>{' '}
                {patient.status === 'disagreed' ? '미동의 사유' : '보류 사유'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(DISAGREE_REASON_CATEGORIES).map(([key, category]) => {
                  const selected = category.reasons.filter((r) =>
                    patient.disagreeReasons.includes(r)
                  );
                  if (selected.length === 0) return null;
                  return (
                    <div key={key} className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-500 mb-3">
                        {category.emoji} {category.label}
                      </div>
                      <div className="space-y-2">
                        {selected.map((reason) => (
                          <div key={reason} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-rose-500 text-white text-xs flex items-center justify-center">
                              ✓
                            </span>
                            <span className="text-gray-900 font-medium">{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* 시정 계획 */}
        {(patient.status === 'disagreed' || patient.status === 'pending') &&
          patient.correctionPlan && (
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <span>📝</span> 시정 계획
              </h3>
              <p className="text-blue-800 leading-relaxed">{patient.correctionPlan}</p>
            </div>
          )}

        {/* AI 코칭 요약 (캐시된 결과가 있을 때만 표시) */}
        {coachingLoading && (
          <div className="flex items-center gap-2 py-2 text-violet-500 text-sm">
            <Loader2 size={14} className="animate-spin" />
            AI 코칭 확인 중...
          </div>
        )}
        {coachingSummary && (
          <div className="bg-violet-50 rounded-xl p-5 border border-violet-200">
            <h3 className="font-semibold text-violet-900 mb-3 flex items-center gap-2">
              <Sparkles size={16} />
              AI 상담 코칭
              <span className={`ml-auto text-lg font-bold px-2 py-0.5 rounded ${
                coachingSummary.overallScore >= 80 ? 'text-emerald-600 bg-emerald-100' :
                coachingSummary.overallScore >= 60 ? 'text-amber-600 bg-amber-100' :
                'text-rose-600 bg-rose-100'
              }`}>
                {coachingSummary.overallScore}점
              </span>
            </h3>
            <p className="text-sm text-violet-800 leading-relaxed mb-3">
              {coachingSummary.overallComment}
            </p>
            {coachingSummary.nextCallStrategy && (
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-violet-600 font-medium mb-1">다음 콜백 전략</p>
                <p className="text-sm text-gray-700">{coachingSummary.nextCallStrategy}</p>
              </div>
            )}
          </div>
        )}

        {/* 예약 정보 (동의 시) */}
        {patient.status === 'agreed' && patient.appointmentDate && (
          <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
            <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
              <span>📅</span> 예약 정보
            </h3>
            <p className="text-2xl font-bold text-emerald-800">
              {patient.appointmentDate}
            </p>
          </div>
        )}

        {/* 콜백 예정 (미동의/보류/부재중 시) */}
        {(patient.status === 'disagreed' || patient.status === 'pending' || patient.status === 'no_answer') &&
          patient.callbackDate && (
            <div
              className={`rounded-xl p-5 border ${
                patient.status === 'disagreed'
                  ? 'bg-rose-50 border-rose-200'
                  : patient.status === 'no_answer'
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-amber-50 border-amber-200'
              }`}
            >
              <h3
                className={`font-semibold mb-3 flex items-center gap-2 ${
                  patient.status === 'disagreed'
                    ? 'text-rose-900'
                    : patient.status === 'no_answer'
                      ? 'text-slate-900'
                      : 'text-amber-900'
                }`}
              >
                <span>📞</span> 콜백 예정
              </h3>
              <p
                className={`text-2xl font-bold ${
                  patient.status === 'disagreed'
                    ? 'text-rose-800'
                    : patient.status === 'no_answer'
                      ? 'text-slate-800'
                      : 'text-amber-800'
                }`}
              >
                {patient.callbackDate}
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
