// src/components/management/PatientDetailModal.tsx - Hook 규칙 위반 수정

'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RootState } from '@/store'
import {
  clearSelectedPatient,
  Patient,
  updateConsultationInfo,
  updatePatient,
  addCallback,
  updateCallback,
  selectPatient,
  updatePatientDirectly
} from '@/store/slices/patientsSlice'
import { HiOutlineX, HiOutlinePhone, HiOutlineCalendar, HiOutlineUser, HiOutlineLocationMarker, HiOutlineCake, HiOutlineClipboardList, HiOutlinePencil, HiOutlineCheck, HiOutlineStop, HiOutlineRefresh, HiOutlineGlobeAlt, HiOutlineUserGroup, HiOutlineCreditCard, HiOutlineCurrencyDollar, HiOutlineClipboardCheck, HiOutlineHeart, HiOutlineGift } from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { formatDistance } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { Icon } from '../common/Icon'
import CallbackManagement from './CallbackManagement'
import PatientEditForm from './PatientEditForm'
import PatientMessageHistory from './PatientMessageHistory'
import MessageSendModal from './MessageSendModal'
import ConsultationFormModal from './ConsultationFormModal'
import FollowUpTab from './FollowUpTab'
import ReferralTab from './ReferralTab'
import { 
  getEstimateAgreedColor, 
  getEstimateAgreedText,
  formatAmount,
  isTreatmentStarted 
} from '@/utils/paymentUtils'
import { ConsultationInfo } from '@/types/patient'
import { useActivityLogger } from '@/hooks/useActivityLogger'
import { PatientDataSync, setupDataSyncListener } from '@/utils/dataSync'
import VisitManagementTab from './VisitManagementTab'
import { useCategories } from '@/hooks/useCategories'

export default function PatientDetailModal() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const selectedPatient = useAppSelector((state: RootState) => state.patients.selectedPatient)
  const modalContext = useAppSelector((state: RootState) => state.patients.modalContext)
  const currentUser = useAppSelector((state: RootState) => state.auth.user)
  const isLoading = useAppSelector((state: RootState) => state.patients.isLoading)
  
  // ✅ 모든 Hook들을 최상단에서 항상 호출 (조건부 호출 금지)
  const { logPatientAction } = useActivityLogger()

  // 🔥 커스텀 카테고리 훅 - 상담타입, 유입경로, 관심분야 라벨 표시용
  const { activeConsultationTypes, activeReferralSources, activeInterestedServices } = useCategories()

  // 상태 관리 Hook들
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [activeTab, setActiveTab] = useState('환자정보')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isMessageSendModalOpen, setIsMessageSendModalOpen] = useState(false)
  const [isConsultationFormOpen, setIsConsultationFormOpen] = useState(false)

  // 🔥 modalContext에 따라 기본 탭 설정 (CTI 전화 수신 시 내원관리 탭 자동 활성화)
  useEffect(() => {
    if (modalContext === 'visit-management' && selectedPatient?.visitConfirmed) {
      console.log('[CTI] 내원관리 컨텍스트로 모달 오픈 - 내원관리 탭 활성화');
      setActiveTab('내원관리');
    }
  }, [modalContext, selectedPatient?.visitConfirmed]);
  
  // 설정값
  const isOptimisticEnabled = true

  // 메모이제이션된 값들 (selectedPatient가 null일 수도 있으므로 안전하게 처리)
  const isVisitConfirmed = useMemo(() => {
    return selectedPatient?.visitConfirmed === true;
  }, [selectedPatient?.visitConfirmed]);

  const needsCallback = useMemo(() => 
    selectedPatient?.status === '콜백필요' || selectedPatient?.status === '부재중',
    [selectedPatient?.status]
  );

  const isCompleted = useMemo(() => {
    if (!selectedPatient) return false;
    const completed = selectedPatient.isCompleted === true || selectedPatient.status === '종결';
    console.log('🔍 종결 상태 확인:', {
      patientName: selectedPatient.name,
      isCompleted: selectedPatient.isCompleted,
      status: selectedPatient.status,
      finalResult: completed,
      forceUpdateTrigger: forceUpdate
    });
    return completed;
  }, [selectedPatient?.isCompleted, selectedPatient?.status, selectedPatient?.name, forceUpdate]);

  const timeSinceLastConsultation = useMemo(() => {
    if (!selectedPatient?.lastConsultation || selectedPatient.lastConsultation === '') return '';
    return formatDistance(
      new Date(selectedPatient.lastConsultation),
      new Date(),
      { addSuffix: true, locale: ko }
    );
  }, [selectedPatient?.lastConsultation]);

  const timeSinceFirstConsult = useMemo(() => {
    if (!selectedPatient?.firstConsultDate || selectedPatient.firstConsultDate === '') return '';
    return formatDistance(
      new Date(selectedPatient.firstConsultDate),
      new Date(),
      { addSuffix: true, locale: ko }
    );
  }, [selectedPatient?.firstConsultDate]);

  // 콜백 함수들
  const handleVisitManagementTabClick = useCallback(() => {
    if (!isVisitConfirmed) {
      alert('내원관리 탭을 사용하려면 먼저 상담관리 메뉴에서 "내원 확정"을 완료해주세요.');
      return;
    }
    setActiveTab('내원관리');
  }, [isVisitConfirmed]);

  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    console.log('탭 변경:', newTab);
  }, []);

  const handleClose = useCallback(() => {
    try {
      PatientDataSync.refreshAll('PatientDetailModal_close');
      setTimeout(() => {
        try {
          PatientDataSync.refreshAll('PatientDetailModal_close_delayed');
        } catch (error) {
          console.warn('지연된 데이터 동기화 실패:', error);
        }
      }, 200);
      
      dispatch(clearSelectedPatient(undefined));
    } catch (error) {
      console.error('모달 닫기 중 오류:', error);
      dispatch(clearSelectedPatient(undefined));
    }
  }, [dispatch]);

  const handleOpenEditModal = useCallback(() => {
    console.log('환자 정보 수정 모달 열기');
    setIsEditModalOpen(true);
  }, []);

  const handleOpenMessageModal = useCallback(() => {
    console.log('문자 발송 모달 열기');
    setIsMessageSendModalOpen(true);
  }, []);

  const refreshPatientData = useCallback(async () => {
    try {
      const patientId = selectedPatient?._id || selectedPatient?.id;
      if (selectedPatient && patientId) {
        console.log('🔄 환자 상세 모달 - 환자 데이터 새로고침 시작');

        // 🔥 성능 최적화: 전체 환자 목록 대신 단일 환자만 조회
        const response = await fetch(`/api/patients/${patientId}`);
        if (response.ok) {
          const updatedPatient = await response.json();
          dispatch(updatePatientDirectly(updatedPatient));
          console.log('✅ 선택된 환자 정보 업데이트 완료:', {
            name: updatedPatient.name,
            status: updatedPatient.status,
            isCompleted: updatedPatient.isCompleted
          });
        }

        setForceUpdate(prev => prev + 1);

        setTimeout(() => {
          try {
            PatientDataSync.refreshAll('PatientDetailModal_refresh');
          } catch (syncError) {
            console.warn('데이터 동기화 트리거 실패:', syncError);
          }
        }, 500);

        console.log('✅ 환자 상세 모달 - 환자 데이터 새로고침 완료');
      }
    } catch (error) {
      console.error('환자 데이터 새로고침 실패:', error);
    }
  }, [dispatch, selectedPatient?._id, selectedPatient?.id]);

  const handleEditSuccess = useCallback(async () => {
    try {
      setActiveTab('환자정보');
      console.log('🔥 환자 정보 수정 완료 - 활동 로그 새로고침 트리거');
      
      await refreshPatientData();
      setRefreshTrigger(prev => prev + 1);
      
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
        console.log('🔥 지연된 활동 로그 새로고침 트리거');
      }, 1000);
    } catch (error) {
      console.error('환자 수정 완료 처리 중 오류:', error);
    }
  }, [refreshPatientData]);

  const handleMessageSendComplete = useCallback(() => {
    setActiveTab('문자내역');
    console.log('문자 발송 완료');
  }, []);

  // 유틸리티 함수들
  const isReservationCompleted = useCallback((patient: Patient) => {
    if (!patient) return false;
    const result = patient.isCompleted && 
          patient.completedReason && 
          patient.completedReason.includes('[예약완료]');
    
    if (result && patient.completedReason) {
      console.log('=== 예약 완료 환자 디버깅 ===');
      console.log('completedReason:', patient.completedReason);
      console.log('contains newline:', patient.completedReason.includes('\n'));
      console.log('completedReason length:', patient.completedReason.length);
      console.log('completedReason split by \\n:', patient.completedReason.split('\n'));
    }
    
    return result;
  }, []);

  const getReservationConsultationNotes = useCallback((patient: Patient) => {
    if (!patient?.completedReason) return '';
    
    const text = patient.completedReason;
    
    let match = text.match(/\[예약완료\]\s*예약일시:\s*[\d-]+\s+[\d:]+\s*상담내용:\s*([\s\S]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    match = text.match(/예약일시:\s*[\d-]+\s+[\d:]+\s*처리일:\s*[\d-]+\s*상담내용:\s*([\s\S]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    match = text.match(/처리일:\s*[\d-]+\s*상담내용:\s*([\s\S]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    match = text.match(/상담내용:\s*([\s\S]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    match = text.match(/\[예약완료\]\s*예약일시:\s*[\d-]+\s+[\d:]+\s*(.*)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return '';
  }, []);
  
  const getReservationInfo = useCallback((patient: Patient) => {
    if (!patient?.completedReason) return '';
    
    const match = patient.completedReason.match(/(?:\[예약완료\]\s*)?(예약일시:\s*[\d-]+\s+[\d:]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
          
    return '';
  }, []);

  const isReservationConfirmed = useCallback(() => {
    if (!selectedPatient) return false;
    return selectedPatient.status === '예약확정' || 
           selectedPatient.reservationDate || 
           isReservationCompleted(selectedPatient);
  }, [selectedPatient?.status, selectedPatient?.reservationDate, isReservationCompleted, selectedPatient]);

  const getTreatmentStatusText = useCallback(() => {
    if (isReservationConfirmed()) {
      return '예약 완료';
    } else if (selectedPatient?.consultation?.estimateAgreed) {
      return '치료 동의';
    } else {
      return '치료 미시작';
    }
  }, [isReservationConfirmed, selectedPatient?.consultation?.estimateAgreed]);

  const getTreatmentStatusColor = useCallback(() => {
    if (isReservationConfirmed()) {
      return 'text-orange-600';
    } else if (selectedPatient?.consultation?.estimateAgreed) {
      return 'text-green-600';
    } else {
      return 'text-red-600';
    }
  }, [isReservationConfirmed, selectedPatient?.consultation?.estimateAgreed]);

  const getStatusColor = useCallback((status: string) => {
    const colorMap: Record<string, string> = {
      '잠재고객': 'bg-orange-100 text-orange-800',
      '콜백필요': 'bg-yellow-100 text-yellow-800',
      '부재중': 'bg-orange-100 text-orange-800',
      '활성고객': 'bg-green-100 text-green-800',
      'VIP': 'bg-purple-100 text-purple-800',
      '예약확정': 'bg-indigo-100 text-indigo-800',
      '재예약확정': 'bg-purple-100 text-purple-800',
      '종결': 'bg-gray-100 text-gray-800',
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800'
  }, []);

  const StatusBadge = useCallback(({ status }: { status: string }) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  ), [getStatusColor]);

  const ReminderBadge = useCallback(({ status }: { status: string }) => {
    if (status === '-') {
      return <span className="text-text-secondary">-</span>
    }
  
    const colorMap: Record<string, string> = {
      '초기': 'text-text-secondary',
      '1차': 'bg-orange-100 text-orange-800',
      '2차': 'bg-orange-200 text-orange-900',
      '3차': 'bg-red-100 text-red-800',
      '4차': 'bg-red-200 text-red-900',
      '5차': 'bg-red-300 text-red-900',
    }
  
    const isNumeric = ['1차', '2차', '3차', '4차', '5차'].includes(status)
  
    if (isNumeric) {
      return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${colorMap[status]}`}>
          {status.charAt(0)}
        </span>
      )
    }

    return <span className={`text-sm ${colorMap[status]}`}>{status}</span>
  }, []);

  const getReferralSourceText = useCallback((source?: string) => {
    if (!source || source === '') return '-';
    // 커스텀 카테고리에서 라벨 찾기
    const categoryItem = activeReferralSources.find(item => item.id === source);
    return categoryItem?.label || source;
  }, [activeReferralSources]);

  // 🔥 관심분야 라벨 가져오기 (ID 또는 라벨 둘 다 지원)
  const getInterestedServiceLabel = useCallback((service: string) => {
    // ID로 저장된 경우 라벨 찾기
    const categoryItem = activeInterestedServices.find(item => item.id === service);
    if (categoryItem) return categoryItem.label;
    // 이미 라벨로 저장된 경우 그대로 반환
    return service;
  }, [activeInterestedServices]);

  const getUserDisplayName = useCallback((userId?: string, userName?: string) => {
    console.log('🔍 getUserDisplayName 호출:', { userId, userName });
    
    if (!userId && !userName) return '정보 없음';
    if (userName && userName.trim() !== '') return userName;
    if (userId === 'system') return '시스템';
    if (userId && userId.trim() !== '') return `${userId} (ID)`;
    return '정보 없음';
  }, []);

  const formatLastModified = useCallback((dateString?: string) => {
    if (!dateString) return '';
    try {
      return formatDistance(new Date(dateString), new Date(), { 
        addSuffix: true, 
        locale: ko 
      });
    } catch {
      return dateString;
    }
  }, []);

  // Mutation 정의
  const consultationUpdateMutation = useMutation({
    mutationFn: async ({ consultationData, additionalData }: {
      consultationData: Partial<ConsultationInfo>,
      additionalData?: {
        reservationDate?: string
        reservationTime?: string
        callbackDate?: string
        callbackTime?: string
        callbackNotes?: string
        isEditMode?: boolean
        existingCallbackId?: string
      }
    }) => {
      if (!selectedPatient) throw new Error('환자 정보가 없습니다.');

      console.log('🔥 상담 정보 업데이트 시작:', {
        consultationData,
        additionalData,
        isEditMode: additionalData?.isEditMode
      });

      const consultationResult = await dispatch(updateConsultationInfo({
        patientId: selectedPatient._id || selectedPatient.id,
        consultationData
      })).unwrap();

      if (consultationData.estimateAgreed === true && additionalData?.reservationDate && additionalData?.reservationTime) {
        await dispatch(updatePatient({
          patientId: selectedPatient._id || selectedPatient.id,
          patientData: {
            status: '예약확정',
            reservationDate: additionalData.reservationDate,
            reservationTime: additionalData.reservationTime
          }
        })).unwrap();
      }

      if (consultationData.estimateAgreed === false && additionalData?.callbackDate) {
        if (additionalData.isEditMode && additionalData.existingCallbackId) {
          console.log('🔥 기존 1차 콜백 업데이트:', additionalData.existingCallbackId);
          await dispatch(updateCallback({
            patientId: selectedPatient._id || selectedPatient.id,
            callbackId: additionalData.existingCallbackId,
            updateData: {
              date: additionalData.callbackDate,
              time: additionalData.callbackTime,
              notes: additionalData.callbackNotes || '1차 콜백 - 견적 재검토',
              status: '예정'
            }
          })).unwrap();
        } else {
          console.log('🔥 새로운 1차 콜백 생성');
          await dispatch(addCallback({
            patientId: selectedPatient._id || selectedPatient.id,
            callbackData: {
              type: '1차',
              date: additionalData.callbackDate,
              time: additionalData.callbackTime,
              status: '예정',
              notes: additionalData.callbackNotes || '1차 콜백 - 견적 재검토',
              isVisitManagementCallback: false,
              completedTime: false,
              createdAt: '',
              completedDate: ''
            }
          })).unwrap();
        }
      }

      return { consultationResult, consultationData, additionalData };
    },
    onMutate: async ({ consultationData, additionalData }) => {
      if (!selectedPatient) return;

      try {
        await queryClient.cancelQueries({ queryKey: ['patients'] });
        const previousPatients = queryClient.getQueryData(['patients']);

        queryClient.setQueryData(['patients'], (oldData: any) => {
          if (!oldData) return oldData;

          const patientId = selectedPatient._id || selectedPatient.id;

          if (oldData.patients && Array.isArray(oldData.patients)) {
            return {
              ...oldData,
              patients: oldData.patients.map((p: any) => 
                (p._id === patientId || p.id === patientId) 
                  ? { 
                      ...p, 
                      consultation: { ...(p.consultation || {}), ...consultationData },
                      ...(consultationData.estimateAgreed === true && additionalData?.reservationDate ? {
                        status: '예약확정',
                        reservationDate: additionalData.reservationDate,
                        reservationTime: additionalData.reservationTime
                      } : {}),
                      updatedAt: new Date().toISOString()
                    }
                  : p
              )
            };
          }

          return oldData;
        });

        alert('상담 정보가 저장되었습니다.');
        setForceUpdate(prev => prev + 1);

        return { previousPatients, consultationData, additionalData };
      } catch (error) {
        console.error('Optimistic update 실패:', error);
        throw error;
      }
    },
    onSuccess: async (result, variables, context) => {
      if (!selectedPatient) return;

      try {
        PatientDataSync.onConsultationUpdate(selectedPatient._id || selectedPatient.id, 'PatientDetailModal');

        await logPatientAction(
          'consultation_update',
          selectedPatient._id || selectedPatient.id,
          selectedPatient.name,
          {
            patientId: selectedPatient._id || selectedPatient.id,
            patientName: selectedPatient.name,
            consultationData: variables.consultationData,
            additionalData: variables.additionalData,
            handledBy: currentUser?.name,
            notes: `상담 정보 업데이트 완료 (${variables.additionalData?.isEditMode ? '수정' : '신규'})`
          }
        );
        console.log('✅ 상담 정보 업데이트 활동 로그 기록 성공');
      } catch (logError) {
        console.warn('⚠️ 활동 로그 기록 실패:', logError);
      }
    },
    onError: async (error, variables, context) => {
      try {
        if (context?.previousPatients) {
          queryClient.setQueryData(['patients'], context.previousPatients);
        }

        console.error('상담 정보 저장 실패:', error);
        alert('상담 정보 저장에 실패했습니다.');

        if (selectedPatient) {
          try {
            await logPatientAction(
              'consultation_update',
              selectedPatient._id || selectedPatient.id,
              selectedPatient.name,
              {
                patientId: selectedPatient._id || selectedPatient.id,
                patientName: selectedPatient.name,
                error: error instanceof Error ? error.message : '알 수 없는 오류',
                attemptedBy: currentUser?.name,
                notes: '상담 정보 업데이트 실패'
              }
            );
          } catch (logError) {
            console.warn('활동 로그 기록 실패:', logError);
          }
        }
      } catch (rollbackError) {
        console.error('에러 처리 중 추가 오류:', rollbackError);
      }
    },
    onSettled: () => {
      try {
        queryClient.invalidateQueries({ queryKey: ['patients'] });
      } catch (error) {
        console.warn('쿼리 무효화 실패:', error);
      }
    }
  });

  const handleConsultationUpdateTraditional = useCallback(async (
    consultationData: Partial<ConsultationInfo>, 
    additionalData?: {
      reservationDate?: string
      reservationTime?: string
      callbackDate?: string
      callbackTime?: string
      callbackNotes?: string
      isEditMode?: boolean
      existingCallbackId?: string
    }
  ) => {
    try {
      if (!selectedPatient) return;
      
      console.log('🔥 상담 정보 업데이트 시작:', {
        patientId: selectedPatient._id,
        patientName: selectedPatient.name,
        consultationData,
        additionalData
      });
      
      await dispatch(updateConsultationInfo({
        patientId: selectedPatient._id || selectedPatient.id,
        consultationData
      })).unwrap();
      
      if (consultationData.estimateAgreed === true && additionalData?.reservationDate && additionalData?.reservationTime) {
        console.log('🔥 예약완료 처리 시작:', {
          reservationDate: additionalData.reservationDate,
          reservationTime: additionalData.reservationTime
        });
        
        await dispatch(updatePatient({
          patientId: selectedPatient._id || selectedPatient.id,
          patientData: {
            status: '예약확정',
            reservationDate: additionalData.reservationDate,
            reservationTime: additionalData.reservationTime
          }
        })).unwrap();
        
        console.log('✅ 예약완료 처리 성공');
      }
      
      if (consultationData.estimateAgreed === false && additionalData?.callbackDate) {
        if (additionalData.isEditMode && additionalData.existingCallbackId) {
          console.log('🔥 기존 1차 콜백 업데이트:', {
            callbackId: additionalData.existingCallbackId,
            callbackDate: additionalData.callbackDate,
            callbackTime: additionalData.callbackTime,
            callbackNotes: additionalData.callbackNotes
          });
          
          await dispatch(updateCallback({
            patientId: selectedPatient._id || selectedPatient.id,
            callbackId: additionalData.existingCallbackId,
            updateData: {
              date: additionalData.callbackDate,
              time: additionalData.callbackTime,
              notes: additionalData.callbackNotes || '1차 콜백 - 견적 재검토',
              status: '예정'
            }
          })).unwrap();
          
          console.log('✅ 기존 1차 콜백 업데이트 성공');
        } else {
          console.log('🔥 새로운 1차 콜백 등록 시작:', {
            callbackDate: additionalData.callbackDate,
            callbackTime: additionalData.callbackTime,
            callbackNotes: additionalData.callbackNotes
          });
          
          await dispatch(addCallback({
            patientId: selectedPatient._id || selectedPatient.id,
            callbackData: {
              type: '1차',
              date: additionalData.callbackDate,
              time: additionalData.callbackTime,
              status: '예정',
              notes: additionalData.callbackNotes || '1차 콜백 - 견적 재검토',
              isVisitManagementCallback: false,
              completedTime: false,
              createdAt: '',
              completedDate: ''
            }
          })).unwrap();
          
          console.log('✅ 새로운 1차 콜백 등록 성공');
        }
      }
      
      PatientDataSync.onConsultationUpdate(selectedPatient._id || selectedPatient.id, 'PatientDetailModal_traditional');
      setForceUpdate(prev => prev + 1);
      await refreshPatientData();
      
      console.log('🔥 상담 정보 업데이트 완료 - 모든 처리 성공');
      alert('상담 정보가 저장되었습니다.');
    } catch (error) {
      console.error('상담 정보 저장 실패:', error);
      alert('상담 정보 저장에 실패했습니다.');
      throw error;
    }
  }, [dispatch, selectedPatient, refreshPatientData]);

  const handleConsultationUpdateOptimistic = useCallback(async (
    consultationData: Partial<ConsultationInfo>, 
    additionalData?: {
      reservationDate?: string
      reservationTime?: string
      callbackDate?: string
      callbackTime?: string
      callbackNotes?: string
      isEditMode?: boolean
      existingCallbackId?: string
    }
  ) => {
    consultationUpdateMutation.mutate({ consultationData, additionalData });
  }, [consultationUpdateMutation]);

  const handleConsultationUpdate = useMemo(() => 
    isOptimisticEnabled ? handleConsultationUpdateOptimistic : handleConsultationUpdateTraditional,
    [isOptimisticEnabled, handleConsultationUpdateOptimistic, handleConsultationUpdateTraditional]
  );

  // Effect Hook들
  useEffect(() => {
    if (selectedPatient && modalContext) {
      if (modalContext === 'visit-management') {
        setActiveTab('내원관리');
        console.log('내원관리 페이지에서 열림 - 내원관리 탭으로 설정');
      } else if (modalContext === 'management') {
        setActiveTab('환자정보');
        console.log('상담관리 페이지에서 열림 - 환자정보 탭으로 설정');
      }
    } else {
      setActiveTab('환자정보');
    }
  }, [selectedPatient?._id, modalContext]);

  useEffect(() => {
    console.log('📡 PatientDetailModal: 데이터 동기화 리스너 설정 시작');
    
    let cleanup: (() => void) | undefined;
    
    try {
      cleanup = setupDataSyncListener(queryClient);
    } catch (error) {
      console.error('데이터 동기화 리스너 설정 실패:', error);
    }
    
    const handlePatientDataChange = (event: Event) => {
      try {
        const customEvent = event as CustomEvent;
        const { patientId, type } = customEvent.detail || {};
        
        if (selectedPatient && (selectedPatient._id === patientId || selectedPatient.id === patientId)) {
          console.log('🔄 데이터 새로고침 트리거:', { type, patientId });
          
          if (['patient_complete', 'callback_update', 'callback_delete'].includes(type)) {
            setTimeout(() => {
              refreshPatientData();
              setForceUpdate(prev => prev + 1);
            }, 100);
          }
        }
      } catch (error) {
        console.error('환자 데이터 변경 이벤트 처리 실패:', error);
      }
    };
    
    if (typeof window !== 'undefined') {
      console.log('📡 데이터 동기화 리스너 등록 완료');
      window.addEventListener('patientDataChanged', handlePatientDataChange);
      
      return () => {
        try {
          if (cleanup) cleanup();
          window.removeEventListener('patientDataChanged', handlePatientDataChange);
          console.log('📡 PatientDetailModal: 모든 리스너 해제');
        } catch (error) {
          console.error('리스너 해제 중 오류:', error);
        }
      };
    }
    
    return cleanup;
  }, [queryClient, selectedPatient?._id, refreshPatientData]);

  useEffect(() => {
    if (selectedPatient) {
      console.log('환자 상세 정보 표시:', selectedPatient.name);
      console.log('환자 종결 상태:', selectedPatient.isCompleted);
      console.log('환자 상태:', selectedPatient.status);
      console.log('🔥 환자 상세 정보 업데이트:', {
        name: selectedPatient.name,
        hasConsultation: !!selectedPatient.consultation,
        estimateAgreed: selectedPatient.consultation?.estimateAgreed,
        forceUpdateTrigger: forceUpdate
      });
      
      console.log('🔍 메모 필드 확인:', {
        notes: selectedPatient.notes,
        memo: selectedPatient.memo,
        hasNotes: !!selectedPatient.notes,
        hasMemo: !!selectedPatient.memo,
        notesType: typeof selectedPatient.notes,
        memoType: typeof selectedPatient.memo
      });
      
      setRefreshTrigger(0);
    }
  }, [selectedPatient?._id, selectedPatient?.name, selectedPatient?.status, forceUpdate]);

  // ✅ 조건부 렌더링을 모든 Hook 호출 후에 배치
  if (!selectedPatient) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">
              환자 상세: {selectedPatient.name}
            </h2>
            <StatusBadge status={isCompleted ? '종결' : selectedPatient.status} />
            <ReminderBadge status={selectedPatient.reminderStatus} />
            {(() => {
              const consultationType = selectedPatient.consultationType || 'outbound';
              const categoryItem = activeConsultationTypes.find(item => item.id === consultationType);
              const label = categoryItem?.label || consultationType;

              // 색상 결정 (기본 타입은 특정 색상, 커스텀은 회색 계열)
              const colorClass = consultationType === 'inbound'
                ? 'bg-green-100 text-green-800'
                : consultationType === 'returning'
                ? 'bg-purple-100 text-purple-800'
                : consultationType === 'outbound'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-gray-100 text-gray-800'; // 커스텀 카테고리

              // 아이콘 결정
              const IconComponent = consultationType === 'inbound'
                ? FiPhone
                : consultationType === 'returning'
                ? HiOutlineRefresh
                : FiPhoneCall;

              return (
                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                  <IconComponent className="w-3 h-3 mr-1" />
                  {label}
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="text-primary hover:text-primary-dark flex items-center gap-1"
              onClick={handleOpenMessageModal}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">문자 발송</span>
            </button>
            <button 
              className="text-text-secondary hover:text-primary flex items-center gap-1"
              onClick={handleOpenEditModal}
            >
              <Icon icon={HiOutlinePencil} size={18} />
              <span className="text-sm">수정</span>
            </button>
            <button 
              className="text-text-secondary hover:text-text-primary ml-4" 
              onClick={handleClose}
            >
              <Icon icon={HiOutlineX} size={20} />
            </button>
          </div>
        </div>
        
        {/* 탭 메뉴 */}
        <div className="px-6 pt-4 border-b border-border flex items-center">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === '환자정보'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => handleTabChange('환자정보')}
          >
            환자 정보
            {activeTab === '환자정보' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === '상담관리'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => handleTabChange('상담관리')}
          >
            상담관리
            {activeTab === '상담관리' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              !isVisitConfirmed 
                ? 'text-gray-400 cursor-not-allowed'
                : activeTab === '내원관리'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => handleTabChange('내원관리')}
            disabled={!isVisitConfirmed}
            title={!isVisitConfirmed ? '내원 확정 후 이용 가능합니다' : ''}
          >
            내원관리
            {!isVisitConfirmed && (
              <span className="ml-1 text-xs">🔒</span>
            )}
            {activeTab === '내원관리' && isVisitConfirmed && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              !isVisitConfirmed
                ? 'text-gray-400 cursor-not-allowed'
                : activeTab === '사후관리'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => isVisitConfirmed && handleTabChange('사후관리')}
            disabled={!isVisitConfirmed}
            title={!isVisitConfirmed ? '내원 확정 후 이용 가능합니다' : ''}
          >
            사후관리
            {!isVisitConfirmed && (
              <span className="ml-1 text-xs">🔒</span>
            )}
            {activeTab === '사후관리' && isVisitConfirmed && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === '소개관리'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => handleTabChange('소개관리')}
          >
            소개관리
            {activeTab === '소개관리' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === '문자내역'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => handleTabChange('문자내역')}
          >
            문자내역
            {activeTab === '문자내역' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
        </div>
        
        {/* 모달 바디 */}
        <div className="p-6">
          {/* 환자 기본 정보 탭 */}
          {activeTab === '환자정보' && (
            <div className="space-y-6">
              {/* 기본 정보 카드 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">기본 정보</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 환자 ID */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineUser} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">환자 ID</p>
                      <p className="text-text-primary">{selectedPatient.patientId}</p>
                    </div>
                  </div>
                  
                  {/* 연락처 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlinePhone} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">연락처</p>
                      <p className="text-text-primary">{selectedPatient.phoneNumber}</p>
                    </div>
                  </div>
                  
                  {/* 상담 타입 정보 */}
                  {(() => {
                    const consultationType = selectedPatient.consultationType || 'outbound';
                    const categoryItem = activeConsultationTypes.find(item => item.id === consultationType);
                    const label = categoryItem?.label || consultationType;
                    const IconComponent = consultationType === 'inbound'
                      ? FiPhone
                      : consultationType === 'returning'
                      ? HiOutlineRefresh
                      : FiPhoneCall;

                    return (
                      <div className="flex items-start gap-2">
                        <Icon
                          icon={IconComponent}
                          size={18}
                          className="text-text-muted mt-0.5"
                        />
                        <div>
                          <p className="text-sm text-text-secondary">상담 타입</p>
                          <div className="flex items-center gap-2">
                            <p className="text-text-primary">{label}</p>
                            <button
                              className="text-xs text-primary hover:text-primary-dark underline"
                              onClick={handleOpenEditModal}
                              title="상담 타입을 변경하려면 수정 모달에서 변경할 수 있습니다"
                            >
                              변경
                            </button>
                            {consultationType === 'inbound' && selectedPatient.inboundPhoneNumber && (
                              <span className="text-xs text-gray-500">
                                (입력번호: {selectedPatient.inboundPhoneNumber})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* 유입경로 정보 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineGlobeAlt} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">유입경로</p>
                      <p className="text-text-primary">{getReferralSourceText(selectedPatient.referralSource)}</p>
                    </div>
                  </div>
                  
                  {/* 나이 */}
                  {selectedPatient.age && (
                    <div className="flex items-start gap-2">
                      <Icon 
                        icon={HiOutlineCake} 
                        size={18} 
                        className="text-text-muted mt-0.5" 
                      />
                      <div>
                        <p className="text-sm text-text-secondary">나이</p>
                        <p className="text-text-primary">{selectedPatient.age}세</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 지역 */}
                  {selectedPatient.region && (
                    <div className="flex items-start gap-2">
                      <Icon 
                        icon={HiOutlineLocationMarker} 
                        size={18} 
                        className="text-text-muted mt-0.5" 
                      />
                      <div>
                        <p className="text-sm text-text-secondary">거주지역</p>
                        <p className="text-text-primary">
                          {selectedPatient.region.province}
                          {selectedPatient.region.city && ` ${selectedPatient.region.city}`}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* 콜 유입 날짜 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineCalendar} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">DB 유입 날짜</p>
                      <p className="text-text-primary">{selectedPatient.callInDate}</p>
                    </div>
                  </div>
                  
                  {/* 첫 상담 날짜 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineCalendar} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">첫 상담 날짜</p>
                      <p className="text-text-primary">
                        {selectedPatient.firstConsultDate && selectedPatient.firstConsultDate !== '' 
                          ? `${selectedPatient.firstConsultDate} (${timeSinceFirstConsult})`
                          : '-'}
                      </p>
                    </div>
                  </div>
                  
                  {/* 마지막 상담 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineCalendar} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">마지막 상담</p>
                      <p className="text-text-primary">
                        {selectedPatient.lastConsultation && selectedPatient.lastConsultation !== '' 
                          ? `${selectedPatient.lastConsultation} (${timeSinceLastConsultation})`
                          : '-'}
                      </p>
                    </div>
                  </div>
                  
                  {/* 관심 분야 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineClipboardList} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">관심 분야</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPatient.interestedServices.map((service, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-light-bg text-text-primary"
                          >
                            {getInterestedServiceLabel(service)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>              
              
              {/* 상담/결제 정보 카드 */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-text-primary flex items-center gap-2">
                    <Icon icon={HiOutlineCreditCard} size={18} className="text-green-600" />
                    최초 상담 기록
                  </h3>
                  <button
                    onClick={() => setIsConsultationFormOpen(true)}
                    className="text-sm text-orange-600 hover:text-orange-800 underline"
                    disabled={consultationUpdateMutation.isPending}
                  >
                    {selectedPatient.consultation ? '수정' : '+ 추가'}
                  </button>
                </div>
                
                {selectedPatient.consultation ? (
                  <div className="space-y-4">
                    {/* 상담 기본 정보 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <Icon 
                          icon={HiOutlineCalendar} 
                          size={18} 
                          className="text-text-muted mt-0.5" 
                        />
                        <div>
                          <p className="text-sm text-text-secondary">상담 날짜</p>
                          <p className="text-text-primary">{selectedPatient.consultation.consultationDate}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Icon 
                          icon={HiOutlineCurrencyDollar} 
                          size={18} 
                          className="text-text-muted mt-0.5" 
                        />
                        <div>
                          <p className="text-sm text-text-secondary">견적 금액</p>
                          <p className="text-text-primary font-medium">
                            {formatAmount(selectedPatient.consultation.estimatedAmount)}원
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* 견적 동의 현황 */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Icon icon={HiOutlineClipboardCheck} size={16} />
                        견적 동의 현황
                      </h4>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">동의 여부</p>
                          <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
                            getEstimateAgreedColor(selectedPatient.consultation.estimateAgreed)
                          }`}>
                            {getEstimateAgreedText(selectedPatient.consultation.estimateAgreed)}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600 mb-1">치료 상태</p>
                          <p className={`text-sm font-medium ${getTreatmentStatusColor()}`}>
                            {getTreatmentStatusText()}
                          </p>
                        </div>
                      </div>
                      
                      {/* 예약 정보 표시 */}
                      {isReservationConfirmed() && (selectedPatient.reservationDate || selectedPatient.reservationTime) && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-600 mb-1">예약 정보</p>
                          <p className="text-sm font-medium text-orange-600">
                            📅 {selectedPatient.reservationDate} {selectedPatient.reservationTime}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* 추가 정보 */}
                    {(selectedPatient.consultation.treatmentPlan ||
                      selectedPatient.consultation.consultationNotes) && (
                      <div className="grid grid-cols-1 gap-4 pt-2 border-t">
                        {selectedPatient.consultation.treatmentPlan && (
                          <div>
                            <p className="text-sm text-text-secondary">불편한 부분</p>
                            <p className="text-text-primary whitespace-pre-line">
                              {selectedPatient.consultation.treatmentPlan}
                            </p>
                          </div>
                        )}
                        
                        {selectedPatient.consultation.consultationNotes && (
                          <div>
                            <p className="text-sm text-text-secondary">상담 메모</p>
                            <p className="text-text-primary whitespace-pre-line">
                              {selectedPatient.consultation.consultationNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-secondary">
                    <Icon icon={HiOutlineCreditCard} size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="mb-2">최초 상담 기록이 없습니다.</p>
                    <button
                      onClick={() => setIsConsultationFormOpen(true)}
                      className="text-orange-600 hover:text-orange-800 underline"
                      disabled={consultationUpdateMutation.isPending}
                    >
                      최초 상담 정보 추가하기
                    </button>
                  </div>
                )}
              </div>

              {/* 담당자 정보 카드 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">담당자 정보</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 등록 담당자 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineUserGroup} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">등록 담당자</p>
                      <p className="text-text-primary">
                        {getUserDisplayName(selectedPatient.createdBy, selectedPatient.createdByName)}
                      </p>
                      {selectedPatient.createdAt && (
                        <p className="text-xs text-text-muted">
                          {selectedPatient.createdAt} 등록
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* 최종 수정자 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlinePencil} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">최종 수정자</p>
                      <p className="text-text-primary">
                        {getUserDisplayName(selectedPatient.lastModifiedBy, selectedPatient.lastModifiedByName)}
                      </p>
                      {selectedPatient.lastModifiedAt && (
                        <p className="text-xs text-text-muted">
                          {formatLastModified(selectedPatient.lastModifiedAt)} 수정
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 콜백 필요 알림 */}
              {needsCallback && !isCompleted && (
                <div className="card bg-yellow-50 border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-md font-semibold text-yellow-800 mb-1">콜백 필요</h3>
                      <p className="text-yellow-600">이 환자는 콜백이 필요합니다. 콜백 관리 탭에서 다음 콜백을 예약해주세요.</p>
                    </div>
                    <button
                      className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
                      onClick={() => handleTabChange('상담관리')}
                    >
                      상담 관리로 이동
                    </button>
                  </div>
                </div>
              )}

              {/* 종결 처리 알림 */}
              {isCompleted && (
                <div className={`card ${
                  isReservationCompleted(selectedPatient)
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${
                      isReservationCompleted(selectedPatient)
                        ? 'bg-green-200 text-green-700'
                        : 'bg-gray-200 text-gray-700'
                    } flex items-center justify-center`}>
                      <Icon icon={isReservationCompleted(selectedPatient) ? HiOutlineCheck : HiOutlineStop} size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-md font-semibold ${
                        isReservationCompleted(selectedPatient) ? 'text-green-800' : 'text-gray-800'
                      }`}>
                        {isReservationCompleted(selectedPatient)
                          ? '이 환자는 예약 완료되었습니다'
                          : '이 환자는 종결 처리되었습니다'}
                      </h3>
                      
                      {isReservationCompleted(selectedPatient) ? (
                        <div className="mt-1 space-y-2">
                          {getReservationInfo(selectedPatient) && (
                            <p className="text-sm text-green-600 font-medium">
                              {getReservationInfo(selectedPatient)}
                            </p>
                          )}
                          
                          {getReservationConsultationNotes(selectedPatient) && (
                            <p className="text-sm text-green-600">
                              상담내용: {getReservationConsultationNotes(selectedPatient)}
                            </p>
                          )}
                        </div>
                      ) : selectedPatient.completedReason ? (
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
                          상담내용: {selectedPatient.completedReason}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">
                          {isReservationCompleted(selectedPatient)
                            ? '예약 정보가 기록되지 않았습니다.'
                            : '종결 사유가 기록되지 않았습니다.'}
                        </p>
                      )}
                      
                      {selectedPatient.completedAt && (
                        <p className={`text-xs ${
                          isReservationCompleted(selectedPatient) ? 'text-green-500' : 'text-gray-500'
                        } mt-2`}>
                          {isReservationCompleted(selectedPatient) ? '예약 확정일: ' : '종결일: '}{selectedPatient.completedAt}
                        </p>
                      )}
                    </div>
                    <button
                      className={`px-4 py-2 ${
                        isReservationCompleted(selectedPatient)
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-gray-500 hover:bg-gray-600'
                      } text-white rounded-md transition-colors flex items-center gap-2`}
                      onClick={() => handleTabChange('상담관리')}
                    >
                      <Icon icon={HiOutlineRefresh} size={18} />
                      <span>{isReservationCompleted(selectedPatient) ? '예약 취소' : '종결 취소'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 상담관리 탭 */}
          {activeTab === '상담관리' && (
            <CallbackManagement patient={selectedPatient} />
          )}
          
          {/* 내원관리 탭 */}
          {activeTab === '내원관리' && (
            <VisitManagementTab patient={selectedPatient} />
          )}

          {/* 사후관리 탭 */}
          {activeTab === '사후관리' && (
            <FollowUpTab patient={selectedPatient} />
          )}

          {/* 소개관리 탭 */}
          {activeTab === '소개관리' && (
            <ReferralTab patient={selectedPatient} />
          )}

          {/* 문자내역 탭 */}
          {activeTab === '문자내역' && (
            <PatientMessageHistory patient={selectedPatient} />
          )}
        </div>
      </div>
      
      {/* 환자 수정 모달 */}
      {isEditModalOpen && (
        <PatientEditForm 
          key={`edit-${selectedPatient._id}-${refreshTrigger}`}
          patient={selectedPatient} 
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            handleEditSuccess();
          }}
        />
      )}
      
      {/* 문자 발송 모달 */}
      {isMessageSendModalOpen && (
        <MessageSendModal 
          isOpen={isMessageSendModalOpen}
          onClose={() => setIsMessageSendModalOpen(false)}
          selectedPatients={[selectedPatient]}
          onSendComplete={handleMessageSendComplete}
        />
      )}
      
      {/* 상담 정보 모달 */}
      {isConsultationFormOpen && (
        <ConsultationFormModal
          isOpen={isConsultationFormOpen}
          onClose={() => setIsConsultationFormOpen(false)}
          patientId={selectedPatient._id}
          patientName={selectedPatient.name}
          existingConsultation={selectedPatient.consultation}
          patientCallbackHistory={selectedPatient.callbackHistory}
          patientReservationDate={selectedPatient.reservationDate}  // 🔥 이름 수정
          patientReservationTime={selectedPatient.reservationTime}  // 🔥 이름 수정
          onSave={handleConsultationUpdate}
        />
      )}
    </div>
  )
}