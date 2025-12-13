'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import { useAppDispatch } from '@/hooks/reduxHooks';
import { setCurrentMenuItem } from '@/store/slices/uiSlice';
import {
  Users,
  UserPlus,
  Gift,
  Trophy,
  Search,
  RefreshCw,
  Filter,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Bell,
  BellOff,
  Edit,
  Save,
  Heart,
  Award,
  Calendar,
  Phone,
  MessageSquare,
  BarChart3,
  List,
} from 'lucide-react';

// 타입 정의
type TabType = 'dashboard' | 'register' | 'list' | 'ranking';
type ReferralStatus = 'registered' | 'visited' | 'treating' | 'completed';

interface Referral {
  _id: string;
  referrerId: string;
  referrerName: string;
  referrerPhone: string;
  referredId: string;
  referredName: string;
  referredPhone: string;
  referralDate: string;
  referredStatus: ReferralStatus;
  treatmentType?: string;
  thanksSent: boolean;
  thanksSentDate?: string;
  nextVisitAlert: boolean;
  alertMessage?: string;
  notes?: string;
  createdAt: string;
}

interface Stats {
  totalReferrals: number;
  monthReferrals: number;
  pendingThanks: number;
  totalReferrers: number;
}

interface RankingItem {
  _id: string;
  referrerName: string;
  referrerPhone: string;
  count: number;
  lastReferralDate: string;
}

interface Patient {
  _id: string;
  name: string;
  phoneNumber: string;
  chartNo?: string;
}

// 상태 라벨
const statusLabels: Record<ReferralStatus, { label: string; color: string; bgColor: string }> = {
  registered: { label: '등록', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  visited: { label: '내원', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  treating: { label: '진료중', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  completed: { label: '완료', color: 'text-green-600', bgColor: 'bg-green-100' }
};

export default function ReferralsPage() {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);

  // 대시보드 상태
  const [stats, setStats] = useState<Stats>({
    totalReferrals: 0,
    monthReferrals: 0,
    pendingThanks: 0,
    totalReferrers: 0
  });

  // 목록 상태
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [pagination, setPagination] = useState({
    page: 1, limit: 50, total: 0, totalPages: 0
  });
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // 랭킹 상태
  const [ranking, setRanking] = useState<RankingItem[]>([]);

  // 등록 상태
  const [referrerSearch, setReferrerSearch] = useState('');
  const [referredSearch, setReferredSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedReferrer, setSelectedReferrer] = useState<Patient | null>(null);
  const [selectedReferred, setSelectedReferred] = useState<Patient | null>(null);
  const [searchingFor, setSearchingFor] = useState<'referrer' | 'referred' | null>(null);

  // 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [detailReferrals, setDetailReferrals] = useState<Referral[]>([]);

  useEffect(() => {
    dispatch(setCurrentMenuItem('소개환자 관리'));
  }, [dispatch]);

  // 통계 조회
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/referrals?type=stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('통계 조회 실패:', error);
    }
  }, []);

  // 목록 조회
  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filter === 'pending') {
        params.append('thanksSent', 'false');
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      if (dateRange.startDate) {
        params.append('startDate', dateRange.startDate);
      }
      if (dateRange.endDate) {
        params.append('endDate', dateRange.endDate);
      }

      const response = await fetch(`/api/referrals?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setReferrals(data.data);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filter, searchQuery, dateRange]);

  // 랭킹 조회
  const fetchRanking = useCallback(async () => {
    try {
      const response = await fetch('/api/referrals?type=ranking&limit=10');
      const data = await response.json();
      if (data.success) {
        setRanking(data.data);
      }
    } catch (error) {
      console.error('랭킹 조회 실패:', error);
    }
  }, []);

  // 환자 검색
  const searchPatients = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.data || data.patients || []);
      }
    } catch (error) {
      console.error('환자 검색 실패:', error);
    }
  }, []);

  // 탭에 따른 데이터 로드
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchStats();
      fetchRanking();
    } else if (activeTab === 'list') {
      fetchReferrals();
    } else if (activeTab === 'ranking') {
      fetchRanking();
    }
  }, [activeTab, fetchStats, fetchReferrals, fetchRanking]);

  // 소개 등록
  const handleRegister = async () => {
    if (!selectedReferrer || !selectedReferred) {
      alert('소개자와 피소개자를 모두 선택해주세요.');
      return;
    }

    if (selectedReferrer._id === selectedReferred._id) {
      alert('소개자와 피소개자가 동일합니다.');
      return;
    }

    try {
      const response = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrerId: selectedReferrer._id,
          referrerName: selectedReferrer.name,
          referrerPhone: selectedReferrer.phoneNumber,
          referredId: selectedReferred._id,
          referredName: selectedReferred.name,
          referredPhone: selectedReferred.phoneNumber,
          referralDate: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('소개 기록이 등록되었습니다.');
        setSelectedReferrer(null);
        setSelectedReferred(null);
        setReferrerSearch('');
        setReferredSearch('');
        fetchStats();
      } else {
        alert('등록 실패: ' + data.error);
      }
    } catch (error) {
      console.error('등록 실패:', error);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  // 감사인사 완료 처리
  const handleMarkThanksSent = async (id: string) => {
    if (!confirm('감사인사를 전달 완료로 표시하시겠습니까?')) return;

    try {
      const response = await fetch('/api/referrals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'markThanksSent' })
      });

      const data = await response.json();
      if (data.success) {
        alert('감사인사 전달 완료로 표시되었습니다.');
        fetchReferrals();
        fetchStats();
        if (showDetailModal) {
          fetchReferrerDetail(selectedReferral?.referrerId || '');
        }
      }
    } catch (error) {
      console.error('처리 실패:', error);
    }
  };

  // 소개자 상세 조회
  const fetchReferrerDetail = async (referrerId: string) => {
    try {
      const response = await fetch(`/api/referrals?type=detail&referrerId=${referrerId}`);
      const data = await response.json();
      if (data.success) {
        setDetailReferrals(data.data.referrals);
      }
    } catch (error) {
      console.error('상세 조회 실패:', error);
    }
  };

  // 상세 모달 열기
  const openDetailModal = (referral: Referral) => {
    setSelectedReferral(referral);
    setShowDetailModal(true);
    fetchReferrerDetail(referral.referrerId);
  };

  // 새로고침
  const handleRefresh = () => {
    if (activeTab === 'dashboard') {
      fetchStats();
      fetchRanking();
    } else if (activeTab === 'list') {
      fetchReferrals();
    } else if (activeTab === 'ranking') {
      fetchRanking();
    }
  };

  return (
    <AuthGuard>
      <AppLayout currentPage="referrals">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">소개환자 관리</h1>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
          </div>

          {/* 탭 */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            {[
              { id: 'dashboard' as TabType, label: '대시보드', icon: BarChart3 },
              { id: 'register' as TabType, label: '소개 등록', icon: UserPlus },
              { id: 'list' as TabType, label: '소개 목록', icon: List },
              { id: 'ranking' as TabType, label: '소개왕 랭킹', icon: Trophy }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 대시보드 탭 */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* 통계 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">총 소개 건수</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}건</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Calendar className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">이번달 소개</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.monthReferrals}건</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Gift className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">감사인사 미전달</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.pendingThanks}건</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Heart className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">총 소개자 수</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalReferrers}명</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 소개왕 TOP 5 미리보기 */}
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    소개왕 TOP 5
                  </h3>
                  <button
                    onClick={() => setActiveTab('ranking')}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    전체보기
                  </button>
                </div>
                <div className="divide-y">
                  {ranking.slice(0, 5).map((item, index) => (
                    <div key={item._id} className="p-4 flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.referrerName}</p>
                        <p className="text-sm text-gray-500">{item.referrerPhone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">{item.count}건</p>
                      </div>
                    </div>
                  ))}
                  {ranking.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>소개 기록이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 소개 등록 탭 */}
          {activeTab === 'register' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">새 소개 등록</h3>

                {/* 소개자 선택 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    소개자 (기존 환자)
                  </label>
                  {selectedReferrer ? (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{selectedReferrer.name}</p>
                        <p className="text-sm text-gray-500">{selectedReferrer.phoneNumber}</p>
                      </div>
                      <button
                        onClick={() => setSelectedReferrer(null)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="소개자 이름 또는 전화번호 검색..."
                        value={referrerSearch}
                        onChange={(e) => {
                          setReferrerSearch(e.target.value);
                          setSearchingFor('referrer');
                          searchPatients(e.target.value);
                        }}
                        onFocus={() => setSearchingFor('referrer')}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {searchingFor === 'referrer' && searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {searchResults.map(patient => (
                            <button
                              key={patient._id}
                              onClick={() => {
                                setSelectedReferrer(patient);
                                setReferrerSearch('');
                                setSearchResults([]);
                                setSearchingFor(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                            >
                              <User className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="font-medium text-gray-900">{patient.name}</p>
                                <p className="text-sm text-gray-500">{patient.phoneNumber}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 피소개자 선택 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    피소개자 (소개받은 신규 환자)
                  </label>
                  {selectedReferred ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="p-2 bg-green-100 rounded-full">
                        <UserPlus className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{selectedReferred.name}</p>
                        <p className="text-sm text-gray-500">{selectedReferred.phoneNumber}</p>
                      </div>
                      <button
                        onClick={() => setSelectedReferred(null)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="피소개자 이름 또는 전화번호 검색..."
                        value={referredSearch}
                        onChange={(e) => {
                          setReferredSearch(e.target.value);
                          setSearchingFor('referred');
                          searchPatients(e.target.value);
                        }}
                        onFocus={() => setSearchingFor('referred')}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {searchingFor === 'referred' && searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {searchResults.map(patient => (
                            <button
                              key={patient._id}
                              onClick={() => {
                                setSelectedReferred(patient);
                                setReferredSearch('');
                                setSearchResults([]);
                                setSearchingFor(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                            >
                              <User className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="font-medium text-gray-900">{patient.name}</p>
                                <p className="text-sm text-gray-500">{patient.phoneNumber}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 등록 버튼 */}
                <button
                  onClick={handleRegister}
                  disabled={!selectedReferrer || !selectedReferred}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>소개 등록</span>
                </button>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  <strong>안내:</strong> 소개자가 내원할 때 자동으로 알림이 표시되어 감사인사를 전달할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* 소개 목록 탭 */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* 필터 및 검색 */}
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* 상태 필터 */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <div className="flex rounded-lg overflow-hidden border border-gray-300">
                      {(['all', 'pending'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            setFilter(status);
                            setPagination(prev => ({ ...prev, page: 1 }));
                          }}
                          className={`px-4 py-2 text-sm transition-colors ${
                            filter === status
                              ? 'bg-blue-600 text-white'
                              : 'bg-white hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          {status === 'all' ? '전체' : '감사인사 미전달'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 검색 */}
                  <div className="flex-1 min-w-[200px] max-w-md">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="소개자/피소개자 이름 검색..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* 날짜 필터 */}
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => {
                        setDateRange(prev => ({ ...prev, startDate: e.target.value }));
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">~</span>
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => {
                        setDateRange(prev => ({ ...prev, endDate: e.target.value }));
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 목록 테이블 */}
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">소개자</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">피소개자</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">소개일</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">상태</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">감사인사</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-500">
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                            <span>로딩 중...</span>
                          </div>
                        </td>
                      </tr>
                    ) : referrals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-500">
                          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>소개 기록이 없습니다</p>
                        </td>
                      </tr>
                    ) : (
                      referrals.map(referral => (
                        <tr
                          key={referral._id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => openDetailModal(referral)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-600" />
                              <div>
                                <p className="font-medium text-gray-900">{referral.referrerName}</p>
                                <p className="text-sm text-gray-500">{referral.referrerPhone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <UserPlus className="w-4 h-4 text-green-600" />
                              <div>
                                <p className="font-medium text-gray-900">{referral.referredName}</p>
                                <p className="text-sm text-gray-500">{referral.referredPhone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-900">
                              {format(new Date(referral.referralDate), 'yyyy-MM-dd', { locale: ko })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[referral.referredStatus].bgColor} ${statusLabels[referral.referredStatus].color}`}>
                              {statusLabels[referral.referredStatus].label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {referral.thanksSent ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm">완료</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-yellow-600">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm">대기</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!referral.thanksSent && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkThanksSent(referral._id);
                                }}
                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                              >
                                감사인사 완료
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* 페이지네이션 */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                    <div className="text-sm text-gray-600">
                      전체 {pagination.total}건
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        이전
                      </button>
                      <span className="text-sm text-gray-600">
                        {pagination.page} / {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page >= pagination.totalPages}
                        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 소개왕 랭킹 탭 */}
          {activeTab === 'ranking' && (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-r from-yellow-50 to-amber-50">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  소개왕 TOP 10
                </h3>
              </div>
              <div className="divide-y">
                {ranking.map((item, index) => (
                  <div key={item._id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-md' :
                      index === 2 ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-md' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-lg">{item.referrerName}</p>
                      <p className="text-sm text-gray-500">{item.referrerPhone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{item.count}건</p>
                      <p className="text-xs text-gray-500">
                        마지막 소개: {format(new Date(item.lastReferralDate), 'yyyy-MM-dd', { locale: ko })}
                      </p>
                    </div>
                    {index < 3 && (
                      <Award className={`w-8 h-8 ${
                        index === 0 ? 'text-yellow-500' :
                        index === 1 ? 'text-gray-400' :
                        'text-amber-600'
                      }`} />
                    )}
                  </div>
                ))}
                {ranking.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">소개 기록이 없습니다</p>
                    <p className="text-sm mt-2">첫 소개를 등록해보세요!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 소개자 상세 모달 */}
        {showDetailModal && selectedReferral && (
          <ReferrerDetailModal
            referral={selectedReferral}
            referrals={detailReferrals}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedReferral(null);
              setDetailReferrals([]);
            }}
            onMarkThanksSent={handleMarkThanksSent}
          />
        )}
      </AppLayout>
    </AuthGuard>
  );
}

// 소개자 상세 모달 컴포넌트
function ReferrerDetailModal({
  referral,
  referrals,
  onClose,
  onMarkThanksSent
}: {
  referral: Referral;
  referrals: Referral[];
  onClose: () => void;
  onMarkThanksSent: (id: string) => void;
}) {
  const totalReferrals = referrals.length;
  const pendingThanks = referrals.filter(r => !r.thanksSent).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">소개자 상세</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {/* 소개자 정보 */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold text-gray-900">{referral.referrerName}</p>
                <p className="text-gray-600">{referral.referrerPhone}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-600">{totalReferrals}건</p>
                <p className="text-sm text-gray-500">총 소개</p>
              </div>
            </div>
            {pendingThanks > 0 && (
              <div className="mt-3 p-2 bg-yellow-100 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">
                  감사인사 미전달 {pendingThanks}건
                </span>
              </div>
            )}
          </div>

          {/* 소개 목록 */}
          <h4 className="font-medium text-gray-900 mb-3">소개한 환자 목록</h4>
          <div className="space-y-2">
            {referrals.map(ref => (
              <div key={ref._id} className="border rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">{ref.referredName}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(ref.referralDate), 'yyyy-MM-dd', { locale: ko })}
                      {ref.treatmentType && ` · ${ref.treatmentType}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ref.thanksSent ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      감사인사 완료
                    </span>
                  ) : (
                    <button
                      onClick={() => onMarkThanksSent(ref._id)}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      감사인사 완료
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
