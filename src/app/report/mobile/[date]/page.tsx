'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

// 미동의 사유 카테고리 정의
const disagreeReasonCategories = {
  price: {
    label: '가격/비용',
    reasons: ['예산 초과', '타 병원 대비 비쌈', '분납/할부 조건 안 맞음', '당장 여유가 안 됨']
  },
  treatment: {
    label: '치료 계획',
    reasons: ['치료 계획 이견', '제안 치료 거부', '치료 범위 과다', '치료 기간 부담']
  },
  decision: {
    label: '결정 보류',
    reasons: ['가족 상의 필요', '타 병원 비교 중', '추가 상담/정보 필요', '단순 정보 문의']
  },
  other: {
    label: '기타',
    reasons: ['일정 조율 어려움', '치료 두려움/불안', '기타']
  }
};

// 타입 정의
interface PatientData {
  id: string;
  name: string;
  gender: string;
  age: number | null;
  phone: string;
  status: 'agreed' | 'disagreed' | 'pending';
  treatment: string;
  inquiry: string;
  consultantMemo: string;
  disagreeReasons: string[];
  correctionPlan: string;
  appointmentDate?: string;
  callbackDate?: string;
  originalAmount: number;
  discountRate: number;
  discountAmount: number;
  finalAmount: number;
  discountReason: string;
  consultantName: string;
  time: string;
}

interface ReportData {
  date: string;
  dayOfWeek: string;
  clinicName: string;
  summary: {
    total: number;
    agreed: number;
    disagreed: number;
    pending: number;
    expectedRevenue: number;
    actualRevenue: number;
    totalDiscount: number;
    avgDiscountRate: number;
    callbackCount: number;
  };
  patients: PatientData[];
}

// 상태별 색상 및 아이콘
const statusConfig = {
  agreed: {
    icon: '✓',
    label: '동의',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    badgeColor: 'bg-emerald-500'
  },
  disagreed: {
    icon: '✗',
    label: '미동의',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    badgeColor: 'bg-rose-500'
  },
  pending: {
    icon: '◷',
    label: '보류',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-500'
  }
};

// 대시보드 컴포넌트
function Dashboard({
  data,
  onSelectPatient
}: {
  data: ReportData;
  onSelectPatient: (patient: PatientData) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'agreed' | 'disagreed' | 'pending'>('all');

  const filteredPatients = data.patients.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  // 미동의 먼저, 그다음 보류, 그다음 동의 순으로 정렬
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const order = { disagreed: 0, pending: 1, agreed: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="font-semibold text-gray-900 text-lg">{data.clinicName}</h1>
          <p className="text-sm text-gray-500">{data.date} ({data.dayOfWeek}) 일일 상담 리포트</p>
        </div>

        {/* 요약 카드 */}
        <div className="px-4 pb-3">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-4 text-white">
            <div className="flex justify-between items-center mb-3">
              <span className="text-orange-100 text-sm">총 상담</span>
              <span className="text-2xl font-bold">{data.summary.total}건</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/20 rounded-lg py-2">
                <div className="text-lg font-bold">{data.summary.agreed}</div>
                <div className="text-xs text-orange-100">동의</div>
              </div>
              <div className="bg-white/20 rounded-lg py-2">
                <div className="text-lg font-bold">{data.summary.disagreed}</div>
                <div className="text-xs text-orange-100">미동의</div>
              </div>
              <div className="bg-white/20 rounded-lg py-2">
                <div className="text-lg font-bold">{data.summary.pending}</div>
                <div className="text-xs text-orange-100">보류</div>
              </div>
            </div>

            {/* 매출 정보 */}
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="flex justify-between items-center">
                <span className="text-orange-100 text-sm">예상 매출</span>
                <span className="text-xl font-bold">{data.summary.actualRevenue.toLocaleString()}만원</span>
              </div>
              {data.summary.totalDiscount > 0 && (
                <div className="flex justify-between items-center mt-1 text-sm">
                  <span className="text-orange-200">정가 {data.summary.expectedRevenue.toLocaleString()}만원</span>
                  <span className="text-yellow-300">
                    할인 -{data.summary.totalDiscount.toLocaleString()}만원
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {[
            { key: 'all' as const, label: '전체', count: data.summary.total },
            { key: 'disagreed' as const, label: '미동의', count: data.summary.disagreed },
            { key: 'pending' as const, label: '보류', count: data.summary.pending },
            { key: 'agreed' as const, label: '동의', count: data.summary.agreed }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filter === tab.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </div>
      </div>

      {/* 환자 목록 */}
      <div className="p-4 space-y-3">
        {sortedPatients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            해당 조건의 환자가 없습니다.
          </div>
        ) : (
          sortedPatients.map(patient => {
            const config = statusConfig[patient.status];
            const hasDiscount = patient.discountRate > 0;

            return (
              <button
                key={patient.id}
                onClick={() => onSelectPatient(patient)}
                className={`w-full text-left bg-white rounded-xl border ${config.borderColor} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full ${config.badgeColor} text-white text-xs flex items-center justify-center font-bold`}>
                        {config.icon}
                      </span>
                      <span className="font-semibold text-gray-900">{patient.name}</span>
                      {patient.age && (
                        <span className="text-sm text-gray-500">
                          {patient.gender ? `${patient.gender}/` : ''}{patient.age}세
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{patient.time}</span>
                  </div>

                  <div className="text-sm text-gray-900 mb-2">{patient.treatment}</div>

                  {patient.status === 'disagreed' && patient.disagreeReasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {patient.disagreeReasons.slice(0, 3).map((reason, i) => (
                        <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded-full">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {patient.status === 'pending' && patient.disagreeReasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {patient.disagreeReasons.slice(0, 3).map((reason, i) => (
                        <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {patient.status === 'agreed' && patient.appointmentDate && (
                    <div className="text-sm text-emerald-600">
                      예약: {patient.appointmentDate}
                    </div>
                  )}

                  {patient.status === 'pending' && patient.callbackDate && (
                    <div className="text-sm text-amber-600">
                      콜백 예정: {patient.callbackDate}
                    </div>
                  )}

                  {/* 금액 정보 */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {hasDiscount ? (
                        <>
                          <span className="text-sm text-gray-400 line-through">
                            {patient.originalAmount.toLocaleString()}만
                          </span>
                          <span className="text-sm font-medium text-orange-600">
                            {patient.finalAmount.toLocaleString()}만원
                          </span>
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                            -{patient.discountRate}%
                          </span>
                        </>
                      ) : patient.originalAmount > 0 ? (
                        <span className="text-sm text-gray-500">
                          {patient.originalAmount.toLocaleString()}만원
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">금액 미정</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      상세 보기
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// 환자 상세 카드 컴포넌트
function PatientDetail({
  patient,
  onBack
}: {
  patient: PatientData;
  onBack: () => void;
}) {
  const config = statusConfig[patient.status];
  const hasDiscount = patient.discountRate > 0;

  const handleCall = () => {
    window.location.href = `tel:${patient.phone}`;
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* 헤더 */}
      <div className={`${config.bgColor} border-b ${config.borderColor}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1 text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeColor} text-white`}>
                {config.label}
              </span>
              <h1 className="font-semibold text-gray-900">{patient.name}</h1>
              {patient.age && (
                <span className="text-sm text-gray-500">
                  ({patient.gender ? `${patient.gender}/` : ''}{patient.age}세)
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{patient.treatment}</p>
          </div>
        </div>

        {/* 기본 정보 */}
        <div className="px-4 pb-4">
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">연락처</span>
                <div className="font-medium">{patient.phone}</div>
              </div>
              <div>
                <span className="text-gray-500">상담 시간</span>
                <div className="font-medium">{patient.time || '-'}</div>
              </div>
              <div>
                <span className="text-gray-500">담당 상담사</span>
                <div className="font-medium">{patient.consultantName}</div>
              </div>
              <div>
                <span className="text-gray-500">금액</span>
                {hasDiscount ? (
                  <div>
                    <span className="text-gray-400 line-through text-xs mr-1">
                      {patient.originalAmount.toLocaleString()}만
                    </span>
                    <span className="font-medium text-orange-600">
                      {patient.finalAmount.toLocaleString()}만원
                    </span>
                  </div>
                ) : patient.originalAmount > 0 ? (
                  <div className="font-medium text-orange-600">
                    {patient.originalAmount.toLocaleString()}만원
                  </div>
                ) : (
                  <div className="font-medium text-gray-400">미정</div>
                )}
              </div>
            </div>

            {/* 할인 정보 */}
            {hasDiscount && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                      할인 {patient.discountRate}%
                    </span>
                    <span className="text-sm text-gray-600">
                      -{patient.discountAmount.toLocaleString()}만원
                    </span>
                  </div>
                  {patient.discountReason && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {patient.discountReason}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상세 내용 */}
      <div className="p-4 space-y-4">
        {/* 상담 내용 */}
        {patient.inquiry && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-gray-900">상담 내용</h2>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {patient.inquiry}
            </p>
          </div>
        )}

        {/* 상담사 메모 */}
        {patient.consultantMemo && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-gray-900">상담사 메모</h2>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {patient.consultantMemo}
            </p>
          </div>
        )}

        {/* 미동의/보류 사유 */}
        {(patient.status === 'disagreed' || patient.status === 'pending') && patient.disagreeReasons.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-gray-900">
                {patient.status === 'disagreed' ? '미동의 사유' : '보류 사유'}
              </h2>
            </div>
            <div className="space-y-4">
              {Object.entries(disagreeReasonCategories).map(([key, category]) => {
                const categoryReasons = category.reasons.filter(r =>
                  patient.disagreeReasons.includes(r)
                );
                const hasSelectedInCategory = categoryReasons.length > 0;

                if (!hasSelectedInCategory) return null;

                return (
                  <div key={key}>
                    <div className="text-xs font-medium text-gray-500 mb-2">
                      {category.label}
                    </div>
                    <div className="space-y-1.5">
                      {category.reasons.map(reason => {
                        const isSelected = patient.disagreeReasons.includes(reason);
                        if (!isSelected) return null;
                        return (
                          <div key={reason} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded border flex items-center justify-center text-xs bg-rose-500 border-rose-500 text-white">
                              ✓
                            </span>
                            <span className="text-sm text-gray-900 font-medium">
                              {reason}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 시정 계획 */}
        {(patient.status === 'disagreed' || patient.status === 'pending') && patient.correctionPlan && (
          <div className="bg-orange-50 rounded-xl p-4 shadow-sm border border-orange-200">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-orange-900">시정 계획</h2>
            </div>
            <p className="text-sm text-orange-800 leading-relaxed">
              {patient.correctionPlan}
            </p>
          </div>
        )}

        {/* 예약 정보 */}
        {patient.status === 'agreed' && patient.appointmentDate && (
          <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-200">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-emerald-900">예약 정보</h2>
            </div>
            <p className="text-lg font-semibold text-emerald-800">
              {patient.appointmentDate}
            </p>
          </div>
        )}

        {/* 콜백 예정 */}
        {patient.status === 'pending' && patient.callbackDate && (
          <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-amber-900">콜백 예정</h2>
            </div>
            <p className="text-lg font-semibold text-amber-800">
              {patient.callbackDate}
            </p>
          </div>
        )}
      </div>

      {/* 하단 액션 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={handleCall}
            className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            전화 걸기
          </button>
        </div>
      </div>
    </div>
  );
}

// 로딩 컴포넌트
function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto mb-4" />
        <p className="text-gray-600">리포트를 불러오는 중...</p>
      </div>
    </div>
  );
}

// 에러 컴포넌트
function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">😢</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">오류가 발생했습니다</h2>
        <p className="text-gray-600 text-sm">{message}</p>
      </div>
    </div>
  );
}

// 메인 페이지 컴포넌트
export default function DailyReportMobilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const date = params.date as string;
  const token = searchParams.get('token');

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);

  useEffect(() => {
    async function fetchReport() {
      if (!date || !token) {
        setError('유효하지 않은 접근입니다.');
        setLoading(false);
        return;
      }

      try {
        // 동일한 API 사용
        const response = await fetch(`/api/report/daily/${date}?token=${token}`);
        const result = await response.json();

        if (!result.success) {
          setError(result.error || '리포트를 불러올 수 없습니다.');
          return;
        }

        setData(result.data);
      } catch (err) {
        console.error('리포트 조회 오류:', err);
        setError('리포트를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [date, token]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorView message={error} />;
  }

  if (!data) {
    return <ErrorView message="데이터가 없습니다." />;
  }

  // 환자 상세 보기
  if (selectedPatient) {
    return (
      <PatientDetail
        patient={selectedPatient}
        onBack={() => setSelectedPatient(null)}
      />
    );
  }

  // 대시보드
  return (
    <Dashboard
      data={data}
      onSelectPatient={setSelectedPatient}
    />
  );
}
