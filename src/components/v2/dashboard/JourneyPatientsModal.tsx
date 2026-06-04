// src/components/v2/dashboard/JourneyPatientsModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Users, RefreshCw } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';
import { PATIENT_STATUS_CONFIG, PatientStatus } from '@/types/v2';

interface JourneyPatient {
  patientId: string;
  journeyId: string | null;
  name: string;
  phone: string;
  source: string;
  consultationType: string;
  journeyStatus: string;
  journeyStartedAt: string;
  paymentStatus: 'none' | 'partial' | 'completed';
  actualAmount: number;
  estimatedAmount: number;
  consultantName: string;
}

export type FunnelStage = 'new' | 'reserved' | 'visited' | 'paid';

interface JourneyPatientsModalProps {
  open: boolean;
  onClose: () => void;
  year: number;
  month: number; // 1-12
  type?: 'new' | 'returning';      // 신환/구신환 breakdown 모드
  stage?: FunnelStage | null;       // 퍼널 단계 근거 명단 모드 (우선 적용)
  missed?: boolean;                 // 놓친 매출(미결제) 근거 명단 모드 (stage보다 우선)
}

const STAGE_TITLE: Record<FunnelStage, string> = {
  new: '신규 문의 명단',
  reserved: '예약 전환 명단',
  visited: '내원 전환 명단',
  paid: '결제 전환 명단',
};

const STAGE_SUBTITLE: Record<FunnelStage, string> = {
  new: '에 등록된 신규 문의 환자',
  reserved: '등록 환자 중 예약 단계 이상 도달',
  visited: '등록 환자 중 내원 단계 이상 도달',
  paid: '등록 환자 중 결제(부분/완납) 도달',
};

const STAGE_ACCENT: Record<FunnelStage, string> = {
  new: 'bg-orange-100 text-orange-700',
  reserved: 'bg-purple-100 text-purple-700',
  visited: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

const PAYMENT_LABEL: Record<JourneyPatient['paymentStatus'], string> = {
  none: '미결제',
  partial: '부분결제',
  completed: '완납',
};

const PAYMENT_BG: Record<JourneyPatient['paymentStatus'], string> = {
  none: 'bg-gray-100 text-gray-600',
  partial: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const KST = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${KST.getUTCMonth() + 1}/${KST.getUTCDate()}`;
}

function formatAmount(n: number) {
  if (!n) return '-';
  return `${(n / 10000).toLocaleString()}만`;
}

export function JourneyPatientsModal({ open, onClose, year, month, type, stage, missed }: JourneyPatientsModalProps) {
  const router = useRouter();
  const [patients, setPatients] = useState<JourneyPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 우선순위: missed(놓친매출) > stage(퍼널단계) > type(신환/구신환)
  const isStage = !!stage;

  useEffect(() => {
    if (!open) return;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = missed
      ? `/api/v2/dashboard/journey-patients?month=${monthStr}&missed=true`
      : stage
        ? `/api/v2/dashboard/funnel-patients?month=${monthStr}&stage=${stage}`
        : `/api/v2/dashboard/journey-patients?month=${monthStr}&type=${type}`;
    authFetch(url)
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setPatients(result.data.patients || []);
        } else {
          setError(result.error || '명단 조회 실패');
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '명단 조회 실패');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, year, month, type, stage, missed]);

  if (!open) return null;

  const title = missed
    ? '놓친 매출 (미결제) 명단'
    : isStage
      ? STAGE_TITLE[stage!]
      : type === 'new' ? '신환 명단' : '구신환 재유치 명단';
  const subtitle = missed
    ? `${year}년 ${month}월에 시작된 여정 중 견적은 냈으나 미결제`
    : isStage
      ? `${year}년 ${month}월 ${STAGE_SUBTITLE[stage!]}`
      : type === 'new'
        ? `${year}년 ${month}월에 등록된 신환의 여정`
        : `${year}년 ${month}월에 새 여정이 시작된 기존 환자`;
  const accentClass = missed
    ? 'bg-red-100 text-red-700'
    : isStage
      ? STAGE_ACCENT[stage!]
      : type === 'new' ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700';

  const handlePatientClick = (patientId: string) => {
    onClose();
    router.push(`/v2/patients/${patientId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accentClass}`}>
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            </div>
            {!loading && (
              <span className="ml-3 px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-sm font-medium">
                총 {patients.length}건
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            title="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" />
              <span className="text-sm">불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center text-red-500 text-sm">{error}</div>
          ) : patients.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-400 text-sm">해당 월에 일치하는 환자가 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-2.5">여정 시작</th>
                  <th className="px-4 py-2.5">이름</th>
                  <th className="px-4 py-2.5">전화번호</th>
                  <th className="px-4 py-2.5">상태</th>
                  <th className="px-4 py-2.5">유입경로</th>
                  <th className="px-4 py-2.5">결제</th>
                  <th className="px-4 py-2.5 text-right">매출</th>
                  <th className="px-4 py-2.5">상담사</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p, idx) => {
                  const statusCfg = PATIENT_STATUS_CONFIG[p.journeyStatus as PatientStatus];
                  const amount = p.actualAmount || p.estimatedAmount;
                  return (
                    <tr
                      key={`${p.patientId}-${p.journeyId ?? idx}`}
                      onClick={() => handlePatientClick(p.patientId)}
                      className="border-t border-gray-100 hover:bg-orange-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-600 tabular-nums">{formatDate(p.journeyStartedAt)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3 text-gray-600 tabular-nums">{p.phone}</td>
                      <td className="px-4 py-3">
                        {statusCfg ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusCfg.bgColor}`}>
                            {statusCfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">{p.journeyStatus || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.source || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${PAYMENT_BG[p.paymentStatus]}`}>
                          {PAYMENT_LABEL[p.paymentStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatAmount(amount)}</td>
                      <td className="px-4 py-3 text-gray-600">{p.consultantName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default JourneyPatientsModal;
