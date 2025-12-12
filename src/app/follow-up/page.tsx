'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import { useAppDispatch } from '@/hooks/reduxHooks';
import { setCurrentMenuItem } from '@/store/slices/uiSlice';
import {
  Calendar,
  Clock,
  Send,
  Search,
  RefreshCw,
  Filter,
  User,
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  MessageSquare,
  History,
  BarChart3,
  Users,
  ChevronRight,
} from 'lucide-react';

// 타입 정의
type TabType = 'dashboard' | 'patients' | 'history';
type FollowUpStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
type FollowUpType = 'day1' | 'day3' | 'week1' | 'week2' | 'month1' | 'month3' | 'custom';

interface FollowUpRecord {
  _id: string;
  patientId: string;
  patientName: string;
  phoneNumber: string;
  visitDate: string;
  treatmentType?: string;
  followUpType: FollowUpType;
  scheduledDate: string;
  sentDate?: string;
  status: FollowUpStatus;
  messageTemplate?: string;
  messageContent?: string;
  notes?: string;
  createdAt: string;
}

interface FollowUpHistory {
  _id: string;
  followUpId: string;
  patientId: string;
  patientName: string;
  phoneNumber: string;
  followUpType: FollowUpType;
  messageContent: string;
  sentAt: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

interface Patient {
  _id: string;
  name: string;
  phoneNumber: string;
  visitDate?: string;
  postVisitStatus?: string;
  treatmentType?: string;
  followUps?: FollowUpRecord[];
}

interface Stats {
  todayPending: number;
  weekPending: number;
  monthSent: number;
  totalFailed: number;
  typeStats: Record<string, number>;
}

// 사후관리 타입 라벨
const followUpTypeLabels: Record<FollowUpType, string> = {
  day1: 'D+1',
  day3: 'D+3',
  week1: '1주차',
  week2: '2주차',
  month1: '1개월',
  month3: '3개월',
  custom: '커스텀'
};

// 상태 라벨 및 색상
const statusConfig: Record<FollowUpStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '발송예정', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  sent: { label: '발송완료', color: 'text-green-600', bgColor: 'bg-green-100' },
  failed: { label: '발송실패', color: 'text-red-600', bgColor: 'bg-red-100' },
  cancelled: { label: '취소됨', color: 'text-gray-600', bgColor: 'bg-gray-100' }
};

export default function FollowUpPage() {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);

  // 대시보드 상태
  const [stats, setStats] = useState<Stats>({
    todayPending: 0,
    weekPending: 0,
    monthSent: 0,
    totalFailed: 0,
    typeStats: {}
  });
  const [todayFollowUps, setTodayFollowUps] = useState<FollowUpRecord[]>([]);
  const [recentSentFollowUps, setRecentSentFollowUps] = useState<FollowUpHistory[]>([]);

  // 환자 관리 상태
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientPagination, setPatientPagination] = useState({
    page: 1, limit: 20, total: 0, totalPages: 0
  });
  const [patientSearch, setPatientSearch] = useState('');

  // 발송 이력 상태
  const [history, setHistory] = useState<FollowUpHistory[]>([]);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1, limit: 50, total: 0, totalPages: 0
  });
  const [historyDateRange, setHistoryDateRange] = useState({ startDate: '', endDate: '' });
  const [historySearch, setHistorySearch] = useState('');

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    dispatch(setCurrentMenuItem('사후관리'));
  }, [dispatch]);

  // 통계 조회
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/follow-up?type=stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('통계 조회 실패:', error);
    }
  }, []);

  // 오늘 발송 예정 조회
  const fetchTodayFollowUps = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/follow-up?status=pending&startDate=${today}&endDate=${today}&limit=20`);
      const data = await response.json();
      if (data.success) {
        setTodayFollowUps(data.data);
      }
    } catch (error) {
      console.error('오늘 발송 예정 조회 실패:', error);
    }
  }, []);

  // 최근 발송 현황 조회
  const fetchRecentSentFollowUps = useCallback(async () => {
    try {
      const response = await fetch('/api/follow-up?type=history&limit=10');
      const data = await response.json();
      if (data.success) {
        setRecentSentFollowUps(data.data);
      }
    } catch (error) {
      console.error('최근 발송 현황 조회 실패:', error);
    }
  }, []);

  // 환자 목록 조회
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'patients',
        page: patientPagination.page.toString(),
        limit: patientPagination.limit.toString()
      });
      if (patientSearch) params.append('search', patientSearch);

      const response = await fetch(`/api/follow-up?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setPatients(data.data);
        setPatientPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('환자 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [patientPagination.page, patientPagination.limit, patientSearch]);

  // 발송 이력 조회
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'history',
        page: historyPagination.page.toString(),
        limit: historyPagination.limit.toString()
      });
      if (historySearch) params.append('search', historySearch);
      if (historyDateRange.startDate) params.append('startDate', historyDateRange.startDate);
      if (historyDateRange.endDate) params.append('endDate', historyDateRange.endDate);

      const response = await fetch(`/api/follow-up?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setHistory(data.data);
        setHistoryPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('발송 이력 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [historyPagination.page, historyPagination.limit, historySearch, historyDateRange]);

  // 탭에 따른 데이터 로드
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchStats();
      fetchTodayFollowUps();
      fetchRecentSentFollowUps();
    } else if (activeTab === 'patients') {
      fetchPatients();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchStats, fetchTodayFollowUps, fetchRecentSentFollowUps, fetchPatients, fetchHistory]);

  // 사후관리 발송
  const handleSend = async (followUpId: string) => {
    if (!confirm('이 사후관리 메시지를 발송하시겠습니까?')) return;

    try {
      const response = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', followUpId })
      });
      const data = await response.json();
      if (data.success) {
        alert('발송 완료되었습니다.');
        fetchStats();
        fetchTodayFollowUps();
        fetchRecentSentFollowUps();
      } else {
        alert('발송 실패: ' + data.error);
      }
    } catch (error) {
      console.error('발송 실패:', error);
      alert('발송 중 오류가 발생했습니다.');
    }
  };

  // 사후관리 등록
  const handleCreateFollowUp = async (patientId: string, followUpTypes: FollowUpType[]) => {
    const patient = patients.find(p => p._id === patientId);
    if (!patient) return;

    try {
      const response = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-create',
          patientId: patient._id,
          patientName: patient.name,
          phoneNumber: patient.phoneNumber,
          visitDate: patient.visitDate,
          treatmentType: patient.treatmentType,
          followUpTypes
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(`${followUpTypes.length}개의 사후관리가 등록되었습니다.`);
        fetchPatients();
        setShowCreateModal(false);
        setSelectedPatient(null);
      } else {
        alert('등록 실패: ' + data.error);
      }
    } catch (error) {
      console.error('등록 실패:', error);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  // 새로고침
  const handleRefresh = () => {
    if (activeTab === 'dashboard') {
      fetchStats();
      fetchTodayFollowUps();
      fetchRecentSentFollowUps();
    } else if (activeTab === 'patients') {
      fetchPatients();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  };

  return (
    <AuthGuard>
      <AppLayout currentPage="follow-up">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">사후관리</h1>
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
              { id: 'patients' as TabType, label: '환자 관리', icon: Users },
              { id: 'history' as TabType, label: '발송 이력', icon: History }
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
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">오늘 발송 예정</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.todayPending}건</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">이번주 발송 예정</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.weekPending}건</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">이번달 발송 완료</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.monthSent}건</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">발송 실패</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalFailed}건</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 오늘 발송 예정 + 최근 발송 현황 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 오늘 발송 예정 */}
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="p-4 border-b bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">오늘 발송 예정</h3>
                  </div>
                  <div className="divide-y max-h-96 overflow-y-auto">
                    {todayFollowUps.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>오늘 발송 예정인 사후관리가 없습니다</p>
                      </div>
                    ) : (
                      todayFollowUps.map(followUp => (
                        <div key={followUp._id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{followUp.patientName}</p>
                                <p className="text-sm text-gray-500">{followUp.phoneNumber}</p>
                              </div>
                              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                {followUpTypeLabels[followUp.followUpType]}
                              </span>
                            </div>
                            <button
                              onClick={() => handleSend(followUp._id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              <span>발송</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 최근 발송 현황 */}
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="p-4 border-b bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">최근 발송 현황</h3>
                  </div>
                  <div className="divide-y max-h-96 overflow-y-auto">
                    {recentSentFollowUps.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>최근 발송 이력이 없습니다</p>
                      </div>
                    ) : (
                      recentSentFollowUps.map(item => (
                        <div key={item._id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${item.status === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                                {item.status === 'success' ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{item.patientName}</p>
                                <p className="text-sm text-gray-500">{item.phoneNumber}</p>
                              </div>
                              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                {followUpTypeLabels[item.followUpType]}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-medium ${item.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {item.status === 'success' ? '발송완료' : '발송실패'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(item.sentAt), 'MM/dd HH:mm', { locale: ko })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 환자 관리 탭 */}
          {activeTab === 'patients' && (
            <div className="space-y-4">
              {/* 검색 */}
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 max-w-md">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="환자이름 또는 전화번호 검색..."
                        value={patientSearch}
                        onChange={(e) => {
                          setPatientSearch(e.target.value);
                          setPatientPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 환자 목록 */}
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">환자정보</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">내원일</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">상태</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">사후관리</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-500">
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                            <span>로딩 중...</span>
                          </div>
                        </td>
                      </tr>
                    ) : patients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-500">
                          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>내원완료 환자가 없습니다</p>
                        </td>
                      </tr>
                    ) : (
                      patients.map(patient => (
                        <tr key={patient._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-gray-100 rounded-full">
                                <User className="w-4 h-4 text-gray-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{patient.name}</p>
                                <p className="text-sm text-gray-500">{patient.phoneNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-900">
                              {patient.visitDate
                                ? format(new Date(patient.visitDate), 'yyyy-MM-dd', { locale: ko })
                                : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              {patient.postVisitStatus || '내원완료'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {patient.followUps && patient.followUps.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {patient.followUps.map(fu => (
                                  <span
                                    key={fu._id}
                                    className={`px-2 py-0.5 text-xs rounded-full ${statusConfig[fu.status].bgColor} ${statusConfig[fu.status].color}`}
                                  >
                                    {followUpTypeLabels[fu.followUpType]}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">미등록</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedPatient(patient);
                                setShowCreateModal(true);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ml-auto"
                            >
                              <Plus className="w-4 h-4" />
                              <span>등록</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* 페이지네이션 */}
                {patientPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                    <div className="text-sm text-gray-600">
                      전체 {patientPagination.total}명
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPatientPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={patientPagination.page === 1}
                        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        이전
                      </button>
                      <span className="text-sm text-gray-600">
                        {patientPagination.page} / {patientPagination.totalPages}
                      </span>
                      <button
                        onClick={() => setPatientPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={patientPagination.page >= patientPagination.totalPages}
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

          {/* 발송 이력 탭 */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* 필터 */}
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[200px] max-w-md">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="환자이름 또는 전화번호 검색..."
                        value={historySearch}
                        onChange={(e) => {
                          setHistorySearch(e.target.value);
                          setHistoryPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={historyDateRange.startDate}
                      onChange={(e) => {
                        setHistoryDateRange(prev => ({ ...prev, startDate: e.target.value }));
                        setHistoryPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">~</span>
                    <input
                      type="date"
                      value={historyDateRange.endDate}
                      onChange={(e) => {
                        setHistoryDateRange(prev => ({ ...prev, endDate: e.target.value }));
                        setHistoryPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 이력 테이블 */}
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">발송일시</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">환자정보</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">타입</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">상태</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">메시지</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-500">
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                            <span>로딩 중...</span>
                          </div>
                        </td>
                      </tr>
                    ) : history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-500">
                          <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>발송 이력이 없습니다</p>
                        </td>
                      </tr>
                    ) : (
                      history.map(item => (
                        <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-gray-900">
                              {format(new Date(item.sentAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{item.patientName}</p>
                              <p className="text-sm text-gray-500">{item.phoneNumber}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                              {followUpTypeLabels[item.followUpType]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {item.status === 'success' ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm">성공</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="w-4 h-4" />
                                <span className="text-sm">실패</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-600 truncate max-w-xs">
                              {item.messageContent || '-'}
                            </p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* 페이지네이션 */}
                {historyPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                    <div className="text-sm text-gray-600">
                      전체 {historyPagination.total}건
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHistoryPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={historyPagination.page === 1}
                        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        이전
                      </button>
                      <span className="text-sm text-gray-600">
                        {historyPagination.page} / {historyPagination.totalPages}
                      </span>
                      <button
                        onClick={() => setHistoryPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={historyPagination.page >= historyPagination.totalPages}
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
        </div>

        {/* 사후관리 등록 모달 */}
        {showCreateModal && selectedPatient && (
          <CreateFollowUpModal
            patient={selectedPatient}
            onClose={() => {
              setShowCreateModal(false);
              setSelectedPatient(null);
            }}
            onCreate={handleCreateFollowUp}
          />
        )}
      </AppLayout>
    </AuthGuard>
  );
}

// 사후관리 등록 모달 컴포넌트
function CreateFollowUpModal({
  patient,
  onClose,
  onCreate
}: {
  patient: Patient;
  onClose: () => void;
  onCreate: (patientId: string, followUpTypes: FollowUpType[]) => void;
}) {
  const [selectedTypes, setSelectedTypes] = useState<FollowUpType[]>([]);

  const toggleType = (type: FollowUpType) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSubmit = () => {
    if (selectedTypes.length === 0) {
      alert('최소 1개의 사후관리 타입을 선택해주세요.');
      return;
    }
    onCreate(patient._id, selectedTypes);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">사후관리 등록</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* 환자 정보 */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{patient.name}</p>
                <p className="text-sm text-gray-500">{patient.phoneNumber}</p>
              </div>
            </div>
          </div>

          {/* 타입 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              발송 타입 선택 (복수 선택 가능)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(followUpTypeLabels) as [FollowUpType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedTypes.includes(type)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 선택된 타입 미리보기 */}
          {selectedTypes.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                선택된 발송: {selectedTypes.map(t => followUpTypeLabels[t]).join(', ')}
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedTypes.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
