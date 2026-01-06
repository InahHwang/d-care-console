// src/app/v2/referrals/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/v2/layout/PageHeader';
import {
  Users,
  Phone,
  Gift,
  CheckCircle,
  Clock,
  Plus,
  Award,
  TrendingUp,
  Filter,
} from 'lucide-react';
import type { PatientStatus } from '@/types/v2';

interface ReferralItem {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerPhone: string;
  referredId: string;
  referredName: string;
  referredPhone: string;
  referredStatus: PatientStatus;
  referredInterest: string;
  referredCreatedAt: string;
  thanksSent: boolean;
  thanksSentAt?: string;
  createdAt: string;
}

interface TopReferrer {
  id: string;
  name: string;
  phone: string;
  count: number;
}

interface ReferralStats {
  total: number;
  thanksSent: number;
  thanksPending: number;
}

const STATUS_LABELS: Record<PatientStatus, string> = {
  consulting: '전화상담',
  reserved: '내원예약',
  visited: '내원완료',
  treatmentBooked: '치료예약',
  treatment: '치료중',
  completed: '치료완료',
  followup: '사후관리',
  closed: '종결',
};

export default function ReferralsPage() {
  const router = useRouter();
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterThanks, setFilterThanks] = useState<'all' | 'sent' | 'pending'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchReferrals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterThanks === 'sent') params.set('thanksSent', 'true');
      if (filterThanks === 'pending') params.set('thanksSent', 'false');

      const response = await fetch(`/api/v2/referrals?${params}`);
      const result = await response.json();

      if (result.success) {
        setReferrals(result.data.referrals);
        setStats(result.data.stats);
        setTopReferrers(result.data.topReferrers);
      }
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    } finally {
      setLoading(false);
    }
  }, [filterThanks]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleThanksToggle = async (id: string, currentValue: boolean) => {
    try {
      const response = await fetch('/api/v2/referrals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, thanksSent: !currentValue }),
      });

      if (response.ok) {
        fetchReferrals();
      }
    } catch (error) {
      console.error('Failed to update thanks status:', error);
    }
  };

  const handleCallReferrer = (phone: string) => {
    window.dispatchEvent(
      new CustomEvent('cti-call', { detail: { phone } })
    );
  };

  const handlePatientClick = (patientId: string) => {
    router.push(`/v2/patients/${patientId}`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="소개 관리"
        subtitle="소개 환자와 감사 연락 현황을 관리하세요"
        action={{
          label: '소개 등록',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => setShowAddModal(true),
        }}
      />

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Users className="w-4 h-4" />
              전체 소개
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <Gift className="w-4 h-4" />
              감사 완료
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.thanksSent}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
              <Clock className="w-4 h-4" />
              감사 대기
            </div>
            <div className="text-2xl font-bold text-amber-600">{stats.thanksPending}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              전환율
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.total > 0 ? Math.round((stats.thanksSent / stats.total) * 100) : 0}%
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 소개 목록 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 필터 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterThanks}
                onChange={(e) => setFilterThanks(e.target.value as 'all' | 'sent' | 'pending')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">전체</option>
                <option value="sent">감사 완료</option>
                <option value="pending">감사 대기</option>
              </select>
            </div>
          </div>

          {/* 목록 */}
          <div className="bg-white rounded-xl border border-gray-100">
            {loading ? (
              <div className="p-8 text-center text-gray-500">로딩 중...</div>
            ) : referrals.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">등록된 소개 내역이 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* 소개자 */}
                      <div className="flex-1">
                        <div className="text-xs text-gray-400 mb-1">소개자</div>
                        <div
                          className="font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                          onClick={() => handlePatientClick(referral.referrerId)}
                        >
                          {referral.referrerName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {referral.referrerPhone}
                        </div>
                      </div>

                      {/* 화살표 */}
                      <div className="text-gray-300">→</div>

                      {/* 피소개자 */}
                      <div className="flex-1">
                        <div className="text-xs text-gray-400 mb-1">피소개자</div>
                        <div
                          className="font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                          onClick={() => handlePatientClick(referral.referredId)}
                        >
                          {referral.referredName}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          {referral.referredPhone}
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                            {STATUS_LABELS[referral.referredStatus] || referral.referredStatus}
                          </span>
                        </div>
                      </div>

                      {/* 관심분야 */}
                      <div className="w-24 text-center">
                        <div className="text-xs text-gray-400 mb-1">관심분야</div>
                        <div className="text-sm font-medium text-gray-700">
                          {referral.referredInterest || '-'}
                        </div>
                      </div>

                      {/* 등록일 */}
                      <div className="w-24 text-center">
                        <div className="text-xs text-gray-400 mb-1">등록일</div>
                        <div className="text-sm text-gray-600">
                          {formatDate(referral.createdAt)}
                        </div>
                      </div>

                      {/* 감사 상태 */}
                      <div className="flex items-center gap-2">
                        {referral.thanksSent ? (
                          <div className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            감사 완료
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-600 text-sm">
                            <Clock className="w-4 h-4" />
                            감사 대기
                          </div>
                        )}
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCallReferrer(referral.referrerPhone)}
                          className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          title="전화 걸기"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleThanksToggle(referral.id, referral.thanksSent)}
                          className={`p-2 rounded-lg transition-colors ${
                            referral.thanksSent
                              ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              : 'bg-green-500 text-white hover:bg-green-600'
                          }`}
                          title={referral.thanksSent ? '감사 취소' : '감사 완료'}
                        >
                          <Gift className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 상위 소개자 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-gray-700 font-medium mb-4">
              <Award className="w-5 h-5 text-amber-500" />
              Top 소개자
            </div>

            {topReferrers.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                데이터가 없습니다
              </p>
            ) : (
              <div className="space-y-3">
                {topReferrers.map((referrer, index) => (
                  <div
                    key={referrer.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => handlePatientClick(referrer.id)}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-gray-200 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">
                        {referrer.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {referrer.phone}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-blue-600">
                      {referrer.count}명
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 소개 등록 모달 */}
      {showAddModal && (
        <AddReferralModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchReferrals();
          }}
        />
      )}
    </div>
  );
}

// 소개 등록 모달
function AddReferralModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [referrerId, setReferrerId] = useState('');
  const [referredId, setReferredId] = useState('');
  const [referrerSearch, setReferrerSearch] = useState('');
  const [referredSearch, setReferredSearch] = useState('');
  const [referrerResults, setReferrerResults] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [referredResults, setReferredResults] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  // 환자 검색
  const searchPatients = async (query: string, setResults: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; phone: string }>>>) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/v2/patients?search=${query}&limit=10`);
      const result = await response.json();
      if (result.success) {
        setResults(
          result.data.patients.map((p: { id: string; name: string; phone: string }) => ({
            id: p.id,
            name: p.name,
            phone: p.phone,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to search patients:', error);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => searchPatients(referrerSearch, setReferrerResults), 300);
    return () => clearTimeout(debounce);
  }, [referrerSearch]);

  useEffect(() => {
    const debounce = setTimeout(() => searchPatients(referredSearch, setReferredResults), 300);
    return () => clearTimeout(debounce);
  }, [referredSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!referrerId || !referredId) {
      alert('소개자와 피소개자를 모두 선택해주세요.');
      return;
    }

    if (referrerId === referredId) {
      alert('소개자와 피소개자가 같을 수 없습니다.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/v2/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerId, referredId }),
      });

      const result = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        alert(result.error || '소개 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create referral:', error);
      alert('소개 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">소개 등록</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 소개자 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              소개자 (기존 환자)
            </label>
            <input
              type="text"
              value={referrerSearch}
              onChange={(e) => setReferrerSearch(e.target.value)}
              placeholder="이름 또는 전화번호로 검색"
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
            {referrerResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {referrerResults.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setReferrerId(patient.id);
                      setReferrerSearch(`${patient.name} (${patient.phone})`);
                      setReferrerResults([]);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                  >
                    {patient.name} · {patient.phone}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 피소개자 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              피소개자 (신규 환자)
            </label>
            <input
              type="text"
              value={referredSearch}
              onChange={(e) => setReferredSearch(e.target.value)}
              placeholder="이름 또는 전화번호로 검색"
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
            {referredResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {referredResults.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setReferredId(patient.id);
                      setReferredSearch(`${patient.name} (${patient.phone})`);
                      setReferredResults([]);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                  >
                    {patient.name} · {patient.phone}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
