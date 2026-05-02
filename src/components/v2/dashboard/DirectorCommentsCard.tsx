// src/components/v2/dashboard/DirectorCommentsCard.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquareQuote } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';

export interface DirectorComment {
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

function formatRelativeDate(iso: string): string {
  const created = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMin = Math.floor(diffMs / (60 * 1000));
  const diffHour = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDay = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${created.getMonth() + 1}/${created.getDate()}`;
}

export function DirectorCommentsCard() {
  const router = useRouter();
  const [comments, setComments] = useState<DirectorComment[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      const res = await authFetch('/api/v2/director-comments');
      if (!res.ok) {
        setComments([]);
        setUnreadCount(0);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setComments(json.data.comments || []);
        setUnreadCount(json.data.unreadCount || 0);
      }
    } catch {
      setComments([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 30000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const handleClick = async (comment: DirectorComment) => {
    if (comment.isUnread) {
      try {
        await authFetch(`/api/v2/director-comments/${comment.id}`, { method: 'PATCH' });
        setComments(prev =>
          prev.map(c => (c.id === comment.id ? { ...c, isUnread: false } : c))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {
        // 실패해도 페이지 이동은 진행
      }
    }
    router.push(`/v2/patients/${comment.patientId}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-100">
            <MessageSquareQuote size={18} className="text-amber-600" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">원장 코멘트</h3>
          {unreadCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">최근 7일</span>
      </div>

      {comments.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          최근 7일간 등록된 코멘트가 없습니다.
        </div>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {comments.map(comment => (
            <button
              key={comment.id}
              onClick={() => handleClick(comment)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                comment.isUnread
                  ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start gap-2">
                {/* 미확인 점 */}
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    comment.isUnread ? 'bg-red-500' : 'bg-transparent'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  {/* 환자명 + context + 시간 */}
                  <div className="flex items-center gap-1.5 mb-0.5 text-sm">
                    <span
                      className={`${
                        comment.isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                      }`}
                    >
                      {comment.patientName}
                    </span>
                    {comment.context && (
                      <span className="text-xs text-gray-500">· {comment.context}</span>
                    )}
                    <span className="ml-auto text-xs text-gray-400">
                      {formatRelativeDate(comment.createdAt)}
                    </span>
                  </div>
                  {/* 본문 */}
                  <p
                    className={`text-sm line-clamp-2 ${
                      comment.isUnread ? 'text-gray-800' : 'text-gray-600'
                    }`}
                  >
                    {comment.text}
                  </p>
                  {/* 작성자 */}
                  <p className="mt-1 text-xs text-gray-400">— {comment.createdByName}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default DirectorCommentsCard;
