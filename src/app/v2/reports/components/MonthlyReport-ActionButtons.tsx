// src/app/v2/reports/components/MonthlyReport-ActionButtons.tsx
// V2 하단 액션 버튼 (임시저장 + 제출) + 제출 확인 모달
'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import type { MonthlyReportV2 } from './MonthlyReport-Types';

interface MonthlyReportActionButtonsProps {
  report: MonthlyReportV2;
  managerAnswers: {
    question1: string;
    question2: string;
    question3: string;
    question4: string;
  };
  isSubmitting: boolean;
  onTempSave: () => Promise<void>;
  onSubmit: () => Promise<void>;
}

const MonthlyReportActionButtons: React.FC<MonthlyReportActionButtonsProps> = ({
  report,
  managerAnswers,
  isSubmitting,
  onTempSave,
  onSubmit,
}) => {
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const isReadOnly = report.status === 'submitted' || report.status === 'approved';
  if (isReadOnly) return null;

  const validateBeforeSubmit = () => {
    const errors: string[] = [];
    if (!managerAnswers.question1.trim()) errors.push('미내원 환자 원인 분석');
    if (!managerAnswers.question2.trim()) errors.push('치료 거부 환자 원인 분석');
    if (!managerAnswers.question3.trim()) errors.push('개선 방안');
    return errors;
  };

  const handleShowSubmitModal = () => {
    const validationErrors = validateBeforeSubmit();
    if (validationErrors.length > 0) {
      alert(`다음 항목을 작성해주세요:\n\n${validationErrors.map(e => `· ${e}`).join('\n')}`);
      return;
    }
    setShowSubmitModal(true);
  };

  const handleFinalSubmit = async () => {
    try {
      await onSubmit();
      setShowSubmitModal(false);
    } catch (error) {
      alert('제출에 실패했습니다: ' + error);
    }
  };

  return (
    <>
      <div className="mt-8 flex justify-end gap-3 no-print">
        <button
          onClick={onTempSave}
          disabled={isSubmitting}
          className="px-6 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          임시저장
        </button>
        <button
          onClick={handleShowSubmitModal}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          제출하기
        </button>
      </div>

      {/* 제출 확인 모달 */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Send className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">보고서 제출 확인</h3>
                <p className="text-sm text-gray-600">
                  {report.year}년 {report.month}월 보고서
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 text-yellow-600 mt-0.5">!</div>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">제출 전 확인사항</p>
                  <ul className="space-y-1 text-xs">
                    <li>· 보고서를 제출하면 <strong>수정이 어려워집니다</strong></li>
                    <li>· 제출 후 변경이 필요한 경우 관리자에게 문의해야 합니다</li>
                    <li>· 모든 내용을 다시 한 번 확인해주세요</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-6">
              <p className="mb-2 font-medium">제출 내용:</p>
              <div className="bg-gray-50 rounded p-3 space-y-1 text-xs">
                <div>{'>'} 미내원 환자 원인 분석: {managerAnswers.question1.trim() ? '작성완료' : '미작성'}</div>
                <div>{'>'} 치료 거부 환자 원인 분석: {managerAnswers.question2.trim() ? '작성완료' : '미작성'}</div>
                <div>{'>'} 개선 방안: {managerAnswers.question3.trim() ? '작성완료' : '미작성'}</div>
                <div>{'>'} 기타 의견: {managerAnswers.question4.trim() ? '작성완료' : '미작성'}</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? '제출 중...' : '최종 제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MonthlyReportActionButtons;
