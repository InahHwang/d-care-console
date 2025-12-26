'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  PhoneMissed,
  Search,
  RefreshCw,
  Filter,
  Clock,
  User,
  UserPlus,
  Bot,
  Loader2,
} from 'lucide-react';
import CallAnalysisModal from '@/components/call-analysis/CallAnalysisModal';

interface CallLog {
  _id: string;
  callId: string;
  callerNumber: string;
  calledNumber: string;
  callStatus: 'ringing' | 'answered' | 'missed' | 'ended';
  callStartTime?: string;
  callEndTime?: string;
  ringTime: string;
  duration?: number;
  isMissed: boolean;
  patientId?: string;
  patientName?: string;
  legacyPatientName?: string;  // 구환 이름
  analysisId?: string;         // AI 분석 ID
  analysisStatus?: string;     // AI 분석 상태
  createdAt: string;
}

interface TodayStats {
  totalCalls: number;
  missedCalls: number;
  answeredCalls: number;
  totalDuration: number;
}

export default function CallLogsPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const selectedPatient = useAppSelector((state) => state.patients.selectedPatient);
  const { user, isInitialized } = useAppSelector((state) => state.auth);

  // 🔥 마스터 관리자(dsbrdental)만 접근 가능
  const isMasterAdmin = user?.username === 'dsbrdental';

  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    totalCalls: 0,
    missedCalls: 0,
    answeredCalls: 0,
    totalDuration: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [filter, setFilter] = useState<'all' | 'answered' | 'missed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(setCurrentMenuItem('통화기록'));
  }, [dispatch]);

  // 🔥 마스터 관리자가 아니면 대시보드로 리다이렉트
  useEffect(() => {
    if (isInitialized && !isMasterAdmin) {
      router.replace('/');
    }
  }, [isInitialized, isMasterAdmin, router]);

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
        let logs = data.data;

        // 환자 정보가 없는 전화번호들에 대해 구환 정보 조회
        const phonesWithoutPatient = logs
          .filter((log: CallLog) => !log.patientName && log.callerNumber)
          .map((log: CallLog) => log.callerNumber);

        if (phonesWithoutPatient.length > 0) {
          try {
            const legacyResponse = await fetch('/api/legacy-patients', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phoneNumbers: phonesWithoutPatient }),
            });
            const legacyData = await legacyResponse.json();

            if (legacyData.success && legacyData.results) {
              // 구환 정보 매핑
              logs = logs.map((log: CallLog) => {
                if (!log.patientName && legacyData.results[log.callerNumber]) {
                  return {
                    ...log,
                    legacyPatientName: legacyData.results[log.callerNumber].name,
                  };
                }
                return log;
              });
            }
          } catch (legacyError) {
            console.error('구환 정보 조회 실패:', legacyError);
          }
        }

        setCallLogs(logs);
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
  }, [pagination.page, pagination.limit, filter, searchQuery, dateRange]);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  // 통화시간 포맷팅
  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds === 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}초`;
    return `${mins}분 ${secs}초`;
  };

  // 총 통화시간 포맷팅
  const formatTotalDuration = (seconds: number) => {
    if (seconds === 0) return '0분';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${mins}분`;
    return `${hours}시간 ${mins}분`;
  };

  // 통화 상태에 따른 아이콘과 색상 (통화완료/부재중 두 가지로 단순화)
  const getCallStatusDisplay = (log: CallLog) => {
    // 부재중: isMissed가 true이거나, 통화시작 없이 종료된 경우
    if (log.isMissed || (log.callStatus === 'ringing') || (!log.callStartTime && log.callStatus !== 'answered')) {
      return {
        icon: <PhoneMissed className="w-4 h-4" />,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: '부재중',
      };
    }
    // 그 외는 모두 통화완료
    return {
      icon: <Phone className="w-4 h-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      label: '통화완료',
    };
  };

  // 전화번호 클릭 핸들러
  const handlePhoneClick = (log: CallLog) => {
    if (log.patientId && log.patientName) {
      // 등록된 환자 - 환자 상세 모달 열기
      dispatch(selectPatientWithContext(log.patientId, 'visit-management'));
    } else {
      // 미등록 - 신규 환자 등록 모달 열기
      dispatch(openPatientFormWithPhone(log.callerNumber));
    }
  };

  // 🔥 마스터 관리자가 아니면 빈 화면 (리다이렉트 중)
  if (!isInitialized || !isMasterAdmin) {
    return (
      <AuthGuard>
        <AppLayout currentPage="call-logs">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">접근 권한 확인 중...</div>
          </div>
        </AppLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppLayout currentPage="call-logs">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">통화기록</h1>
            <button
              onClick={fetchCallLogs}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
          </div>

          {/* 오늘 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <PhoneIncoming className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">오늘 총 수신</p>
                  <p className="text-2xl font-bold text-gray-900">{todayStats.totalCalls}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Phone className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">통화 연결</p>
                  <p className="text-2xl font-bold text-gray-900">{todayStats.answeredCalls}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <PhoneMissed className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">부재중</p>
                  <p className="text-2xl font-bold text-gray-900">{todayStats.missedCalls}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">총 통화시간</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatTotalDuration(todayStats.totalDuration)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 필터 및 검색 */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* 상태 필터 */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {(['all', 'answered', 'missed'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilter(status);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className={`px-4 py-2 text-sm transition-colors ${
                        filter === status
                          ? 'bg-blue-600 text-white'
                          : 'bg-white hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      {status === 'all' ? '전체' : status === 'answered' ? '통화' : '부재중'}
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
                    placeholder="전화번호 또는 환자이름 검색..."
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
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-400">~</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => {
                    setDateRange((prev) => ({ ...prev, endDate: e.target.value }));
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 통화기록 테이블 */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">상태</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">발신번호</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">환자</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">착신시각</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">통화시작</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">통화종료</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">통화시간</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">AI분석</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                        <span>로딩 중...</span>
                      </div>
                    </td>
                  </tr>
                ) : callLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      <PhoneIncoming className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>통화기록이 없습니다</p>
                    </td>
                  </tr>
                ) : (
                  callLogs.map((log) => {
                    const statusDisplay = getCallStatusDisplay(log);
                    return (
                      <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-2 ${statusDisplay.color}`}>
                            <div className={`p-1.5 rounded-lg ${statusDisplay.bgColor}`}>
                              {statusDisplay.icon}
                            </div>
                            <span className="text-sm font-medium">{statusDisplay.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handlePhoneClick(log)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-mono cursor-pointer"
                          >
                            {log.callerNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {log.patientName ? (
                            <button
                              onClick={() => handlePhoneClick(log)}
                              className="flex items-center gap-2 hover:text-blue-600 cursor-pointer"
                            >
                              <User className="w-4 h-4 text-blue-600" />
                              <span className="text-gray-900 hover:underline">{log.patientName}</span>
                            </button>
                          ) : log.legacyPatientName ? (
                            <button
                              onClick={() => handlePhoneClick(log)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <User className="w-4 h-4 text-orange-500" />
                              <span className="text-orange-600 hover:underline">
                                {log.legacyPatientName}
                                <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">구환</span>
                              </span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePhoneClick(log)}
                              className="flex items-center gap-1 text-gray-400 hover:text-orange-500 text-sm cursor-pointer"
                            >
                              <UserPlus className="w-4 h-4" />
                              <span>신규등록</span>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 text-sm">
                            {format(new Date(log.ringTime), 'MM/dd HH:mm:ss', { locale: ko })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 text-sm">
                            {log.callStartTime
                              ? format(new Date(log.callStartTime), 'HH:mm:ss', { locale: ko })
                              : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 text-sm">
                            {log.callEndTime
                              ? format(new Date(log.callEndTime), 'HH:mm:ss', { locale: ko })
                              : '-'}
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
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
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
                              {log.analysisStatus === 'complete' ? '분석완료' :
                               log.analysisStatus === 'failed' ? '실패' :
                               log.analysisStatus === 'analyzing' ? '분석중' :
                               log.analysisStatus === 'stt_processing' ? 'STT중' :
                               log.analysisStatus === 'stt_complete' ? '분석대기' :
                               log.analysisStatus === 'pending' ? '대기중' : '처리중'}
                            </button>
                          ) : log.duration && log.duration > 10 ? (
                            <span className="text-xs text-gray-400">-</span>
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
