// src/app/v2/patients/mobile/[id]/page.tsx
// 모바일용 환자 상세 페이지
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// 상태 설정
const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
  consulting: { label: '전화상담', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
  reserved: { label: '내원예약', bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
  visited: { label: '내원완료', bgColor: 'bg-amber-100', textColor: 'text-amber-700' },
  treatmentBooked: { label: '치료예약', bgColor: 'bg-teal-100', textColor: 'text-teal-700' },
  treatment: { label: '치료중', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700' },
  completed: { label: '치료완료', bgColor: 'bg-green-100', textColor: 'text-green-700' },
  followup: { label: '사후관리', bgColor: 'bg-slate-100', textColor: 'text-slate-700' },
  closed: { label: '종결', bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
};

interface CallLog {
  id: string;
  callTime: string;
  callType: 'inbound' | 'outbound';
  duration: number;
  summary?: string;
  classification?: string;
}

interface PatientDetail {
  id: string;
  name: string;
  phone: string;
  status: string;
  interest: string;
  summary?: string;
  memo?: string;
  createdAt: string;
  lastContactAt?: string;
  age?: number;
  gender?: '남' | '여';
  region?: {
    province: string;
    city?: string;
  };
  estimatedAmount?: number;
  nextActionDate?: string;
  nextActionNote?: string;
}

export default function MobilePatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
    }
  }, [patientId]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v2/patients/${patientId}`);
      const result = await response.json();

      if (result.success) {
        setPatient(result.data.patient);
        setCallLogs(result.data.callLogs || []);
      } else {
        setError(result.error || '환자 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">환자 정보 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-2">❌</div>
          <p className="text-gray-700 font-medium">{error || '환자 정보를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  const status = statusConfig[patient.status] || statusConfig.consulting;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-gray-900">{patient.name}</h1>
              {patient.gender && patient.age && (
                <span className="text-sm text-gray-500">({patient.gender}/{patient.age}세)</span>
              )}
            </div>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${status.bgColor} ${status.textColor}`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="p-4 space-y-4">
        {/* 연락처 카드 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📱</span>
            <h2 className="font-semibold text-gray-900">연락처</h2>
          </div>
          <div className="text-lg font-medium text-gray-900">{patient.phone}</div>
          {patient.region && (
            <div className="text-sm text-gray-500 mt-1">
              📍 {patient.region.province} {patient.region.city || ''}
            </div>
          )}
        </div>

        {/* 관심 치료 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🦷</span>
            <h2 className="font-semibold text-gray-900">관심 치료</h2>
          </div>
          <div className="text-gray-700">{patient.interest || '미정'}</div>
          {patient.estimatedAmount && patient.estimatedAmount > 0 && (
            <div className="mt-2 text-blue-600 font-medium">
              💰 예상 금액: {(patient.estimatedAmount / 10000).toLocaleString()}만원
            </div>
          )}
        </div>

        {/* AI 요약 */}
        {patient.summary && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">✨</span>
              <h2 className="font-semibold text-gray-900">AI 요약</h2>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {patient.summary}
            </p>
          </div>
        )}

        {/* 메모 */}
        {patient.memo && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📝</span>
              <h2 className="font-semibold text-gray-900">메모</h2>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {patient.memo}
            </p>
          </div>
        )}

        {/* 다음 액션 */}
        {patient.nextActionDate && (
          <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📅</span>
              <h2 className="font-semibold text-amber-900">다음 연락</h2>
            </div>
            <p className="text-lg font-semibold text-amber-800">
              {formatDate(patient.nextActionDate)}
            </p>
            {patient.nextActionNote && (
              <p className="text-sm text-amber-700 mt-1">{patient.nextActionNote}</p>
            )}
          </div>
        )}

        {/* 최근 통화 기록 */}
        {callLogs.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📞</span>
              <h2 className="font-semibold text-gray-900">최근 통화</h2>
              <span className="text-sm text-gray-500">({callLogs.length}건)</span>
            </div>
            <div className="space-y-3">
              {callLogs.slice(0, 5).map((call) => (
                <div key={call.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        call.callType === 'inbound'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {call.callType === 'inbound' ? '수신' : '발신'}
                      </span>
                      <span className="text-sm text-gray-500">{formatDuration(call.duration)}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(call.callTime).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {call.summary && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{call.summary}</p>
                  )}
                </div>
              ))}
              {callLogs.length > 5 && (
                <p className="text-center text-xs text-gray-400 pt-2">
                  +{callLogs.length - 5}건 더 있음
                </p>
              )}
            </div>
          </div>
        )}

        {/* 등록일/최근 연락 */}
        <div className="bg-gray-100 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">등록일</span>
              <div className="font-medium text-gray-700">{formatDate(patient.createdAt)}</div>
            </div>
            {patient.lastContactAt && (
              <div>
                <span className="text-gray-500">최근 연락</span>
                <div className="font-medium text-gray-700">{formatDate(patient.lastContactAt)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 액션 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex gap-3">
          <a
            href={`tel:${patient.phone}`}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-medium text-white text-center transition-colors"
          >
            📞 전화 걸기
          </a>
          <a
            href={`sms:${patient.phone}`}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium text-white text-center transition-colors"
          >
            💬 문자 보내기
          </a>
        </div>
      </div>
      <div className="h-24"></div>
    </div>
  );
}
