// src/app/v2/admin/audit/page.tsx
// 활동 로그 페이지 — activityLogs_v2 API 연동
'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Clock, User, Filter, ChevronLeft, ChevronRight, Download, Trash2, AlertTriangle } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';

interface ActivityLog {
  _id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  target: string;
  targetId: string;
  targetName: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
}

const ACTION_LABELS: Record<string, string> = {
  login: '로그인',
  logout: '로그아웃',
  patient_create: '환자 등록',
  patient_update: '환자 수정',
  patient_delete: '환자 삭제',
  patient_view: '환자 조회',
  patient_complete: '환자 종결',
  patient_complete_cancel: '종결 취소',
  patient_status_change: '환자 상태 변경',
  visit_confirmation_toggle: '내원 확정',
  consultation_update: '상담 수정',
  callback_create: '콜백 등록',
  callback_update: '콜백 수정',
  callback_complete: '콜백 완료',
  callback_cancel: '콜백 취소',
  callback_delete: '콜백 삭제',
  callback_reschedule: '콜백 일정변경',
  message_send: '메시지 전송',
  event_target_create: '이벤트 타겟 등록',
  event_target_update: '이벤트 타겟 수정',
  event_target_delete: '이벤트 타겟 삭제',
  'patient.create': '환자 등록',
  'patient.update': '환자 수정',
  'patient.delete': '환자 삭제',
  'patient.status_change': '상태 변경',
  'callback.create': '콜백 생성',
  'callback.update': '콜백 수정',
  'callback.delete': '콜백 삭제',
  'consultation.create': '상담 등록',
  'consultation.update': '상담 수정',
  'coaching.run': 'AI 코칭 실행',
  'coaching.apply': 'AI 코칭 적용',
};

const ACTION_COLORS: Record<string, string> = {
  'patient.delete': 'bg-red-100 text-red-700',
  patient_delete: 'bg-red-100 text-red-700',
  'patient.status_change': 'bg-amber-100 text-amber-700',
  patient_status_change: 'bg-amber-100 text-amber-700',
  'patient.update': 'bg-orange-100 text-orange-700',
  patient_update: 'bg-orange-100 text-orange-700',
  'patient.create': 'bg-green-100 text-green-700',
  patient_create: 'bg-green-100 text-green-700',
  'callback.create': 'bg-purple-100 text-purple-700',
  callback_create: 'bg-purple-100 text-purple-700',
  'consultation.create': 'bg-teal-100 text-teal-700',
  consultation_update: 'bg-teal-100 text-teal-700',
  'coaching.run': 'bg-violet-100 text-violet-700',
  'coaching.apply': 'bg-violet-100 text-violet-700',
  login: 'bg-blue-100 text-blue-700',
  message_send: 'bg-cyan-100 text-cyan-700',
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  } catch {
    return ts;
  }
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const limit = 30;

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (actionFilter) params.set('action', actionFilter);
    if (userFilter) params.set('userName', userFilter);

    const res = await authFetch(`/api/v2/activity-logs?${params}`);
    if (!res.ok) throw new Error('Failed to fetch activity logs');
    return res.json();
  }, [page, actionFilter, userFilter]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['activity-logs', page, actionFilter, userFilter],
    queryFn: fetchLogs,
    refetchInterval: 30000,
  });

  // 상담사별 요약 (최근 7일, 별도 쿼리)
  const fetchUserSummary = useCallback(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await authFetch(`/api/v2/activity-logs?page=1&limit=100&startDate=${sevenDaysAgo}`);
    if (!res.ok) return [];
    const result = await res.json();
    const recentLogs: ActivityLog[] = result?.logs || [];

    // 상담사별 집계
    const summaryMap = new Map<string, { total: number; deletes: number; statusChanges: number; lastActivity: string }>();
    for (const log of recentLogs) {
      const name = log.userName || 'unknown';
      const existing = summaryMap.get(name) || { total: 0, deletes: 0, statusChanges: 0, lastActivity: '' };
      existing.total++;
      if (log.action.includes('delete')) existing.deletes++;
      if (log.action.includes('status')) existing.statusChanges++;
      if (!existing.lastActivity || log.timestamp > existing.lastActivity) existing.lastActivity = log.timestamp;
      summaryMap.set(name, existing);
    }

    return Array.from(summaryMap.entries()).map(([userName, stats]) => ({
      userName,
      ...stats,
    })).sort((a, b) => b.total - a.total);
  }, []);

  const { data: userSummary } = useQuery({
    queryKey: ['activity-logs-user-summary'],
    queryFn: fetchUserSummary,
    refetchInterval: 60000,
  });

  const logs: ActivityLog[] = data?.logs || [];
  const total: number = data?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const handleExport = async () => {
    try {
      const res = await authFetch('/api/v2/activity-logs/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV 내보내기 실패:', err);
      alert('CSV 내보내기에 실패했습니다.');
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('이 로그를 삭제하시겠습니까?')) return;
    try {
      const res = await authFetch(`/api/v2/activity-logs/${logId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      // refetch
      window.location.reload();
    } catch (err) {
      console.error('로그 삭제 실패:', err);
      alert('로그 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">활동 로그</h1>
          <span className="text-sm text-gray-500">총 {total}건</span>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          CSV 내보내기
        </button>
      </div>

      {/* 상담사별 활동 요약 (최근 7일) */}
      {userSummary && userSummary.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">최근 7일 활동 요약</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {userSummary.map((s) => (
              <div
                key={s.userName}
                className={`p-4 bg-white rounded-lg border cursor-pointer transition-colors ${
                  userFilter === s.userName ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => { setUserFilter(userFilter === s.userName ? '' : s.userName); setPage(1); }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{s.userName}</span>
                  </div>
                  {s.deletes > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="w-3 h-3" />
                      삭제 {s.deletes}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>총 {s.total}건</span>
                  <span>상태변경 {s.statusChanges}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5"
        >
          <option value="">전체 활동</option>
          <option value="login">로그인</option>
          <option value="patient_status_change">상태 변경</option>
          <option value="patient_delete">환자 삭제</option>
          <option value="patient_update">환자 수정</option>
          <option value="callback_create">콜백 등록</option>
          <option value="consultation_update">상담 수정</option>
          <option value="message_send">메시지 전송</option>
        </select>
        {(actionFilter || userFilter) && (
          <button
            onClick={() => { setActionFilter(''); setUserFilter(''); setPage(1); }}
            className="text-xs text-indigo-600 hover:underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 로그 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            활동 로그를 불러올 수 없습니다.
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">활동 로그가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">시간</th>
                <th className="px-4 py-3 text-left font-medium">상담사</th>
                <th className="px-4 py-3 text-left font-medium">활동</th>
                <th className="px-4 py-3 text-left font-medium">대상</th>
                <th className="px-4 py-3 text-left font-medium">상세</th>
                <th className="px-4 py-3 text-center font-medium w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-1 cursor-pointer hover:text-indigo-600"
                      onClick={() => { setUserFilter(userFilter === log.userName ? '' : log.userName); setPage(1); }}
                    >
                      <User className="w-3 h-3 text-gray-400" />
                      <span className={`font-medium ${userFilter === log.userName ? 'text-indigo-600' : 'text-gray-900'}`}>
                        {log.userName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'
                    }`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {log.targetName || log.targetId?.substring(0, 8) || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                    {(log.details as Record<string, string>)?.notes || (log.details as Record<string, string>)?.changeDetails || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDeleteLog(log._id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
