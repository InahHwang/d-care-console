// src/components/reports/MonthlyReport.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, Phone, Users, CreditCard, MapPin, TrendingUp, Edit3, Send, Download, MessageSquare, PhoneCall, RefreshCw, AlertTriangle, TrendingDown, DollarSign, Eye, EyeOff, X, Plus, Trash2, Edit, MessageCircle } from 'lucide-react';
import { MonthlyReportData, PatientConsultationSummary, DirectorFeedback } from '@/types/report';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { saveReport, submitReport, updateCurrentReport, refreshReportData, addDirectorFeedback, updateDirectorFeedback, deleteDirectorFeedback } from '@/store/slices/reportsSlice';
import { calculatePatientProgress } from '@/utils/patientProgressUtils';
import { FiPhone, FiPhoneCall } from 'react-icons/fi';
import { HiOutlineRefresh } from 'react-icons/hi';
import RevenueAnalysisSection from './RevenueAnalysisSection';
import SimplePatientListModal from './SimplePatientListModal';
import { Patient } from '@/types/patient';

const ProgressGuideSection: React.FC = () => {
  const progressStages = [
    {
      stage: '전화상담',
      description: '첫 문의 후 아직 예약이 확정되지 않은 상태',
      detail: '콜백필요, 잠재고객, 부재중 등 예약 전 단계',
      color: 'text-yellow-800',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300'
    },
    {
      stage: '예약완료',
      description: '상담을 통해 내원 예약이 확정된 상태',
      detail: '예약일시가 정해져 내원을 기다리는 단계',
      color: 'text-orange-800',
      bgColor: 'bg-orange-100',
      borderColor: 'border-orange-300'
    },
    {
      stage: '내원완료',
      description: '실제 병원에 내원하여 직접 상담을 받은 상태',
      detail: '내원 후 치료 여부가 아직 결정되지 않은 단계',
      color: 'text-purple-800',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300'
    },
    {
      stage: '치료동의',
      description: '내원 상담 후 치료에 동의한 상태',
      detail: '치료 계획에 동의했지만 아직 치료를 시작하지 않은 단계',
      color: 'text-orange-800',
      bgColor: 'bg-orange-100',
      borderColor: 'border-orange-300'
    },
    {
      stage: '치료시작',
      description: '실제 치료가 시작된 상태',
      detail: '치료 과정이 진행 중이거나 완료된 단계',
      color: 'text-green-800',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    },
    {
      stage: '종결',
      description: '상담이나 치료가 완전히 종료된 상태',
      detail: '더 이상 진행할 내용이 없는 최종 단계',
      color: 'text-gray-800',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300'
    }
  ];

  return (
    <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">?</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900">
          📋 환자 진행상황 가이드
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {progressStages.map((stage, index) => (
          <div 
            key={stage.stage}
            className={`p-3 rounded-lg border-2 ${stage.bgColor} ${stage.borderColor}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-500">
                  {index + 1}.
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stage.color} ${stage.bgColor}`}>
                  {stage.stage}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-700 font-medium mb-1">
              {stage.description}
            </p>
            <p className="text-xs text-slate-600">
              {stage.detail}
            </p>
          </div>
        ))}
      </div>
      
    </div>
  );
};

interface MonthlyReportProps {
  reportData: MonthlyReportData;
}

// 🔥 새로 추가: 피드백 컴포넌트
const DirectorFeedbackSection: React.FC<{
  targetSection: string;
  sectionTitle: string;
  feedbacks: DirectorFeedback[];
  reportId?: string;
  userRole?: string;
  currentUserId?: string;
}> = ({ targetSection, sectionTitle, feedbacks, reportId, userRole, currentUserId }) => {
  const dispatch = useAppDispatch();
  const { isFeedbackSubmitting } = useAppSelector((state) => state.reports);
  
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [feedbackContent, setFeedbackContent] = useState('');

  // 해당 섹션의 피드백들만 필터링
  const sectionFeedbacks = feedbacks.filter(f => f.targetSection === targetSection);

  // 피드백 작성 권한 확인 (원장님만 가능)
  const canWriteFeedback = userRole === 'master' || userRole === 'director';

  const handleAddFeedback = async () => {
    if (!reportId || !feedbackContent.trim()) return;

    try {
      await dispatch(addDirectorFeedback({
        reportId,
        feedbackData: {
          content: feedbackContent.trim(),
          targetSection
        }
      })).unwrap();
      
      setFeedbackContent('');
      setShowFeedbackForm(false);
    } catch (error) {
      alert('피드백 추가에 실패했습니다: ' + error);
    }
  };

  const handleUpdateFeedback = async (feedbackId: string) => {
    if (!reportId || !feedbackContent.trim()) return;

    try {
      await dispatch(updateDirectorFeedback({
        reportId,
        feedbackId,
        feedbackData: {
          content: feedbackContent.trim(),
          targetSection
        }
      })).unwrap();
      
      setFeedbackContent('');
      setEditingFeedbackId(null);
    } catch (error) {
      alert('피드백 수정에 실패했습니다: ' + error);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!reportId) return;
    
    if (!confirm('이 피드백을 삭제하시겠습니까?')) return;

    try {
      await dispatch(deleteDirectorFeedback({
        reportId,
        feedbackId
      })).unwrap();
    } catch (error) {
      alert('피드백 삭제에 실패했습니다: ' + error);
    }
  };

  const startEdit = (feedback: DirectorFeedback) => {
    setEditingFeedbackId(feedback.feedbackId);
    setFeedbackContent(feedback.content);
    setShowFeedbackForm(false);
  };

  const cancelEdit = () => {
    setEditingFeedbackId(null);
    setFeedbackContent('');
  };

  // 피드백이 없고 권한이 없으면 렌더링하지 않음
  if (sectionFeedbacks.length === 0 && !canWriteFeedback) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-orange-900 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          원장님 피드백 ({sectionTitle})
          {sectionFeedbacks.length > 0 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
              {sectionFeedbacks.length}개
            </span>
          )}
        </h4>
        
        {canWriteFeedback && !showFeedbackForm && !editingFeedbackId && (
          <button
            onClick={() => setShowFeedbackForm(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 border border-orange-300 rounded hover:bg-orange-100 no-print"
          >
            <Plus className="w-3 h-3" />
            피드백 추가
          </button>
        )}
      </div>

      {/* 기존 피드백 목록 */}
      <div className="space-y-3">
        {sectionFeedbacks.map((feedback) => (
          <div key={feedback.feedbackId} className="bg-white border border-orange-200 rounded p-3">
            {editingFeedbackId === feedback.feedbackId ? (
              // 수정 모드
              <div className="space-y-2">
                <textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  className="w-full h-20 p-2 text-sm border rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="피드백 내용을 입력하세요..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateFeedback(feedback.feedbackId)}
                    disabled={isFeedbackSubmitting || !feedbackContent.trim()}
                    className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                  >
                    {isFeedbackSubmitting ? '저장 중...' : '저장'}
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
              // 보기 모드
              <>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 whitespace-pre-line">
                      {feedback.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>{feedback.createdByName}</span>
                      <span>•</span>
                      <span>{new Date(feedback.createdAt).toLocaleDateString()}</span>
                      {feedback.updatedAt && (
                        <>
                          <span>•</span>
                          <span>수정됨</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* 수정/삭제 버튼 (작성자 또는 master만) */}
                  {canWriteFeedback && (feedback.createdBy === currentUserId || userRole === 'master') && (
                    <div className="flex gap-1 ml-2 no-print">
                      <button
                        onClick={() => startEdit(feedback)}
                        className="p-1 text-gray-400 hover:text-orange-600"
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
        <div className="mt-3 p-3 bg-white border border-orange-200 rounded">
          <textarea
            value={feedbackContent}
            onChange={(e) => setFeedbackContent(e.target.value)}
            className="w-full h-20 p-2 text-sm border rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="피드백 내용을 입력하세요..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAddFeedback}
              disabled={isFeedbackSubmitting || !feedbackContent.trim()}
              className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {isFeedbackSubmitting ? '추가 중...' : '피드백 추가'}
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

const MonthlyReport: React.FC<MonthlyReportProps> = ({ reportData }) => {
  const dispatch = useAppDispatch();
  const { isSubmitting, isRefreshing } = useAppSelector((state) => state.reports);
  const { user } = useAppSelector((state) => state.auth); // 🔥 사용자 정보 가져오기
  
  const [managerComment, setManagerComment] = useState(reportData.managerComment || '');
  const [improvementSuggestions, setImprovementSuggestions] = useState(reportData.improvementSuggestions || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingImprovement, setIsEditingImprovement] = useState(false);
  const [managerAnswers, setManagerAnswers] = useState({
    question1: reportData.managerAnswers?.question1 || '',
    question2: reportData.managerAnswers?.question2 || '',
    question3: reportData.managerAnswers?.question3 || '',
    question4: reportData.managerAnswers?.question4 || ''
  });
  const [isEditingAnswers, setIsEditingAnswers] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  // 🔥 환자 상담 내용 상세 모달 상태
  const [selectedPatientConsultation, setSelectedPatientConsultation] = useState<PatientConsultationSummary | null>(null);
  
  // 🔥 새로 추가: 환자 목록 모달 관련 상태
  const [showPatientListModal, setShowPatientListModal] = useState(false);
  const [patientListData, setPatientListData] = useState<{
    patients: Patient[];
    title: string;
  }>({ patients: [], title: '' });

  // 로컬 상태를 Redux 상태와 동기화
  useEffect(() => {
    setManagerComment(reportData.managerComment || '');
    setImprovementSuggestions(reportData.improvementSuggestions || '');
    setManagerAnswers({
      question1: reportData.managerAnswers?.question1 || '',
      question2: reportData.managerAnswers?.question2 || '',
      question3: reportData.managerAnswers?.question3 || '',
      question4: reportData.managerAnswers?.question4 || ''
    });
  }, [reportData]);

  // 🔥 새로 추가: 환자 목록 모달 핸들러
  const handlePatientListClick = (patients: Patient[], title: string) => {
    setPatientListData({ patients, title });
    setShowPatientListModal(true);
  };

  // 데이터 새로고침 핸들러
  const handleRefreshData = async () => {
    if (!reportData._id) return;
    
    if (!confirm('보고서 데이터를 최신 정보로 새로고침하시겠습니까?\n\n작성하신 매니저 의견과 피드백은 그대로 유지됩니다.')) {
      return;
    }
    
    try {
      await dispatch(refreshReportData(reportData._id)).unwrap();
      alert('보고서 데이터가 최신 정보로 업데이트되었습니다!');
    } catch (error) {
      alert('데이터 새로고침에 실패했습니다: ' + error);
    }
  };

  const handleSaveManagerComment = async () => {
    if (!reportData._id) return;
    
    try {
      await dispatch(saveReport({
        reportId: reportData._id,
        formData: { managerComment }
      })).unwrap();
      setIsEditing(false);
    } catch (error) {
      alert('저장에 실패했습니다.');
    }
  };

  const handleSaveImprovementSuggestions = async () => {
    if (!reportData._id) return;
    
    try {
      await dispatch(saveReport({
        reportId: reportData._id,
        formData: { improvementSuggestions }
      })).unwrap();
      setIsEditingImprovement(false);
    } catch (error) {
      alert('저장에 실패했습니다.');
    }
  };

  const handleSaveAnswers = async () => {
    if (!reportData._id) return;
    
    try {
      await dispatch(saveReport({
        reportId: reportData._id,
        formData: { managerAnswers }
      })).unwrap();
      setIsEditingAnswers(false);
    } catch (error) {
      alert('저장에 실패했습니다.');
    }
  };

  const handleTempSave = async () => {
    if (!reportData._id) return;
    
    try {
      await dispatch(saveReport({
        reportId: reportData._id,
        formData: {
          managerComment,
          improvementSuggestions,
          managerAnswers
        }
      })).unwrap();
      alert('임시저장되었습니다.');
    } catch (error) {
      alert('임시저장에 실패했습니다.');
    }
  };

  // 🔥 제출 전 검증 함수
  const validateBeforeSubmit = () => {
    const errors = [];
    
    if (!managerAnswers.question1.trim()) {
      errors.push('• 미내원 환자 원인 분석');
    }
    if (!managerAnswers.question2.trim()) {
      errors.push('• 치료 거부 환자 원인 분석');
    }
    if (!managerAnswers.question3.trim()) {
      errors.push('• 개선 방안');
    }
    
    return errors;
  };

  const handleShowSubmitModal = () => {
    const validationErrors = validateBeforeSubmit();
    
    if (validationErrors.length > 0) {
      alert(`다음 항목을 작성해주세요:\n\n${validationErrors.join('\n')}`);
      return;
    }
    
    setShowSubmitModal(true);
  };

  // 🔥 최종 제출 처리
  const handleFinalSubmit = async () => {
    if (!reportData._id) return;
    
    try {
      await dispatch(submitReport({
        reportId: reportData._id,
        formData: {
          month: reportData.month,
          year: reportData.year,
          managerComment,
          improvementSuggestions,
          managerAnswers
        }
      })).unwrap();
      
      setShowSubmitModal(false);
      alert('보고서가 성공적으로 제출되었습니다!');
    } catch (error) {
      alert('제출에 실패했습니다: ' + error);
    }
  };

  const handlePatientConsultationClick = (patient: PatientConsultationSummary) => {
    setSelectedPatientConsultation(patient);
  };

  const handleClosePatientConsultationModal = () => {
    setSelectedPatientConsultation(null);
  };

  const isReadOnly = reportData.status === 'submitted' || reportData.status === 'approved';

  // 🔥 피드백 데이터 가져오기
  const directorFeedbacks = reportData.directorFeedbacks || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* PDF 전용 스타일 */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-container {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
      
      <div className="max-w-5xl mx-auto print-container">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {reportData.month}월 상담 실적 보고서
                </h1>
                {/* 데이터 새로고침 버튼 */}
                {!isReadOnly && (
                  <button
                    onClick={handleRefreshData}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed no-print"
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
                  {reportData.year}년 {reportData.month}월
                </span>
                <span>생성일: {reportData.generatedDate}</span>
                <span>최근 업데이트: {new Date(reportData.updatedAt).toLocaleDateString()}</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  reportData.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  reportData.status === 'submitted' ? 'bg-orange-100 text-orange-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {reportData.status === 'draft' ? '임시저장' :
                   reportData.status === 'submitted' ? '최종제출' : '승인완료'}
                </span>
              </div>
              {/* 새로고침 안내 메시지 */}
              {!isReadOnly && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 no-print">
                  <div className="flex items-start gap-2">
                    <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">데이터 업데이트 안내</p>
                      <p className="text-xs mt-1">
                        환자 데이터가 변경된 경우 '데이터 새로고침' 버튼을 클릭하여 최신 통계로 업데이트할 수 있습니다.
                        <br />
                        작성하신 매니저 의견은 그대로 보존됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 🔥 새로 추가: 제출 완료 안내 */}
              {reportData.status === 'submitted' && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 no-print">
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

        {/* 상담 실적 요약 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6 border-b bg-orange-50">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-600" />
              상담 실적 요약
            </h2>
          </div>
          <div className="p-6">
            {/* 신규 문의 */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  이번달 총 신규문의 - {reportData.totalInquiries}건
                </h3>
                <span className={`text-sm px-2 py-1 rounded-full ${
                  reportData.changes.totalInquiries.type === 'increase' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  전월대비 {reportData.changes.totalInquiries.type === 'increase' ? '+' : '-'}{reportData.changes.totalInquiries.value}건
                </span>
              </div>
              <div className="flex gap-6 text-sm text-gray-600 ml-4">
                <span className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-green-600" />
                  인바운드 {reportData.inboundCalls}건
                </span>
                <span className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-orange-600" />
                  아웃바운드 {reportData.outboundCalls}건
                </span>
                {/* 🔥 구신환 정보 추가 */}
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  구신환 {reportData.returningCalls}건
                </span>
              </div>
            </div>

            {/* 주요 지표 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">예약 환자수</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-2xl font-bold text-green-900">{reportData.appointmentPatients}명</div>
                  {reportData.changes.appointmentPatients && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      reportData.changes.appointmentPatients.type === 'increase' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {reportData.changes.appointmentPatients.type === 'increase' ? '+' : '-'}{reportData.changes.appointmentPatients.value}명
                    </span>
                  )}
                </div>
                <div className="text-sm text-green-700">
                  예약전환율 {reportData.appointmentRate}% 
                  {reportData.changes.appointmentRate && (
                    <span className={`ml-1 ${
                      reportData.changes.appointmentRate.type === 'increase' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      ({reportData.changes.appointmentRate.type === 'increase' ? '+' : '-'}{reportData.changes.appointmentRate.value}%p)
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  <span className="font-medium text-orange-800">내원 환자수</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-2xl font-bold text-orange-900">{reportData.visitedPatients}명</div>
                  {reportData.changes.visitedPatients && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      reportData.changes.visitedPatients.type === 'increase' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {reportData.changes.visitedPatients.type === 'increase' ? '+' : '-'}{reportData.changes.visitedPatients.value}명
                    </span>
                  )}
                </div>
                <div className="text-sm text-orange-700">
                  내원전환율 {reportData.visitRate}%
                  {reportData.changes.visitRate && (
                    <span className={`ml-1 ${
                      reportData.changes.visitRate.type === 'increase' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      ({reportData.changes.visitRate.type === 'increase' ? '+' : '-'}{reportData.changes.visitRate.value}%p)
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-purple-800">총 결제금액</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-2xl font-bold text-purple-900">
                    {reportData.totalPayment.toLocaleString()}원
                  </div>
                  {reportData.changes.totalPayment && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      reportData.changes.totalPayment.type === 'increase' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {reportData.changes.totalPayment.type === 'increase' ? '+' : '-'}{(reportData.changes.totalPayment.value / 10000).toFixed(0)}만원
                    </span>
                  )}
                </div>
                <div className="text-sm text-purple-700 space-y-1">
                  <div className="flex items-center gap-2">
                    결제환자수 {reportData.paymentPatients}명
                    {reportData.changes.paymentPatients && (
                      <span className={`text-xs px-1 py-0.5 rounded ${
                        reportData.changes.paymentPatients.type === 'increase' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {reportData.changes.paymentPatients.type === 'increase' ? '+' : '-'}{reportData.changes.paymentPatients.value}명
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    결제전환율 {reportData.paymentRate}%
                    {reportData.changes.paymentRate && (
                      <span className={`text-xs ${
                        reportData.changes.paymentRate.type === 'increase' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        ({reportData.changes.paymentRate.type === 'increase' ? '+' : '-'}{reportData.changes.paymentRate.value}%p)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 환자 통계 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6 border-b bg-green-50">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              환자 통계
            </h2>
          </div>
          <div className="p-6">
            {/* 평균 연령 */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-2">평균 연령</h3>
              <div className="text-2xl font-bold text-gray-900">{reportData.averageAge}세</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 지역별 통계 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  지역별 통계
                </h3>
                <div className="space-y-3">
                  {reportData.regionStats.map((region, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-orange-100 text-orange-800 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <span className="text-sm">{region.region}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-orange-600 h-2 rounded-full" 
                            style={{ width: `${Math.min((region.percentage / 30) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium w-12">{region.percentage.toFixed(1)}%</span>
                        <span className="text-xs text-gray-500 w-8">({region.count}명)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 유입경로 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-4">유입경로</h3>
                <div className="space-y-3">
                  {reportData.channelStats.map((channel, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <span className="text-sm">{channel.channel}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${Math.min((channel.percentage / 45) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium w-12">{channel.percentage.toFixed(1)}%</span>
                        <span className="text-xs text-gray-500 w-8">({channel.count}건)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🔥 환자별 상담 내용 요약 섹션 */}
        <PatientConsultationSection 
          reportData={reportData}
          onPatientClick={handlePatientConsultationClick}
        />

        {/* 🔥 매출 현황 분석 섹션 (새로 추가) */}
        {reportData.revenueAnalysis && (
          <RevenueAnalysisSection 
            reportData={reportData}
            onPatientListClick={handlePatientListClick}
          />
        )}

        {/* 이슈 및 개선사항 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6 border-b bg-yellow-50">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-600" />
              이슈 및 개선사항
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* 자동 생성: 주요 이슈 */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                  🚨 주요 이슈 <span className="text-xs bg-red-100 px-2 py-1 rounded">(자동 감지)</span>
                </h3>
                <ul className="text-sm text-red-700 space-y-1">
                  {/* 신규 문의 감소 */}
                  {reportData.changes.totalInquiries.type === 'decrease' && (
                    <li>
                      • 신규 문의 총 {reportData.changes.totalInquiries.value}건 감소 
                      <span className="text-xs ml-1 text-red-600">
                        (인바운드 {reportData.changes.inboundCalls?.type === 'decrease' ? '-' : '+'}{reportData.changes.inboundCalls?.value || 0}건, 
                         아웃바운드 {reportData.changes.outboundCalls?.type === 'decrease' ? '-' : '+'}{reportData.changes.outboundCalls?.value || 0}건)
                      </span>
                    </li>
                  )}
                  
                  {/* 예약 관련 이슈 - 한 줄로 묶기 */}
                  {(reportData.changes.appointmentPatients?.type === 'decrease' || reportData.changes.appointmentRate.type === 'decrease') && (
                    <li>
                      • 예약 성과 저하: 
                      {reportData.changes.appointmentPatients?.type === 'decrease' && (
                        <span> 예약환자수 {reportData.changes.appointmentPatients.value}명 감소</span>
                      )}
                      {reportData.changes.appointmentPatients?.type === 'decrease' && reportData.changes.appointmentRate.type === 'decrease' && ', '}
                      {reportData.changes.appointmentRate.type === 'decrease' && (
                        <span> 예약전환율 {reportData.changes.appointmentRate.value}%p 하락</span>
                      )}
                    </li>
                  )}
                  
                  {/* 내원 관련 이슈 - 한 줄로 묶기 */}
                  {(reportData.changes.visitedPatients?.type === 'decrease' || reportData.changes.visitRate.type === 'decrease') && (
                    <li>
                      • 내원 성과 저하: 
                      {reportData.changes.visitedPatients?.type === 'decrease' && (
                        <span> 내원환자수 {reportData.changes.visitedPatients.value}명 감소</span>
                      )}
                      {reportData.changes.visitedPatients?.type === 'decrease' && reportData.changes.visitRate.type === 'decrease' && ', '}
                      {reportData.changes.visitRate.type === 'decrease' && (
                        <span> 내원전환율 {reportData.changes.visitRate.value}%p 하락</span>
                      )}
                    </li>
                  )}
                  
                  {/* 결제 관련 이슈 - 한 줄로 묶기 */}
                  {(reportData.changes.paymentPatients?.type === 'decrease' || reportData.changes.paymentRate.type === 'decrease' || reportData.changes.totalPayment.type === 'decrease') && (
                    <li>
                      • 매출 성과 저하: 
                      {reportData.changes.totalPayment.type === 'decrease' && (
                        <span> 총 결제금액 {(reportData.changes.totalPayment.value / 10000).toFixed(0)}만원 감소</span>
                      )}
                      {reportData.changes.totalPayment.type === 'decrease' && (reportData.changes.paymentPatients?.type === 'decrease' || reportData.changes.paymentRate.type === 'decrease') && ', '}
                      {reportData.changes.paymentPatients?.type === 'decrease' && (
                        <span> 결제환자수 {reportData.changes.paymentPatients.value}명 감소</span>
                      )}
                      {reportData.changes.paymentPatients?.type === 'decrease' && reportData.changes.paymentRate.type === 'decrease' && ', '}
                      {reportData.changes.paymentRate.type === 'decrease' && (
                        <span> 결제전환율 {reportData.changes.paymentRate.value}%p 하락</span>
                      )}
                    </li>
                  )}
                  
                  {/* 이슈가 없는 경우 */}
                  {!(
                    reportData.changes.totalInquiries.type === 'decrease' ||
                    reportData.changes.appointmentPatients?.type === 'decrease' ||
                    reportData.changes.appointmentRate.type === 'decrease' ||
                    reportData.changes.visitedPatients?.type === 'decrease' ||
                    reportData.changes.visitRate.type === 'decrease' ||
                    reportData.changes.paymentPatients?.type === 'decrease' ||
                    reportData.changes.paymentRate.type === 'decrease' ||
                    reportData.changes.totalPayment.type === 'decrease'
                  ) && (
                    <li>• 전월 대비 감소한 주요 지표가 없습니다.</li>
                  )}
                </ul>
              </div>
              
              {/* 자동 생성: 긍정적 변화 */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                  ✅ 긍정적 변화 <span className="text-xs bg-green-100 px-2 py-1 rounded">(자동 감지)</span>
                </h3>
                <ul className="text-sm text-green-700 space-y-1">
                  {/* 신규 문의 증가 */}
                  {reportData.changes.totalInquiries.type === 'increase' && reportData.changes.totalInquiries.value >= 1 && (
                    <li>
                      • 신규 문의 총 {reportData.changes.totalInquiries.value}건 증가 
                      <span className="text-xs ml-1 text-green-600">
                        (인바운드 {reportData.changes.inboundCalls?.type === 'decrease' ? '-' : '+'}{reportData.changes.inboundCalls?.value || 0}건, 
                         아웃바운드 {reportData.changes.outboundCalls?.type === 'decrease' ? '-' : '+'}{reportData.changes.outboundCalls?.value || 0}건)
                      </span>
                    </li>
                  )}
                  
                  {/* 예약 관련 개선 - 한 줄로 묶기 */}
                  {((reportData.changes.appointmentPatients?.type === 'increase' && reportData.changes.appointmentPatients.value > 0) || (reportData.changes.appointmentRate.type === 'increase' && reportData.changes.appointmentRate.value > 0)) && (
                    <li>
                      • 예약 성과 개선: 
                      {reportData.changes.appointmentPatients?.type === 'increase' && reportData.changes.appointmentPatients.value > 0 && (
                        <span> 예약환자수 {reportData.changes.appointmentPatients.value}명 증가</span>
                      )}
                      {reportData.changes.appointmentPatients?.type === 'increase' && reportData.changes.appointmentPatients.value > 0 && reportData.changes.appointmentRate.type === 'increase' && reportData.changes.appointmentRate.value > 0 && ', '}
                      {reportData.changes.appointmentRate.type === 'increase' && reportData.changes.appointmentRate.value > 0 && (
                        <span> 예약전환율 {reportData.changes.appointmentRate.value}%p 개선</span>
                      )}
                    </li>
                  )}
                  
                  {/* 내원 관련 개선 - 한 줄로 묶기 */}
                  {((reportData.changes.visitedPatients?.type === 'increase' && reportData.changes.visitedPatients.value > 0) || (reportData.changes.visitRate.type === 'increase' && reportData.changes.visitRate.value > 0)) && (
                    <li>
                      • 내원 성과 개선: 
                      {reportData.changes.visitedPatients?.type === 'increase' && reportData.changes.visitedPatients.value > 0 && (
                        <span> 내원환자수 {reportData.changes.visitedPatients.value}명 증가</span>
                      )}
                      {reportData.changes.visitedPatients?.type === 'increase' && reportData.changes.visitedPatients.value > 0 && reportData.changes.visitRate.type === 'increase' && reportData.changes.visitRate.value > 0 && ', '}
                      {reportData.changes.visitRate.type === 'increase' && reportData.changes.visitRate.value > 0 && (
                        <span> 내원전환율 {reportData.changes.visitRate.value}%p 개선</span>
                      )}
                    </li>
                  )}
                  
                  {/* 결제 관련 개선 - 한 줄로 묶기 */}
                  {((reportData.changes.paymentPatients?.type === 'increase' && reportData.changes.paymentPatients.value > 0) || (reportData.changes.paymentRate.type === 'increase' && reportData.changes.paymentRate.value > 0) || (reportData.changes.totalPayment.type === 'increase' && reportData.changes.totalPayment.value > 0)) && (
                    <li>
                      • 매출 성과 개선: 
                      {reportData.changes.totalPayment.type === 'increase' && reportData.changes.totalPayment.value > 0 && (
                        <span> 총 결제금액 {(reportData.changes.totalPayment.value / 10000).toFixed(0)}만원 증가</span>
                      )}
                      {reportData.changes.totalPayment.type === 'increase' && reportData.changes.totalPayment.value > 0 && ((reportData.changes.paymentPatients?.type === 'increase' && reportData.changes.paymentPatients.value > 0) || (reportData.changes.paymentRate.type === 'increase' && reportData.changes.paymentRate.value > 0)) && ', '}
                      {reportData.changes.paymentPatients?.type === 'increase' && reportData.changes.paymentPatients.value > 0 && (
                        <span> 결제환자수 {reportData.changes.paymentPatients.value}명 증가</span>
                      )}
                      {reportData.changes.paymentPatients?.type === 'increase' && reportData.changes.paymentPatients.value > 0 && reportData.changes.paymentRate.type === 'increase' && reportData.changes.paymentRate.value > 0 && ', '}
                      {reportData.changes.paymentRate.type === 'increase' && reportData.changes.paymentRate.value > 0 && (
                        <span> 결제전환율 {reportData.changes.paymentRate.value}%p 개선</span>
                      )}
                    </li>
                  )}
                  
                  {/* 긍정적 변화가 없는 경우 */}
                  {!(
                    (reportData.changes.totalInquiries.type === 'increase' && reportData.changes.totalInquiries.value >= 1) ||
                    (reportData.changes.appointmentPatients?.type === 'increase' && reportData.changes.appointmentPatients.value > 0) ||
                    (reportData.changes.appointmentRate.type === 'increase' && reportData.changes.appointmentRate.value > 0) ||
                    (reportData.changes.visitedPatients?.type === 'increase' && reportData.changes.visitedPatients.value > 0) ||
                    (reportData.changes.visitRate.type === 'increase' && reportData.changes.visitRate.value > 0) ||
                    (reportData.changes.paymentPatients?.type === 'increase' && reportData.changes.paymentPatients.value > 0) ||
                    (reportData.changes.paymentRate.type === 'increase' && reportData.changes.paymentRate.value > 0) ||
                    (reportData.changes.totalPayment.type === 'increase' && reportData.changes.totalPayment.value > 0)
                  ) && (
                    <li>• 전월 대비 증가한 지표가 없습니다.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>


        {/* 매니저 의견 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="flex items-center justify-between p-6 border-b bg-orange-50">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-orange-600" />
              매니저 의견
            </h2>
            {!isReadOnly && (
              <button 
                onClick={() => {
                  if (isEditingAnswers) {
                    handleSaveAnswers();
                  } else {
                    setIsEditingAnswers(true);
                  }
                }}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1 text-sm text-orange-600 hover:bg-orange-100 rounded transition-colors disabled:opacity-50"
              >
                <Edit3 className="w-4 h-4" />
                {isEditingAnswers ? '저장' : '편집'}
              </button>
            )}
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {/* 질문 1 + 피드백 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">
                  1. 전화 상담 후 미내원하신 환자들의 원인은 무엇이라 생각하나요?
                </h3>
                {isEditingAnswers ? (
                  <textarea
                    value={managerAnswers.question1}
                    onChange={(e) => setManagerAnswers(prev => ({ ...prev, question1: e.target.value }))}
                    className="w-full h-24 p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="미내원 원인에 대한 분석을 작성해 주세요..."
                  />
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg min-h-[80px] text-gray-600">
                    {managerAnswers.question1 ? (
                      <div className="whitespace-pre-line">{managerAnswers.question1}</div>
                    ) : (
                      <span className="text-gray-400 italic">
                        매니저 의견을 추가하려면 편집 버튼을 클릭하세요.
                      </span>
                    )}
                  </div>
                )}
                {/* 🔥 피드백 섹션 추가 */}
                <DirectorFeedbackSection
                  targetSection="managerAnswers.question1"
                  sectionTitle="미내원 환자 원인 분석"
                  feedbacks={directorFeedbacks}
                  reportId={reportData._id}
                  userRole={user?.role}
                  currentUserId={user?.id || user?._id}
                />
              </div>

              {/* 질문 2 + 피드백 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">
                  2. 내원 후 치료에 동의하지 않으신 환자분의 원인은 무엇이라 생각하나요?
                </h3>
                {isEditingAnswers ? (
                  <textarea
                    value={managerAnswers.question2}
                    onChange={(e) => setManagerAnswers(prev => ({ ...prev, question2: e.target.value }))}
                    className="w-full h-24 p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="치료 거부 원인에 대한 분석을 작성해 주세요..."
                  />
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg min-h-[80px] text-gray-600">
                    {managerAnswers.question2 ? (
                      <div className="whitespace-pre-line">{managerAnswers.question2}</div>
                    ) : (
                      <span className="text-gray-400 italic">
                        매니저 의견을 추가하려면 편집 버튼을 클릭하세요.
                      </span>
                    )}
                  </div>
                )}{/* 🔥 피드백 섹션 추가 */}
                <DirectorFeedbackSection
                  targetSection="managerAnswers.question2"
                  sectionTitle="치료 거부 환자 원인 분석"
                  feedbacks={directorFeedbacks}
                  reportId={reportData._id}
                  userRole={user?.role}
                  currentUserId={user?.id || user?._id}
                />
              </div>

              {/* 질문 3 + 피드백 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">
                  3. 환자들의 내원, 치료 동의를 이끌어 내기 위해 어떤 부분에서 개선이 필요할까요?
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  (진료실, 상담 차원에서 필요한 부분 모두 자유롭게 서술해주세요)
                </p>
                {isEditingAnswers ? (
                  <textarea
                    value={managerAnswers.question3}
                    onChange={(e) => setManagerAnswers(prev => ({ ...prev, question3: e.target.value }))}
                    className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="개선 방안에 대한 의견을 작성해 주세요..."
                  />
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg min-h-[100px] text-gray-600">
                    {managerAnswers.question3 ? (
                      <div className="whitespace-pre-line">{managerAnswers.question3}</div>
                    ) : (
                      <span className="text-gray-400 italic">
                        매니저 의견을 추가하려면 편집 버튼을 클릭하세요.
                      </span>
                    )}
                  </div>
                )}
                {/* 🔥 피드백 섹션 추가 */}
                <DirectorFeedbackSection
                  targetSection="managerAnswers.question3"
                  sectionTitle="개선 방안"
                  feedbacks={directorFeedbacks}
                  reportId={reportData._id}
                  userRole={user?.role}
                  currentUserId={user?.id || user?._id}
                />
              </div>

              {/* 질문 4 + 피드백 */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">
                  4. 기타 의견
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  (추가적으로 공유하고 싶은 의견이나 제안사항을 자유롭게 작성해주세요)
                </p>
                {isEditingAnswers ? (
                  <textarea
                    value={managerAnswers.question4}
                    onChange={(e) => setManagerAnswers(prev => ({ ...prev, question4: e.target.value }))}
                    className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="기타 의견을 작성해 주세요..."
                  />
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg min-h-[100px] text-gray-600">
                    {managerAnswers.question4 ? (
                      <div className="whitespace-pre-line">{managerAnswers.question4}</div>
                    ) : (
                      <span className="text-gray-400 italic">
                        매니저 의견을 추가하려면 편집 버튼을 클릭하세요.
                      </span>
                    )}
                  </div>
                )}
                {/* 🔥 피드백 섹션 추가 */}
                <DirectorFeedbackSection
                  targetSection="managerAnswers.question4"
                  sectionTitle="기타 의견"
                  feedbacks={directorFeedbacks}
                  reportId={reportData._id}
                  userRole={user?.role}
                  currentUserId={user?.id || user?._id}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 🔥 수정된 하단 액션 버튼 */}
        {!isReadOnly && (
          <div className="mt-8 flex justify-end gap-3 no-print">
            <button 
              onClick={handleTempSave}
              disabled={isSubmitting || isRefreshing}
              className="px-6 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              임시저장
            </button>
            <button 
              onClick={handleShowSubmitModal}
              disabled={isSubmitting || isRefreshing}
              className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              제출하기
            </button>
          </div>
        )}
      </div>

      {/* 🔥 환자 상담 내용 상세 모달 */}
      <PatientConsultationDetailModal
        patient={selectedPatientConsultation}
        onClose={handleClosePatientConsultationModal}
      />

      {/* 🔥 새로 추가: 환자 목록 모달 */}
      {showPatientListModal && (
        <SimplePatientListModal
          patients={patientListData.patients}
          title={patientListData.title}
          onClose={() => setShowPatientListModal(false)}
        />
      )}

      {/* 🔥 새로 추가: 제출 확인 모달 */}
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
                  {reportData.year}년 {reportData.month}월 보고서
                </p>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 text-yellow-600 mt-0.5">⚠️</div>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">제출 전 확인사항</p>
                  <ul className="space-y-1 text-xs">
                    <li>• 보고서를 제출하면 <strong>수정이 어려워집니다</strong></li>
                    <li>• 제출 후 변경이 필요한 경우 관리자에게 문의해야 합니다</li>
                    <li>• 모든 내용을 다시 한 번 확인해주세요</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 mb-6">
              <p className="mb-2 font-medium">제출 내용:</p>
              <div className="bg-gray-50 rounded p-3 space-y-1 text-xs">
                <div>✓ 미내원 환자 원인 분석: {managerAnswers.question1.trim() ? '작성완료' : '미작성'}</div>
                <div>✓ 치료 거부 환자 원인 분석: {managerAnswers.question2.trim() ? '작성완료' : '미작성'}</div>
                <div>✓ 개선 방안: {managerAnswers.question3.trim() ? '작성완료' : '미작성'}</div>
                <div>✓ 기타 의견: {managerAnswers.question4.trim() ? '작성완료' : '미작성'}</div>
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
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {isSubmitting ? '제출 중...' : '최종 제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 🔥 환자별 상담 내용 요약 섹션 컴포넌트 - 진행상황 로직 적용
const PatientConsultationSection: React.FC<{ 
  reportData: MonthlyReportData;
  onPatientClick: (patient: PatientConsultationSummary) => void;
}> = ({ reportData, onPatientClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const consultations = reportData.patientConsultations || [];
  
  // 🔥 진행상황 계산 함수 추가
  const calculatePatientProgress = (patient: PatientConsultationSummary) => {
    // 6. 종결 (최우선 - 내원여부 무관)
    if (patient.isCompleted === true || patient.status === '종결') {
      return {
        stage: '종결',
        color: 'text-gray-800',
        bgColor: 'bg-gray-100'
      };
    }

    // 내원완료 여부로 크게 분기
    if (patient.visitConfirmed === true) {
      // 내원완료 환자들
      switch (patient.postVisitStatus) {
        case '치료시작':
          // 5. 치료시작
          return {
            stage: '치료시작',
            color: 'text-green-800',
            bgColor: 'bg-green-100'
          };
        
        case '치료동의':
          // 4. 치료동의
          return {
            stage: '치료동의',
            color: 'text-orange-800',
            bgColor: 'bg-orange-100'
          };
        
        case '재콜백':
        case '':
        case null:
        case undefined:
          // 3. 내원완료 (재콜백 OR 상태미설정)
          return {
            stage: '내원완료',
            color: 'text-purple-800',
            bgColor: 'bg-purple-100'
          };
        
        default:
          // 기타 내원 후 상태들도 내원완료로 분류
          return {
            stage: '내원완료',
            color: 'text-purple-800',
            bgColor: 'bg-purple-100'
          };
      }
    } else {
      // 미내원 환자들
      if (patient.status === '예약확정') {
        // 2. 예약완료
        return {
          stage: '예약완료',
          color: 'text-orange-800',
          bgColor: 'bg-orange-100'
        };
      } else {
        // 1. 전화상담 (콜백필요, 잠재고객, 미처리콜백 등 모든 미내원 상태)
        return {
          stage: '전화상담',
          color: 'text-yellow-800',
          bgColor: 'bg-yellow-100'
        };
      }
    }
  };

  // 🔥 진행상황별 통계 계산
  const progressStats = consultations.reduce((stats, patient) => {
    const progress = calculatePatientProgress(patient);
    stats[progress.stage] = (stats[progress.stage] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);
  
  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-6 border-b bg-indigo-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            환자별 상담 내용 요약
            <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
              총 {consultations.length}명
            </span>
          </h2>
          
          {/* 🔥 펼침/접힘 토글 버튼 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 no-print transition-colors"
          >
            {isExpanded ? (
              <>
                <EyeOff className="w-4 h-4" />
                접기
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                상세보기 ({consultations.length}명)
              </>
            )}
          </button>
        </div>
        
        <ProgressGuideSection />

        {/* 🔥 접힌 상태일 때 진행상황별 요약 표시 */}
        {!isExpanded && consultations.length > 0 && (
          <div className="mt-4 p-4 bg-white rounded-lg border">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              {/* 6단계 진행상황별 표시 */}
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {progressStats['전화상담'] || 0}명
                </div>
                <div className="text-gray-600">전화상담</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {progressStats['예약완료'] || 0}명
                </div>
                <div className="text-gray-600">예약완료</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {progressStats['내원완료'] || 0}명
                </div>
                <div className="text-gray-600">내원완료</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {progressStats['치료동의'] || 0}명
                </div>
                <div className="text-gray-600">치료동의</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {progressStats['치료시작'] || 0}명
                </div>
                <div className="text-gray-600">치료시작</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {progressStats['종결'] || 0}명
                </div>
                <div className="text-gray-600">종결</div>
              </div>
            </div>
            {/* 🔥 견적금액 정보는 기존 유지 */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-center">
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">
                        {Math.round(
                          consultations
                            .filter(c => c.estimatedAmount && c.estimatedAmount > 0)
                            .reduce((sum, c) => sum + c.estimatedAmount, 0) / 10000
                        )}만원
                      </div>
                      <div className="text-gray-600">견적 합계</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!isExpanded && (
          <p className="text-sm text-gray-600 mt-3">
            이번 달 상담 내용이 기록된 환자들의 진행상황별 요약입니다. "상세보기" 버튼을 클릭하면 전체 목록을 확인할 수 있습니다.
          </p>
        )}
      </div>
      
      {/* 🔥 펼쳐진 상태일 때만 테이블 표시 */}
      {isExpanded && (
        <>
          {consultations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>이번 달 상담 내용이 기록된 환자가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    {/* 환자명: 좁게 - 이름은 보통 짧음 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      환자명
                    </th>
                    {/* 나이: 매우 좁게 - 숫자 2-3자리 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      나이
                    </th>
                    {/* 🔥 관심분야 열 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      관심분야
                    </th>
                    {/* 상담내용: 적당히 - 너무 크지 않게 조정 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-80">
                      상담내용 (전화+내원)
                    </th>
                    {/* 견적금액: 적당히 - 숫자가 길어질 수 있음 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      견적금액
                    </th>
                    {/* 🔥 "동의여부" → "진행상황"으로 변경 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      진행상황
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consultations.map((patient) => {
                    const progress = calculatePatientProgress(patient);
                    
                    return (
                      <tr key={patient._id} onClick={() => onPatientClick(patient)} className="hover:bg-indigo-50 cursor-pointer transition-colors">
                        {/* 환자명 */}
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900 break-words">
                            {patient.name}
                          </div>
                        </td>
                        
                        {/* 나이 */}
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-600 whitespace-nowrap">
                            {patient.age ? `${patient.age}세` : '-'}
                          </div>
                        </td>
                        
                        {/* 관심분야 */}
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            {patient.interestedServices && patient.interestedServices.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {patient.interestedServices.slice(0, 2).map((service, index) => (
                                  <span 
                                    key={index}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800 whitespace-nowrap"
                                  >
                                    {service}
                                  </span>
                                ))}
                                {patient.interestedServices.length > 2 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 whitespace-nowrap">
                                    +{patient.interestedServices.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">정보 없음</span>
                            )}
                          </div>
                        </td>
                        
                        {/* 상담내용 */}
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900">
                            {patient.consultationSummary && patient.consultationSummary !== '상담내용 없음' ? (
                              <>
                                {patient.consultationSummary.length > 120 ? (
                                  <details className="cursor-pointer">
                                    <summary className="font-medium text-orange-600 hover:text-orange-800">
                                      {patient.consultationSummary.substring(0, 120)}... (더보기)
                                    </summary>
                                    <div className="mt-2 p-3 bg-gray-50 rounded-lg whitespace-pre-line text-xs">
                                      {patient.fullConsultation}
                                    </div>
                                  </details>
                                ) : (
                                  <div className="whitespace-pre-line text-xs leading-relaxed">
                                    {patient.consultationSummary}
                                  </div>
                                )}
                                
                                {/* 상담 단계 표시 */}
                                <div className="flex items-center gap-1 mt-2">
                                  {patient.hasPhoneConsultation && (
                                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded whitespace-nowrap">
                                      📞 전화
                                    </span>
                                  )}
                                  {patient.hasVisitConsultation && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded whitespace-nowrap">
                                      🏥 내원
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-400 italic text-xs">상담내용 없음</span>
                            )}
                          </div>
                        </td>
                        
                        {/* 견적금액 */}
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.estimatedAmount && patient.estimatedAmount > 0 ? (
                              <div>
                                <div className="whitespace-nowrap">
                                  {patient.estimatedAmount.toLocaleString()}원
                                </div>
                                {/* 견적 출처 표시 */}
                                {patient.visitAmount && patient.visitAmount > 0 ? (
                                  <div className="text-xs text-green-600 whitespace-nowrap">내원견적</div>
                                ) : patient.phoneAmount && patient.phoneAmount > 0 ? (
                                  <div className="text-xs text-orange-600 whitespace-nowrap">전화견적</div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic whitespace-nowrap">데이터 없음</span>
                            )}
                          </div>
                        </td>
                        
                        {/* 🔥 진행상황 (기존 동의여부 대체) */}
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${progress.color} ${progress.bgColor}`}>
                            {progress.stage}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// 🔥 환자 상담 내용 상세 모달 컴포넌트
const PatientConsultationDetailModal: React.FC<{
  patient: PatientConsultationSummary | null;
  onClose: () => void;
}> = ({ patient, onClose }) => {
  if (!patient) return null;

  // 🔥 디버깅: 실제 데이터 확인
  console.log('모달에서 받은 환자 데이터:', patient);
  console.log('상담타입:', patient.consultationType);

  // 🔥 환자의 진행상황 계산 (테이블과 동일한 로직)
  const calculatePatientProgress = (patient: PatientConsultationSummary) => {
    // 6. 종결 (최우선 - 내원여부 무관)
    if (patient.isCompleted === true || patient.status === '종결') {
      return {
        stage: '종결',
        color: 'text-gray-800',
        bgColor: 'bg-gray-100'
      };
    }

    // 내원완료 여부로 크게 분기
    if (patient.visitConfirmed === true) {
      // 내원완료 환자들
      switch (patient.postVisitStatus) {
        case '치료시작':
          // 5. 치료시작
          return {
            stage: '치료시작',
            color: 'text-green-800',
            bgColor: 'bg-green-100'
          };
        
        case '치료동의':
          // 4. 치료동의
          return {
            stage: '치료동의',
            color: 'text-orange-800',
            bgColor: 'bg-orange-100'
          };
        
        case '재콜백':
        case '':
        case null:
        case undefined:
          // 3. 내원완료 (재콜백 OR 상태미설정)
          return {
            stage: '내원완료',
            color: 'text-purple-800',
            bgColor: 'bg-purple-100'
          };
        
        default:
          // 기타 내원 후 상태들도 내원완료로 분류
          return {
            stage: '내원완료',
            color: 'text-purple-800',
            bgColor: 'bg-purple-100'
          };
      }
    } else {
      // 미내원 환자들
      if (patient.status === '예약확정') {
        // 2. 예약완료
        return {
          stage: '예약완료',
          color: 'text-orange-800',
          bgColor: 'bg-orange-100'
        };
      } else {
        // 1. 전화상담 (콜백필요, 잠재고객, 미처리콜백 등 모든 미내원 상태)
        return {
          stage: '전화상담',
          color: 'text-yellow-800',
          bgColor: 'bg-yellow-100'
        };
      }
    }
  };

  // 🔥 상담 타입 배지 컴포넌트 (기존 디자인과 통일)
  const ConsultationTypeBadge = ({ type }: { type?: string }) => {
    if (type === 'inbound') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <FiPhone className="w-3 h-3 mr-1" />
          인바운드
        </span>
      );
    }

    if (type === 'returning') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <HiOutlineRefresh className="w-3 h-3 mr-1" />
          구신환
        </span>
      );
    }

    if (type === 'outbound') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <FiPhoneCall className="w-3 h-3 mr-1" />
          아웃바운드
        </span>
      );
    }

    // 기본값 (미분류)
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        미분류
      </span>
    );
  };

  const progress = calculatePatientProgress(patient);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">상담 내용 상세</h3>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-600">
                {patient.name} {patient.age ? `(${patient.age}세)` : '(나이 정보 없음)'}
              </p>
              {/* 🔥 상담타입 배지 추가 */}
              <ConsultationTypeBadge type={patient.consultationType} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* 관심분야 정보 */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="font-medium text-orange-900 mb-2">관심분야</h4>
            <div className="flex flex-wrap gap-2">
              {patient.interestedServices && patient.interestedServices.length > 0 ? (
                patient.interestedServices.map((service, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800"
                  >
                    {service}
                  </span>
                ))
              ) : (
                <span className="text-orange-600 italic">관심분야 정보가 없습니다.</span>
              )}
            </div>
          </div>

          {/* 🔥 견적 정보 - "동의여부" → "진행상황"으로 변경 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">견적 정보</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">견적 금액:</span>
                <span className="ml-2 font-medium">
                  {patient.estimatedAmount && patient.estimatedAmount > 0 ? 
                    `${patient.estimatedAmount.toLocaleString()}원` : 
                    <span className="text-gray-400 italic">데이터 없음</span>
                  }
                </span>
              </div>
              <div>
                {/* 🔥 "동의 여부" → "진행상황"으로 변경 */}
                <span className="text-gray-600">진행상황:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${progress.color} ${progress.bgColor}`}>
                  {progress.stage}
                </span>
              </div>
            </div>
            

          </div>
          
          {/* 불편한 부분 */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">불편한 부분</h4>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-line">
                {patient.fullDiscomfort || '기록된 내용이 없습니다.'}
              </p>
            </div>
          </div>
          
          {/* 상담 메모 */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">상담 메모</h4>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-line">
                    {patient.fullConsultation ? 
                      patient.fullConsultation
                        .replace(/\[불편부위\][\s\S]*?(?=\n\[|$)/g, '') // [불편부위] 섹션 제거
                        .replace(/^\s*\n+/g, '') // 앞쪽 빈 줄 제거
                        .replace(/(\📞 전화상담:.*?)\n\s*\n(\[상담메모\])/g, '$1\n$2') // 📞 전화상담: 다음의 빈 줄만 제거
                        .trim() || '기록된 내용이 없습니다.'
                      : '기록된 내용이 없습니다.'
                    }
                  </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReport;