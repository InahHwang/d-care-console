// src/components/management/PatientListModal.tsx
import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '@/hooks/reduxHooks';
import { selectPatient } from '@/store/slices/patientsSlice';
import { Patient, PatientStatus } from '@/store/slices/patientsSlice';
import { PatientFilterType } from '../dashboard/PatientStatusCards';
import PatientDetailModal from './PatientDetailModal';

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
      const response = await fetch(`/api/patients/status-filter?type=${filterType}`);
      
      if (!response.ok) {
        throw new Error('환자 목록을 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      setPatients(data);
    } catch (err) {
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
    // Redux에 환자 선택 저장
    dispatch(selectPatient(patient._id || patient.id));
    // 상세 모달 열기
    setIsDetailModalOpen(true);
  };

  const handleDetailModalClose = () => {
    setIsDetailModalOpen(false);
  };

  const getStatusBadgeColor = (status: PatientStatus) => {
    switch (status) {
      case '콜백필요':
        return 'bg-yellow-100 text-yellow-800';
      case '부재중':
        return 'bg-red-100 text-red-800';
      case '잠재고객':
        return 'bg-blue-100 text-blue-800';
      case '활성고객':
        return 'bg-green-100 text-green-800';
      case 'VIP':
        return 'bg-purple-100 text-purple-800';
      case '예약확정':
        return 'bg-indigo-100 text-indigo-800';
      case '종결':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    
    // status가 "예정"인 콜백 찾기
    const scheduledCallback = patient.callbackHistory.find(callback => callback.status === '예정');
    return scheduledCallback;
  };

  // 다음 콜백 날짜 상태 확인 (오늘 기준)
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
      return { type: 'scheduled', text: '예정', color: 'text-blue-600 bg-blue-50' };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-5xl mx-4 max-h-[80vh] overflow-hidden">
          {/* 모달 헤더 */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                  총 <span className="font-semibold text-blue-600">{patients.length}명</span>의 환자가 있습니다.
                </div>
                
                {patients.map((patient) => {
                  const nextCallback = getNextCallback(patient);
                  
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

                    {/* 다음 콜백 일정 - callbackHistory에서 예정된 콜백 표시 */}
                    {nextCallback && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border-l-4 border-blue-400">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                    {/* 관심 서비스 태그 */}
                    {patient.interestedServices && patient.interestedServices.length > 0 && (
                      <div className="mb-2">
                        <div className="flex flex-wrap gap-1">
                          {patient.interestedServices.slice(0, 3).map((service, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">
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
                )})}
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

      {/* 환자 상세 모달 - PatientDetailModal은 props 없이 Redux에서 selectedPatient를 가져옴 */}
      {isDetailModalOpen && (
        <PatientDetailModal />
      )}
    </>
  );
};

export default PatientListModal;