// src/app/v2/reports/components/MonthlyReport-Header.tsx
// V2 월별 보고서 헤더 - 제목, 상태배지, 새로고침, PDF
'use client';

import React from 'react';
import { Calendar, Download, RefreshCw, Send } from 'lucide-react';
import type { MonthlyReportV2 } from './MonthlyReport-Types';

interface MonthlyReportHeaderProps {
  report: MonthlyReportV2;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const STATUS_CONFIG = {
  draft: { label: '임시저장', className: 'bg-yellow-100 text-yellow-800' },
  submitted: { label: '최종제출', className: 'bg-blue-100 text-blue-800' },
  approved: { label: '승인완료', className: 'bg-green-100 text-green-800' },
} as const;

const MonthlyReportHeader: React.FC<MonthlyReportHeaderProps> = ({
  report,
  isRefreshing,
  onRefresh,
}) => {
  const isReadOnly = report.status === 'submitted' || report.status === 'approved';
  const statusConfig = STATUS_CONFIG[report.status];

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {report.month}월 상담 실적 보고서
            </h1>
            {!isReadOnly && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed no-print"
                title="최신 데이터로 통계 새로고침"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? '새로고침 중...' : '데이터 새로고침'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {report.year}년 {report.month}월
            </span>
            <span>생성일: {report.generatedDate}</span>
            <span>최근 업데이트: {new Date(report.updatedAt).toLocaleDateString()}</span>
            <span className={`px-2 py-1 rounded-full text-xs ${statusConfig.className}`}>
              {statusConfig.label}
            </span>
          </div>

          {/* 새로고침 안내 메시지 */}
          {!isReadOnly && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 no-print">
              <div className="flex items-start gap-2">
                <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">데이터 업데이트 안내</p>
                  <p className="text-xs mt-1">
                    환자 데이터가 변경된 경우 &apos;데이터 새로고침&apos; 버튼을 클릭하여 최신 통계로 업데이트할 수 있습니다.
                    <br />
                    작성하신 매니저 의견은 그대로 보존됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 제출 완료 안내 */}
          {report.status === 'submitted' && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 no-print">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span className="font-medium">이 보고서는 최종 제출되었습니다.</span>
              </div>
              <p className="text-xs mt-1">제출된 보고서는 수정할 수 없습니다. 수정이 필요한 경우 관리자에게 문의하세요.</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 no-print"
          >
            <Download className="w-4 h-4" />
            PDF 다운로드
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportHeader;
