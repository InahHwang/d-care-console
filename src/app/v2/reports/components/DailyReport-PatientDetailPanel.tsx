// src/app/v2/reports/components/DailyReport-PatientDetailPanel.tsx
// 일별 리포트 환자 상세 패널 컴포넌트
'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
  DailyReportPatient,
  CONSULTATION_STATUS_CONFIG,
  DISAGREE_REASON_CATEGORIES,
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

export function DailyReportPatientDetailPanel({
  patient,
}: DailyReportPatientDetailPanelProps) {
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

  const config = CONSULTATION_STATUS_CONFIG[patient.status];
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
            <p className="text-lg text-gray-700">{patient.treatment}</p>
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
            <div className="text-sm text-gray-500 mb-1">통화 시간</div>
            <div className="font-medium">{formatDuration(patient.duration)}</div>
            <div className="text-xs text-gray-400">{patient.time}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">담당 상담사</div>
            <div className="font-medium">{patient.consultantName}</div>
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
        {/* 상담 내용 (AI 요약) */}
        {patient.aiSummary && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📞</span> 상담 내용
              <span className="text-xs text-gray-400 font-normal">(AI 요약)</span>
            </h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{patient.aiSummary}</p>
          </div>
        )}

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

        {/* 콜백 예정 (미동의/보류 시) */}
        {(patient.status === 'disagreed' || patient.status === 'pending') &&
          patient.callbackDate && (
            <div
              className={`rounded-xl p-5 border ${
                patient.status === 'disagreed'
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <h3
                className={`font-semibold mb-3 flex items-center gap-2 ${
                  patient.status === 'disagreed' ? 'text-rose-900' : 'text-amber-900'
                }`}
              >
                <span>📞</span> 콜백 예정
              </h3>
              <p
                className={`text-2xl font-bold ${
                  patient.status === 'disagreed' ? 'text-rose-800' : 'text-amber-800'
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
