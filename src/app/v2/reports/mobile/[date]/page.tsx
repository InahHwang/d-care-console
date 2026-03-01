// src/app/v2/reports/mobile/[date]/page.tsx
// 모바일용 일별 보고서 페이지 - v2 디자인 적용
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// 에러 바운더리 컴포넌트
class MobileReportErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <p className="text-gray-700 font-medium mb-2">보고서 표시 중 오류가 발생했습니다.</p>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// 미동의 사유 카테고리 정의
const disagreeReasonCategories: Record<string, { label: string; reasons: string[] }> = {
  price: {
    label: '💰 가격/비용',
    reasons: [
      '예산 초과',
      '타 병원 대비 비쌈',
      '분납/할부 조건 안 맞음',
      '당장 여유가 안 됨',
    ]
  },
  treatment: {
    label: '🦷 치료 계획',
    reasons: [
      '치료 계획 이견 (타 병원과 다름)',
      '제안 치료 거부 (임플란트→틀니 등)',
      '치료 범위 과다 (과잉진료 우려)',
      '치료 기간 부담',
    ]
  },
  decision: {
    label: '⏳ 결정 보류',
    reasons: [
      '가족 상의 필요',
      '타 병원 비교 중',
      '추가 상담/정보 필요',
      '단순 정보 문의',
    ]
  },
  other: {
    label: '📋 기타',
    reasons: [
      '일정 조율 어려움',
      '치료 두려움/불안',
      '기타',
    ]
  }
};

// 통화 시간(초)를 분:초 형식으로 변환
function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '-';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}초`;
  if (secs === 0) return `${minutes}분`;
  return `${minutes}분 ${secs}초`;
}

// 개별 상담 기록
interface ConsultationEntry {
  type: 'phone' | 'visit' | 'other';
  time: string;
  content?: string;
  consultantName?: string;
  duration?: number;
  direction?: 'inbound' | 'outbound';
  source?: 'manual' | 'auto';
}

// 타입 정의
interface DailyReportPatient {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  status: 'agreed' | 'disagreed' | 'pending' | 'no_answer' | 'no_consultation' | 'closed';
  type: 'phone' | 'visit';
  treatment: string;
  originalAmount: number;
  discountRate: number;
  discountAmount: number;
  finalAmount: number;
  discountReason?: string;
  disagreeReasons: string[];
  correctionPlan?: string;
  appointmentDate?: string;
  callbackDate?: string;
  consultantName: string;
  time: string;
  duration?: number;
  aiSummary?: string;
  gender?: '남' | '여';
  age?: number;
  region?: any;
  memo?: string;
  inquiry?: string;
  consultantMemo?: string;
  consultationNumber?: number;
  consultationType?: string;
  direction?: 'inbound' | 'outbound';
  source?: 'manual' | 'auto';
  consultations?: ConsultationEntry[];
}

interface DailyReportSummary {
  total: number;
  agreed: number;
  disagreed: number;
  pending: number;
  noAnswer?: number;
  noConsultation?: number;
  closed?: number;
  expectedRevenue: number;
  actualRevenue: number;
  totalDiscount: number;
  avgDiscountRate: number;
  callbackCount: number;
  newPatients: number;
  existingPatients: number;
  phoneConsultations: number;
  visitConsultations: number;
}

interface ExistingPatientCall {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  patientStatus: string;
  treatment?: string;
  time: string;
  duration?: number;
  aiSummary?: string;
  gender?: '남' | '여';
  age?: number;
  memo?: string;
  direction?: 'inbound' | 'outbound';
  source?: 'manual' | 'auto';
}

interface DailyReportData {
  date: string;
  dayOfWeek: string;
  summary: DailyReportSummary;
  patients: DailyReportPatient[];
  existingPatientCalls: ExistingPatientCall[];
  existingPatientCallSummary: {
    total: number;
    byStatus: Record<string, number>;
  };
  aiInsights?: string[];
}

// 상태별 색상 및 아이콘
const statusConfig: Record<string, { icon: string; label: string; bgColor: string; textColor: string; borderColor: string; badgeColor: string }> = {
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
  },
  no_answer: {
    icon: '📵',
    label: '부재중',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    badgeColor: 'bg-slate-500'
  },
  no_consultation: {
    icon: '–',
    label: '미입력',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    badgeColor: 'bg-gray-400'
  },
  closed: {
    icon: '⊘',
    label: '종결',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    badgeColor: 'bg-gray-500'
  }
};

const defaultStatusConfig = {
  icon: '?',
  label: '기타',
  bgColor: 'bg-gray-50',
  textColor: 'text-gray-700',
  borderColor: 'border-gray-200',
  badgeColor: 'bg-gray-400'
};

// 안전한 statusConfig 조회
const getStatusConfig = (status: string) => statusConfig[status] || defaultStatusConfig;

// no_consultation 상태의 세분화된 설정 (색상 + 라벨)
function getNoConsultationConfig(aiSummary?: string) {
  if (aiSummary) {
    return {
      icon: '—',
      label: '결과미입력',
      bgColor: 'bg-sky-50',
      textColor: 'text-sky-700',
      borderColor: 'border-sky-200',
      badgeColor: 'bg-sky-400',
    };
  }
  return {
    icon: '—',
    label: '상담미입력',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    badgeColor: 'bg-gray-400',
  };
}

// 환자 데이터 기반으로 올바른 상태 설정을 반환
function getPatientConfig(patient: { status: string; aiSummary?: string }) {
  if (patient.status === 'no_consultation') {
    return getNoConsultationConfig(patient.aiSummary);
  }
  return getStatusConfig(patient.status);
}

// 요일 변환
const getDayOfWeek = (dateStr: string): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateStr);
  return days[date.getDay()];
};

export default function MobileDailyReportPageWrapper() {
  return (
    <MobileReportErrorBoundary>
      <MobileDailyReportPage />
    </MobileReportErrorBoundary>
  );
}

function MobileDailyReportPage() {
  const params = useParams();
  const router = useRouter();
  const dateParam = params.date as string;

  const [data, setData] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'agreed' | 'disagreed' | 'pending' | 'no_answer' | 'no_consultation' | 'closed'>('all');
  const [selectedPatient, setSelectedPatient] = useState<DailyReportPatient | null>(null);
  const [selectedExistingCall, setSelectedExistingCall] = useState<ExistingPatientCall | null>(null);

  useEffect(() => {
    if (dateParam) {
      fetchReport(dateParam);
    }
  }, [dateParam]);

  const fetchReport = async (date: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v2/reports/daily/${date}`);
      const result = await response.json();

      if (result.success) {
        setData({
          ...result.data,
          dayOfWeek: getDayOfWeek(date)
        });
      } else {
        setError(result.error || '보고서를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 필터링된 환자 목록
  const filteredPatients = data?.patients.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  }) || [];

  // 미동의 > 보류 > 미입력 > 동의 순으로 정렬
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const order: Record<string, number> = { disagreed: 0, pending: 1, no_answer: 2, no_consultation: 3, closed: 4, agreed: 5 };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">보고서 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-2">❌</div>
          <p className="text-gray-700 font-medium">{error}</p>
          <button
            onClick={() => fetchReport(dateParam)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // 환자 상세 보기
  if (selectedPatient) {
    const config = getPatientConfig(selectedPatient);
    const hasDiscount = selectedPatient.discountRate > 0;

    return (
      <div className="bg-gray-50 min-h-screen">
        {/* 헤더 */}
        <div className={`${config.bgColor} border-b ${config.borderColor}`}>
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSelectedPatient(null)} className="p-1 -ml-1 text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeColor} text-white`}>
                  {config.label}
                </span>
                <h1 className="font-semibold text-gray-900">{selectedPatient.name}</h1>
                {selectedPatient.gender && selectedPatient.age && (
                  <span className="text-sm text-gray-500">({selectedPatient.gender}/{selectedPatient.age}세)</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-sm text-gray-600">{selectedPatient.treatment || '치료 미정'}</p>
                {selectedPatient.consultationType && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${
                    selectedPatient.consultationType === 'inbound'
                      ? 'bg-blue-100 text-blue-700'
                      : selectedPatient.consultationType === 'outbound'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-teal-100 text-teal-700'
                  }`}>
                    {selectedPatient.consultationType === 'inbound' ? '인바운드'
                      : selectedPatient.consultationType === 'outbound' ? '아웃바운드'
                        : selectedPatient.consultationType === 'returning' ? '구신환'
                          : selectedPatient.consultationType}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="px-4 pb-4">
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">연락처</span>
                  <div className="font-medium">{selectedPatient.phone}</div>
                </div>
                <div>
                  <span className="text-gray-500">금액</span>
                  {hasDiscount ? (
                    <div>
                      <span className="text-gray-400 line-through text-xs mr-1">
                        {selectedPatient.originalAmount.toLocaleString()}만
                      </span>
                      <span className="font-medium text-blue-600">
                        {selectedPatient.finalAmount.toLocaleString()}만원
                      </span>
                    </div>
                  ) : (
                    <div className="font-medium text-blue-600">
                      {selectedPatient.originalAmount > 0 ? `${selectedPatient.originalAmount.toLocaleString()}만원` : '-'}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-gray-500">나이</span>
                  <div className="font-medium">{selectedPatient.age ? `${selectedPatient.age}세` : '-'}</div>
                </div>
                <div>
                  <span className="text-gray-500">거주지</span>
                  <div className="font-medium">
                    {selectedPatient.region
                      ? typeof selectedPatient.region === 'string'
                        ? selectedPatient.region
                        : `${selectedPatient.region.province}${selectedPatient.region.city ? ` ${selectedPatient.region.city}` : ''}`
                      : '-'}
                  </div>
                </div>
              </div>

              {/* 할인 정보 */}
              {hasDiscount && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                        할인 {selectedPatient.discountRate}%
                      </span>
                      <span className="text-sm text-gray-600">
                        -{selectedPatient.discountAmount.toLocaleString()}만원
                      </span>
                    </div>
                    {selectedPatient.discountReason && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {selectedPatient.discountReason}
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
          {/* 상담 내용 - consultations 타임라인 (최신순) */}
          {selectedPatient.consultations && selectedPatient.consultations.length > 0 ? (
            <div className="space-y-3">
              {[...selectedPatient.consultations].reverse().map((entry, idx) => (
                <div key={idx} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="mb-2">
                    {/* 1행: 타입 + 태그 + 시간 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{entry.type === 'visit' ? '🏥' : entry.source === 'manual' ? '✏️' : '📞'}</span>
                        <span className="font-semibold text-gray-900 text-sm whitespace-nowrap">
                          {entry.type === 'visit' ? '내원' : '전화'}
                        </span>
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
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{entry.time}</span>
                    </div>
                    {/* 2행: 통화시간 + 상담사 */}
                    {(entry.duration != null && entry.duration > 0 || entry.consultantName) && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        {entry.type !== 'visit' && entry.duration != null && entry.duration > 0 && (
                          <span>통화 {formatDuration(entry.duration)}</span>
                        )}
                        {entry.consultantName && (
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded">{entry.consultantName}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {entry.content ? (
                    <ul className="space-y-1.5">
                      {entry.content.split('\n').filter(line => line.trim()).map((line, lineIdx) => (
                        <li key={lineIdx} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-blue-500 mt-0.5">•</span>
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
          ) : selectedPatient.aiSummary ? (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span>📞</span>
                <h2 className="font-semibold text-gray-900 text-sm">상담 내용</h2>
                <span className="text-xs text-gray-400">(AI 요약)</span>
              </div>
              <ul className="space-y-1.5">
                {selectedPatient.aiSummary.split('\n').filter(line => line.trim()).map((line, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{line.trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 상담사 메모 (상담 타임라인에 이미 포함된 내용이면 중복 표시 안 함) */}
          {selectedPatient.memo && (() => {
            const memoTrimmed = selectedPatient.memo!.trim();
            const isDuplicate = selectedPatient.consultations?.some(
              (entry) => entry.content?.trim() === memoTrimmed || entry.content?.trim().includes(memoTrimmed)
            );
            if (isDuplicate) return null;
            return (
              <div className="bg-amber-50 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span>📝</span>
                  <h2 className="font-semibold text-gray-900 text-sm">상담사 메모</h2>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedPatient.memo}
                </p>
              </div>
            );
          })()}

          {/* 미동의/보류 사유 (카테고리별 표시) */}
          {(selectedPatient.status === 'disagreed' || selectedPatient.status === 'pending') &&
           selectedPatient.disagreeReasons?.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">❌</span>
                <h2 className="font-semibold text-gray-900">
                  {selectedPatient.status === 'disagreed' ? '미동의 사유' : '보류 사유'}
                </h2>
              </div>
              <div className="space-y-4">
                {Object.entries(disagreeReasonCategories).map(([key, category]) => {
                  const categoryReasons = category.reasons.filter(r =>
                    selectedPatient.disagreeReasons.includes(r)
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
                          const isSelected = selectedPatient.disagreeReasons.includes(reason);
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
          {selectedPatient.correctionPlan && (
            <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📝</span>
                <h2 className="font-semibold text-blue-900">시정 계획</h2>
              </div>
              <p className="text-sm text-blue-800 leading-relaxed">
                "{selectedPatient.correctionPlan}"
              </p>
            </div>
          )}

          {/* 예약 정보 */}
          {selectedPatient.status === 'agreed' && selectedPatient.appointmentDate && (
            <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📅</span>
                <h2 className="font-semibold text-emerald-900">예약 정보</h2>
              </div>
              <p className="text-lg font-semibold text-emerald-800">
                {selectedPatient.appointmentDate}
              </p>
            </div>
          )}

          {/* 콜백 예정 */}
          {selectedPatient.callbackDate && (
            <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📞</span>
                <h2 className="font-semibold text-amber-900">콜백 예정</h2>
              </div>
              <p className="text-lg font-semibold text-amber-800">
                {selectedPatient.callbackDate}
              </p>
            </div>
          )}
        </div>

        {/* 하단 액션 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        </div>
      </div>
    );
  }

  // 기존 환자 통화 상세 보기
  if (selectedExistingCall) {
    const patientStatusLabels: Record<string, string> = {
      treatment: '치료중',
      treatmentBooked: '치료예약',
      completed: '치료완료',
      followup: '사후관리',
      closed: '종결',
      consulting: '상담중',
      reserved: '내원예약',
    };
    const statusLabel = patientStatusLabels[selectedExistingCall.patientStatus] || selectedExistingCall.patientStatus;

    return (
      <div className="bg-gray-50 min-h-screen">
        {/* 헤더 */}
        <div className="bg-slate-50 border-b border-slate-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSelectedExistingCall(null)} className="p-1 -ml-1 text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500 text-white">
                  {statusLabel}
                </span>
                {selectedExistingCall.source === 'manual' ? (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">수동</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">자동</span>
                )}
                {selectedExistingCall.direction && (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    selectedExistingCall.direction === 'inbound'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {selectedExistingCall.direction === 'inbound' ? '수신' : '발신'}
                  </span>
                )}
                <h1 className="font-semibold text-gray-900">{selectedExistingCall.name}</h1>
                {selectedExistingCall.gender && selectedExistingCall.age && (
                  <span className="text-sm text-gray-500">({selectedExistingCall.gender}/{selectedExistingCall.age}세)</span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{selectedExistingCall.treatment || '치료 미정'}</p>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="px-4 pb-4">
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">연락처</span>
                  <div className="font-medium">{selectedExistingCall.phone}</div>
                </div>
                <div>
                  <span className="text-gray-500">통화 시간</span>
                  <div className="font-medium">
                    {selectedExistingCall.time}
                    {selectedExistingCall.duration != null && selectedExistingCall.duration > 0 && (
                      <span className="text-gray-400 ml-1">({formatDuration(selectedExistingCall.duration)})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 상세 내용 */}
        <div className="p-4 space-y-4">
          {/* 통화 내용 (AI 요약) */}
          {selectedExistingCall.aiSummary ? (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span>📞</span>
                <h2 className="font-semibold text-gray-900 text-sm">통화 내용</h2>
                <span className="text-xs text-gray-400">(AI 요약)</span>
              </div>
              <ul className="space-y-1.5">
                {selectedExistingCall.aiSummary.split('\n').filter(line => line.trim()).map((line, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{line.trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">
              통화 내용 요약이 없습니다.
            </div>
          )}

          {/* 메모 */}
          {selectedExistingCall.memo && (
            <div className="bg-amber-50 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span>📝</span>
                <h2 className="font-semibold text-gray-900 text-sm">메모</h2>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedExistingCall.memo}</p>
            </div>
          )}
        </div>

        {/* 하단 액션 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
          <a
            href={`tel:${selectedExistingCall.phone}`}
            className="block w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-700 text-center transition-colors"
          >
            📞 전화 걸기
          </a>
        </div>
        <div className="h-24"></div>
      </div>
    );
  }

  // 대시보드 뷰
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="font-semibold text-gray-900">D-Care 일별 보고서</h1>
          <p className="text-xs text-gray-500">{data.date} ({data.dayOfWeek}) 신규 상담</p>
        </div>

        {/* 요약 카드 (압축) */}
        <div className="px-4 pb-3">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl px-4 py-3 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold">{data.summary.total}건</span>
                <span className="text-blue-200 text-xs">상담</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold">
                  {data.summary.total > 0 ? Math.round((data.summary.agreed / data.summary.total) * 100) : 0}%
                </span>
                <span className="text-blue-200 text-xs">동의율</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/20 space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-blue-200">확정 매출 (동의 {data.summary.agreed}건)</span>
                <span className="font-bold">{data.summary.actualRevenue.toLocaleString()}만원</span>
              </div>
              {data.summary.expectedRevenue > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-blue-200">
                    정가 {data.summary.expectedRevenue.toLocaleString()}만
                    {data.summary.totalDiscount > 0 && (
                      <span className="text-yellow-300">
                        {' '}→ 할인 -{data.summary.totalDiscount.toLocaleString()}만
                        {data.summary.avgDiscountRate > 0 && `(${data.summary.avgDiscountRate}%)`}
                      </span>
                    )}
                  </span>
                  <span className="text-white font-medium">
                    할인가 {(data.summary.expectedRevenue - data.summary.totalDiscount).toLocaleString()}만
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI 인사이트 */}
        {data.aiInsights && data.aiInsights.length > 0 && (
          <div className="px-4 pb-3">
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">✨</span>
                <span className="text-sm font-medium text-purple-700">AI 인사이트</span>
              </div>
              <ul className="text-sm text-purple-600 space-y-1">
                {data.aiInsights.slice(0, 3).map((insight, i) => (
                  <li key={i}>• {insight}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 필터 탭 */}
        <div className="px-4 pb-2 flex gap-2">
          {[
            { key: 'all' as const, label: '전체', count: data.summary.total },
            { key: 'disagreed' as const, label: '미동의', count: data.summary.disagreed },
            { key: 'pending' as const, label: '보류', count: data.summary.pending },
            ...(data.summary.noAnswer ? [{ key: 'no_answer' as const, label: '부재중', count: data.summary.noAnswer }] : []),
            { key: 'agreed' as const, label: '동의', count: data.summary.agreed },
            ...(data.summary.closed ? [{ key: 'closed' as const, label: '종결', count: data.summary.closed }] : []),
            ...(data.summary.noConsultation ? [{ key: 'no_consultation' as const, label: '미입력', count: data.summary.noConsultation }] : []),
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-blue-500 text-white'
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
          <div className="text-center py-8 text-gray-500">
            해당 조건의 상담 기록이 없습니다.
          </div>
        ) : (
          sortedPatients.map(patient => {
            const config = getPatientConfig(patient);
            const hasDiscount = patient.discountRate > 0;

            return (
              <button
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className={`w-full text-left bg-white rounded-xl border ${config.borderColor} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full ${config.badgeColor} text-white text-xs flex items-center justify-center font-bold`}>
                        {config.icon}
                      </span>
                      <span className="font-semibold text-gray-900">{patient.name}</span>
                      {patient.gender && patient.age && (
                        <span className="text-sm text-gray-500">
                          {patient.gender}/{patient.age}세
                        </span>
                      )}
                      {patient.consultations && patient.consultations.length > 1 && (
                        <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-xs rounded font-medium">
                          상담 {patient.consultations.length}건
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{patient.time}</span>
                  </div>

                  <div className="text-sm text-gray-900 mb-2">{patient.treatment || '치료 미정'}</div>

                  {patient.status === 'disagreed' && patient.disagreeReasons?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {patient.disagreeReasons.map((reason, i) => (
                        <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded-full">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {patient.status === 'pending' && patient.disagreeReasons?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {patient.disagreeReasons.map((reason, i) => (
                        <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {patient.status === 'agreed' && patient.appointmentDate && (
                    <div className="text-sm text-emerald-600">
                      📅 예약: {patient.appointmentDate}
                    </div>
                  )}

                  {(patient.status === 'disagreed' || patient.status === 'pending' || patient.status === 'no_answer') && (
                    <div className={`text-sm ${
                      patient.status === 'disagreed' ? 'text-rose-600'
                        : patient.status === 'no_answer' ? 'text-slate-600'
                        : 'text-amber-600'
                    }`}>
                      {patient.callbackDate
                        ? `📞 콜백 예정: ${patient.callbackDate}`
                        : '📞 예정된 콜백 없음'}
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
                          <span className="text-sm font-medium text-blue-600">
                            {patient.finalAmount.toLocaleString()}만원
                          </span>
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                            -{patient.discountRate}%
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">
                          {patient.originalAmount > 0 ? `${patient.originalAmount.toLocaleString()}만원` : '-'}
                        </span>
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

      {/* 기존 환자 통화 섹션 */}
      {data.existingPatientCalls && data.existingPatientCalls.length > 0 && (
        <div className="p-4 pt-0">
          <div className="bg-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">👥</span>
              <h2 className="font-semibold text-gray-700">기존 환자 통화</h2>
              <span className="text-sm text-gray-500">({data.existingPatientCallSummary?.total || 0}건)</span>
            </div>
            <div className="space-y-2">
              {data.existingPatientCalls.map(call => (
                <button
                  key={call.id}
                  onClick={() => setSelectedExistingCall(call)}
                  className="w-full text-left bg-white rounded-lg p-3 text-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{call.name}</span>
                    <span className="text-xs text-gray-400">{call.time}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-gray-500 text-xs">
                      {call.treatment || call.patientStatus}
                    </span>
                    <span className="text-xs text-blue-500">
                      상세보기 →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 하단 여백 */}
      <div className="h-8"></div>
    </div>
  );
}
