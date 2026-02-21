// src/app/v2/reports/components/MonthlyReport-FullView.tsx
// V2 월별 보고서 전체 뷰 - 재편된 섹션 구성 (2026-02)
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { MonthlyReportV2 } from './MonthlyReport-Types';
import type { PatientSummaryV2 } from './MonthlyReport-Types';
import MonthlyReportHeader from './MonthlyReport-Header';
import MonthlyReportExecutiveSummary from './MonthlyReport-ExecutiveSummary';
import MonthlyReportKPIOverview from './MonthlyReport-KPIOverview';
import MonthlyReportConversionFunnel from './MonthlyReport-ConversionFunnel';
import MonthlyReportDemographics from './MonthlyReport-Demographics';
import MonthlyReportChannelROI from './MonthlyReport-ChannelROI';
import MonthlyReportTreatmentAnalysis from './MonthlyReport-TreatmentAnalysis';
import MonthlyReportRevenueAnalysis from './MonthlyReport-RevenueAnalysis';
import MonthlyReportTrends from './MonthlyReport-Trends';
import MonthlyReportDisagreeAnalysis from './MonthlyReport-DisagreeAnalysis';
import MonthlyReportPatientConsultationTable from './MonthlyReport-PatientConsultationTable';
import MonthlyReportInsights from './MonthlyReport-Insights';
import MonthlyReportManagerQA from './MonthlyReport-ManagerQA';
import MonthlyReportActionButtons from './MonthlyReport-ActionButtons';
import MonthlyReportPatientDetailModal from './MonthlyReport-PatientDetailModal';

interface MonthlyReportFullViewProps {
  report: MonthlyReportV2;
  userRole?: string;
  currentUserId?: string;
  authToken: string;
  onReportUpdate: (updatedReport: MonthlyReportV2) => void;
}

const MonthlyReportFullView: React.FC<MonthlyReportFullViewProps> = ({
  report,
  userRole,
  currentUserId,
  authToken,
  onReportUpdate,
}) => {
  // 매니저 답변 로컬 상태
  const [managerAnswers, setManagerAnswers] = useState(report.managerAnswers);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSummaryV2 | null>(null);

  // report 변경 시 로컬 상태 동기화
  useEffect(() => {
    setManagerAnswers(report.managerAnswers);
  }, [report.managerAnswers]);

  const isReadOnly = report.status === 'submitted' || report.status === 'approved';

  // API 호출 헬퍼
  const patchReport = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/v2/reports/${report._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '업데이트 실패');
    return data.data as MonthlyReportV2;
  }, [report._id, authToken]);

  // 데이터 새로고침
  const handleRefresh = useCallback(async () => {
    if (!confirm('보고서 데이터를 최신 정보로 새로고침하시겠습니까?\n\n작성하신 매니저 의견과 피드백은 그대로 유지됩니다.')) return;
    setIsRefreshing(true);
    try {
      const updated = await patchReport({ refreshStats: true });
      onReportUpdate(updated);
      alert('보고서 데이터가 최신 정보로 업데이트되었습니다!');
    } catch (error) {
      alert('데이터 새로고침에 실패했습니다: ' + error);
    } finally {
      setIsRefreshing(false);
    }
  }, [patchReport, onReportUpdate]);

  // AI 인사이트 생성
  const handleGenerateAIInsights = useCallback(async () => {
    setIsGeneratingAI(true);
    try {
      const updated = await patchReport({ generateAIInsights: true });
      onReportUpdate(updated);
    } catch (error) {
      alert('AI 인사이트 생성에 실패했습니다: ' + error);
    } finally {
      setIsGeneratingAI(false);
    }
  }, [patchReport, onReportUpdate]);

  // 매니저 답변 저장
  const handleSaveAnswers = useCallback(async () => {
    const updated = await patchReport({ managerAnswers });
    onReportUpdate(updated);
  }, [patchReport, managerAnswers, onReportUpdate]);

  // 임시저장 (전체)
  const handleTempSave = useCallback(async () => {
    try {
      const updated = await patchReport({ managerAnswers });
      onReportUpdate(updated);
      alert('임시저장되었습니다.');
    } catch (error) {
      alert('임시저장에 실패했습니다: ' + error);
    }
  }, [patchReport, managerAnswers, onReportUpdate]);

  // 제출
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const updated = await patchReport({ managerAnswers, status: 'submitted' });
      onReportUpdate(updated);
      alert('보고서가 성공적으로 제출되었습니다!');
    } catch (error) {
      alert('제출에 실패했습니다: ' + error);
    } finally {
      setIsSubmitting(false);
    }
  }, [patchReport, managerAnswers, onReportUpdate]);

  // 피드백 추가
  const handleAddFeedback = useCallback(async (targetSection: string, content: string) => {
    const updated = await patchReport({
      feedbackAction: 'add',
      feedbackData: { content, targetSection },
    });
    onReportUpdate(updated);
  }, [patchReport, onReportUpdate]);

  // 피드백 수정
  const handleUpdateFeedback = useCallback(async (feedbackId: string, content: string) => {
    const updated = await patchReport({
      feedbackAction: 'update',
      feedbackId,
      feedbackData: { content },
    });
    onReportUpdate(updated);
  }, [patchReport, onReportUpdate]);

  // 피드백 삭제
  const handleDeleteFeedback = useCallback(async (feedbackId: string) => {
    const updated = await patchReport({
      feedbackAction: 'delete',
      feedbackId,
    });
    onReportUpdate(updated);
  }, [patchReport, onReportUpdate]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* PDF 전용 스타일 */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-container {
            margin: 0 !important; padding: 0 !important; background: white !important;
          }
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto print-container">
        {/* 1. 헤더 (간소화: 새로고침/PDF/상태) */}
        <MonthlyReportHeader
          report={report}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        {/* 2. 핵심 요약 (Executive Summary) */}
        <MonthlyReportExecutiveSummary
          stats={report.stats}
          year={report.year}
          month={report.month}
          onGenerateAIInsights={handleGenerateAIInsights}
          isGeneratingAI={isGeneratingAI}
          isReadOnly={isReadOnly}
        />

        {/* 3. KPI 개요 (스파크라인 포함) */}
        <MonthlyReportKPIOverview stats={report.stats} />

        {/* 4. 전환 퍼널 */}
        <MonthlyReportConversionFunnel stats={report.stats} />

        {/* 5. 인구통계 대시보드 */}
        <MonthlyReportDemographics stats={report.stats} />

        {/* 6. 유입채널 ROI 분석 */}
        <MonthlyReportChannelROI stats={report.stats} />

        {/* 7. 치료 관심분야 분석 */}
        <MonthlyReportTreatmentAnalysis stats={report.stats} />

        {/* 8. 매출 현황 분석 (도넛차트 + 누적매출) */}
        <MonthlyReportRevenueAnalysis
          revenueAnalysis={report.stats.revenueAnalysis}
          dailyTrends={report.stats.dailyTrends}
        />

        {/* 9. 일별/요일별 추이 */}
        <MonthlyReportTrends stats={report.stats} />

        {/* 10. 미동의 & 이탈 분석 */}
        <MonthlyReportDisagreeAnalysis stats={report.stats} />

        {/* 11. 주의 환자 & 환자별 상담 분석 */}
        <MonthlyReportPatientConsultationTable
          stats={report.stats}
          onPatientClick={setSelectedPatient}
        />

        {/* 12. 인사이트 & 개선사항 */}
        <MonthlyReportInsights stats={report.stats} />

        {/* 13. 매니저 의견 + 양방향 피드백 */}
        <MonthlyReportManagerQA
          report={report}
          managerAnswers={managerAnswers}
          onAnswersChange={setManagerAnswers}
          onSaveAnswers={handleSaveAnswers}
          isReadOnly={isReadOnly}
          userRole={userRole}
          currentUserId={currentUserId}
          onAddFeedback={handleAddFeedback}
          onUpdateFeedback={handleUpdateFeedback}
          onDeleteFeedback={handleDeleteFeedback}
        />

        {/* 14. 하단 액션 버튼 */}
        <MonthlyReportActionButtons
          report={report}
          managerAnswers={managerAnswers}
          isSubmitting={isSubmitting}
          onTempSave={handleTempSave}
          onSubmit={handleSubmit}
        />
      </div>

      {/* 환자 상세 모달 */}
      <MonthlyReportPatientDetailModal
        patient={selectedPatient}
        onClose={() => setSelectedPatient(null)}
      />
    </div>
  );
};

export default MonthlyReportFullView;
