'use client';

import React, { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/reduxHooks';
import { 
  Calendar, 
  Users, 
  RefreshCw,
  Eye,
  AlertCircle,
  FileText,
  DollarSign,
  Phone,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react';
import { Patient } from '@/types/patient';
import PatientListModal from '../management/PatientListModal';

// 🔥 일별 업무 현황을 위한 인터페이스 수정
interface DailyWorkSummary {
  selectedDate: string;
  callbackSummary: {
    overdueCallbacks: {
      total: number;
      processed: number;
      processingRate: number;
    };
    callbackUnregistered: {
      total: number;
      processed: number;
      processingRate: number;
    };
    absent: {
      total: number;
      processed: number;
      processingRate: number;
    };
    todayScheduled: {
      total: number;
      processed: number;
      processingRate: number;
    };
  };
  estimateSummary: {
    totalConsultationEstimate: number;        // 오늘 총 상담 견적
    visitConsultationEstimate: number;        // 내원 상담 환자 견적
    phoneConsultationEstimate: number;        // 유선 상담 환자 견적
    treatmentStartedEstimate: number;         // 치료 시작한 견적
  };
}

// 일별 환자 데이터 타입 (내원관리용)
interface DailyPatientData {
  _id: string;
  name: string;
  treatmentContent: string;
  estimatedAmount: number;
  postVisitStatus: string;
  consultationContent: string;
  visitDate: string;
}

// 일별 상담관리 환자 데이터 타입
interface DailyConsultationData {
  _id: string;
  name: string;
  treatmentContent: string;
  estimatedAmount: number;
  status: string;
  callbackCount: number;
  consultationContent: string;
  callInDate: string;
}

const DailyReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyPatients, setDailyPatients] = useState<DailyPatientData[]>([]);
  const [dailyConsultations, setDailyConsultations] = useState<DailyConsultationData[]>([]);
  const [dailyWorkSummary, setDailyWorkSummary] = useState<DailyWorkSummary | null>(null); // 🔥 추가
  const [isLoading, setIsLoading] = useState(false);
  // 🔥 모달 상태 추가 - PatientFilterType 사용
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    filterType: 'overdueCallbacks' | 'callbackUnregistered' | 'absent' | 'todayScheduled' | null;
    title: string;
  }>({
    isOpen: false,
    filterType: null,
    title: ''
  });

  // Redux에서 환자 데이터 가져오기
  const { patients } = useAppSelector((state) => state.patients);

  // 상태별 색상 매핑 (내원관리용)
  const getStatusColor = (status: string) => {
    switch (status) {
      case '치료시작':
        return 'bg-green-100 text-green-800';
      case '치료동의':
        return 'bg-blue-100 text-blue-800';
      case '재콜백필요':
        return 'bg-yellow-100 text-yellow-800';
      case '종결':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-red-100 text-red-800'; // 상태미설정
    }
  };

  // 상담관리 환자 상태 매핑
  const mapConsultationStatus = (patient: Patient): string => {
    const today = new Date().toISOString().split('T')[0];
    
    // 오늘 예약인지 확인
    if (patient.reservationDate === today) {
      return '오늘예약';
    }
    
    // 기존 상태를 6가지로 매핑
    switch (patient.status) {
      case '예약확정':
        return '내원확정';
      case '콜백필요':
        return '콜백필요';
      case '부재중':
        return '부재중';
      default:
        // 예약 후 미내원 체크
        if (patient.isPostReservationPatient || patient.hasBeenPostReservationPatient) {
          return '예약후미내원';
        }
        // 미처리 콜백이 있는지 체크
        const hasPendingCallback = patient.callbackHistory?.some(
          callback => callback.status === '예정' || callback.status === '부재중'
        );
        if (hasPendingCallback) {
          return '미처리콜백';
        }
        return '콜백필요'; // 기본값
    }
  };

  // 상담관리 환자 상태별 색상
  const getConsultationStatusColor = (status: string) => {
    switch (status) {
      case '내원확정':
        return 'bg-green-100 text-green-800';
      case '오늘예약':
        return 'bg-purple-100 text-purple-800';
      case '콜백필요':
        return 'bg-yellow-100 text-yellow-800';
      case '부재중':
        return 'bg-gray-100 text-gray-800';
      case '예약후미내원':
        return 'bg-orange-100 text-orange-800';
      case '미처리콜백':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 🔥 모달 핸들러 수정 - 타입 안전성 확보
  const handleOpenModal = (filterType: 'overdueCallbacks' | 'callbackUnregistered' | 'absent' | 'todayScheduled', title: string) => {
    setModalState({
      isOpen: true,
      filterType,
      title
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      filterType: null,
      title: ''
    });
  };

  // 🔥 일별 업무 현황 데이터 가져오기 함수
  const fetchDailyWorkSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/statistics/daily?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.warn('일별 업무 현황 조회 실패');
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        setDailyWorkSummary(result.data);
        console.log('일별 업무 현황 로드 완료:', result.data);
      }
    } catch (error) {
      console.error('일별 업무 현황 조회 오류:', error);
    }
  };

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억원`;
    }
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(0)}만원`;
    }
    return `${amount.toLocaleString()}원`;
  };

  // 내원관리 환자 상담내용 조합 함수 - 수정된 버전
  const getCombinedConsultationContent = (patient: Patient): string => {
    const contents: string[] = [];
    
    // 🔥 디버깅 로그 추가
    console.log(`=== ${patient.name} 내원관리 상담내용 분석 ===`);
    console.log('postVisitConsultation 데이터:', patient.postVisitConsultation);
    console.log('callbackHistory 길이:', patient.callbackHistory?.length || 0);
    
    // 최초 상담내용 (내원 후 첫 상담)
    if (patient.postVisitConsultation?.firstVisitConsultationContent) {
      contents.push(`[최초 상담] ${patient.postVisitConsultation.firstVisitConsultationContent}`);
    }

    // 콜백 히스토리에서 내원관리 콜백들 추출 - 수정된 로직
    if (patient.callbackHistory) {
      console.log('내원관리 콜백 히스토리 상세:', patient.callbackHistory);
      
      const visitCallbacks = patient.callbackHistory
        .filter(callback => {
          console.log(`내원콜백 ${callback.type}: isVisitManagementCallback=${callback.isVisitManagementCallback}, resultNotes="${callback.resultNotes}", notes="${callback.notes}"`);
          
          // 내원관리 콜백이면서 유효한 상담내용이 있는지 확인
          if (!callback.isVisitManagementCallback) return false;
          
          // 🔥 수정된 로직: resultNotes가 유효하지 않으면 notes 사용
          const hasValidResultNotes = callback.resultNotes && 
                                    callback.resultNotes !== 'undefined' && 
                                    callback.resultNotes.trim() !== '';
          const hasValidNotes = callback.notes && 
                              callback.notes !== 'undefined' && 
                              callback.notes.trim() !== '';
          
          return hasValidResultNotes || hasValidNotes;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      console.log('유효한 내원관리 콜백 수:', visitCallbacks.length);
      
      visitCallbacks.forEach((callback) => {
        // 🔥 수정된 로직: resultNotes 우선, 없으면 notes 사용
        let consultationText = '';
        
        if (callback.resultNotes && 
            callback.resultNotes !== 'undefined' && 
            callback.resultNotes.trim() !== '') {
          consultationText = callback.resultNotes;
        } else if (callback.notes && 
                  callback.notes !== 'undefined' && 
                  callback.notes.trim() !== '') {
          consultationText = callback.notes;
        }
        
        if (consultationText) {
          // 콜백 타입과 날짜 정보 포함
          const callbackDate = new Date(callback.date).toLocaleDateString();
          contents.push(`[${callback.type} - ${callbackDate}]\n${consultationText}`);
        }
      });
    }

    const finalContent = contents.length > 0 ? contents.join('\n\n') : '-';
    console.log('내원관리 최종 상담내용:', finalContent);
    console.log('========================');
    
    return finalContent;
  };

  // 상담관리 환자의 상담내용 조합 함수 - 수정된 버전
  const getConsultationContent = (patient: Patient): string => {
    const contents: string[] = [];
    
    // 🔥 디버깅 로그 추가
    console.log(`=== ${patient.name} 상담내용 분석 ===`);
    console.log('consultation 데이터:', patient.consultation);
    console.log('callbackHistory 길이:', patient.callbackHistory?.length || 0);
    
    // 최초 상담 - 불편한 부분과 상담메모 조합
    const consultation = patient.consultation;
    if (consultation) {
      let initialContent = '';
      if (consultation.treatmentPlan) {
        initialContent += `[불편한 부분] ${consultation.treatmentPlan}`;
      }
      if (consultation.consultationNotes) {
        if (initialContent) initialContent += '\n';
        initialContent += `[상담메모] ${consultation.consultationNotes}`;
      }
      if (initialContent) {
        contents.push(`[최초 상담]\n${initialContent}`);
      }
    }

    // 콜백 히스토리의 상담내용들 (상담관리용 - 모든 콜백 포함)
    if (patient.callbackHistory && patient.callbackHistory.length > 0) {
      console.log('콜백 히스토리 상세:', patient.callbackHistory);
      
      const consultationCallbacks = patient.callbackHistory
        .filter(callback => {
          console.log(`콜백 ${callback.type}: resultNotes="${callback.resultNotes}", notes="${callback.notes}", content="${callback.content}"`);
          
          // 🔥 수정된 로직: resultNotes가 유효하지 않으면 notes 사용
          const hasValidResultNotes = callback.resultNotes && 
                                    callback.resultNotes !== 'undefined' && 
                                    callback.resultNotes.trim() !== '';
          const hasValidNotes = callback.notes && 
                              callback.notes !== 'undefined' && 
                              callback.notes.trim() !== '';
          
          return hasValidResultNotes || hasValidNotes;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      console.log('유효한 상담내용이 있는 콜백 수:', consultationCallbacks.length);
      
      consultationCallbacks.forEach((callback) => {
        // 🔥 수정된 로직: resultNotes 우선, 없으면 notes 사용
        let consultationText = '';
        
        if (callback.resultNotes && 
            callback.resultNotes !== 'undefined' && 
            callback.resultNotes.trim() !== '') {
          consultationText = callback.resultNotes;
        } else if (callback.notes && 
                  callback.notes !== 'undefined' && 
                  callback.notes.trim() !== '') {
          consultationText = callback.notes;
        }
        
        if (consultationText) {
          // 콜백 타입과 날짜 정보 포함
          const callbackDate = new Date(callback.date).toLocaleDateString();
          contents.push(`[${callback.type} 콜백 - ${callbackDate}]\n${consultationText}`);
        }
      });
    }

    const finalContent = contents.length > 0 ? contents.join('\n\n') : '-';
    console.log('최종 상담내용:', finalContent);
    console.log('========================');
    
    return finalContent;
  };

  // 선택된 날짜의 내원관리 환자 데이터 필터링
  const filterPatientsByDate = () => {
    if (!patients || patients.length === 0) {
      setDailyPatients([]);
      return;
    }

    const filtered = patients
      .filter(patient => {
        // visitDate가 선택된 날짜와 일치하는 환자만
        return patient.visitDate === selectedDate && patient.visitConfirmed;
      })
      .map(patient => ({
        _id: patient._id,
        name: patient.name,
        treatmentContent: patient.postVisitConsultation?.treatmentContent || '-',
        estimatedAmount: patient.postVisitConsultation?.estimateInfo?.discountPrice || 0,
        postVisitStatus: patient.postVisitStatus || '상태미설정',
        consultationContent: getCombinedConsultationContent(patient),
        visitDate: patient.visitDate || ''
      }));

    setDailyPatients(filtered);
  };

  // 선택된 날짜의 상담관리 환자 데이터 필터링
  const filterConsultationsByDate = () => {
    if (!patients || patients.length === 0) {
      setDailyConsultations([]);
      return;
    }

    const filtered = patients
      .filter(patient => {
        // callInDate가 선택된 날짜와 일치하는 모든 환자 포함
        return patient.callInDate === selectedDate;
      })
      .map(patient => ({
        _id: patient._id,
        name: patient.name,
        treatmentContent: patient.consultation?.treatmentPlan || '-',
        estimatedAmount: patient.consultation?.estimatedAmount || 0,
        status: mapConsultationStatus(patient),
        callbackCount: patient.callbackHistory?.length || 0,
        consultationContent: getConsultationContent(patient),
        callInDate: patient.callInDate || ''
      }));

    setDailyConsultations(filtered);
  };

  // 날짜 변경 시 또는 환자 데이터 변경 시 필터링
  useEffect(() => {
    setIsLoading(true);
    // 실제 환경에서는 API 호출 대신 기존 데이터 필터링
    setTimeout(() => {
      filterPatientsByDate();
      filterConsultationsByDate();
      fetchDailyWorkSummary(); // 🔥 일별 업무 현황도 함께 조회
      setIsLoading(false);
    }, 300);
  }, [selectedDate, patients]);

  // 통계 계산
  const stats = {
    total: dailyPatients.length,
    treatmentStarted: dailyPatients.filter(p => p.postVisitStatus === '치료시작').length,
    treatmentConsented: dailyPatients.filter(p => p.postVisitStatus === '치료동의').length,
    callbackNeeded: dailyPatients.filter(p => p.postVisitStatus === '재콜백필요').length,
    terminated: dailyPatients.filter(p => p.postVisitStatus === '종결').length,
    unset: dailyPatients.filter(p => p.postVisitStatus === '상태미설정').length,
    totalAmount: dailyPatients.reduce((sum, p) => sum + p.estimatedAmount, 0)
  };

  // 상담관리 통계 계산
  const consultationStats = {
    total: dailyConsultations.length,
    unprocessedCallback: dailyConsultations.filter(p => p.status === '미처리콜백').length,
    postReservationAbsent: dailyConsultations.filter(p => p.status === '예약후미내원').length,
    visitConfirmed: dailyConsultations.filter(p => p.status === '내원확정').length,
    callbackNeeded: dailyConsultations.filter(p => p.status === '콜백필요').length,
    todayReservation: dailyConsultations.filter(p => p.status === '오늘예약').length,
    absent: dailyConsultations.filter(p => p.status === '부재중').length,
    totalAmount: dailyConsultations.reduce((sum, p) => sum + p.estimatedAmount, 0),
    totalCallbacks: dailyConsultations.reduce((sum, p) => sum + p.callbackCount, 0)
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">일별 보고서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 날짜 선택 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">일별마감보고</h2>
          <p className="text-sm text-gray-600 mt-1">선택한 날짜에 내원한 환자들의 상담 현황입니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              filterPatientsByDate();
              filterConsultationsByDate();
              fetchDailyWorkSummary(); // 🔥 업무 현황도 함께 새로고침
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* 🔥 일별 업무 현황 섹션 추가 */}
      {dailyWorkSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 오늘 처리한 업무 - 새로운 디자인 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">오늘 처리한 업무</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 미처리 콜백 */}
              <div 
                className="bg-white/70 rounded-lg p-4 border border-red-200 cursor-pointer hover:bg-red-50 transition-colors"
                onClick={() => handleOpenModal('overdueCallbacks', '🚨 미처리 콜백 - 즉시 대응 필요')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-3 h-3 text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-red-700">🚨 미처리 콜백</span>
                  </div>
                  <span className="text-xs text-blue-600">클릭하여 보기</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-red-900">
                    {dailyWorkSummary.callbackSummary.overdueCallbacks.total}건
                  </span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    dailyWorkSummary.callbackSummary.overdueCallbacks.processingRate === 100 
                      ? 'bg-green-100 text-green-800' 
                      : dailyWorkSummary.callbackSummary.overdueCallbacks.processingRate >= 80 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    처리율 {dailyWorkSummary.callbackSummary.overdueCallbacks.processingRate}%
                  </span>
                </div>
                
                <div className="text-xs text-red-600 mt-1">
                  {dailyWorkSummary.callbackSummary.overdueCallbacks.processed}건 처리완료
                </div>
              </div>

              {/* 콜백 미등록 */}
              <div 
                className="bg-white/70 rounded-lg p-4 border border-orange-200 cursor-pointer hover:bg-orange-50 transition-colors"
                onClick={() => handleOpenModal('callbackUnregistered', '📋 콜백 미등록 - 잠재고객 상담 등록 필요')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                      <FileText className="w-3 h-3 text-orange-600" />
                    </div>
                    <span className="text-sm font-medium text-orange-700">📋 콜백 미등록</span>
                  </div>
                  <span className="text-xs text-blue-600">클릭하여 보기</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-orange-900">
                    {dailyWorkSummary.callbackSummary.callbackUnregistered.total}명
                  </span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    dailyWorkSummary.callbackSummary.callbackUnregistered.processingRate === 100 
                      ? 'bg-green-100 text-green-800' 
                      : dailyWorkSummary.callbackSummary.callbackUnregistered.processingRate >= 80 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    처리율 {dailyWorkSummary.callbackSummary.callbackUnregistered.processingRate}%
                  </span>
                </div>
                
                <div className="text-xs text-orange-600 mt-1">
                  {dailyWorkSummary.callbackSummary.callbackUnregistered.processed}명 처리완료
                </div>
              </div>

              {/* 부재중 */}
              <div 
                className="bg-white/70 rounded-lg p-4 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleOpenModal('absent', '부재중 환자')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <Phone className="w-3 h-3 text-gray-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">부재중</span>
                  </div>
                  <span className="text-xs text-blue-600">클릭하여 보기</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    {dailyWorkSummary.callbackSummary.absent.total}명
                  </span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    dailyWorkSummary.callbackSummary.absent.processingRate === 100 
                      ? 'bg-green-100 text-green-800' 
                      : dailyWorkSummary.callbackSummary.absent.processingRate >= 80 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    처리율 {dailyWorkSummary.callbackSummary.absent.processingRate}%
                  </span>
                </div>
                
                <div className="text-xs text-gray-600 mt-1">
                  {dailyWorkSummary.callbackSummary.absent.processed}명 처리완료
                </div>
              </div>

              {/* 오늘 예정된 콜백 */}
              <div 
                className="bg-white/70 rounded-lg p-4 border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleOpenModal('todayScheduled', '오늘 예정된 콜백')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-3 h-3 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-blue-700">오늘 예정된 콜</span>
                  </div>
                  <span className="text-xs text-blue-600">클릭하여 보기</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-900">
                    {dailyWorkSummary.callbackSummary.todayScheduled.total}건
                  </span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    dailyWorkSummary.callbackSummary.todayScheduled.processingRate === 100 
                      ? 'bg-green-100 text-green-800' 
                      : dailyWorkSummary.callbackSummary.todayScheduled.processingRate >= 80 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    처리율 {dailyWorkSummary.callbackSummary.todayScheduled.processingRate}%
                  </span>
                </div>
                
                <div className="text-xs text-blue-600 mt-1">
                  {dailyWorkSummary.callbackSummary.todayScheduled.processed}건 처리완료
                </div>
              </div>
            </div>
          </div>

          {/* 견적금액 정보 - 새로운 디자인 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">견적금액 정보</h3>
            </div>
            
            {/* 상담 견적 섹션 */}
            <div className="space-y-3 mb-4">
              <div className="bg-white/50 rounded-lg p-4 border border-green-100">
                <div className="text-sm font-medium text-green-800 mb-3">📋 오늘 상담 견적</div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">• 내원 상담 환자 견적</span>
                    <span className="font-medium text-blue-900">
                      {formatAmount(dailyWorkSummary.estimateSummary.visitConsultationEstimate)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">• 유선 상담 환자 견적</span>
                    <span className="font-medium text-purple-900">
                      {formatAmount(dailyWorkSummary.estimateSummary.phoneConsultationEstimate)}
                    </span>
                  </div>
                </div>
                
                <div className="border-t border-green-200 mt-3 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800">📊 총 상담 견적</span>
                    <span className="text-xl font-bold text-green-900">
                      {formatAmount(dailyWorkSummary.estimateSummary.totalConsultationEstimate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 치료 시작 견적 섹션 (별도 구분) */}
            <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">🚀 치료 시작한 견적 (처리일 기준)</span>
                <span className="text-lg font-bold text-amber-800">
                  {formatAmount(dailyWorkSummary.estimateSummary.treatmentStartedEstimate)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-900">{stats.total}명</div>
          <div className="text-sm text-blue-700">총 내원환자</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-900">{stats.treatmentStarted}명</div>
          <div className="text-sm text-green-700">치료시작</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-900">{stats.treatmentConsented}명</div>
          <div className="text-sm text-blue-700">치료동의</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-900">{stats.callbackNeeded}명</div>
          <div className="text-sm text-yellow-700">재콜백필요</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.terminated}명</div>
          <div className="text-sm text-gray-700">종결</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-900">{formatAmount(stats.totalAmount)}</div>
          <div className="text-sm text-orange-700">총 견적금액</div>
        </div>
      </div>

      {/* 환자 목록 테이블 */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            {selectedDate}일 내원 환자 목록 ({stats.total}명)
          </h3>
        </div>

        {dailyPatients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>선택한 날짜에 내원한 환자가 없습니다.</p>
            <p className="text-sm mt-1">다른 날짜를 선택해보세요.</p>
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
                    치료 내용
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                    상담내용
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyPatients.map((patient) => (
                  <tr key={patient._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{patient.name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient.treatmentContent}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {patient.estimatedAmount > 0 ? formatAmount(patient.estimatedAmount) : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(patient.postVisitStatus)}`}>
                        {patient.postVisitStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-md">
                        {patient.consultationContent.length > 100 ? (
                          <details className="cursor-pointer">
                            <summary className="font-medium text-blue-600 hover:text-blue-800">
                              {patient.consultationContent.substring(0, 100)}... (더보기)
                            </summary>
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg whitespace-pre-line">
                              {patient.consultationContent}
                            </div>
                          </details>
                        ) : (
                          <div className="whitespace-pre-line">{patient.consultationContent}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 하단 요약 */}
      {dailyPatients.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">💡 {selectedDate}일 내원 현황 요약</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <p>• 총 {stats.total}명이 내원하여 상담을 진행했습니다.</p>
                <p>• 치료시작 {stats.treatmentStarted}명, 치료동의 {stats.treatmentConsented}명, 재콜백필요 {stats.callbackNeeded}명</p>
                <p>• 총 견적금액: {formatAmount(stats.totalAmount)}</p>
                <p>• 상태미설정 {stats.unset}명 (후속 관리 필요)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상담관리 환자 목록 테이블 */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-yellow-50">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            {selectedDate}일 신규 상담 환자 목록 ({consultationStats.total}명)
          </h3>
        </div>

        {/* 상담관리 통계 카드 */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{consultationStats.total}명</div>
              <div className="text-xs text-gray-600">총 신규환자</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-900">{consultationStats.unprocessedCallback}명</div>
              <div className="text-xs text-red-700">미처리콜백</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-900">{consultationStats.postReservationAbsent}명</div>
              <div className="text-xs text-orange-700">예약후미내원</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-900">{consultationStats.visitConfirmed}명</div>
              <div className="text-xs text-green-700">내원확정</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-purple-900">{consultationStats.todayReservation}명</div>
              <div className="text-xs text-purple-700">오늘예약</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-900">{consultationStats.totalCallbacks}회</div>
              <div className="text-xs text-blue-700">총 콜백횟수</div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-indigo-900">{formatAmount(consultationStats.totalAmount)}</div>
              <div className="text-xs text-indigo-700">총 견적금액</div>
            </div>
          </div>
        </div>

        {dailyConsultations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>선택한 날짜에 신규 상담한 환자가 없습니다.</p>
            <p className="text-sm mt-1">다른 날짜를 선택해보세요.</p>
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
                    치료 내용
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    견적 금액
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총 콜백 횟수
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                    상담내용
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyConsultations.map((consultation) => (
                  <tr key={consultation._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{consultation.name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{consultation.treatmentContent}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {consultation.estimatedAmount > 0 ? formatAmount(consultation.estimatedAmount) : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConsultationStatusColor(consultation.status)}`}>
                        {consultation.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 text-center">{consultation.callbackCount}회</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-md">
                        {consultation.consultationContent.length > 100 ? (
                          <details className="cursor-pointer">
                            <summary className="font-medium text-blue-600 hover:text-blue-800">
                              {consultation.consultationContent.substring(0, 100)}... (더보기)
                            </summary>
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg whitespace-pre-line">
                              {consultation.consultationContent}
                            </div>
                          </details>
                        ) : (
                          <div className="whitespace-pre-line">{consultation.consultationContent}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 상담관리 요약 */}
      {dailyConsultations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">📞 {selectedDate}일 상담 현황 요약</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <p>• 총 {consultationStats.total}명의 신규 환자가 상담을 받았습니다.</p>
                <p>• 미처리콜백 {consultationStats.unprocessedCallback}명, 예약후미내원 {consultationStats.postReservationAbsent}명 (우선 관리 필요)</p>
                <p>• 내원확정 {consultationStats.visitConfirmed}명, 오늘예약 {consultationStats.todayReservation}명</p>
                <p>• 총 콜백 {consultationStats.totalCallbacks}회, 총 견적금액 {formatAmount(consultationStats.totalAmount)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 환자 목록 모달 추가 */}
      {modalState.isOpen && modalState.filterType && (
        <PatientListModal
          isOpen={modalState.isOpen}
          onClose={handleCloseModal}
          filterType={modalState.filterType}
          title={modalState.title}
        />
      )}
    </div>
  );
};

export default DailyReport;