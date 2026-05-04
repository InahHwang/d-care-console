// src/components/v2/patients/DirectorCommentsSection.tsx
// 환자 상세 페이지에 표시되는 원장 코멘트 섹션
// - master 권한이면 입력 가능, 모든 staff는 조회 가능
// - 환자별 코멘트 전체 히스토리 표시 (대시보드는 7일치, 여기는 전체)

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquareQuote, Trash2, CornerDownRight } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';

interface DirectorCommentReply {
  id: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

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
  replies?: DirectorCommentReply[];
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

  const handleDeleteReply = async (commentId: string, replyId: string) => {
    if (!confirm('이 답글을 삭제하시겠습니까?')) return;
    try {
      const res = await authFetch(
        `/api/v2/director-comments/${commentId}/replies/${replyId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setComments(prev =>
          prev.map(c =>
            c.id === commentId
              ? { ...c, replies: (c.replies || []).filter(r => r.id !== replyId) }
              : c
          )
        );
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

                <CommentReplies
                  comment={comment}
                  currentUserId={currentUserId}
                  isMaster={isMaster}
                  onReplyAdded={fetchComments}
                  onDeleteReply={handleDeleteReply}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// 답글 영역 (코멘트당 1개)
// ───────────────────────────────────────────────
interface CommentRepliesProps {
  comment: DirectorComment;
  currentUserId?: string;
  isMaster: boolean;
  onReplyAdded: () => Promise<void> | void;
  onDeleteReply: (commentId: string, replyId: string) => Promise<void>;
}

function CommentReplies({
  comment,
  currentUserId,
  isMaster,
  onReplyAdded,
  onDeleteReply,
}: CommentRepliesProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replies = comment.replies || [];

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/v2/director-comments/${comment.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || '답글 등록에 실패했습니다.');
        return;
      }
      setText('');
      setOpen(false);
      await onReplyAdded();
    } catch {
      setError('답글 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2">
      {replies.length > 0 && (
        <ul className="space-y-1.5 mb-2 pl-3 border-l-2 border-amber-200">
          {replies.map(r => {
            const canDel = isMaster || r.createdBy === currentUserId;
            return (
              <li key={r.id} className="flex items-start gap-2">
                <CornerDownRight size={12} className="mt-1 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="font-medium text-gray-700">{r.createdByName}</span>
                    <span>·</span>
                    <span>{formatDate(r.createdAt)}</span>
                    {canDel && (
                      <button
                        onClick={() => onDeleteReply(comment.id, r.id)}
                        className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
                        title="답글 삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-amber-600 hover:text-amber-700 font-medium"
        >
          ↳ 답글 달기
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="답글을 입력하세요"
            rows={2}
            maxLength={2000}
            disabled={submitting}
            autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-gray-50 resize-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setOpen(false); setText(''); setError(null); }}
              disabled={submitting}
              className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
              className="px-3 py-1 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '등록 중...' : '답글 등록'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DirectorCommentsSection;
