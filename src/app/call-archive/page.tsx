'use client';

// 통화기록 아카이브 페이지 - 전체 수발신 기록 조회
// 기존 /call-logs와 별도로 운영

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { setCurrentMenuItem, openPatientFormWithPhone } from '@/store/slices/uiSlice';
import { selectPatientWithContext } from '@/store/slices/patientsSlice';
import PatientDetailModal from '@/components/management/PatientDetailModal';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  RefreshCw,
  Filter,
  Clock,
  User,
  UserPlus,
  Bot,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import CallAnalysisModal from '@/components/call-analysis/CallAnalysisModal';

interface CallLog {
  _id: string;
  callId: string;
  callDirection?: 'inbound' | 'outbound';
  callerNumber: string;
  calledNumber: string;
  phoneNumber?: string;
  callStatus: 'ringing' | 'answered' | 'missed' | 'ended';
  callStartTime?: string;
  callEndTime?: string;
  ringTime?: string;
  duration?: number;
  isMissed?: boolean;
  patientId?: string;
  patientName?: string;
  isNewPatient?: boolean;
  legacyPatientName?: string;
  analysisId?: string;
  analysisStatus?: string;
  createdAt: string;
}

interface TodayStats {
  totalCalls: number;
  missedCalls: number;
  answeredCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  newPatientCalls: number;
  totalDuration: number;
}

export default function CallArchivePage() {
  const dispatch = useAppDispatch();
  const selectedPatient = useAppSelector((state) => state.patients.selectedPatient);

  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    totalCalls: 0,
    missedCalls: 0,
    answeredCalls: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    newPatientCalls: 0,
    totalDuration: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [filter, setFilter] = useState<'all' | 'answered' | 'missed'>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [showNewPatientOnly, setShowNewPatientOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(setCurrentMenuItem('통화 아카이브'));
  }, [dispatch]);

  const fetchCallLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filter !== 'all') {
        params.append('status', filter);
      }
      if (directionFilter !== 'all') {
        params.append('direction', directionFilter);
      }
      if (showNewPatientOnly) {
        params.append('isNewPatient', 'true');
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

      const response = await fetch(`/api/call-logs?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setCallLogs(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
        setTodayStats(data.todayStats);
      }
    } catch (error) {
      console.error('통화기록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filter, directionFilter, showNewPatientOnly, searchQuery, dateRange]);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds === 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}초`;
    return `${mins}분 ${secs}초`;
  };

  const formatTotalDuration = (seconds: number) => {
    if (seconds === 0) return '0분';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${mins}분`;
    return `${hours}시간 ${mins}분`;
  };

  const getCallDirectionDisplay = (log: CallLog) => {
    if (log.callDirection === 'outbound') {
      return {
        icon: <ArrowUpRight className="w-3.5 h-3.5" />,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: '발신',
      };
    }
    return {
      icon: <ArrowDownLeft className="w-3.5 h-3.5" />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      label: '수신',
    };
  };

  const getCallStatusDisplay = (log: CallLog) => {
    if (log.isMissed || (log.callStatus === 'ringing') || (!log.callStartTime && log.callStatus !== 'answered')) {
      return {
        icon: <PhoneMissed className="w-4 h-4" />,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: '부재중',
      };
    }
    return {
      icon: <Phone className="w-4 h-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      label: '완료',
    };
  };

  const getPatientPhone = (log: CallLog) => {
    if (log.phoneNumber) return log.phoneNumber;
    return log.callDirection === 'outbound' ? log.calledNumber : log.callerNumber;
  };

  const handlePhoneClick = (log: CallLog) => {
    const phone = getPatientPhone(log);
    if (log.patientId && log.patientName) {
      dispatch(selectPatientWithContext(log.patientId, 'call-archive'));
    } else {
      dispatch(openPatientFormWithPhone(phone));
    }
  };

  return (
    <AuthGuard>
      <AppLayout currentPage="call-archive">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">통화 아카이브</h1>
            <button
              onClick={fetchCallLogs}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
          </div>

          {/* 오늘 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">오늘 전체</p>
                  <p className="text-xl font-bold text-gray-900">{todayStats.totalCalls}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <ArrowDownLeft className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">수신</p>
                  <p className="text-xl font-bold text-gray-900">{todayStats.inboundCalls}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ArrowUpRight className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">발신</p>
                  <p className="text-xl font-bold text-gray-900">{todayStats.outboundCalls}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <PhoneMissed className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">부재중</p>
                  <p className="text-xl font-bold text-gray-900">{todayStats.missedCalls}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <UserPlus className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">신규등록</p>
                  <p className="text-xl font-bold text-gray-900">{todayStats.newPatientCalls}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">총 통화시간</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatTotalDuration(todayStats.totalDuration)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 필터 및 검색 */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* 방향 필터 */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {(['all', 'inbound', 'outbound'] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => {
                        setDirectionFilter(dir);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className={`px-3 py-2 text-sm transition-colors flex items-center gap-1 ${
                        directionFilter === dir
                          ? 'bg-blue-600 text-white'
                          : 'bg-white hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      {dir === 'inbound' && <ArrowDownLeft className="w-3.5 h-3.5" />}
                      {dir === 'outbound' && <ArrowUpRight className="w-3.5 h-3.5" />}
                      {dir === 'all' ? '전체' : dir === 'inbound' ? '수신' : '발신'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 상태 필터 */}
              <div className="flex rounded-lg overflow-hidden border border-gray-300">
                {(['all', 'answered', 'missed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setFilter(status);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className={`px-3 py-2 text-sm transition-colors ${
                      filter === status
                        ? 'bg-green-600 text-white'
                        : 'bg-white hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    {status === 'all' ? '상태전체' : status === 'answered' ? '연결' : '부재중'}
                  </button>
                ))}
              </div>

              {/* 신규환자 필터 */}
              <button
                onClick={() => {
                  setShowNewPatientOnly(!showNewPatientOnly);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${
                  showNewPatientOnly
                    ? 'bg-yellow-500 text-white border-yellow-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                자동등록만
              </button>

              {/* 검색 */}
              <div className="flex-1 min-w-[200px] max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="전화번호 또는 환자이름..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 날짜 필터 */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => {
                    setDateRange((prev) => ({ ...prev, startDate: e.target.value }));
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <span className="text-gray-400">~</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => {
                    setDateRange((prev) => ({ ...prev, endDate: e.target.value }));
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* 통화기록 테이블 */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">방향</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">상태</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">전화번호</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">환자</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">시각</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">통화시간</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">AI분석</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                        <span>로딩 중...</span>
                      </div>
                    </td>
                  </tr>
                ) : callLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>통화기록이 없습니다</p>
                    </td>
                  </tr>
                ) : (
                  callLogs.map((log) => {
                    const directionDisplay = getCallDirectionDisplay(log);
                    const statusDisplay = getCallStatusDisplay(log);
                    const patientPhone = getPatientPhone(log);
                    const callTime = log.ringTime || log.callStartTime || log.createdAt;
                    return (
                      <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1.5 ${directionDisplay.color}`}>
                            <div className={`p-1 rounded ${directionDisplay.bgColor}`}>
                              {directionDisplay.icon}
                            </div>
                            <span className="text-xs font-medium">{directionDisplay.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1.5 ${statusDisplay.color}`}>
                            <div className={`p-1 rounded ${statusDisplay.bgColor}`}>
                              {statusDisplay.icon}
                            </div>
                            <span className="text-xs font-medium">{statusDisplay.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handlePhoneClick(log)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-sm cursor-pointer"
                          >
                            {patientPhone}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {log.patientName ? (
                              <button
                                onClick={() => handlePhoneClick(log)}
                                className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer"
                              >
                                <User className="w-4 h-4 text-blue-600" />
                                <span className="text-gray-900 hover:underline text-sm">{log.patientName}</span>
                              </button>
                            ) : log.legacyPatientName ? (
                              <button
                                onClick={() => handlePhoneClick(log)}
                                className="flex items-center gap-1.5 cursor-pointer"
                              >
                                <User className="w-4 h-4 text-orange-500" />
                                <span className="text-orange-600 hover:underline text-sm">
                                  {log.legacyPatientName}
                                  <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1 py-0.5 rounded">구환</span>
                                </span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePhoneClick(log)}
                                className="flex items-center gap-1 text-gray-400 hover:text-orange-500 text-xs cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>등록</span>
                              </button>
                            )}
                            {log.isNewPatient && (
                              <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                                자동
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 text-sm">
                            {format(new Date(callTime), 'MM/dd HH:mm:ss', { locale: ko })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${log.duration ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                            {formatDuration(log.duration)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.analysisId ? (
                            <button
                              onClick={() => setSelectedAnalysisId(log.analysisId!)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                                log.analysisStatus === 'complete'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : log.analysisStatus === 'failed'
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
                              {log.analysisStatus === 'complete' ? (
                                <Bot className="w-3.5 h-3.5" />
                              ) : log.analysisStatus === 'failed' ? (
                                <Bot className="w-3.5 h-3.5" />
                              ) : (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              )}
                              {log.analysisStatus === 'complete' ? '분석' :
                               log.analysisStatus === 'failed' ? '실패' : '처리중'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <div className="text-sm text-gray-600">
                  전체 {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.total)}건
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    이전
                  </button>
                  <span className="text-sm text-gray-600">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
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

        {/* 환자 상세 모달 */}
        {selectedPatient && <PatientDetailModal />}

        {/* AI 분석 모달 */}
        {selectedAnalysisId && (
          <CallAnalysisModal
            analysisId={selectedAnalysisId}
            onClose={() => setSelectedAnalysisId(null)}
          />
        )}
      </AppLayout>
    </AuthGuard>
  );
}
