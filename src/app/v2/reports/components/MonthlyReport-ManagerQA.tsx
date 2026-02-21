// src/app/v2/reports/components/MonthlyReport-ManagerQA.tsx
// V2 매니저 의견 (4개 Q&A) + 각 질문에 양방향 피드백
'use client';

import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
import type { MonthlyReportV2 } from './MonthlyReport-Types';
import MonthlyReportFeedbackSection from './MonthlyReport-FeedbackSection';

interface MonthlyReportManagerQAProps {
  report: MonthlyReportV2;
  managerAnswers: {
    question1: string;
    question2: string;
    question3: string;
    question4: string;
  };
  onAnswersChange: (answers: MonthlyReportManagerQAProps['managerAnswers']) => void;
  onSaveAnswers: () => Promise<void>;
  isReadOnly: boolean;
  userRole?: string;
  currentUserId?: string;
  onAddFeedback: (targetSection: string, content: string) => Promise<void>;
  onUpdateFeedback: (feedbackId: string, content: string) => Promise<void>;
  onDeleteFeedback: (feedbackId: string) => Promise<void>;
}

const QUESTIONS = [
  {
    key: 'question1' as const,
    title: '1. 전화 상담 후 미내원하신 환자들의 원인은 무엇이라 생각하나요?',
    placeholder: '미내원 원인에 대한 분석을 작성해 주세요...',
    targetSection: 'managerAnswers.question1',
    sectionTitle: '미내원 환자 원인 분석',
    rows: 4,
  },
  {
    key: 'question2' as const,
    title: '2. 내원 후 치료에 동의하지 않으신 환자분의 원인은 무엇이라 생각하나요?',
    placeholder: '치료 거부 원인에 대한 분석을 작성해 주세요...',
    targetSection: 'managerAnswers.question2',
    sectionTitle: '치료 거부 환자 원인 분석',
    rows: 4,
  },
  {
    key: 'question3' as const,
    title: '3. 환자들의 내원, 치료 동의를 이끌어 내기 위해 어떤 부분에서 개선이 필요할까요?',
    subtitle: '(진료실, 상담 차원에서 필요한 부분 모두 자유롭게 서술해주세요)',
    placeholder: '개선 방안에 대한 의견을 작성해 주세요...',
    targetSection: 'managerAnswers.question3',
    sectionTitle: '개선 방안',
    rows: 5,
  },
  {
    key: 'question4' as const,
    title: '4. 기타 의견',
    subtitle: '(추가적으로 공유하고 싶은 의견이나 제안사항을 자유롭게 작성해주세요)',
    placeholder: '기타 의견을 작성해 주세요...',
    targetSection: 'managerAnswers.question4',
    sectionTitle: '기타 의견',
    rows: 5,
  },
];

const MonthlyReportManagerQA: React.FC<MonthlyReportManagerQAProps> = ({
  report,
  managerAnswers,
  onAnswersChange,
  onSaveAnswers,
  isReadOnly,
  userRole,
  currentUserId,
  onAddFeedback,
  onUpdateFeedback,
  onDeleteFeedback,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleEdit = async () => {
    if (isEditing) {
      setIsSaving(true);
      try {
        await onSaveAnswers();
        setIsEditing(false);
      } catch {
        alert('저장에 실패했습니다.');
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(true);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="flex items-center justify-between p-6 border-b bg-orange-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-orange-600" />
          매니저 의견
        </h2>
        {!isReadOnly && (
          <button
            onClick={handleToggleEdit}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1 text-sm text-orange-600 hover:bg-orange-100 rounded transition-colors disabled:opacity-50"
          >
            <Edit3 className="w-4 h-4" />
            {isSaving ? '저장 중...' : isEditing ? '저장' : '편집'}
          </button>
        )}
      </div>

      <div className="p-6">
        <div className="space-y-6">
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <h3 className="font-medium text-gray-900 mb-3">{q.title}</h3>
              {q.subtitle && (
                <p className="text-sm text-gray-600 mb-3">{q.subtitle}</p>
              )}

              {isEditing && !isReadOnly ? (
                <textarea
                  value={managerAnswers[q.key]}
                  onChange={(e) => onAnswersChange({ ...managerAnswers, [q.key]: e.target.value })}
                  rows={q.rows}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder={q.placeholder}
                />
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg min-h-[80px] text-gray-600">
                  {managerAnswers[q.key] ? (
                    <div className="whitespace-pre-line">{managerAnswers[q.key]}</div>
                  ) : (
                    <span className="text-gray-400 italic">
                      매니저 의견을 추가하려면 편집 버튼을 클릭하세요.
                    </span>
                  )}
                </div>
              )}

              {/* 양방향 피드백 */}
              <MonthlyReportFeedbackSection
                targetSection={q.targetSection}
                sectionTitle={q.sectionTitle}
                feedbacks={report.directorFeedbacks || []}
                reportId={report._id}
                userRole={userRole}
                currentUserId={currentUserId}
                isReadOnly={false}
                onAddFeedback={onAddFeedback}
                onUpdateFeedback={onUpdateFeedback}
                onDeleteFeedback={onDeleteFeedback}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportManagerQA;
