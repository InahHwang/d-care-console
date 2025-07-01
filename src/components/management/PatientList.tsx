// src/components/management/PatientList.tsx - 내원확정 즉시 반영 수정 버전

'use client'

import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { Patient } from '@/types/patient'
import { setPage, selectPatient, toggleVisitConfirmation, fetchPatients } from '@/store/slices/patientsSlice'
import { openDeleteConfirm, toggleHideCompletedVisits } from '@/store/slices/uiSlice'
import { IconType } from 'react-icons'
import { HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineArrowUp, HiOutlineTrash, HiOutlineCheck, HiOutlineEyeOff, HiOutlineEye } from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import { useState, useEffect, useMemo } from 'react'
import PatientDetailModal from './PatientDetailModal'
import PatientTooltip from './PatientTooltip'
import ReservationDateModal from './ReservationDateModal'
import CancelVisitConfirmationModal from './CancelVisitConfirmationModal'
// 🔥 useQueryClient 추가 import
import { useQueryClient } from '@tanstack/react-query'

interface PatientListProps {
  isLoading?: boolean;
  filteredPatients?: Patient[]; // 🔥 필터링된 환자 데이터 추가
}

const PatientStatusBadge = ({ status }: { status: string }) => {
  const colorMap: Record<string, string> = {
    '잠재고객': 'bg-blue-100 text-blue-800',
    '콜백필요': 'bg-yellow-100 text-yellow-800',
    '부재중': 'bg-red-100 text-red-800',
    '예약확정': 'bg-indigo-100 text-indigo-800',
    '종결': 'bg-gray-100 text-gray-800',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}

// 최근 상담 날짜를 계산하는 헬퍼 함수
const getLastConsultationDate = (patient: Patient): string => {
  const completedCallbacks = (patient.callbackHistory || []).filter(callback => 
    callback.status === '완료' && callback.completedAt
  );
  
  const postVisitDate = (patient.postVisitConsultation?.consultationContent) ? 
    patient.visitDate : null;
  
  const consultationDate = patient.consultation?.consultationDate;
  
  const dates = [
    ...completedCallbacks.map(cb => cb.completedAt!),
    postVisitDate,
    consultationDate,
    patient.lastConsultation
  ].filter(Boolean)
   .filter(date => date && date.trim() !== '')
   .map(date => new Date(date))
   .filter(date => !isNaN(date.getTime()))
   .sort((a, b) => b.getTime() - a.getTime());
  
  if (dates.length === 0) {
    return '-';
  }
  
  return dates[0].toISOString().split('T')[0];
};

// 상담 타입 배지 컴포넌트
const ConsultationTypeBadge = ({ type, inboundPhoneNumber }: { type: 'inbound' | 'outbound', inboundPhoneNumber?: string }) => {
  if (type === 'inbound') {
    return (
      <div className="flex items-center space-x-1">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <FiPhone className="w-3 h-3 mr-1" />
          인바운드
        </span>
        {inboundPhoneNumber && (
          <span className="text-xs text-gray-500" title="입력된 번호">
          </span>
        )}
      </div>
    );
  }
  
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      <FiPhoneCall className="w-3 h-3 mr-1" />
      아웃바운드
    </span>
  );
};

// 견적동의 상태 표시 컴포넌트
const EstimateAgreementBadge = ({ patient }: { patient: Patient }) => {
  const hasConsultation = patient.consultation && 
    (patient.consultation.estimatedAmount > 0 || patient.consultation.treatmentPlan);
  
  if (!hasConsultation) {
    return <span className="text-sm text-gray-400">-</span>;
  }
  
  const estimateAgreed = patient.consultation?.estimateAgreed;
  const estimatedAmount = patient.consultation?.estimatedAmount;
  
  const formatAmount = (amount?: number) => {
    if (!amount || amount === 0) return '';
    return amount.toLocaleString('ko-KR');
  };
  
  if (estimateAgreed === true) {
    return (
      <div className="flex flex-col items-start space-y-1">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          동의
        </span>
        {estimatedAmount && estimatedAmount > 0 && (
          <span className="text-xs text-gray-600 font-medium">
            {formatAmount(estimatedAmount)}원
          </span>
        )}
      </div>
    );
  } else if (estimateAgreed === false) {
    return (
      <div className="flex flex-col items-start space-y-1">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          거부
        </span>
        {estimatedAmount && estimatedAmount > 0 && (
          <span className="text-xs text-gray-600 font-medium">
            {formatAmount(estimatedAmount)}원
          </span>
        )}
      </div>
    );
  } else {
    return (
      <div className="flex flex-col items-start space-y-1">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          미결정
        </span>
        {estimatedAmount && estimatedAmount > 0 && (
          <span className="text-xs text-gray-600 font-medium">
            {formatAmount(estimatedAmount)}원
          </span>
        )}
      </div>
    );
  }
};

// 내원일 표시 컴포넌트
const VisitDateBadge = ({ patient }: { patient: Patient }) => {
  if (patient.visitConfirmed && patient.visitDate) {
    return (
      <span className="text-sm text-gray-600">
        {patient.visitDate}
      </span>
    );
  }
  
  if (patient.visitConfirmed && patient.reservationDate) {
    return (
      <span className="text-sm text-blue-600">
        {patient.reservationDate}
        {patient.reservationTime && ` ${patient.reservationTime}`}
      </span>
    );
  }
  
  return <span className="text-sm text-gray-400">-</span>;
};

// 총 콜백 횟수 표시를 위한 컴포넌트
const CallbackCountBadge = ({ patient }: { patient: Patient }) => {
  const completedCallbacks = (patient.callbackHistory || []).filter(cb => cb.status === '완료').length;
  const scheduledCallbacks = (patient.callbackHistory || []).filter(cb => cb.status === '예정').length;
  
  if (completedCallbacks === 0) {
    return <span className="text-text-secondary">-</span>;
  }
  
  return (
    <div className="flex items-center gap-1">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        {completedCallbacks}
      </span>
      {scheduledCallbacks > 0 && (
        <span className="text-xs text-blue-600">
          (+{scheduledCallbacks})
        </span>
      )}
    </div>
  );
};

export default function PatientList({ isLoading = false, filteredPatients }: PatientListProps) {
  const dispatch = useDispatch<AppDispatch>()
  // 🔥 useQueryClient 훅 추가
  const queryClient = useQueryClient()
  
  const [isMounted, setIsMounted] = useState(false)
  const [tooltipRefreshTrigger, setTooltipRefreshTrigger] = useState(0)
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false)
  const [selectedPatientForReservation, setSelectedPatientForReservation] = useState<Patient | null>(null)
  const [isProcessingReservation, setIsProcessingReservation] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState<Patient | null>(null)
  
  // 🔥 Redux 상태에서 기본 데이터 가져오기
  const { 
    filteredPatients: reduxFilteredPatients, 
    pagination: { currentPage, totalPages, itemsPerPage, totalItems },
    filters,
    selectedPatient,
    patients,
  } = useSelector((state: RootState) => state.patients)

  const { hideCompletedVisits } = useSelector((state: RootState) => state.ui.visitManagement)
  
  // 🔥 props로 받은 filteredPatients가 있으면 그것을 사용, 없으면 Redux 데이터 사용
  const displayPatientsSource = filteredPatients || reduxFilteredPatients;
  
  // 내원확정 환자 필터링 로직
  const displayPatients = useMemo(() => {
    if (!hideCompletedVisits) {
      return displayPatientsSource;
    }
    
    return displayPatientsSource.filter(patient => !patient.visitConfirmed);
  }, [displayPatientsSource, hideCompletedVisits]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = displayPatientsSource.length;
    const visitConfirmed = displayPatientsSource.filter(p => p.visitConfirmed).length;
    const needsPostVisitFollow = displayPatientsSource.filter(p => 
      p.visitConfirmed && p.postVisitStatus === '재콜백필요'
    ).length;
    
    return { total, visitConfirmed, needsPostVisitFollow };
  }, [displayPatientsSource]);
  
  useEffect(() => {
    console.log('PatientList 컴포넌트 마운트됨');
    setIsMounted(true);
  }, [])

  useEffect(() => {
    if (isMounted && patients.length > 0) {
      console.log('🔥 PatientList: 환자 데이터 변경 감지, 툴팁 새로고침 트리거');
      setTooltipRefreshTrigger(prev => prev + 1);
    }
  }, [patients, isMounted]);
  
  console.log('PatientList 렌더링 - isMounted:', isMounted);
  console.log('displayPatients 수:', displayPatients.length);
  
  // 🔥 페이지네이션 계산 - displayPatients 기준으로 수정
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, displayPatients.length)
  const paginatedPatients = displayPatients.slice(startIndex, endIndex)
  
  const handlePageChange = (newPage: number) => {
    dispatch(setPage(newPage))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  const handleViewDetails = (patient: Patient) => {
    const patientId = patient._id || patient.id;
    
    if (!patientId) {
      console.error('환자 ID가 없습니다:', patient);
      return;
    }
    
    console.log('상세 보기 선택:', patientId);
    dispatch(selectPatient(patientId));
  }

  // 🔥 내원 확정 핸들러 - Redux 액션 사용으로 완전 변경
  const handleToggleVisitConfirmation = async (patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const patientId = patient._id || patient.id;
    
    if (!patientId) {
      console.error('환자 ID가 없습니다:', patient);
      return;
    }
    
    console.log('🔥 내원 확정 버튼 클릭:', patientId, '현재 내원확정 상태:', patient.visitConfirmed);
    
    // 🔥 내원확정 취소 로직 (기존과 동일)
    if (patient.visitConfirmed) {
      console.log('내원확정 취소 확인 모달 띄우기');
      setSelectedPatientForCancel(patient);
      setIsCancelModalOpen(true);
      return;
    }
    
    // 🔥 예약확정 환자의 내원확정 처리 - Redux 액션 사용
    if (patient.status === '예약확정' && !patient.visitConfirmed) {
      try {
        console.log('🔥 예약확정 환자의 내원확정 처리 - Redux 액션 사용');
        
        // Redux 액션 호출로 변경
        const result = await dispatch(toggleVisitConfirmation(patientId));
        
        if (toggleVisitConfirmation.fulfilled.match(result)) {
          console.log('✅ Redux 내원확정 처리 성공');
          
          // 🔥 React Query 캐시 무효화로 즉시 UI 반영
          queryClient.invalidateQueries({ queryKey: ['patients'] });
          setTooltipRefreshTrigger(prev => prev + 1);
        } else {
          console.error('❌ Redux 내원확정 처리 실패:', result.payload);
          throw new Error(result.payload as string || '내원확정 처리에 실패했습니다.');
        }
        
      } catch (error) {
        console.error('예약확정 환자 내원확정 처리 실패:', error);
        alert(`내원확정 처리에 실패했습니다: ${error}`);
      }
      return;
    }
    
    // 🔥 일반 환자의 내원확정 처리 - 예약일자 모달 (기존과 동일)
    if (!patient.visitConfirmed && patient.status !== '예약확정') {
      console.log('예약일자 입력 모달 띄우기 - 갑작스러운 내원 케이스');
      setSelectedPatientForReservation(patient);
      setIsReservationModalOpen(true);
      return;
    }
  };

  // 🔥 예약일자 모달 확인 핸들러 - Redux 액션 사용으로 개선
  const handleReservationConfirm = async (reservationDate: string, reservationTime: string) => {
    if (!selectedPatientForReservation) {
      console.error('선택된 환자가 없습니다.');
      return;
    }

    setIsProcessingReservation(true);
    
    try {
      const patientId = selectedPatientForReservation._id || selectedPatientForReservation.id;
      
      console.log('🔥 예약일자 처리 시작 (Redux 액션 사용):', {
        patientId,
        reservationDate,
        reservationTime
      });

      // 🔥 1단계: 예약완료 처리 (기존 API 호출 유지)
      const reservationResponse = await fetch(`/api/patients/${patientId}/reservation-complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservationDate,
          reservationTime,
          reason: `[예약완료] 예약일시: ${reservationDate} ${reservationTime}`
        }),
      });

      if (!reservationResponse.ok) {
        const errorData = await reservationResponse.json();
        throw new Error(errorData.error || '예약완료 처리에 실패했습니다.');
      }

      console.log('✅ 1단계: 예약완료 처리 성공');

      // 🔥 2단계: 내원확정 처리 - Redux 액션 사용
      const result = await dispatch(toggleVisitConfirmation(patientId));
      
      if (toggleVisitConfirmation.fulfilled.match(result)) {
        console.log('✅ 2단계: Redux 내원확정 처리 성공');
        
        // 🔥 React Query 캐시 무효화로 즉시 UI 반영
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        setTooltipRefreshTrigger(prev => prev + 1);

        alert(`${selectedPatientForReservation.name} 환자의 예약완료 및 내원확정 처리가 완료되었습니다.`);

        setIsReservationModalOpen(false);
        setSelectedPatientForReservation(null);
      } else {
        console.error('❌ Redux 내원확정 처리 실패:', result.payload);
        throw new Error(result.payload as string || '내원확정 처리에 실패했습니다.');
      }

    } catch (error) {
      console.error('예약일자 처리 실패:', error);
      alert(`처리 중 오류가 발생했습니다: ${error}`);
    } finally {
      setIsProcessingReservation(false);
    }
  };

  const handleReservationModalClose = () => {
    if (!isProcessingReservation) {
      setIsReservationModalOpen(false);
      setSelectedPatientForReservation(null);
    }
  };

  // 🔥 내원확정 취소 확인 핸들러 - Redux 액션 사용으로 개선
  const handleConfirmCancelVisit = async (reason: string) => {
    if (!selectedPatientForCancel) {
      console.error('취소할 환자가 선택되지 않았습니다.');
      return;
    }

    setIsProcessingReservation(true);
    
    try {
      const patientId = selectedPatientForCancel._id || selectedPatientForCancel.id;
      
      console.log('🔥 내원확정 취소 처리 시작 (Redux 액션 사용):', patientId);

      // 🔥 취소 API 호출 후 Redux 액션으로 상태 업데이트
      const cancelResponse = await fetch(`/api/patients/${patientId}/cancel-visit-confirmation`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || '관리자 취소'
        }),
      });

      if (!cancelResponse.ok) {
        const errorData = await cancelResponse.json();
        throw new Error(errorData.error || '내원확정 취소에 실패했습니다.');
      }

      console.log('✅ 내원확정 취소 API 호출 성공');

      // 🔥 Redux 액션으로 상태 동기화 (toggleVisitConfirmation 대신 fetchPatients 사용)
      await dispatch(fetchPatients()).unwrap();
      
      // 🔥 React Query 캐시 무효화로 즉시 UI 반영
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setTooltipRefreshTrigger(prev => prev + 1);

      console.log('✅ 내원확정 취소 완료 및 데이터 새로고침 성공');
      alert(`${selectedPatientForCancel.name} 환자의 내원확정이 취소되었습니다.`);

      setIsCancelModalOpen(false);
      setSelectedPatientForCancel(null);

    } catch (error) {
      console.error('내원확정 취소 실패:', error);
      alert(`내원확정 취소에 실패했습니다: ${error}`);
    } finally {
      setIsProcessingReservation(false);
    }
  };

  const handleCancelModalClose = () => {
    setIsCancelModalOpen(false);
    setSelectedPatientForCancel(null);
  };
  
  return (
    <>
      {/* 내원 관리 통계 및 토글 버튼 */}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="text-sm text-gray-600">
              <span className="font-medium">전체: {stats.total}명</span>
            </div>
            <div className="text-sm text-indigo-600">
              <span className="font-medium">내원확정: {stats.visitConfirmed}명</span>
            </div>
            <div className="text-sm text-yellow-600">
              <span className="font-medium">추가 콜백 필요: {stats.needsPostVisitFollow}명</span>
            </div>
          </div>
          
          <button
            onClick={() => dispatch(toggleHideCompletedVisits())}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              hideCompletedVisits 
                ? 'bg-gray-600 text-white hover:bg-gray-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Icon 
              icon={hideCompletedVisits ? HiOutlineEyeOff : HiOutlineEye} 
              size={16} 
            />
            <span>{hideCompletedVisits ? '내원확정 환자 숨김' : '내원확정 환자 표시'}</span>
          </button>
        </div>
      </div>

      <div className="card p-0 w-full">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] table-auto">
            <thead>
              <tr className="bg-light-bg">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">상담 타입</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">이름</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">나이</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">지역</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">연락처</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">관심 분야</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">최근 상담</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">총 콜백 횟수</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">견적동의</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">내원 확정</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">액션</th>
              </tr>
            </thead>
            
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-text-secondary">
                    불러오는 중...
                  </td>
                </tr>
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-text-secondary">
                    {hideCompletedVisits ? '내원완료 환자를 제외한 결과가 없습니다.' : 
                     filters.searchTerm ? (
                      <>검색 결과가 없습니다: <strong>{filters.searchTerm}</strong></>
                    ) : (
                      '등록된 환자가 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => {
                  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
                    const absentCallbacks = patient.callbackHistory.filter(cb => cb.status === '부재중');
                    if (absentCallbacks.length > 0) {
                      console.log('부재중 콜백이 있는 환자:', patient._id, patient.name, '- 상태:', patient.status);
                    }
                  }
                  
                  const rowColor = patient.visitConfirmed 
                    ? 'bg-gray-50/70'
                    : patient.consultationType === 'inbound' 
                    ? 'bg-green-50/30'
                    : patient.status === 'VIP' 
                    ? 'bg-purple-50/30' 
                    : patient.status === '부재중' 
                    ? 'bg-red-50/30' 
                    : patient.status === '콜백필요' 
                    ? 'bg-yellow-50/30' 
                    : '';
                  
                  const isVip = patient.name === '홍길동' || patient.status === 'VIP';
                  const patientId = patient._id || patient.id || '';
                  
                  return (
                    <tr 
                      key={patient._id} 
                      className={`border-b border-border last:border-0 ${rowColor} hover:bg-light-bg/50 transition-colors duration-150 ${
                        patient.visitConfirmed ? 'opacity-75' : ''
                      }`}
                    >
                      <td className="px-4 py-4">
                        <ConsultationTypeBadge 
                          type={patient.consultationType || 'outbound'} 
                          inboundPhoneNumber={patient.inboundPhoneNumber}
                        />
                      </td>
                      <td className={`px-4 py-4 text-sm font-medium ${isVip ? 'text-purple-800' : 'text-text-primary'}`}>
                        <PatientTooltip
                          patientId={patientId}
                          patientName={patient.name}
                          refreshTrigger={tooltipRefreshTrigger}
                        >
                          <button 
                            onClick={() => handleViewDetails(patient)}
                            className="hover:underline"
                          >
                            {patient.name}
                          </button>
                        </PatientTooltip>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.age || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.region ? (
                          <>
                            {patient.region.province}
                            {patient.region.city && ` ${patient.region.city}`}
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.phoneNumber || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(patient.interestedServices || []).map((service, idx) => (
                            <span 
                              key={idx}
                              className="inline-block px-2 py-1 rounded-full text-xs bg-light-bg text-text-primary"
                            >
                              {service}
                            </span>
                          ))}
                          {(!patient.interestedServices || patient.interestedServices.length === 0) && (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {getLastConsultationDate(patient)}
                      </td>
                      <td className="px-4 py-4">
                        <PatientStatusBadge status={patient.status} />
                      </td>
                      <td className="px-4 py-4">
                        <CallbackCountBadge patient={patient} />
                      </td>
                      <td className="px-4 py-4">
                        <EstimateAgreementBadge patient={patient} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-150 ${
                            patient.visitConfirmed 
                              ? 'bg-green-500 text-white hover:bg-green-600' 
                              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                          }`}
                          onClick={(e) => handleToggleVisitConfirmation(patient, e)}
                          title={patient.visitConfirmed ? "내원확정 취소" : "내원 확정"}
                          disabled={isProcessingReservation}
                        >
                          <Icon 
                            icon={HiOutlineCheck} 
                            size={16} 
                          />
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors duration-150"
                            onClick={() => handleViewDetails(patient)}
                            title="상세 정보"
                          >
                            <Icon 
                              icon={HiOutlineArrowUp} 
                              size={16} 
                              className="transform rotate-45" 
                            />
                          </button>
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-error text-white hover:bg-error/90 transition-colors duration-150"
                            onClick={() => patientId && dispatch(openDeleteConfirm(patientId))}
                            title="환자 삭제"
                          >
                            <Icon 
                              icon={HiOutlineTrash} 
                              size={16} 
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* 🔥 페이지네이션 - displayPatients 기준으로 수정 */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border">
          <div className="text-sm text-text-secondary mb-4 sm:mb-0">
            총 {displayPatients.length}개 항목 중 {Math.min(startIndex + 1, displayPatients.length)}-{Math.min(endIndex, displayPatients.length)} 표시
            {hideCompletedVisits && (
              <span className="ml-2 text-gray-500">(내원완료 {stats.visitConfirmed}명 숨김)</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 bg-light-bg px-4 py-1.5 rounded-full">
            <button
              className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <Icon 
                icon={HiOutlineChevronLeft} 
                size={20} 
                className="text-current" 
              />
            </button>
            
            {Math.ceil(displayPatients.length / itemsPerPage) <= 5 ? (
              Array.from({ length: Math.ceil(displayPatients.length / itemsPerPage) }, (_, i) => (
                <button
                  key={i + 1}
                  className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                    currentPage === i + 1 ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                  }`}
                  onClick={() => handlePageChange(i + 1)}
                >
                  {i + 1}
                </button>
              ))
            ) : (
              <>
                {[1, 2, 3].map((page) => (
                  <button
                    key={page}
                    className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                      currentPage === page ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                    }`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                ))}
                
                <span className="text-text-secondary">...</span>
                
                <button
                  className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                    currentPage === Math.ceil(displayPatients.length / itemsPerPage) ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                  }`}
                  onClick={() => handlePageChange(Math.ceil(displayPatients.length / itemsPerPage))}
                >
                  {Math.ceil(displayPatients.length / itemsPerPage)}
                </button>
              </>
            )}
            
            <button
              className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === Math.ceil(displayPatients.length / itemsPerPage)}
            >
              <Icon 
                icon={HiOutlineChevronRight} 
                size={20} 
                className="text-current" 
              />
            </button>
          </div>
        </div>
      </div>
      
      {selectedPatient && <PatientDetailModal />}

      <ReservationDateModal
        isOpen={isReservationModalOpen}
        onClose={handleReservationModalClose}
        onConfirm={handleReservationConfirm}
        patient={selectedPatientForReservation}
        isLoading={isProcessingReservation}
      />

      <CancelVisitConfirmationModal
        isOpen={isCancelModalOpen}
        onClose={handleCancelModalClose}
        onConfirm={handleConfirmCancelVisit}
        patient={selectedPatientForCancel}
        isLoading={isProcessingReservation}
      />
    </>
  )
}