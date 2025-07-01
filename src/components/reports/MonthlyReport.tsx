// src/components/reports/MonthlyReport.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, Phone, Users, CreditCard, MapPin, TrendingUp, Edit3, Send, Download, MessageSquare, PhoneCall, RefreshCw, AlertTriangle, TrendingDown, DollarSign, Eye, EyeOff, X } from 'lucide-react';
import { MonthlyReportData, PatientConsultationSummary } from '@/types/report';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { saveReport, submitReport, updateCurrentReport, refreshReportData } from '@/store/slices/reportsSlice';

interface MonthlyReportProps {
  reportData: MonthlyReportData;
}

// 🔥 새로 추가: 손실 분석 섹션 컴포넌트
const LossAnalysisSection: React.FC<{ reportData: MonthlyReportData }> = ({ reportData }) => {
  const [showDetails, setShowDetails] = useState(false);
  const lossAnalysis = reportData.lossAnalysis;
  
  if (!lossAnalysis) return null;

  // 손실률에 따른 스타일링
  const getLossRateStyle = (rate: number): string => {
    if (rate <= 20) return 'text-green-600 bg-green-50 border-green-200';
    if (rate <= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (rate <= 60) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
    if (amount >= 10000) return `${(amount / 10000).toFixed(0)}만원`;
    return `${amount.toLocaleString()}원`;
  };

  const totalLoss = lossAnalysis.totalLoss;
  const consultationLoss = lossAnalysis.consultationLoss;
  const visitLoss = lossAnalysis.visitLoss;

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-6 border-b bg-red-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            미예약/미내원 환자 손실 분석

          </h2>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 no-print"
          >
            {showDetails ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showDetails ? '간단히 보기' : '상세히 보기'}
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {/* 📊 핵심 지표 카드 */}
        <div className="mb-6">
          <div className={`border rounded-lg p-6 ${getLossRateStyle(totalLoss.lossRate)}`}>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <TrendingDown className="w-8 h-8" />
                <h3 className="text-2xl font-bold">
                  총 {totalLoss.totalPatients}명의 환자를 놓쳤습니다
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold mb-1">
                    {formatAmount(totalLoss.totalAmount)}
                  </div>
                  <div className="text-sm font-medium">예상 손실 매출</div>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-1">
                    {totalLoss.lossRate}%
                  </div>
                  <div className="text-sm font-medium">전체 문의 대비 손실률</div>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-1">
                    {totalLoss.totalAmount > 0 ? (totalLoss.totalAmount / totalLoss.totalPatients / 10000).toFixed(0) : 0}만원
                  </div>
                  <div className="text-sm font-medium">환자당 평균 손실액</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 💡 가정 시나리오 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <DollarSign className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                💰 만약 이 환자들이 모두 치료를 받았다면...
              </h3>
              <div className="space-y-2 text-blue-800">
                <p className="text-base">
                  <span className="font-bold text-xl">{formatAmount(totalLoss.totalAmount)}</span>의 
                  <span className="font-semibold"> 추가 매출</span>이 발생했을 것입니다.
                </p>
                <p className="text-sm">
                  • 이는 현재 월 총 매출 <span className="font-semibold">{formatAmount(reportData.totalPayment)}</span>의 
                  <span className="font-bold"> {reportData.totalPayment > 0 ? ((totalLoss.totalAmount / reportData.totalPayment) * 100).toFixed(1) : 0}%</span>에 해당합니다.
                </p>
                <p className="text-sm">
                  • 전체 잠재 매출: <span className="font-bold">{formatAmount(reportData.totalPayment + totalLoss.totalAmount)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 📋 상세 분석 (토글 가능) */}
        {showDetails && (
          <div className="space-y-6">
            {/* 🔥 수정된 상담 관리 손실군 */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" />
                상담 관리 손실군 ({consultationLoss.totalCount}명)
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  예약확정 외 환자
                </span>
              </h4>
              
              {/* 🔥 4개 상태 + 총 손실금액 = 5개 컬럼으로 확장 */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-900">{consultationLoss.terminated}명</div>
                  <div className="text-orange-700 text-xs">종결</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-900">{consultationLoss.missed}명</div>
                  <div className="text-orange-700 text-xs">부재중</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-900">{consultationLoss.potential}명</div>
                  <div className="text-orange-700 text-xs">잠재고객</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-900">{consultationLoss.callback}명</div>
                  <div className="text-orange-700 text-xs">콜백필요</div>
                </div>
                <div className="text-center bg-orange-100 rounded p-2">
                  <div className="text-xl font-bold text-orange-900">{formatAmount(consultationLoss.estimatedAmount)}</div>
                  <div className="text-orange-700 text-xs font-medium">총 손실금액</div>
                </div>
              </div>
              
              <p className="text-xs text-orange-600 mt-2">
                💡 예약확정에 도달하지 못한 모든 환자들입니다. 
              </p>
            </div>

            {/* 내원 관리 손실군은 기존과 동일... */}

            {/* 내원 관리 손실군 */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" />
                내원 관리 손실군 ({visitLoss.totalCount}명)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-900">{visitLoss.terminated}명</div>
                  <div className="text-purple-700">내원 후 종결</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-900">{visitLoss.onHold}명</div>
                  <div className="text-purple-700">치료 보류</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-900">{visitLoss.callbackNeeded}명</div>
                  <div className="text-purple-700">재콜백 필요</div>
                </div>
                <div className="text-center md:col-span-2">
                  <div className="text-xl font-bold text-purple-900">{formatAmount(visitLoss.estimatedAmount)}</div>
                  <div className="text-purple-700">예상 손실 금액</div>
                </div>
              </div>
              <p className="text-xs text-purple-600 mt-2">
                💡 이들은 실제 내원까지 했지만 치료로 이어지지 않은 환자들입니다.
              </p>
            </div>

            {/* 개선 포인트 제안 */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">🎯 개선 포인트 제안</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                  <span><strong>상담 프로세스 개선:</strong> 종결/부재중 환자의 주요 이탈 포인트 분석 필요</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                  <span><strong>내원 후 상담 강화:</strong> 치료 계획 설명 및 환자 니즈 파악 개선</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                  <span><strong>후속 관리 체계화:</strong> 재콜백 환자에 대한 체계적인 팔로업 프로세스 구축</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MonthlyReport: React.FC<MonthlyReportProps> = ({ reportData }) => {
  // 🔥 환자 상담 내용 상세 모달 상태 추가
  const [selectedPatientConsultation, setSelectedPatientConsultation] = useState<PatientConsultationSummary | null>(null);

  // 🔥 환자 클릭 핸들러
  const handlePatientConsultationClick = (patient: PatientConsultationSummary) => {
    setSelectedPatientConsultation(patient);
  };

  // 🔥 환자 상담 상세 모달 닫기
  const handleClosePatientConsultationModal = () => {
    setSelectedPatientConsultation(null);
  };
  const dispatch = useAppDispatch();
  const { isSubmitting, isRefreshing } = useAppSelector((state) => state.reports);
  
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
  
  // 🔥 새로 추가: 제출 확인 모달 상태
  const [showSubmitModal, setShowSubmitModal] = useState(false);

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

  // 데이터 새로고침 핸들러
  const handleRefreshData = async () => {
    if (!reportData._id) return;
    
    if (!confirm('보고서 데이터를 최신 정보로 새로고침하시겠습니까?\n\n작성하신 매니저 의견은 그대로 유지됩니다.')) {
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

  // 🔥 제출 확인 모달 열기
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

  const isReadOnly = reportData.status === 'submitted' || reportData.status === 'approved';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* PDF 전용 스타일 추가 */}
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
                  {reportData.year}년 {reportData.month}월
                </span>
                <span>생성일: {reportData.generatedDate}</span>
                <span>최근 업데이트: {new Date(reportData.updatedAt).toLocaleDateString()}</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  reportData.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  reportData.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {reportData.status === 'draft' ? '임시저장' :
                   reportData.status === 'submitted' ? '최종제출' : '승인완료'}
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

        {/* 상담 실적 요약 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6 border-b bg-blue-50">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
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
                  <PhoneCall className="w-4 h-4 text-blue-600" />
                  아웃바운드 {reportData.outboundCalls}건
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-800">내원 환자수</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-2xl font-bold text-blue-900">{reportData.visitedPatients}명</div>
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
                <div className="text-sm text-blue-700">
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
                        <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <span className="text-sm">{region.region}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
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

        {/* 🔥 새로 추가: 환자별 상담 내용 요약 섹션 */}
        <PatientConsultationSection 
          reportData={reportData}
          onPatientClick={handlePatientConsultationClick}
        />

        {/* 🔥 새로 추가: 손실 분석 섹션 */}
        <LossAnalysisSection reportData={reportData} />

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
              {/* 질문 1 */}
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
              </div>

              {/* 질문 2 */}
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
                )}
              </div>

              {/* 질문 3 */}
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
              </div>

              {/* 질문 4 - 새로 추가 */}
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
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

// 🔥 환자별 상담 내용 요약 섹션 컴포넌트
const PatientConsultationSection: React.FC<{ 
  reportData: MonthlyReportData;
  onPatientClick: (patient: PatientConsultationSummary) => void;
}> = ({ reportData, onPatientClick }) => {
  const [isExpanded, setIsExpanded] = useState(false); // 🔥 접힘/펼침 상태
  const consultations = reportData.patientConsultations || [];
  
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
        
        {/* 🔥 접힌 상태일 때 간단한 요약 표시 */}
        {!isExpanded && consultations.length > 0 && (
          <div className="mt-4 p-4 bg-white rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {consultations.length}명
                </div>
                <div className="text-gray-600">상담 기록</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {consultations.filter(c => c.estimateAgreed).length}명
                </div>
                <div className="text-gray-600">견적 동의</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round(consultations.reduce((sum, c) => sum + c.estimatedAmount, 0) / 10000)}만원
                </div>
                <div className="text-gray-600">견적 합계</div>
              </div>
            </div>
          </div>
        )}
        
        {!isExpanded && (
          <p className="text-sm text-gray-600 mt-3">
            이번 달 상담 내용이 기록된 환자들의 요약입니다. "상세보기" 버튼을 클릭하면 전체 목록을 확인할 수 있습니다.
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
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      환자명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      나이
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      불편한 부분
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상담 메모 요약
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      견적금액
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      동의여부
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consultations.map((patient, index) => (
                    <tr 
                      key={patient._id}
                      onClick={() => onPatientClick(patient)}
                      className="hover:bg-indigo-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {patient.name}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {patient.age ? `${patient.age}세` : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 max-w-xs">
                          {patient.discomfort || '-'}
                          {patient.fullDiscomfort && patient.fullDiscomfort.length > 50 && (
                            <span className="text-indigo-600 ml-1">더보기</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 max-w-sm">
                          {patient.consultationSummary || '-'}
                          {patient.fullConsultation && patient.fullConsultation.length > 80 && (
                            <span className="text-indigo-600 ml-1">더보기</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {patient.estimatedAmount.toLocaleString()}원
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          patient.estimateAgreed 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {patient.estimateAgreed ? '동의' : '거부'}
                        </span>
                      </td>
                    </tr>
                  ))}
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">상담 내용 상세</h3>
            <p className="text-sm text-gray-600">
              {patient.name} {patient.age ? `(${patient.age}세)` : '(나이 정보 없음)'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* 견적 정보 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">견적 정보</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">견적 금액:</span>
                <span className="ml-2 font-medium">{patient.estimatedAmount.toLocaleString()}원</span>
              </div>
              <div>
                <span className="text-gray-600">동의 여부:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  patient.estimateAgreed 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {patient.estimateAgreed ? '동의' : '거부'}
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
                {patient.fullConsultation || '기록된 내용이 없습니다.'}
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