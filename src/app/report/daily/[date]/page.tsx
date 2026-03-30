'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

// 미동의 사유 카테고리 정의
const disagreeReasonCategories = {
  price: {
    label: '💰 가격/비용',
    reasons: ['예산 초과', '타 병원 대비 비쌈', '분납/할부 조건 안 맞음', '당장 여유가 안 됨']
  },
  treatment: {
    label: '🦷 치료 계획',
    reasons: ['치료 계획 이견', '제안 치료 거부', '치료 범위 과다', '치료 기간 부담']
  },
  decision: {
    label: '⏳ 결정 보류',
    reasons: ['가족 상의 필요', '타 병원 비교 중', '추가 상담/정보 필요', '단순 정보 문의']
  },
  other: {
    label: '📋 기타',
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
    badgeColor: 'bg-emerald-500',
    lightBadge: 'bg-emerald-100 text-emerald-700'
  },
  disagreed: {
    icon: '✗',
    label: '미동의',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    badgeColor: 'bg-rose-500',
    lightBadge: 'bg-rose-100 text-rose-700'
  },
  pending: {
    icon: '◷',
    label: '보류',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-500',
    lightBadge: 'bg-amber-100 text-amber-700'
  }
};

// 요약 카드 컴포넌트
function SummaryCards({ summary }: { summary: ReportData['summary'] }) {
  const conversionRate = summary.total > 0
    ? Math.round((summary.agreed / summary.total) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 총 상담 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-1">총 상담</div>
        <div className="text-3xl font-bold text-gray-900">{summary.total}건</div>
        <div className="text-sm text-gray-500 mt-1">
          전환율 {conversionRate}%
        </div>
      </div>

      {/* 상담 결과 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-2">상담 결과</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-sm">동의 {summary.agreed}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            <span className="text-sm">미동의 {summary.disagreed}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-sm">보류 {summary.pending}</span>
          </div>
        </div>
        {/* 프로그레스 바 */}
        <div className="flex h-2 rounded-full overflow-hidden mt-3 bg-gray-100">
          <div
            className="bg-emerald-500"
            style={{ width: `${(summary.agreed / summary.total) * 100}%` }}
          />
          <div
            className="bg-rose-500"
            style={{ width: `${(summary.disagreed / summary.total) * 100}%` }}
          />
          <div
            className="bg-amber-500"
            style={{ width: `${(summary.pending / summary.total) * 100}%` }}
          />
        </div>
      </div>

      {/* 예상 매출 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-1">예상 매출</div>
        <div className="text-3xl font-bold text-orange-600">
          {summary.actualRevenue.toLocaleString()}만원
        </div>
        {summary.totalDiscount > 0 && (
          <div className="text-sm text-gray-500 mt-1">
            정가 {summary.expectedRevenue.toLocaleString()}만원
          </div>
        )}
      </div>

      {/* 할인 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-1">할인</div>
        <div className="text-3xl font-bold text-rose-500">
          -{summary.totalDiscount.toLocaleString()}만원
        </div>
        <div className="text-sm text-gray-500 mt-1">
          평균 {summary.avgDiscountRate}% 할인
        </div>
      </div>
    </div>
  );
}

// 환자 목록 테이블 (좌측 패널)
function PatientList({
  patients,
  selectedId,
  onSelect,
  filter,
  onFilterChange
}: {
  patients: PatientData[];
  selectedId: string | null;
  onSelect: (patient: PatientData) => void;
  filter: 'all' | 'agreed' | 'disagreed' | 'pending';
  onFilterChange: (filter: 'all' | 'agreed' | 'disagreed' | 'pending') => void;
}) {
  const filteredPatients = patients.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  // 미동의 먼저, 그다음 보류, 그다음 동의 순으로 정렬
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const order = { disagreed: 0, pending: 1, agreed: 2 };
    return order[a.status] - order[b.status];
  });

  const counts = {
    all: patients.length,
    agreed: patients.filter(p => p.status === 'agreed').length,
    disagreed: patients.filter(p => p.status === 'disagreed').length,
    pending: patients.filter(p => p.status === 'pending').length
  };

  return (
    <div className="flex flex-col h-full">
      {/* 필터 탭 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          {[
            { key: 'all' as const, label: '전체' },
            { key: 'disagreed' as const, label: '미동의' },
            { key: 'pending' as const, label: '보류' },
            { key: 'agreed' as const, label: '동의' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>
      </div>

      {/* 환자 목록 */}
      <div className="flex-1 overflow-y-auto">
        {sortedPatients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            해당 조건의 환자가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedPatients.map(patient => {
              const config = statusConfig[patient.status];
              const isSelected = selectedId === patient.id;
              const hasDiscount = patient.discountRate > 0;

              return (
                <button
                  key={patient.id}
                  onClick={() => onSelect(patient)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.lightBadge}`}>
                        {config.label}
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

                  <div className="text-sm text-gray-700 mb-2">{patient.treatment}</div>

                  {/* 미동의/보류 사유 태그 */}
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
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
                          +{patient.disagreeReasons.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 예약/콜백 정보 */}
                  {patient.status === 'agreed' && patient.appointmentDate && (
                    <div className="text-sm text-emerald-600 mb-2">
                      📅 {patient.appointmentDate}
                    </div>
                  )}
                  {patient.status === 'pending' && patient.callbackDate && (
                    <div className="text-sm text-amber-600 mb-2">
                      📞 콜백: {patient.callbackDate}
                    </div>
                  )}

                  {/* 금액 */}
                  <div className="flex items-center gap-2">
                    {hasDiscount ? (
                      <>
                        <span className="text-sm text-gray-400 line-through">
                          {patient.originalAmount.toLocaleString()}만
                        </span>
                        <span className="text-sm font-semibold text-orange-600">
                          {patient.finalAmount.toLocaleString()}만원
                        </span>
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                          -{patient.discountRate}%
                        </span>
                      </>
                    ) : patient.originalAmount > 0 ? (
                      <span className="text-sm font-semibold text-gray-700">
                        {patient.originalAmount.toLocaleString()}만원
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">금액 미정</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// 환자 상세 패널 (우측)
function PatientDetailPanel({ patient }: { patient: PatientData | null }) {
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

  const config = statusConfig[patient.status];
  const hasDiscount = patient.discountRate > 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* 헤더 */}
      <div className={`${config.bgColor} border-b ${config.borderColor} p-6`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.badgeColor} text-white`}>
                {config.label}
              </span>
              <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
              {patient.age && (
                <span className="text-gray-500">
                  ({patient.gender ? `${patient.gender}/` : ''}{patient.age}세)
                </span>
              )}
            </div>
            <p className="text-lg text-gray-700">{patient.treatment}</p>
          </div>

          {/* 전화 버튼 */}
          <a
            href={`tel:${patient.phone}`}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            📞 전화 걸기
          </a>
        </div>

        {/* 기본 정보 그리드 */}
        <div className="bg-white rounded-xl p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">연락처</div>
            <div className="font-medium">{patient.phone}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">상담 시간</div>
            <div className="font-medium">{patient.time || '-'}</div>
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
                  {patient.originalAmount.toLocaleString()}만
                </span>
                <span className="font-bold text-orange-600">
                  {patient.finalAmount.toLocaleString()}만원
                </span>
                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                  -{patient.discountRate}%
                </span>
              </div>
            ) : patient.originalAmount > 0 ? (
              <div className="font-bold text-orange-600">
                {patient.originalAmount.toLocaleString()}만원
              </div>
            ) : (
              <div className="text-gray-400">미정</div>
            )}
          </div>
        </div>

        {/* 할인 정보 */}
        {hasDiscount && (
          <div className="mt-3 bg-white rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-rose-500 font-medium">할인 적용</span>
              <span className="px-2 py-1 bg-rose-100 text-rose-600 rounded font-medium">
                {patient.discountRate}% (-{patient.discountAmount.toLocaleString()}만원)
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

      {/* 상세 내용 */}
      <div className="p-6 space-y-4">
        {/* 상담 내용 */}
        {patient.inquiry && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📞</span> 상담 내용
            </h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {patient.inquiry}
            </p>
          </div>
        )}

        {/* 상담사 메모 */}
        {patient.consultantMemo && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>💬</span> 상담사 메모
            </h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {patient.consultantMemo}
            </p>
          </div>
        )}

        {/* 미동의/보류 사유 */}
        {(patient.status === 'disagreed' || patient.status === 'pending') &&
          patient.disagreeReasons.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>❌</span> {patient.status === 'disagreed' ? '미동의 사유' : '보류 사유'}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Object.entries(disagreeReasonCategories).map(([key, category]) => {
                const categoryReasons = category.reasons.filter(r =>
                  patient.disagreeReasons.includes(r)
                );
                if (categoryReasons.length === 0) return null;

                return (
                  <div key={key} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-500 mb-3">
                      {category.label}
                    </div>
                    <div className="space-y-2">
                      {category.reasons.map(reason => {
                        const isSelected = patient.disagreeReasons.includes(reason);
                        if (!isSelected) return null;
                        return (
                          <div key={reason} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded border flex items-center justify-center text-xs bg-rose-500 border-rose-500 text-white">
                              ✓
                            </span>
                            <span className="text-gray-900 font-medium">{reason}</span>
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
          <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
            <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
              <span>📝</span> 시정 계획
            </h3>
            <p className="text-orange-800 leading-relaxed">
              {patient.correctionPlan}
            </p>
          </div>
        )}

        {/* 예약 정보 */}
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

        {/* 콜백 예정 */}
        {patient.status === 'pending' && patient.callbackDate && (
          <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <span>📞</span> 콜백 예정
            </h3>
            <p className="text-2xl font-bold text-amber-800">
              {patient.callbackDate}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// 로딩 컴포넌트
function Loading() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">😢</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">오류가 발생했습니다</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

// 메인 페이지 컴포넌트
export default function DailyReportPCPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const date = params.date as string;
  const token = searchParams.get('token');

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [filter, setFilter] = useState<'all' | 'agreed' | 'disagreed' | 'pending'>('all');

  useEffect(() => {
    async function fetchReport() {
      if (!date || !token) {
        setError('유효하지 않은 접근입니다.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/report/daily/${date}?token=${token}`);
        const result = await response.json();

        if (!result.success) {
          setError(result.error || '리포트를 불러올 수 없습니다.');
          return;
        }

        setData(result.data);

        // 미동의 환자가 있으면 첫 번째 미동의 환자 선택
        if (result.data.patients.length > 0) {
          const firstDisagreed = result.data.patients.find(
            (p: PatientData) => p.status === 'disagreed'
          );
          setSelectedPatient(firstDisagreed || result.data.patients[0]);
        }
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.clinicName}</h1>
            <p className="text-gray-500">
              {data.date} ({data.dayOfWeek}) 일일 상담 리포트
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              📥 PDF 다운로드
            </button>
            <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              📊 엑셀 다운로드
            </button>
          </div>
        </div>
      </header>

      {/* 요약 카드 */}
      <div className="px-6 py-4">
        <SummaryCards summary={data.summary} />
      </div>

      {/* 메인 컨텐츠 - 좌우 분할 */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 h-[calc(100vh-320px)] min-h-[500px]">
            {/* 좌측: 환자 목록 */}
            <div className="border-r border-gray-200">
              <PatientList
                patients={data.patients}
                selectedId={selectedPatient?.id || null}
                onSelect={setSelectedPatient}
                filter={filter}
                onFilterChange={setFilter}
              />
            </div>

            {/* 우측: 환자 상세 */}
            <div>
              <PatientDetailPanel patient={selectedPatient} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
