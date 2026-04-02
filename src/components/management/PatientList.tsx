// src/components/management/PatientList.tsx - 이벤트 타겟 표시 추가 완전한 버전

'use client'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { Patient } from '@/types/patient'
import { setPage, selectPatient, toggleVisitConfirmation, fetchPatients, selectPatientWithContext, updatePatientDirectly } from '@/store/slices/patientsSlice'
import { openDeleteConfirm, toggleHideCompletedVisits } from '@/store/slices/uiSlice'
import { IconType } from 'react-icons'
import { HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineArrowUp, HiOutlineTrash, HiOutlineCheck, HiOutlineEyeOff, HiOutlineEye, HiOutlineUser, HiOutlineRefresh, HiOutlineTag, HiOutlineExclamationCircle } from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import { useState, useEffect, useMemo } from 'react'
import PatientTooltip from './PatientTooltip'
import ReservationDateModal from './ReservationDateModal'
import CancelVisitConfirmationModal from './CancelVisitConfirmationModal'
import { useQueryClient } from '@tanstack/react-query'
import { useCategories } from '@/hooks/useCategories'

// 🔥 이벤트 타겟 표시 컴포넌트
const EventTargetBadge = ({ patient, context = 'management' }: { 
  patient: Patient; 
  context?: 'management' | 'visit-management' 
}) => {
  // 이벤트 타겟이 아니면 아무것도 표시하지 않음
  if (!patient.eventTargetInfo?.isEventTarget) {
    return null;
  }

  // 상담관리 메뉴에서의 구분
  if (context === 'management') {
    const hasVisitCompleted = patient.visitConfirmed === true;
    
    if (hasVisitCompleted) {
      // 내원완료 후 이벤트 타겟 - 파란색
      return (
        <span 
          className="inline-flex items-center justify-center w-4 h-4 ml-1 text-orange-600"
          title="내원완료 후 이벤트 타겟 관리 대상"
        >
          <HiOutlineTag size={14} />
        </span>
      );
    } else {
      // 일반 이벤트 타겟 - 주황색  
      return (
        <span 
          className="inline-flex items-center justify-center w-4 h-4 ml-1 text-orange-600"
          title="전화상담 단계 이벤트 타겟 관리 대상"
        >
          <HiOutlineTag size={14} />
        </span>
      );
    }
  }

  // 내원관리 메뉴에서의 표시 (내원완료 후 이벤트 타겟과 동일한 색상)
  if (context === 'visit-management') {
    return (
      <span 
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-orange-600"
        title="이벤트 타겟 관리 대상"
      >
        <HiOutlineTag size={14} />
      </span>
    );
  }

  return null;
};

interface PatientListProps {
  isLoading: boolean;
  filteredPatients: Patient[];
  onSelectPatient?: (patientId: string) => void;
}

// 🔥 환자 상태 배지 - 콜백 날짜/시간 표시 추가
const PatientStatusBadge = ({ status, patient }: { 
  status: string, 
  patient?: Patient
}) => {
  const colorMap: Record<string, string> = {
    '잠재고객': 'bg-orange-100 text-orange-800',
    '콜백필요': 'bg-yellow-100 text-yellow-800',
    '부재중': 'bg-red-100 text-red-800',
    '예약확정': 'bg-indigo-100 text-indigo-800',
    '재예약확정': 'bg-orange-100 text-orange-800', // 🔥 재예약확정 스타일 추가
    '종결': 'bg-gray-100 text-gray-800',
    '내원완료': 'bg-gray-100 text-gray-800',
  }

  // 🔥 가장 가까운 예정된 콜백 찾기 함수
  const getNextScheduledCallback = (patient: Patient) => {
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) return null;
    
    const scheduledCallbacks = patient.callbackHistory
      .filter(cb => cb.status === '예정')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return scheduledCallbacks.length > 0 ? scheduledCallbacks[0] : null;
  };

  // 🔥 재예약확정 상태 우선 처리 (내원완료보다 먼저)
  if (status === '재예약확정') {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
          재예약확정
        </span>
        {/* 재예약 날짜/시간 표시 - 예약확정과 동일한 색상 */}
        {patient && (patient.reservationDate || patient.reservationTime) && (
          <div className="text-xs text-indigo-600 font-medium">
            {patient.reservationDate && <div>{patient.reservationDate}</div>}
            {patient.reservationTime && <div>{patient.reservationTime}</div>}
          </div>
        )}
      </div>
    );
  }

  // 🔥 내원완료가 최우선, 그 다음 특별 상태
  if (patient?.visitConfirmed) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          내원완료
        </span>
        {/* 내원완료 시에도 예약일시 표시 (참고용) */}
        {patient && (patient.reservationDate || patient.reservationTime) && (
          <div className="text-xs text-gray-500 font-medium">
            {patient.reservationDate && <div>{patient.reservationDate}</div>}
            {patient.reservationTime && <div>{patient.reservationTime}</div>}
          </div>
        )}
      </div>
    );
  }

  // 🔥 오늘 예약이나 예약 후 미내원인 경우 특별 처리
  const showSpecialStatus = (patient?.isTodayReservationPatient || patient?.hasBeenPostReservationPatient);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-0.5">
        
        {/* 🔥 특별 상태가 있으면 그것만 표시, 없으면 기본 상태 표시 */}
        {showSpecialStatus ? (
          <>
            {/* 오늘 예약 */}
            {patient?.isTodayReservationPatient && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                오늘 예약
              </span>
            )}
            
            {/* 예약 후 미내원 (오늘 예약이 아닌 경우만) */}
            {patient?.hasBeenPostReservationPatient && !patient?.isTodayReservationPatient && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                예약 후 미내원
              </span>
            )}
          </>
        ) : (
          /* 기본 상태 배지 */
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[status] || 'bg-gray-100 text-gray-800'}`}>
            {status}
          </span>
        )}
        
        {/* 🔥 콜백필요 상태일 때 다음 예정된 콜백 날짜/시간 표시 */}
        {status === '콜백필요' && patient && (() => {
          const nextCallback = getNextScheduledCallback(patient);
          return nextCallback && (
            <div className="text-xs text-yellow-600 font-medium">
              {nextCallback.date && <div>{nextCallback.date}</div>}
              {nextCallback.time && <div>{nextCallback.time}</div>}
            </div>
          );
        })()}
        
        {/* 예약일시 표시 - 예약확정일 때만 */}
        {status === '예약확정' && patient && (patient.reservationDate || patient.reservationTime) && (
          <div className="text-xs text-indigo-600 font-medium">
            {patient.reservationDate && <div>{patient.reservationDate}</div>}
            {patient.reservationTime && <div>{patient.reservationTime}</div>}
          </div>
        )}
      </div>
    </div>
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

// 상담 타입 배지 컴포넌트 - 커스텀 카테고리 지원
const ConsultationTypeBadge = ({
  type,
  inboundPhoneNumber,
  consultationTypes
}: {
  type: string;
  inboundPhoneNumber?: string;
  consultationTypes?: { id: string; label: string }[];
}) => {
  // 카테고리에서 라벨 찾기
  const categoryItem = consultationTypes?.find(item => item.id === type);
  const label = categoryItem?.label || type;

  // 색상 결정 (기본 타입은 특정 색상, 커스텀은 회색 계열)
  const colorClass = type === 'inbound'
    ? 'bg-green-100 text-green-800'
    : type === 'returning'
    ? 'bg-purple-100 text-purple-800'
    : type === 'outbound'
    ? 'bg-orange-100 text-orange-800'
    : 'bg-gray-100 text-gray-800'; // 커스텀 카테고리

  // 아이콘 결정
  const IconComponent = type === 'inbound'
    ? FiPhone
    : type === 'returning'
    ? HiOutlineRefresh
    : FiPhoneCall;

  return (
    <div className="flex items-center space-x-1">
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        <IconComponent className="w-3 h-3 mr-1" />
        {label}
      </span>
      {type === 'inbound' && inboundPhoneNumber && (
        <span className="text-xs text-gray-500" title="입력된 번호">
        </span>
      )}
    </div>
  );
};

// 견적동의 상태 표시 컴포넌트 - 배지 제거하고 금액만 표시
const EstimateAgreementBadge = ({ patient }: { patient: Patient }) => {
  const hasConsultation = patient.consultation && 
    (patient.consultation.estimatedAmount > 0 || patient.consultation.treatmentPlan);
  
  if (!hasConsultation) {
    return <span className="text-sm text-gray-400">-</span>;
  }
  
  const estimatedAmount = patient.consultation?.estimatedAmount;
  
  const formatAmount = (amount?: number) => {
    if (!amount || amount === 0) return '';
    return amount.toLocaleString('ko-KR');
  };
  
  // 🔥 금액만 표시 (배지 제거)
  if (estimatedAmount && estimatedAmount > 0) {
    return (
      <span className="text-sm text-gray-900 font-medium">
        {formatAmount(estimatedAmount)}원
      </span>
    );
  }
  
  return <span className="text-sm text-gray-400">-</span>;
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
      <span className="text-sm text-orange-600">
        {patient.reservationDate}
        {patient.reservationTime && ` ${patient.reservationTime}`}
      </span>
    );
  }
  
  return <span className="text-sm text-gray-400">-</span>;
};

// 총 콜백 횟수 표시를 위한 컴포넌트
const CallbackCountBadge = ({ patient }: { patient: Patient }) => {
  // 🔥 디버깅: 전체 콜백 히스토리 로그
  console.log(`🔍 CallbackCountBadge 디버깅 - 환자: ${patient.name}`);
  console.log('전체 콜백 히스토리:', patient.callbackHistory);
  
  // 🔥 디버깅: 전체 콜백 히스토리 로그
  console.log(`🔍 CallbackCountBadge 디버깅 - 환자: ${patient.name}`);
  console.log('전체 콜백 히스토리:', patient.callbackHistory);
  
  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
    patient.callbackHistory.forEach((cb, index) => {
      console.log(`콜백 ${index + 1} 전체 객체:`, cb);
      console.log(`콜백 ${index + 1} 핵심 필드:`, {
        id: cb.id,
        status: cb.status,
        type: cb.type,
        isCompletionRecord: cb.isCompletionRecord,
        isDirectVisitCompletion: cb.isDirectVisitCompletion,
        date: cb.date,
        notes: cb.notes?.substring(0, 50)
      });
      
      // 🔥 추가: isDirectVisitCompletion 값 특별히 체크
      console.log(`콜백 ${index + 1} isDirectVisitCompletion 상세:`, {
        value: cb.isDirectVisitCompletion,
        type: typeof cb.isDirectVisitCompletion,
        hasProperty: cb.hasOwnProperty('isDirectVisitCompletion'),
        truthyTest: !!cb.isDirectVisitCompletion
      });
    });
  }
  
  // 🔥 기존 필터링 로직 - 단계별 로그 추가
  const allCallbacks = patient.callbackHistory || [];
  console.log(`1단계 - 전체 콜백 수: ${allCallbacks.length}`);
  
  const completedCallbacks = allCallbacks.filter(cb => cb.status === '완료');
  console.log(`2단계 - 완료 상태 콜백 수: ${completedCallbacks.length}`);
  
  const withoutCompletionRecord = completedCallbacks.filter(cb => !cb.isCompletionRecord);
  console.log(`3단계 - 종결 기록 제외 후: ${withoutCompletionRecord.length}`);
  
  const finalCount = withoutCompletionRecord.filter(cb => !cb.isDirectVisitCompletion);
  console.log(`4단계 - 직접 내원완료 제외 후 (최종): ${finalCount.length}`);
  
  const scheduledCallbacks = allCallbacks.filter(cb => cb.status === '예정').length;
  console.log(`예정된 콜백 수: ${scheduledCallbacks}`);
  
  if (finalCount.length === 0) {
    return <span className="text-text-secondary">-</span>;
  }
  
  return (
    <div className="flex items-center gap-1">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
        {finalCount.length}
      </span>
      {scheduledCallbacks > 0 && (
        <span className="text-xs text-orange-600">
          (+{scheduledCallbacks})
        </span>
      )}
    </div>
  );
};

// 🔥 미처리 콜백 체크 헬퍼 함수 추가
const hasOverdueCallbacks = (patient: Patient): boolean => {
  const today = new Date().toISOString().split('T')[0];
  return (patient.callbackHistory || []).some(callback => 
    callback.status === '예정' && 
    callback.date < today
  );
};

export default function PatientList({ isLoading = false, filteredPatients, onSelectPatient }: PatientListProps) {
  const dispatch = useDispatch<AppDispatch>()
  const queryClient = useQueryClient()

  // 🔥 커스텀 카테고리 훅 - 상담타입, 관심분야 라벨 표시용
  const { activeConsultationTypes, activeInterestedServices } = useCategories()

  // 🔥 관심분야 라벨 가져오기 헬퍼 함수
  const getInterestedServiceLabel = (service: string) => {
    const categoryItem = activeInterestedServices.find(item => item.id === service);
    return categoryItem?.label || service;
  }

  const [isMounted, setIsMounted] = useState(false)
  const [tooltipRefreshTrigger, setTooltipRefreshTrigger] = useState(0)
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false)
  const [selectedPatientForReservation, setSelectedPatientForReservation] = useState<Patient | null>(null)
  const [isProcessingReservation, setIsProcessingReservation] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState<Patient | null>(null)
  
  // Redux 상태에서 기본 데이터 가져오기
  const { 
    filteredPatients: reduxFilteredPatients, 
    pagination: { currentPage, totalPages, itemsPerPage, totalItems },
    filters,
    selectedPatient,
    patients,
  } = useSelector((state: RootState) => state.patients)

  const { hideCompletedVisits } = useSelector((state: RootState) => state.ui.visitManagement)
  const { user: currentUser } = useSelector((state: RootState) => state.auth)
  const isMaster = currentUser?.role === 'master'

  // props로 받은 filteredPatients가 있으면 그것을 사용, 없으면 Redux 데이터 사용
  const displayPatientsSource = filteredPatients || reduxFilteredPatients;
  
  // 내원확정 환자 필터링 로직
  const displayPatients = useMemo(() => {
    if (!hideCompletedVisits) {
      return displayPatientsSource;
    }
    
    return displayPatientsSource.filter(patient => !patient.visitConfirmed);
  }, [displayPatientsSource, hideCompletedVisits]);

  // 🔥 통계 계산 - 미처리 콜백 환자 추가
  const stats = useMemo(() => {
    const total = displayPatientsSource.length;
    const visitConfirmed = displayPatientsSource.filter(p => p.visitConfirmed).length;
    const needsPostVisitFollow = displayPatientsSource.filter(p => 
      p.visitConfirmed && p.postVisitStatus === '재콜백필요'
    ).length;
    // 🔥 예약 후 미내원 환자 수 추가
    const postReservationPatients = displayPatientsSource.filter(p => 
      p.hasBeenPostReservationPatient === true  // 🔥 영구 기록 기준
    ).length;
    const todayReservations = displayPatientsSource.filter(p => 
      p.isTodayReservationPatient === true
    ).length;
    // 🔥 미처리 콜백 환자 수 추가
    const overdueCallbacks = displayPatientsSource.filter(p => 
      hasOverdueCallbacks(p)
    ).length;
    
    return { total, visitConfirmed, needsPostVisitFollow, postReservationPatients, todayReservations, overdueCallbacks };
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
  
  // 페이지네이션 계산
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, displayPatients.length)
  const paginatedPatients = displayPatients.slice(startIndex, endIndex)
  
  const handlePageChange = (newPage: number) => {
    dispatch(setPage(newPage))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  // 🆕 환자 클릭 핸들러 추가
  const handlePatientClick = (patientId: string) => {
    console.log('🔥 PatientList - 환자 클릭:', patientId, 'onSelectPatient 존재:', !!onSelectPatient);
    
    // 🔥 임시 데이터인 경우 클릭 방지
    const patient = filteredPatients.find(p => p._id === patientId || p.id === patientId);
    if (patient?.isTemporary) {
      console.warn('임시 환자 데이터는 선택할 수 없습니다. 실제 데이터 대기 중...');
      return;
    }
    
    if (onSelectPatient) {
      // 부모 컴포넌트에서 전달된 핸들러 사용 (상담관리 페이지)
      onSelectPatient(patientId);
    } else {
      // 기본 동작 (다른 곳에서 사용될 때)
      dispatch(selectPatient(patientId));
    }
  };

  // 🔧 기존 handleViewDetails 함수 수정
  const handleViewDetails = (patient: Patient) => {
    const patientId = patient._id || patient.id;
    
    if (!patientId) {
      console.error('환자 ID가 없습니다:', patient);
      return;
    }
    
    console.log('상세 보기 선택:', patientId);
    // 🔧 handlePatientClick 사용으로 변경
    handlePatientClick(patientId);
  }

  // 내원 완료 핸들러
  const handleToggleVisitConfirmation = async (patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const patientId = patient._id || patient.id;
    
    if (!patientId) {
      console.error('환자 ID가 없습니다:', patient);
      return;
    }
    
    console.log('🔥 내원 완료 버튼 클릭:', patientId, '현재 내원확정 상태:', patient.visitConfirmed);
    
    // 내원확정 취소 로직
    if (patient.visitConfirmed) {
      console.log('내원확정 취소 확인 모달 띄우기');
      setSelectedPatientForCancel(patient);
      setIsCancelModalOpen(true);
      return;
    }
    
    // 예약확정 환자의 내원확정 처리
    if (patient.status === '예약확정' && !patient.visitConfirmed) {
      try {
        console.log('🔥 예약확정 환자의 내원확정 처리 - Redux 액션 사용');
        
        const result = await dispatch(toggleVisitConfirmation(patientId));
        
        if (toggleVisitConfirmation.fulfilled.match(result)) {
          console.log('✅ Redux 내원확정 처리 성공');
          
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
    
    // 일반 환자의 내원확정 처리 - 예약일자 모달
    if (!patient.visitConfirmed && patient.status !== '예약확정') {
      console.log('예약일자 입력 모달 띄우기 - 갑작스러운 내원 케이스');
      setSelectedPatientForReservation(patient);
      setIsReservationModalOpen(true);
      return;
    }
  };

  // 예약일자 모달 확인 핸들러 - 🔥 속도 최적화: API 호출 1회로 통합
  const handleReservationConfirm = async (reservationDate: string, reservationTime: string) => {
    if (!selectedPatientForReservation) {
      console.error('선택된 환자가 없습니다.');
      return;
    }

    setIsProcessingReservation(true);

    try {
      const patientId = selectedPatientForReservation._id || selectedPatientForReservation.id;

      console.log('🔥 내원완료 처리 시작 (최적화된 단일 API):', {
        patientId,
        reservationDate,
        reservationTime
      });

      // 🔥 단일 API로 예약완료 + 내원확정 동시 처리 (속도 2배 향상)
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

      const responseData = await reservationResponse.json();
      const updatedPatient = responseData.updatedPatient;

      console.log('✅ 내원완료 처리 성공 (예약완료 + 내원확정 통합)');

      // 🔥 Redux 상태 업데이트 (fetchPatients 대신 직접 업데이트로 속도 향상)
      dispatch(updatePatientDirectly(updatedPatient));

      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setTooltipRefreshTrigger(prev => prev + 1);

      alert(`${selectedPatientForReservation.name} 환자의 예약완료 및 내원확정 처리가 완료되었습니다.`);

      setIsReservationModalOpen(false);
      setSelectedPatientForReservation(null);

    } catch (error) {
      console.error('내원완료 처리 실패:', error);
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

  // 내원확정 취소 확인 핸들러
  const handleConfirmCancelVisit = async (reason: string) => {
    if (!selectedPatientForCancel) {
      console.error('취소할 환자가 선택되지 않았습니다.');
      return;
    }

    setIsProcessingReservation(true);
    
    try {
      const patientId = selectedPatientForCancel._id || selectedPatientForCancel.id;
      
      console.log('🔥 내원확정 취소 처리 시작 (Redux 액션 사용):', patientId);

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

      const cancelResponseData = await cancelResponse.json();
      const updatedPatient = cancelResponseData.updatedPatient || cancelResponseData;

      console.log('✅ 내원확정 취소 API 호출 성공');

      // 🔥 Redux 상태 업데이트 (fetchPatients 대신 직접 업데이트로 속도 향상)
      dispatch(updatePatientDirectly(updatedPatient));

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
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">콜 유입 날짜</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">상태</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">총 콜백 횟수</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">견적금액</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">내원 완료</th>
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
                // 🔥 미처리 콜백 체크 추가
                const hasOverdueCallback = hasOverdueCallbacks(patient);
                
                // 🔥 행 색상 우선순위: 내원완료 > 미처리 콜백 > 오늘 예약 > 예약 후 미내원
                const rowColor = patient.visitConfirmed 
                  ? 'bg-gray-50/70'  // 🔥 내원 완료가 최우선 (음영/실선 효과 없음)
                  : hasOverdueCallback
                  ? 'bg-red-50 border-l-4 border-l-red-500'  // 🔥 미처리 콜백 - 빨간색 (2순위)
                  : patient.isTodayReservationPatient  
                  ? 'bg-green-50 border-l-4 border-l-green-400'  // 오늘 예약 (3순위)
                  : patient.hasBeenPostReservationPatient  
                  ? 'bg-orange-50 border-l-4 border-l-orange-400'  // 예약 후 미내원 (4순위)
                  : patient.consultationType === 'inbound'  
                  ? 'bg-green-50/30'
                  : patient.consultationType === 'returning'
                  ? 'bg-purple-50/30'
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
                    className={`border-b border-border last:border-0 ${rowColor} transition-colors duration-150 ${
                      patient.visitConfirmed ? 'opacity-75' : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      <ConsultationTypeBadge
                        type={patient.consultationType || 'outbound'}
                        inboundPhoneNumber={patient.inboundPhoneNumber}
                        consultationTypes={activeConsultationTypes}
                      />
                    </td>
                    <td className={`px-4 py-4 text-sm font-medium ${isVip ? 'text-purple-800' : 'text-text-primary'}`}>
                      <PatientTooltip
                        patientId={patientId}
                        patientName={patient.name}
                        refreshTrigger={tooltipRefreshTrigger}
                      >
                        <button
                          onClick={() => handlePatientClick(patientId)}
                          className={`flex items-center ${patient.isTemporary ? 'opacity-50 cursor-not-allowed' : 'hover:underline'}`}
                          disabled={patient.isTemporary}
                          title={patient.isTemporary ? '데이터 동기화 중...' : '상세 정보 보기'}
                        >
                          <span>{patient.name}</span>
                          {/* 🔥 이벤트 타겟 표시 추가 */}
                          <EventTargetBadge patient={patient} context="management" />
                          {/* 🔥 미룸 사유 표시 추가 */}
                          {patient.latestPostponementReason && (
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 ml-1 text-amber-600"
                              title={`미룸 사유: ${patient.latestPostponementReason === 'other' ? patient.latestPostponementReasonCustom || '기타' : patient.latestPostponementReason}`}
                            >
                              <HiOutlineExclamationCircle size={14} />
                            </span>
                          )}
                          {/* 🔥 임시 데이터 표시 */}
                          {patient.isTemporary && (
                            <span className="ml-1 text-xs text-orange-500">(동기화 중)</span>
                          )}
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
                            {getInterestedServiceLabel(service)}
                          </span>
                        ))}
                        {(!patient.interestedServices || patient.interestedServices.length === 0) && (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {patient.callInDate || '-'}
                    </td>
                    <td className="px-4 py-4">
                      {/* 🔥 PatientStatusBadge 올바른 위치에 배치 */}
                      <PatientStatusBadge 
                        status={patient.status} 
                        patient={patient}
                      />
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
                        title={patient.visitConfirmed ? "내원완료 취소" : "내원 완료"}
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
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-150 ${
                            patient.isTemporary 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                          onClick={() => handlePatientClick(patientId)}
                          title={patient.isTemporary ? '데이터 동기화 중...' : '상세 정보'}
                          disabled={patient.isTemporary}
                        >
                          <Icon 
                            icon={HiOutlineArrowUp} 
                            size={16} 
                            className="transform rotate-45" 
                          />
                        </button>
                        {isMaster && (
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
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* 페이지네이션 */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border">
        <div className="text-sm text-text-secondary mb-4 sm:mb-0">
          총 {displayPatients.length}개 항목 중 {Math.min(startIndex + 1, displayPatients.length)}-{Math.min(endIndex, displayPatients.length)} 표시
          {hideCompletedVisits && (
            <span className="ml-2 text-gray-500">(내원완료 {stats.visitConfirmed}명 숨김)</span>
          )}
          {/* 🔥 미처리 콜백 환자 수 표시 */}
          {stats.overdueCallbacks > 0 && (
            <span className="ml-2 text-red-600">(미처리 콜백 {stats.overdueCallbacks}명)</span>
          )}
          {/* 🔥 예약 후 미내원 환자 수 표시 */}
          {stats.postReservationPatients > 0 && (
            <span className="ml-2 text-orange-600">(예약 후 미내원 {stats.postReservationPatients}명)</span>
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
          
          {(() => {
            const totalPages = Math.ceil(displayPatients.length / itemsPerPage);
            const pagesPerGroup = 10; // 한 번에 보여줄 페이지 수
            const currentGroup = Math.ceil(currentPage / pagesPerGroup);
            const startPage = (currentGroup - 1) * pagesPerGroup + 1;
            const endPage = Math.min(startPage + pagesPerGroup - 1, totalPages);
            
            const pages = [];
            
            // 현재 그룹의 페이지 번호들을 생성
            for (let i = startPage; i <= endPage; i++) {
              pages.push(
                <button
                  key={i}
                  className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                    currentPage === i ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                  }`}
                  onClick={() => handlePageChange(i)}
                >
                  {i}
                </button>
              );
            }
            
            return pages;
          })()}
          
          <button
            className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
            onClick={() => {
              const totalPages = Math.ceil(displayPatients.length / itemsPerPage);
              const pagesPerGroup = 10;
              const currentGroup = Math.ceil(currentPage / pagesPerGroup);
              const nextGroupStartPage = currentGroup * pagesPerGroup + 1;
              
              if (nextGroupStartPage <= totalPages) {
                handlePageChange(nextGroupStartPage);
              }
            }}
            disabled={(() => {
              const totalPages = Math.ceil(displayPatients.length / itemsPerPage);
              const pagesPerGroup = 10;
              const currentGroup = Math.ceil(currentPage / pagesPerGroup);
              const nextGroupStartPage = currentGroup * pagesPerGroup + 1;
              return nextGroupStartPage > totalPages;
            })()}
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