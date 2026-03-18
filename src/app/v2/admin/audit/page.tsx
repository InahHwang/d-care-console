// src/app/v2/admin/audit/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Clock, User, Filter, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  collection: string;
  documentId: string;
  documentName?: string;
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
  reason?: string;
  ipAddress?: string;
  timestamp: string;
}

interface UserSummary {
  userId: string;
  userName: string;
  totalActions: number;
  deletes: number;
  statusChanges: number;
  lastActivity: string;
}

const ACTION_LABELS: Record<string, string> = {
  'patient.create': '환자 등록',
  'patient.update': '환자 수정',
  'patient.delete': '환자 삭제',
  'patient.status_change': '상태 변경',
  'callback.create': '콜백 생성',
  'callback.update': '콜백 수정',
  'callback.delete': '콜백 삭제',
  'consultation.create': '상담 등록',
  'consultation.update': '상담 수정',
  'consultation.delete': '상담 삭제',
};

const ACTION_COLORS: Record<string, string> = {
  'patient.delete': 'bg-red-100 text-red-700',
  'patient.status_change': 'bg-amber-100 text-amber-700',
  'patient.update': 'bg-blue-100 text-blue-700',
  'patient.create': 'bg-green-100 text-green-700',
  'callback.create': 'bg-purple-100 text-purple-700',
  'callback.update': 'bg-purple-100 text-purple-700',
  'consultation.create': 'bg-teal-100 text-teal-700',
  'consultation.update': 'bg-teal-100 text-teal-700',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace('T', ' ').substring(0, 19);
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '30' });
    if (actionFilter) params.set('action', actionFilter);
    if (userFilter) params.set('userName', userFilter);

    const token = localStorage.getItem('token');
    const res = await fetch(`/api/v2/audit?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  }, [page, actionFilter, userFilter]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', page, actionFilter, userFilter],
    queryFn: fetchAuditLogs,
    refetchInterval: 30000,
  });

  const logs: AuditLog[] = data?.data?.logs || [];
  const totalPages = data?.data?.totalPages || 1;
  const userSummary: UserSummary[] = data?.data?.userSummary || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">감사 로그</h1>
      </div>

      {/* 사용자별 활동 요약 (최근 7일) */}
      {userSummary.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">최근 7일 활동 요약</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {userSummary.map((s) => (
              <div
                key={s.userId}
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
                  <span>총 {s.totalActions}건</span>
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
          <option value="patient.status_change">상태 변경</option>
          <option value="patient.delete">환자 삭제</option>
          <option value="patient.update">환자 수정</option>
          <option value="callback">콜백</option>
          <option value="consultation">상담</option>
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
            감사 로그를 불러올 수 없습니다. 관리자 권한이 필요합니다.
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">감사 로그가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">시간</th>
                <th className="px-4 py-3 text-left font-medium">상담사</th>
                <th className="px-4 py-3 text-left font-medium">활동</th>
                <th className="px-4 py-3 text-left font-medium">대상</th>
                <th className="px-4 py-3 text-left font-medium">변경 내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {log.userName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'
                      }`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.documentName || log.documentId.substring(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {log.changes.length > 0
                        ? log.changes.slice(0, 2).map((c) => c.field).join(', ')
                        + (log.changes.length > 2 ? ` 외 ${log.changes.length - 2}건` : '')
                        : '-'}
                    </td>
                  </tr>
                  {expandedLog === log.id && log.changes.length > 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 bg-gray-50">
                        <div className="space-y-1">
                          {log.changes.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-gray-700 min-w-[120px]">{c.field}</span>
                              <span className="text-red-500 line-through">{formatValue(c.oldValue)}</span>
                              <span className="text-gray-400">&rarr;</span>
                              <span className="text-green-600">{formatValue(c.newValue)}</span>
                            </div>
                          ))}
                          {log.reason && (
                            <div className="text-xs text-gray-500 mt-1">사유: {log.reason}</div>
                          )}
                          {log.ipAddress && (
                            <div className="text-xs text-gray-400">IP: {log.ipAddress}</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
