// src/components/v2/dashboard/IncentiveSettlementTable.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, X, ArrowRight } from 'lucide-react';

// ===== types =====
export interface IncentiveConsultantRow {
  name: string;
  registered: number;
  reserved: number;
  visited: number;
  paid: number;
  retroCount: number;      // 이번 달 소급 건수 (지난달 내원 → 이번달 결제)
  reservationRate: number; // 예약/문의
  visitRate: number;       // 내원/예약
  paymentRate: number;     // 결제/내원
  lowSample: boolean;
}

export interface IncentiveRetroPatient {
  consultant: string;
  patientId: string;
  journeyId: string | null;
  name: string;
  phone: string;
  journeyStartedAt: string;
  originMonth: string;     // 내원(출처)월 YYYY-MM
  paidAt: string | null;
  paymentStatus: string;
  amount: number;
}

export interface IncentiveSettlementData {
  month: string;
  consultants: IncentiveConsultantRow[];
  retroPatients: IncentiveRetroPatient[];
  totals: {
    registered: number;
    reserved: number;
    visited: number;
    paid: number;
    retroCount: number;
    reservationRate: number;
    visitRate: number;
    paymentRate: number;
  };
}

interface IncentiveSettlementTableProps {
  data: IncentiveSettlementData | null;
  loading?: boolean;
}

// ===== helpers =====
function formatDate(iso: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const KST = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${KST.getUTCMonth() + 1}/${KST.getUTCDate()}`;
}

function formatAmount(n: number) {
  if (!n) return '-';
  return `${(n / 10000).toLocaleString()}만`;
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== component =====
export function IncentiveSettlementTable({ data, loading }: IncentiveSettlementTableProps) {
  const router = useRouter();
  const [retroConsultant, setRetroConsultant] = useState<string | null>(null);

  if (loading) return <LoadingSkeleton />;

  const rows = data?.consultants ?? [];
  const totals = data?.totals;
  const retroAll = data?.retroPatients ?? [];
  const retroRows = retroConsultant
    ? retroAll.filter((p) => p.consultant === retroConsultant)
    : [];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-100">
            <Coins size={18} className="text-emerald-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">인센티브 정산</h3>
        </div>
        <span className="text-xs text-gray-500">
          전환율 = 직전 단계 대비(내원월 기준) · <span className="text-blue-600 font-medium">소급</span> = 지난달 내원 환자가 이번 달 결제 (이번 달 지급 대상)
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">이번 달 실적이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2 px-3 font-medium">상담사</th>
                <th className="py-2 px-3 font-medium text-right">문의</th>
                <th className="py-2 px-3 font-medium text-right">예약전환</th>
                <th className="py-2 px-3 font-medium text-right">내원전환</th>
                <th className="py-2 px-3 font-medium text-right">결제전환</th>
                <th className="py-2 px-3 font-medium text-right">소급</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isUnassigned = row.name === '미지정';
                const nameColor = isUnassigned ? 'text-gray-400 italic' : 'text-gray-900 font-medium';
                const rateClass = row.lowSample ? 'text-gray-400' : 'text-gray-600';
                const sampleMark = row.lowSample ? '※' : '';

                return (
                  <tr key={row.name} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className={`py-3 px-3 ${nameColor}`}>{row.name}</td>
                    <td className="py-3 px-3 text-right text-gray-900">{row.registered}</td>

                    {/* 예약전환 = 예약/문의 */}
                    <td className="py-3 px-3 text-right">
                      <span className="text-gray-900">{row.reserved}</span>
                      <span className={`ml-1.5 text-xs ${rateClass}`}>({row.reservationRate}%{sampleMark})</span>
                    </td>

                    {/* 내원전환 = 내원/예약 */}
                    <td className="py-3 px-3 text-right">
                      <span className="text-gray-900">{row.visited}</span>
                      <span className={`ml-1.5 text-xs ${rateClass}`}>({row.visitRate}%{sampleMark})</span>
                    </td>

                    {/* 결제전환 = 결제/내원 (내원월 코호트 기준) */}
                    <td className="py-3 px-3 text-right">
                      <span className="text-gray-900">{row.paid}</span>
                      <span className={`ml-1.5 text-xs ${rateClass}`}>({row.paymentRate}%{sampleMark})</span>
                    </td>

                    {/* 소급 배지 (지난달 내원 → 이번달 결제) */}
                    <td className="py-3 px-3 text-right">
                      {row.retroCount > 0 ? (
                        <button
                          onClick={() => setRetroConsultant(row.name)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 transition-colors"
                          title="소급 환자 명단 보기"
                        >
                          +{row.retroCount}명
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* 합계 */}
              {totals && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-3 px-3 text-gray-900">합계</td>
                  <td className="py-3 px-3 text-right text-gray-900">{totals.registered}</td>
                  <td className="py-3 px-3 text-right text-gray-900">
                    {totals.reserved}
                    <span className="ml-1.5 text-xs text-gray-600 font-normal">({totals.reservationRate}%)</span>
                  </td>
                  <td className="py-3 px-3 text-right text-gray-900">
                    {totals.visited}
                    <span className="ml-1.5 text-xs text-gray-600 font-normal">({totals.visitRate}%)</span>
                  </td>
                  <td className="py-3 px-3 text-right text-gray-900">
                    {totals.paid}
                    <span className="ml-1.5 text-xs text-gray-600 font-normal">({totals.paymentRate}%)</span>
                  </td>
                  <td className="py-3 px-3 text-right text-blue-700">
                    {totals.retroCount > 0 ? `+${totals.retroCount}명` : '-'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* 안내 주석 */}
          <div className="mt-3 space-y-1">
            {rows.some((r) => r.lowSample) && (
              <p className="text-xs text-gray-400">※ 문의 5건 미만 — 전환율은 표본이 작아 참고용</p>
            )}
            <p className="text-xs text-blue-500">
              🔵 소급 = 지난달(6개월 내) 내원 환자가 이번 달에 결제한 건. 이번 달 인센에 이 인원을 추가로 챙겨주세요.
            </p>
          </div>
        </div>
      )}

      {/* 소급 드릴다운 모달 (이미 불러온 데이터에서 필터, 추가 요청 없음) */}
      {retroConsultant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRetroConsultant(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{retroConsultant} — 소급 결제 명단</h2>
                <p className="text-xs text-gray-500 mt-0.5">지난달(6개월 내) 내원 후 이번 달 결제된 환자 · 총 {retroRows.length}명 (이번 달 인센 추가 대상)</p>
              </div>
              <button onClick={() => setRetroConsultant(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="닫기">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {retroRows.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400 text-sm">소급 건이 없습니다.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-xs font-medium text-gray-500">
                      <th className="px-4 py-2.5">이름</th>
                      <th className="px-4 py-2.5">전화번호</th>
                      <th className="px-4 py-2.5 text-center">내원(출처)</th>
                      <th className="px-4 py-2.5 text-center">결제일</th>
                      <th className="px-4 py-2.5 text-right">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retroRows.map((p, idx) => (
                      <tr
                        key={`${p.patientId}-${p.journeyId ?? idx}`}
                        onClick={() => { setRetroConsultant(null); router.push(`/v2/patients/${p.patientId}`); }}
                        className="border-t border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-gray-600 tabular-nums">{p.phone}</td>
                        <td className="px-4 py-3 text-center text-gray-500 tabular-nums">
                          {p.originMonth || formatDate(p.journeyStartedAt)}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                            <ArrowRight size={11} className="text-gray-300" />{formatDate(p.paidAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatAmount(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IncentiveSettlementTable;
