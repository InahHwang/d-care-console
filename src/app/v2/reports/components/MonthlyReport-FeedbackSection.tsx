// src/app/v2/reports/components/MonthlyReport-FeedbackSection.tsx
// 양방향 피드백 컴포넌트 (원장님 + 매니저 모두 작성 가능)
'use client';

import React, { useState } from 'react';
import { MessageCircle, Plus, Edit, Trash2 } from 'lucide-react';
import type { DirectorFeedbackV2 } from './MonthlyReport-Types';

interface MonthlyReportFeedbackSectionProps {
  targetSection: string;
  sectionTitle: string;
  feedbacks: DirectorFeedbackV2[];
  reportId?: string;
  userRole?: string;
  currentUserId?: string;
  isReadOnly?: boolean;
  onAddFeedback: (targetSection: string, content: string) => Promise<void>;
  onUpdateFeedback: (feedbackId: string, content: string) => Promise<void>;
  onDeleteFeedback: (feedbackId: string) => Promise<void>;
}

const MonthlyReportFeedbackSection: React.FC<MonthlyReportFeedbackSectionProps> = ({
  targetSection,
  sectionTitle,
  feedbacks,
  userRole,
  currentUserId,
  isReadOnly,
  onAddFeedback,
  onUpdateFeedback,
  onDeleteFeedback,
}) => {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [feedbackContent, setFeedbackContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sectionFeedbacks = feedbacks.filter(f => f.targetSection === targetSection);

  // 모든 역할이 피드백 가능 (양방향)
  const canWriteFeedback = !isReadOnly;

  const handleAddFeedback = async () => {
    if (!feedbackContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddFeedback(targetSection, feedbackContent.trim());
      setFeedbackContent('');
      setShowFeedbackForm(false);
    } catch (error) {
      alert('피드백 추가에 실패했습니다: ' + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateFeedback = async (feedbackId: string) => {
    if (!feedbackContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onUpdateFeedback(feedbackId, feedbackContent.trim());
      setFeedbackContent('');
      setEditingFeedbackId(null);
    } catch (error) {
      alert('피드백 수정에 실패했습니다: ' + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!confirm('이 피드백을 삭제하시겠습니까?')) return;
    try {
      await onDeleteFeedback(feedbackId);
    } catch (error) {
      alert('피드백 삭제에 실패했습니다: ' + error);
    }
  };

  const startEdit = (feedback: DirectorFeedbackV2) => {
    setEditingFeedbackId(feedback.feedbackId);
    setFeedbackContent(feedback.content);
    setShowFeedbackForm(false);
  };

  const cancelEdit = () => {
    setEditingFeedbackId(null);
    setFeedbackContent('');
  };

  if (sectionFeedbacks.length === 0 && !canWriteFeedback) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-blue-900 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          피드백 ({sectionTitle})
          {sectionFeedbacks.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {sectionFeedbacks.length}개
            </span>
          )}
        </h4>

        {canWriteFeedback && !showFeedbackForm && !editingFeedbackId && (
          <button
            onClick={() => setShowFeedbackForm(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-100 no-print"
          >
            <Plus className="w-3 h-3" />
            피드백 추가
          </button>
        )}
      </div>

      {/* 기존 피드백 목록 */}
      <div className="space-y-3">
        {sectionFeedbacks.map((feedback) => (
          <div key={feedback.feedbackId} className="bg-white border border-blue-200 rounded p-3">
            {editingFeedbackId === feedback.feedbackId ? (
              <div className="space-y-2">
                <textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  className="w-full h-20 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="피드백 내용을 입력하세요..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateFeedback(feedback.feedbackId)}
                    disabled={isSubmitting || !feedbackContent.trim()}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? '저장 중...' : '저장'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1 text-xs text-gray-600 border rounded hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 whitespace-pre-line">
                      {feedback.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>{feedback.createdByName}</span>
                      <span>·</span>
                      <span>{new Date(feedback.createdAt).toLocaleDateString()}</span>
                      {feedback.updatedAt && (
                        <>
                          <span>·</span>
                          <span>수정됨</span>
                        </>
                      )}
                    </div>
                  </div>

                  {canWriteFeedback && (feedback.createdBy === currentUserId || userRole === 'master') && (
                    <div className="flex gap-1 ml-2 no-print">
                      <button
                        onClick={() => startEdit(feedback)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="수정"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteFeedback(feedback.feedbackId)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 새 피드백 작성 폼 */}
      {showFeedbackForm && canWriteFeedback && (
        <div className="mt-3 p-3 bg-white border border-blue-200 rounded">
          <textarea
            value={feedbackContent}
            onChange={(e) => setFeedbackContent(e.target.value)}
            className="w-full h-20 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="피드백 내용을 입력하세요..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAddFeedback}
              disabled={isSubmitting || !feedbackContent.trim()}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? '추가 중...' : '피드백 추가'}
            </button>
            <button
              onClick={() => {
                setShowFeedbackForm(false);
                setFeedbackContent('');
              }}
              className="px-3 py-1 text-xs text-gray-600 border rounded hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyReportFeedbackSection;
