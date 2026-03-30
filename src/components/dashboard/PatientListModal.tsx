// src/components/management/PatientListModal.tsx - 새로운 필터 타입 지원
import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '@/hooks/reduxHooks';
import { selectPatient } from '@/store/slices/patientsSlice';
import PatientDetailModal from '@/components/management/PatientDetailModal';
import { Patient, PatientStatus, PatientFilterType } from '@/types/patient';

interface PatientListModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterType: PatientFilterType;
  title: string;
}

const PatientListModal: React.FC<PatientListModalProps> = ({
  isOpen,
  onClose,
  filterType,
  title
}) => {
  const dispatch = useAppDispatch();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // 환자 목록 가져오기
  const fetchFilteredPatients = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 API 호출: /api/patients/status-filter?type=${filterType}`);
      
      const response = await fetch(`/api/patients/status-filter?type=${filterType}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error('환자 목록을 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      console.log(`🔍 API 응답 (${filterType}):`, data);
      
      setPatients(data);
    } catch (err) {
      console.error('🚨 API 에러:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFilteredPatients();
    }
  }, [isOpen, filterType]);

  const handlePatientClick = (patient: Patient) => {
    dispatch(selectPatient(patient._id || patient.id));
    setIsDetailModalOpen(true);
  };

  const handleDetailModalClose = () => {
    setIsDetailModalOpen(false);
  };

  const handleRefresh = () => {
    console.log('🔄 수동 새로고침 시작');
    fetchFilteredPatients();
  };

  const getStatusBadgeColor = (status: PatientStatus) => {
    switch (status) {
      case '콜백필요':
        return 'bg-yellow-100 text-yellow-800';
      case '부재중':
        return 'bg-red-100 text-red-800';
      case '잠재고객':
        return 'bg-green-100 text-green-800';
      case 'VIP':
        return 'bg-purple-100 text-purple-800';
      case '예약확정':
        return 'bg-indigo-100 text-indigo-800';
      case '재예약확정':
        return 'bg-indigo-100 text-indigo-800';
      case '종결':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 🔥 내원 후 상태 뱃지 색상
  const getPostVisitStatusBadgeColor = (postVisitStatus: string) => {
    switch (postVisitStatus) {
      case '재콜백필요':
        return 'bg-orange-100 text-orange-800';
      case '치료동의':
        return 'bg-green-100 text-green-800';
      case '치료시작':
        return 'bg-orange-100 text-orange-800';
      case '종결':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-purple-100 text-purple-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateWithTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    return phoneNumber.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  };

  // callbackHistory에서 예정된 콜백 찾기
  const getNextCallback = (patient: Patient) => {
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
      return null;
    }
    
    const scheduledCallback = patient.callbackHistory.find(callback => callback.status === '예정');
    return scheduledCallback;
  };

  // 미처리 콜백 찾기
  const getOverdueCallback = (patient: Patient) => {
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
      return null;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const overdueCallbacks = patient.callbackHistory.filter(callback => {
      if (callback.status !== '예정') return false;
      const callbackDate = new Date(callback.date);
      callbackDate.setHours(0, 0, 0, 0);
      return callbackDate < today;
    });
    
    if (overdueCallbacks.length > 0) {
      return overdueCallbacks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    }
    
    return null;
  };

  // 다음 콜백 날짜 상태 확인
  const getCallbackDateStatus = (callbackDate: string) => {
    const today = new Date();
    const callback = new Date(callbackDate);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    if (callback < todayStart) {
      return { type: 'overdue', text: '지연됨', color: 'text-red-600 bg-red-50' };
    } else if (callback >= todayStart && callback < tomorrowStart) {
      return { type: 'today', text: '오늘', color: 'text-orange-600 bg-orange-50' };
    } else {
      return { type: 'scheduled', text: '예정', color: 'text-orange-600 bg-orange-50' };
    }
  };

  // 미처리 콜백 경과 일수 계산
  const getOverdueDays = (callbackDate: string) => {
    const today = new Date();
    const callback = new Date(callbackDate);
    const diffTime = today.getTime() - callback.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // 🔥 필터 타입에 따른 특별 정보 표시 여부 결정
  const shouldShowOverdueInfo = () => {
    return filterType === 'overdueCallbacks' || 
           filterType === 'overdueCallbacks_consultation' || 
           filterType === 'overdueCallbacks_visit';
  };

  const shouldShowCallbackInfo = () => {
    return !shouldShowOverdueInfo();
  };

  // 🔥 리마인더 관련 정보 표시
  const getReminderInfo = (patient: Patient) => {
    if (!patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate) {
      return null;
    }
    
    const treatmentStartDate = patient.postVisitConsultation.treatmentConsentInfo.treatmentStartDate;
    const today = new Date();
    const startDate = new Date(treatmentStartDate);
    const diffTime = startDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      treatmentStartDate,
      daysUntilStart: diffDays,
      isOverdue: diffDays < 0
    };
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-5xl mx-4 max-h-[80vh] overflow-hidden">
          {/* 모달 헤더 */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="px-3 py-1 bg-orange-100 text-orange-600 rounded-md hover:bg-orange-200 disabled:opacity-50 text-sm"
              >
                {isLoading ? '새로고침...' : '🔄 새로고침'}
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 모달 콘텐츠 */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                <span className="ml-2 text-gray-600">로딩 중...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <div className="text-red-800">{error}</div>
                <button
                  onClick={fetchFilteredPatients}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                >
                  다시 시도
                </button>
              </div>
            )}

            {!isLoading && !error && patients.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-2">해당하는 환자가 없습니다.</div>
                <div className="text-sm text-gray-400">조건에 맞는 환자 데이터가 없습니다.</div>
              </div>
            )}

            {!isLoading && !error && patients.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600 mb-4">
                  총 <span className="font-semibold text-orange-600">{patients.length}명</span>의 환자가 있습니다.
                  <div className="text-xs text-gray-400 mt-1">
                    필터: {filterType} | 마지막 조회: {new Date().toLocaleTimeString()}
                  </div>
                </div>
                
                {patients.map((patient) => {
                  const nextCallback = getNextCallback(patient);
                  const overdueCallback = getOverdueCallback(patient);
                  const reminderInfo = getReminderInfo(patient);
                  
                  return (
                    <div
                      key={patient._id || patient.id}
                      onClick={() => handlePatientClick(patient)}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-medium text-gray-900">{patient.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(patient.status)}`}>
                            {patient.status}
                          </span>
                          
                          {/* 내원 관리 상태 표시 */}
                          {patient.visitConfirmed && patient.postVisitStatus && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPostVisitStatusBadgeColor(patient.postVisitStatus)}`}>
                              {patient.postVisitStatus}
                            </span>
                          )}
                          
                          {/* 미처리 콜백 경고 뱃지 */}
                          {shouldShowOverdueInfo() && overdueCallback && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {getOverdueDays(overdueCallback.date)}일 지연
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {patient.patientId}
                        </div>
                      </div>

                      {/* 기본 정보 그리드 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 mb-3">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {formatPhoneNumber(patient.phoneNumber)}
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          최근 상담: {formatDate(patient.lastConsultation)}
                        </div>
                      </div>

                      {/* 🔥 미처리 콜백 정보 표시 */}
                      {shouldShowOverdueInfo() && overdueCallback && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                            <div className="flex items-center">
                              <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-sm font-medium text-red-900">
                                  🚨 {overdueCallback.type} 콜백 미처리 ({getOverdueDays(overdueCallback.date)}일 지연)
                                </div>
                                <div className="text-sm text-red-700">
                                  예정일: {formatDateWithTime(overdueCallback.date)}
                                </div>
                                {overdueCallback.notes && (
                                  <div className="text-xs text-red-600 mt-1">
                                    {overdueCallback.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="px-2 py-1 rounded text-xs font-medium bg-red-200 text-red-800">
                              긴급
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 🔥 일반 콜백 정보 표시 */}
                      {shouldShowCallbackInfo() && nextCallback && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border-l-4 border-orange-400">
                            <div className="flex items-center">
                              <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  다음 {nextCallback.type} 콜백 예정
                                </div>
                                <div className="text-sm text-gray-600">
                                  {formatDateWithTime(nextCallback.date)}
                                </div>
                                {nextCallback.notes && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {nextCallback.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-medium ${getCallbackDateStatus(nextCallback.date).color}`}>
                              {getCallbackDateStatus(nextCallback.date).text}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 🔥 리마인더 정보 표시 */}
                      {(filterType.includes('reminderCallbacks') || filterType.includes('reminder')) && reminderInfo && (
                        <div className="mb-3">
                          <div className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${
                            reminderInfo.isOverdue ? 'bg-red-50 border-red-500' : 'bg-purple-50 border-purple-500'
                          }`}>
                            <div className="flex items-center">
                              <svg className={`w-5 h-5 mr-2 ${reminderInfo.isOverdue ? 'text-red-500' : 'text-purple-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className={`text-sm font-medium ${reminderInfo.isOverdue ? 'text-red-900' : 'text-purple-900'}`}>
                                  {reminderInfo.isOverdue ? '⚠️ 치료 시작일 경과' : '⏰ 치료 시작 예정'}
                                </div>
                                <div className={`text-sm ${reminderInfo.isOverdue ? 'text-red-700' : 'text-purple-700'}`}>
                                  치료 시작일: {formatDate(reminderInfo.treatmentStartDate)}
                                  {reminderInfo.isOverdue 
                                    ? ` (${Math.abs(reminderInfo.daysUntilStart)}일 경과)` 
                                    : ` (${reminderInfo.daysUntilStart}일 후)`
                                  }
                                </div>
                              </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-medium ${
                              reminderInfo.isOverdue 
                                ? 'bg-red-200 text-red-800' 
                                : 'bg-purple-200 text-purple-800'
                            }`}>
                              {reminderInfo.isOverdue ? '지연' : '예정'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 관심 서비스 태그 */}
                      {patient.interestedServices && patient.interestedServices.length > 0 && (
                        <div className="mb-2">
                          <div className="flex flex-wrap gap-1">
                            {patient.interestedServices.slice(0, 3).map((service, index) => (
                              <span key={index} className="px-2 py-1 bg-orange-50 text-orange-600 text-xs rounded">
                                {service}
                              </span>
                            ))}
                            {patient.interestedServices.length > 3 && (
                              <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded">
                                +{patient.interestedServices.length - 3}개
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 추가 정보 */}
                      {patient.callInDate && (
                        <div className="flex justify-end text-xs text-gray-500 pt-2 border-t border-gray-100">
                          콜인일: {formatDate(patient.callInDate)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 모달 푸터 */}
          <div className="flex justify-end p-6 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* 환자 상세 모달 - PatientDetailModal 경로 확인 후 주석 해제 */}
      {/* 
      {isDetailModalOpen && (
        <PatientDetailModal />
      )}
      */}
    </>
  );
};

export default PatientListModal;