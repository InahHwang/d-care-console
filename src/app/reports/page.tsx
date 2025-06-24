//src/app/reports/page.tsx

export const dynamic = 'force-dynamic';

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { 
  fetchReports, 
  fetchReport,
  generateMonthlyReport, 
  deleteReport,  // 🔥 추가
  clearCurrentReport,
  selectReports,
  selectCurrentReport,
  selectReportsLoading,
  selectReportsError
} from '@/store/slices/reportsSlice';
import { setCurrentMenuItem } from '@/store/slices/uiSlice';
import { Calendar, Plus, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import MonthlyReport from '@/components/reports/MonthlyReport';

export default function ReportsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  
  const reports = useAppSelector(selectReports);
  const currentReport = useAppSelector(selectCurrentReport);
  const isLoading = useAppSelector(selectReportsLoading);
  const error = useAppSelector(selectReportsError);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  useEffect(() => {
    dispatch(setCurrentMenuItem('월별보고서'));
    dispatch(fetchReports());
  }, [dispatch]);

  const handleCreateReport = async () => {
    try {
      const result = await dispatch(generateMonthlyReport({
        month: selectedMonth,
        year: selectedYear
      })).unwrap();
      
      setShowCreateModal(false);
      
      // 🔥 보고서 목록 새로고침 추가
      await dispatch(fetchReports());
      
      // 생성된 보고서로 이동하지 않고, 현재 페이지에서 보여주기
    } catch (error: any) {
      alert(error || '보고서 생성에 실패했습니다.');
    }
  };

  const handleViewReport = async (reportId: string) => {
    try {
      await dispatch(fetchReport(reportId)).unwrap();
    } catch (error) {
      alert('보고서를 불러오는데 실패했습니다.');
    }
  };

  const handleDeleteReport = async (reportId: string, reportTitle: string) => {
    if (!confirm(`"${reportTitle}" 보고서를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      await dispatch(deleteReport(reportId)).unwrap();
      
      // 🔥 삭제 후 보고서 목록 새로고침 추가 (안전장치)
      await dispatch(fetchReports());
      
      alert('보고서가 삭제되었습니다.');
    } catch (error) {
      alert('보고서 삭제에 실패했습니다: ' + error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
            <Clock className="w-3 h-3" />
            임시저장
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
            <AlertCircle className="w-3 h-3" />
            제출완료
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
            <CheckCircle className="w-3 h-3" />
            승인완료
          </span>
        );
      default:
        return null;
    }
  };

  // 현재 보고서가 선택되어 있으면 보고서 상세보기 표시
  if (currentReport) {
    return (
      <AuthGuard>
        <AppLayout currentPage="reports">
          <div className="mb-4">
            <button
              onClick={async () => {
                dispatch(clearCurrentReport());
                // 🔥 보고서 목록 새로고침 추가
                await dispatch(fetchReports());
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ← 보고서 목록으로 돌아가기
            </button>
          </div>
          <MonthlyReport reportData={currentReport} />
        </AppLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppLayout currentPage="reports">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">월별보고서</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              새 보고서 생성
            </button>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* 보고서 목록 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">보고서 목록</h2>
            </div>
            
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">보고서를 불러오는 중...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>생성된 보고서가 없습니다.</p>
                <p className="text-sm mt-1">새 보고서를 생성해보세요.</p>
              </div>
            ) : (
              <div className="divide-y">
                {reports.map((report) => (
                  <div key={report._id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {report.year}년 {report.month}월 보고서
                          </h3>
                          <p className="text-sm text-gray-600">
                            작성자: {report.createdByName} | 
                            생성일: {new Date(report.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {getStatusBadge(report.status)}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewReport(report._id)}
                            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                          >
                            보기
                          </button>
                          <button
                            onClick={() => handleDeleteReport(report._id, `${report.year}년 ${report.month}월 보고서`)}
                            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 보고서 생성 모달 */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">새 보고서 생성</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    년도
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    월
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}월
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateReport}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? '생성 중...' : '생성'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    </AuthGuard>
  );
}