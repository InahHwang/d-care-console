// src/components/v2/dashboard/ConsultantPerformanceTable.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';

export interface ConsultantStat {
  name: string;
  registered: number;
  contributionRate: number;
  reserved: number;
  reservationRate: number;
  visited: number;
  visitRate: number;
  paid: number;
  paymentRate: number;
  lowSample: boolean;
}

interface ConsultantPerformanceTableProps {
  data: ConsultantStat[] | null;
  loading?: boolean;
}

const RESERVED_STATUS = 'reserved,visited,treatmentBooked,treatment,completed,followup';
const VISITED_STATUS = 'visited,treatmentBooked,treatment,completed,followup';
const PAID_STATUS = 'partial,completed';

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

export function ConsultantPerformanceTable({ data, loading }: ConsultantPerformanceTableProps) {
  const router = useRouter();

  if (loading) {
    return <LoadingSkeleton />;
  }

  const rows = data ?? [];

  // 합계 계산
  const totals = rows.reduce(
    (acc, r) => ({
      registered: acc.registered + r.registered,
      reserved: acc.reserved + r.reserved,
      visited: acc.visited + r.visited,
      paid: acc.paid + r.paid,
    }),
    { registered: 0, reserved: 0, visited: 0, paid: 0 }
  );

  const totalReservationRate = totals.registered > 0 ? Math.round((totals.reserved / totals.registered) * 100) : 0;
  const totalVisitRate = totals.registered > 0 ? Math.round((totals.visited / totals.registered) * 100) : 0;
  // 결제달성률은 내원 대비 ('이번달 성과' 결제전환율과 동일 기준)
  const totalPaymentRate = totals.visited > 0 ? Math.round((totals.paid / totals.visited) * 100) : 0;

  const navigateToPatients = (consultantName: string, statusFilter?: string, paymentFilter?: string) => {
    const params = new URLSearchParams({
      period: 'thisMonth',
      createdBy: consultantName,
    });
    if (statusFilter) params.set('status', statusFilter);
    if (paymentFilter) params.set('paymentStatus', paymentFilter);
    router.push(`/v2/patients?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-100">
            <Users size={18} className="text-indigo-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">상담사별 실적</h3>
        </div>
        <span className="text-xs text-gray-500">
          예약·내원 달성률 = 등록 대비 · 결제달성률 = 내원 대비 · 기여율 = 전체 신규 대비 등록 비율
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">이번 달 신규 환자가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2 px-3 font-medium">상담사</th>
                <th className="py-2 px-3 font-medium text-right">등록</th>
                <th className="py-2 px-3 font-medium text-right">기여율</th>
                <th className="py-2 px-3 font-medium text-right">예약 (달성률)</th>
                <th className="py-2 px-3 font-medium text-right">내원 (달성률)</th>
                <th className="py-2 px-3 font-medium text-right">결제 (내원대비)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isUnassigned = row.name === '미지정';
                const nameColor = isUnassigned ? 'text-gray-400 italic' : 'text-gray-900 font-medium';
                const rateClass = row.lowSample ? 'text-gray-400' : 'text-gray-600';
                const sampleMark = row.lowSample ? '※' : '';

                return (
                  <tr
                    key={row.name}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className={`py-3 px-3 ${nameColor}`}>{row.name}</td>

                    {/* 등록 수 (클릭 → 해당 상담사 환자 전체) */}
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigateToPatients(row.name)}
                        className="text-gray-900 hover:text-indigo-600 hover:underline"
                      >
                        {row.registered}
                      </button>
                    </td>

                    {/* 기여율 */}
                    <td className="py-3 px-3 text-right text-gray-600">
                      {row.contributionRate}%
                    </td>

                    {/* 예약 */}
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigateToPatients(row.name, RESERVED_STATUS)}
                        className="text-gray-900 hover:text-indigo-600 hover:underline"
                        disabled={row.reserved === 0}
                      >
                        {row.reserved}
                      </button>
                      <span className={`ml-1.5 text-xs ${rateClass}`}>
                        ({row.reservationRate}%{sampleMark})
                      </span>
                    </td>

                    {/* 내원 */}
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigateToPatients(row.name, VISITED_STATUS)}
                        className="text-gray-900 hover:text-indigo-600 hover:underline"
                        disabled={row.visited === 0}
                      >
                        {row.visited}
                      </button>
                      <span className={`ml-1.5 text-xs ${rateClass}`}>
                        ({row.visitRate}%{sampleMark})
                      </span>
                    </td>

                    {/* 결제 */}
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigateToPatients(row.name, undefined, PAID_STATUS)}
                        className="text-gray-900 hover:text-indigo-600 hover:underline"
                        disabled={row.paid === 0}
                      >
                        {row.paid}
                      </button>
                      <span className={`ml-1.5 text-xs ${rateClass}`}>
                        ({row.paymentRate}%{sampleMark})
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* 합계 행 */}
              <tr className="bg-gray-50 font-semibold">
                <td className="py-3 px-3 text-gray-900">합계</td>
                <td className="py-3 px-3 text-right text-gray-900">{totals.registered}</td>
                <td className="py-3 px-3 text-right text-gray-900">100%</td>
                <td className="py-3 px-3 text-right text-gray-900">
                  {totals.reserved}
                  <span className="ml-1.5 text-xs text-gray-600 font-normal">
                    ({totalReservationRate}%)
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-gray-900">
                  {totals.visited}
                  <span className="ml-1.5 text-xs text-gray-600 font-normal">
                    ({totalVisitRate}%)
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-gray-900">
                  {totals.paid}
                  <span className="ml-1.5 text-xs text-gray-600 font-normal">
                    ({totalPaymentRate}%)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 주석 */}
          {rows.some((r) => r.lowSample) && (
            <p className="mt-3 text-xs text-gray-400">
              ※ 등록 환자 5명 미만 — 달성률은 표본이 작아 참고용
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default ConsultantPerformanceTable;
