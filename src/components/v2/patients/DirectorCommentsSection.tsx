// src/components/v2/patients/DirectorCommentsSection.tsx
// 환자 상세 페이지에 표시되는 원장 코멘트 섹션
// - master 권한이면 입력 가능, 모든 staff는 조회 가능
// - 환자별 코멘트 전체 히스토리 표시 (대시보드는 7일치, 여기는 전체)

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquareQuote, Trash2 } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';

interface DirectorComment {
  id: string;
  patientId: string;
  patientName: string;
  context: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  isUnread: boolean;
}

interface DirectorCommentsSectionProps {
  patientId: string;
  patientName: string;
  isMaster: boolean;
  currentUserId?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

export function DirectorCommentsSection({
  patientId,
  patientName,
  isMaster,
  currentUserId,
}: DirectorCommentsSectionProps) {
  const [comments, setComments] = useState<DirectorComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v2/director-comments?patientId=${patientId}`);
      if (!res.ok) {
        setComments([]);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setComments(json.data.comments || []);
      }
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('코멘트 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/v2/director-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName,
          text: trimmed,
          context: context.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || '코멘트 작성에 실패했습니다.');
        return;
      }
      setText('');
      setContext('');
      await fetchComments();
    } catch {
      setError('코멘트 작성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 코멘트를 삭제하시겠습니까?')) return;
    try {
      const res = await authFetch(`/api/v2/director-comments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== id));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-amber-100">
          <MessageSquareQuote size={16} className="text-amber-600" />
        </div>
        <h3 className="font-bold text-gray-900">원장 코멘트</h3>
        <span className="text-xs text-gray-400">({comments.length}건)</span>
      </div>

      {/* 작성 폼 (master 전용) */}
      {isMaster && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="space-y-2">
            <input
              type="text"
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="태그 (선택) — 예: 어제 노쇼, 상담 후 미예약"
              maxLength={100}
              disabled={submitting}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-gray-50"
            />
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="직원에게 남길 코멘트를 입력하세요"
              rows={3}
              maxLength={2000}
              disabled={submitting}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-gray-50 resize-none"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={submitting || !text.trim()}
                className="px-4 py-1.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '저장 중...' : '코멘트 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 코멘트 히스토리 */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          {isMaster ? '아직 등록된 코멘트가 없습니다.' : '원장님이 남긴 코멘트가 없습니다.'}
        </p>
      ) : (
        <div className="space-y-2">
          {comments.map(comment => {
            const canDelete = isMaster || comment.createdBy === currentUserId;
            return (
              <div
                key={comment.id}
                className="p-3 rounded-xl border border-gray-100 bg-gray-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{comment.createdByName}</span>
                    <span>·</span>
                    <span>{formatDate(comment.createdAt)}</span>
                    {comment.context && (
                      <>
                        <span>·</span>
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                          {comment.context}
                        </span>
                      </>
                    )}
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DirectorCommentsSection;
