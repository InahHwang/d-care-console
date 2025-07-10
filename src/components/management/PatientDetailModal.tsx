// src/components/management/PatientDetailModal.tsx - 실시간 데이터 동기화 추가

'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RootState } from '@/store'
import { 
  clearSelectedPatient, 
  Patient, 
  updateConsultationInfo,
  updatePatient,
  addCallback,
  fetchPatients,
  selectPatient
} from '@/store/slices/patientsSlice'
import { HiOutlineX, HiOutlinePhone, HiOutlineCalendar, HiOutlineUser, HiOutlineLocationMarker, HiOutlineCake, HiOutlineClipboardList, HiOutlinePencil, HiOutlineCheck, HiOutlineStop, HiOutlineRefresh, HiOutlineGlobeAlt, HiOutlineUserGroup, HiOutlineCreditCard, HiOutlineCurrencyDollar, HiOutlineClipboardCheck } from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { formatDistance } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { Icon } from '../common/Icon'
import CallbackManagement from './CallbackManagement'
import PatientEditForm from './PatientEditForm'
import PatientMessageHistory from './PatientMessageHistory'
import MessageSendModal from './MessageSendModal'
import ConsultationFormModal from './ConsultationFormModal'
import { 
  getEstimateAgreedColor, 
  getEstimateAgreedText,
  formatAmount,
  isTreatmentStarted 
} from '@/utils/paymentUtils'
import { ConsultationInfo } from '@/types/patient'
import { useActivityLogger } from '@/hooks/useActivityLogger'
// 🔥 데이터 동기화 유틸리티 import 추가
import { PatientDataSync, setupDataSyncListener } from '@/utils/dataSync'

export default function PatientDetailModal() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const selectedPatient = useAppSelector((state: RootState) => state.patients.selectedPatient)
  const currentUser = useAppSelector((state: RootState) => state.auth.user)
  const isLoading = useAppSelector((state: RootState) => state.patients.isLoading)
  
  // 🔥 활동 로깅 훅 추가
  const { logPatientAction } = useActivityLogger()
  
  // 🔥 활동 로그 업데이트 트리거를 위한 상태
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  // 🔥 강제 리렌더링을 위한 상태 추가
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // 탭 상태 관리
  const [activeTab, setActiveTab] = useState('환자정보')
  
  // 환자 수정 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // 문자 발송 모달 상태
  const [isMessageSendModalOpen, setIsMessageSendModalOpen] = useState(false)
  
  // 🔥 상담 정보 모달 상태 추가
  const [isConsultationFormOpen, setIsConsultationFormOpen] = useState(false)
  
  // 🚀 Optimistic Update 활성화
  const isOptimisticEnabled = true
  
  // 🔥 데이터 동기화 리스너 설정
  useEffect(() => {
    console.log('📡 PatientDetailModal: 데이터 동기화 리스너 설정 시작');
    
    const cleanup = setupDataSyncListener(queryClient);
    
    // 🔥 추가: 환자 데이터 변경 이벤트 직접 리스너
    const handlePatientDataChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { patientId, type } = customEvent.detail;
      
      if (selectedPatient && (selectedPatient._id === patientId || selectedPatient.id === patientId)) {
        console.log('🔄 환자 상세 모달 - 실시간 데이터 변경 감지:', type);
        
        // 🔥 특정 이벤트 타입에 대해 강제 새로고침
        if (['patient_complete', 'callback_update', 'callback_delete'].includes(type)) {
          setTimeout(() => {
            refreshPatientData();
            setForceUpdate(prev => prev + 1);
          }, 100);
        }
      }
    };
    
    if (typeof window !== 'undefined') {
      // 🔥 수정: EventListener 타입으로 변경
      window.addEventListener('patientDataChanged', handlePatientDataChange);
      
      return () => {
        cleanup();
        // 🔥 수정: 동일한 타입으로 제거
        window.removeEventListener('patientDataChanged', handlePatientDataChange);
        console.log('📡 PatientDetailModal: 모든 리스너 해제');
      };
    }
    
    return cleanup;
  }, [queryClient, selectedPatient]);

  // 🔥 환자 데이터 새로고침 함수 추가
  const refreshPatientData = async () => {
    try {
      if (selectedPatient && (selectedPatient._id || selectedPatient.id)) {
        console.log('🔄 환자 상세 모달 - 환자 데이터 새로고침 시작');
        
        // 1. 환자 목록 새로고침
        const result = await dispatch(fetchPatients()).unwrap();
        
        // 2. 🔥 새로고침된 데이터에서 현재 선택된 환자 찾아서 업데이트
        if (result?.patients) {
          const updatedPatient = result.patients.find((p: Patient) => 
            p._id === selectedPatient._id || p.id === selectedPatient.id
          );
          
          if (updatedPatient) {
            // 🔥 Redux store의 selectedPatient도 업데이트
            dispatch(selectPatient(updatedPatient));
            console.log('✅ 선택된 환자 정보 업데이트 완료:', {
              name: updatedPatient.name,
              status: updatedPatient.status,
              isCompleted: updatedPatient.isCompleted
            });
          }
        }
        
        // 3. 강제 리렌더링 트리거
        setForceUpdate(prev => prev + 1);
        
        // 🔥 4. 추가: PatientList 테이블 즉시 업데이트를 위한 전역 이벤트 트리거
        setTimeout(() => {
          PatientDataSync.refreshAll('PatientDetailModal_refresh');
        }, 500);
        
        console.log('✅ 환자 상세 모달 - 환자 데이터 새로고침 완료');
      }
    } catch (error) {
      console.error('환자 데이터 새로고침 실패:', error);
    }
  };

  // 🚀 상담 정보 업데이트를 위한 Optimistic Update Mutation
  const consultationUpdateMutation = useMutation({
    mutationFn: async ({ consultationData, additionalData }: {
      consultationData: Partial<ConsultationInfo>,
      additionalData?: {
        reservationDate?: string
        reservationTime?: string
        callbackDate?: string
        callbackTime?: string
        callbackNotes?: string
      }
    }) => {
      if (!selectedPatient) throw new Error('환자 정보가 없습니다.');

      // 1. 상담정보 저장
      const consultationResult = await dispatch(updateConsultationInfo({
        patientId: selectedPatient._id || selectedPatient.id,
        consultationData
      })).unwrap();

      // 2. 동의 시 예약완료 처리
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

      // 3. 거부 시 1차 콜백 등록
      if (consultationData.estimateAgreed === false && additionalData?.callbackDate) {
        await dispatch(addCallback({
          patientId: selectedPatient._id || selectedPatient.id,
          callbackData: {
            type: '1차',
            date: additionalData.callbackDate,
            time: additionalData.callbackTime,
            status: '예정',
            notes: additionalData.callbackNotes || '1차 콜백 - 견적 재검토',
            isVisitManagementCallback: false
          }
        })).unwrap();
      }

      return { consultationResult, consultationData, additionalData };
    },
    onMutate: async ({ consultationData, additionalData }) => {
      if (!selectedPatient) return;

      // 🚀 1. 기존 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['patients'] });

      // 🚀 2. 현재 데이터 백업
      const previousPatients = queryClient.getQueryData(['patients']);

      // 🚀 3. UI에 즉시 반영
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

      // 🚀 4. 즉시 성공 메시지 표시
      alert('상담 정보가 저장되었습니다.');
      setForceUpdate(prev => prev + 1);

      return { previousPatients, consultationData, additionalData };
    },
    onSuccess: async (result, variables, context) => {
      if (!selectedPatient) return;

      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onConsultationUpdate(selectedPatient._id || selectedPatient.id, 'PatientDetailModal');

      // 🚀 활동 로그 기록
      try {
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
            notes: `상담 정보 업데이트 완료`
          }
        );
        console.log('✅ 상담 정보 업데이트 활동 로그 기록 성공');
      } catch (logError) {
        console.warn('⚠️ 활동 로그 기록 실패:', logError);
      }
    },
    onError: async (error, variables, context) => {
      // 🚀 실패시 롤백
      if (context?.previousPatients) {
        queryClient.setQueryData(['patients'], context.previousPatients);
      }

      console.error('상담 정보 저장 실패:', error);
      alert('상담 정보 저장에 실패했습니다.');

      // 실패 로그 기록
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
    },
    onSettled: () => {
      // 🚀 최종적으로 서버 데이터로 동기화
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    }
  });

  // 선택된 환자 변경 감지 - forceUpdate 의존성 추가
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
      
      // 🔥 메모 디버깅 로그 추가
      console.log('🔍 메모 필드 확인:', {
        notes: selectedPatient.notes,
        memo: selectedPatient.memo,
        hasNotes: !!selectedPatient.notes,
        hasMemo: !!selectedPatient.memo,
        notesType: typeof selectedPatient.notes,
        memoType: typeof selectedPatient.memo
      });
      
      // 🔥 환자가 변경되면 새로고침 트리거 초기화
      setRefreshTrigger(0);
    }
  }, [selectedPatient, forceUpdate]);
  
  // 탭 변경 핸들러
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    console.log('탭 변경:', newTab);
  }
  
  // 🔥 모달 닫기 함수 수정 - 닫을 때 추가 동기화 트리거
  const handleClose = () => {
    // 🔥 추가: 모달 닫을 때 PatientList 강제 새로고침
    PatientDataSync.refreshAll('PatientDetailModal_close');
    
    // 약간의 지연 후 한 번 더 (확실한 동기화)
    setTimeout(() => {
      PatientDataSync.refreshAll('PatientDetailModal_close_delayed');
    }, 200);
    
    dispatch(clearSelectedPatient());
  };
  
  // 환자 수정 모달 열기
  const handleOpenEditModal = () => {
    console.log('환자 정보 수정 모달 열기');
    setIsEditModalOpen(true)
  }
  
  // 🔥 환자 수정 완료 처리 - 활동 로그 새로고침 트리거 추가
  const handleEditSuccess = async () => {
    // 환자 정보 탭으로 돌아가기
    setActiveTab('환자정보')
    console.log('🔥 환자 정보 수정 완료 - 활동 로그 새로고침 트리거');
    
    // 🔥 환자 데이터 새로고침
    await refreshPatientData();
    
    // 🔥 활동 로그 새로고침을 위한 트리거 업데이트
    setRefreshTrigger(prev => prev + 1);
    
    // 약간의 지연 후 추가 새로고침 (로그 기록이 완료될 시간 확보)
    setTimeout(() => {
      setRefreshTrigger(prev => prev + 1);
      console.log('🔥 지연된 활동 로그 새로고침 트리거');
    }, 1000);
  }

  // 문자 발송 완료 핸들러
  const handleMessageSendComplete = () => {
    // 필요한 경우 환자 상태 업데이트 또는 메시지 갱신
    // 문자 내역 탭으로 전환
    setActiveTab('문자내역')
    console.log('문자 발송 완료');
  }
  
  // 문자 발송 모달 열기
  const handleOpenMessageModal = () => {
    console.log('문자 발송 모달 열기');
    setIsMessageSendModalOpen(true)
  }
  
  // 🔥 기존 상담 정보 업데이트 핸들러 - 기존 방식 (fallback)
  const handleConsultationUpdateTraditional = async (
    consultationData: Partial<ConsultationInfo>, 
    additionalData?: {
      reservationDate?: string
      reservationTime?: string
      callbackDate?: string
      callbackTime?: string
      callbackNotes?: string
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
      
      // 1. 상담정보 저장
      await dispatch(updateConsultationInfo({
        patientId: selectedPatient._id || selectedPatient.id,
        consultationData
      })).unwrap();
      
      // 2. 동의 시 예약완료 처리
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
      
      // 3. 거부 시 1차 콜백 등록
      if (consultationData.estimateAgreed === false && additionalData?.callbackDate) {
        console.log('🔥 1차 콜백 등록 시작:', {
          callbackDate: additionalData.callbackDate,
          callbackTime: additionalData.callbackTime,
          callbackNotes: additionalData.callbackNotes
        });
        
        await dispatch(addCallback({
          patientId: selectedPatient._id || selectedPatient.id,
          callbackData: {
            type: '1차',
            date: additionalData.callbackDate,      // ✅ 수정됨
            time: additionalData.callbackTime,      // ✅ 수정됨
            status: '예정',
            notes: additionalData.callbackNotes || '1차 콜백 - 견적 재검토',  // ✅ 수정됨
            isVisitManagementCallback: false
          }
        })).unwrap();
        
        console.log('✅ 1차 콜백 등록 성공');
      }
      
      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onConsultationUpdate(selectedPatient._id || selectedPatient.id, 'PatientDetailModal_traditional');
      
      // 🔥 강제 리렌더링을 위한 상태 업데이트
      setForceUpdate(prev => prev + 1);
      
      // 환자 데이터 새로고침
      await refreshPatientData();
      
      console.log('🔥 상담 정보 업데이트 완료 - 모든 처리 성공');
      alert('상담 정보가 저장되었습니다.');
    } catch (error) {
      console.error('상담 정보 저장 실패:', error);
      alert('상담 정보 저장에 실패했습니다.');
      throw error;
    }
  };

  // 🚀 Optimistic 방식 상담 정보 업데이트 핸들러
  const handleConsultationUpdateOptimistic = async (
    consultationData: Partial<ConsultationInfo>, 
    additionalData?: {
      reservationDate?: string
      reservationTime?: string
      callbackDate?: string
      callbackTime?: string
      callbackNotes?: string
    }
  ) => {
    // 🚀 Optimistic Update 실행
    consultationUpdateMutation.mutate({ consultationData, additionalData });
  };

  // 🚀 환경변수에 따라 상담 정보 업데이트 방식 선택
  const handleConsultationUpdate = isOptimisticEnabled ? handleConsultationUpdateOptimistic : handleConsultationUpdateTraditional;
  
  // 기본 정보가 없으면 렌더링하지 않음
  if (!selectedPatient) return null
  
  // 콜백 필요 여부 확인
  const needsCallback = selectedPatient.status === '콜백필요' || selectedPatient.status === '부재중'
  
  // 예약 완료 여부 확인 함수 수정
  const isReservationCompleted = (patient: Patient) => {
    const result = patient.isCompleted && 
          patient.completedReason && 
          patient.completedReason.includes('[예약완료]');
    
    // 디버깅 로그 추가
    if (result && patient.completedReason) {
      console.log('=== 예약 완료 환자 디버깅 ===');
      console.log('completedReason:', patient.completedReason);
      console.log('contains newline:', patient.completedReason.includes('\n'));
      console.log('completedReason length:', patient.completedReason.length);
      console.log('completedReason split by \\n:', patient.completedReason.split('\n'));
    }
    
    return result;
  };

  // 예약 완료 상담 내용 추출 함수 수정
  const getReservationConsultationNotes = (patient: Patient) => {
    if (!patient.completedReason) return '';
    
    const text = patient.completedReason;
    
    // 🔥 수정: s 플래그 대신 [\s\S] 사용 (공백 문자와 비공백 문자 모두 매치)
    // 패턴 1: [예약완료] 예약일시: YYYY-MM-DD HH:MM 상담내용: 내용
    let match = text.match(/\[예약완료\]\s*예약일시:\s*[\d-]+\s+[\d:]+\s*상담내용:\s*([\s\S]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // 패턴 2: 예약일시: YYYY-MM-DD HH:MM 처리일: YYYY-MM-DD 상담내용: 내용
    match = text.match(/예약일시:\s*[\d-]+\s+[\d:]+\s*처리일:\s*[\d-]+\s*상담내용:\s*([\s\S]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // 패턴 3: 처리일: YYYY-MM-DD 상담내용: 내용 (예약일시가 앞에 있는 경우)
    match = text.match(/처리일:\s*[\d-]+\s*상담내용:\s*([\s\S]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // 패턴 4: 단순히 상담내용: 으로 시작하는 경우
    match = text.match(/상담내용:\s*([\s\S]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // 🔥 추가: 기존 패턴 호환성 - [예약완료] 예약일시: 뒤의 모든 내용
    match = text.match(/\[예약완료\]\s*예약일시:\s*[\d-]+\s+[\d:]+\s*(.*)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return '';
  };
  
  // 예약 정보 추출 함수 수정
  const getReservationInfo = (patient: Patient) => {
    if (!patient.completedReason) return '';
    
    // [예약완료] 예약일시: YYYY-MM-DD HH:MM 부분만 추출
    const match = patient.completedReason.match(/(?:\[예약완료\]\s*)?(예약일시:\s*[\d-]+\s+[\d:]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
          
    return '';
  };

  // 3. 🔥 종결 상태 확인 함수 수정 - 실시간 반영
  const isCompleted = useMemo(() => {
    const completed = selectedPatient.isCompleted === true || selectedPatient.status === '종결';
    console.log('🔍 종결 상태 확인:', {
      patientName: selectedPatient.name,
      isCompleted: selectedPatient.isCompleted,
      status: selectedPatient.status,
      finalResult: completed,
      forceUpdateTrigger: forceUpdate
    });
    return completed;
  }, [selectedPatient.isCompleted, selectedPatient.status, forceUpdate]);
  
  // 🔥 예약완료 상태 확인 함수 추가
  const isReservationConfirmed = () => {
    return selectedPatient.status === '예약확정' || 
           selectedPatient.reservationDate || 
           isReservationCompleted(selectedPatient);
  };
  
  // 🔥 치료 상태 텍스트 결정 함수
  const getTreatmentStatusText = () => {
    if (isReservationConfirmed()) {
      return '예약 완료';
    } else if (selectedPatient.consultation?.estimateAgreed) {
      return '치료 동의';
    } else {
      return '치료 미시작';
    }
  };
  
  // 🔥 치료 상태 색상 결정 함수
  const getTreatmentStatusColor = () => {
    if (isReservationConfirmed()) {
      return 'text-blue-600'; // 예약완료는 파란색
    } else if (selectedPatient.consultation?.estimateAgreed) {
      return 'text-green-600'; // 치료 동의는 초록색
    } else {
      return 'text-red-600'; // 치료 미시작은 빨간색
    }
  };
  
  // 마지막 상담 일자 기준 경과 시간
  const lastConsultationDate = new Date(selectedPatient.lastConsultation)
  const timeSinceLastConsultation = selectedPatient.lastConsultation && selectedPatient.lastConsultation !== ''
    ? formatDistance(
        new Date(selectedPatient.lastConsultation),
        new Date(),
        { addSuffix: true, locale: ko }
      )
    : '';

  // 첫 상담 이후 경과 시간 - 값이 있는 경우에만 계산
  const timeSinceFirstConsult = selectedPatient.firstConsultDate && selectedPatient.firstConsultDate !== ''
    ? formatDistance(
        new Date(selectedPatient.firstConsultDate),
        new Date(),
        { addSuffix: true, locale: ko }
      )
    : '';
  
  // 환자 상태에 따른 뱃지 색상
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      '잠재고객': 'bg-blue-100 text-blue-800',
      '콜백필요': 'bg-yellow-100 text-yellow-800',
      '부재중': 'bg-orange-100 text-orange-800',
      '활성고객': 'bg-green-100 text-green-800',
      'VIP': 'bg-purple-100 text-purple-800',
      '예약확정': 'bg-indigo-100 text-indigo-800',
      '재예약확정': 'bg-purple-100 text-purple-800',
      '종결': 'bg-gray-100 text-gray-800',
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800'
  }
  
  // 환자 상태 뱃지
  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  )
  
  // 리마인더 상태 뱃지
  const ReminderBadge = ({ status }: { status: string }) => {
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
  }
  
  // 유입경로 표시 텍스트
  const getReferralSourceText = (source?: string) => {
    if (!source || source === '') return '-';
    return source;
  }
  
  // 담당자 정보 표시 함수
  const getUserDisplayName = (userId?: string, userName?: string) => {
    console.log('🔍 getUserDisplayName 호출:', { userId, userName });
    
    if (!userId && !userName) return '정보 없음';
    if (userName && userName.trim() !== '') return userName;
    if (userId === 'system') return '시스템';
    if (userId && userId.trim() !== '') return `${userId} (ID)`;
    return '정보 없음';
  }

  // 마지막 수정 시간 포맷팅
  const formatLastModified = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return formatDistance(new Date(dateString), new Date(), { 
        addSuffix: true, 
        locale: ko 
      });
    } catch {
      return dateString;
    }
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
            {/* 🔥 종결 상태 실시간 반영 */}
            <StatusBadge status={isCompleted ? '종결' : selectedPatient.status} />
            <ReminderBadge status={selectedPatient.reminderStatus} />
            {/* 상담 타입 뱃지 추가 */}
            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              (selectedPatient.consultationType || 'outbound') === 'inbound' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {(selectedPatient.consultationType || 'outbound') === 'inbound' ? (
                <>
                  <FiPhone className="w-3 h-3 mr-1" />
                  인바운드
                </>
              ) : (
                <>
                  <FiPhoneCall className="w-3 h-3 mr-1" />
                  아웃바운드
                </>
              )}
            </div>
            
          </div>
          <div className="flex items-center gap-2">
            {/* 문자 발송 버튼 추가 */}
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
        
        {/* 탭 메뉴 - 문자내역 탭 추가 */}
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
              activeTab === '콜백관리'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => handleTabChange('콜백관리')}
          >
            콜백 관리
            {activeTab === '콜백관리' && (
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
                  
                  {/* 상담 타입 정보 추가 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={(selectedPatient.consultationType || 'outbound') === 'inbound' ? FiPhone : FiPhoneCall} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">상담 타입</p>
                      <div className="flex items-center gap-2">
                        <p className="text-text-primary">
                          {(selectedPatient.consultationType || 'outbound') === 'inbound' ? '인바운드' : '아웃바운드'}
                        </p>
                        {/* 🔥 변경 버튼 추가 */}
                        <button
                          className="text-xs text-primary hover:text-primary-dark underline"
                          onClick={handleOpenEditModal}
                          title="상담 타입을 변경하려면 수정 모달에서 변경할 수 있습니다"
                        >
                          변경
                        </button>
                        {selectedPatient.consultationType === 'inbound' && selectedPatient.inboundPhoneNumber && (
                          <span className="text-xs text-gray-500">
                            (입력번호: {selectedPatient.inboundPhoneNumber})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* 유입경로 정보 추가 */}
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
                      <p className="text-sm text-text-secondary">콜 유입 날짜</p>
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
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>              
              
              {/* 🔥 상담/결제 정보 카드 (치료 상태 표시 수정) */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-text-primary flex items-center gap-2">
                    <Icon icon={HiOutlineCreditCard} size={18} className="text-green-600" />
                    최초 상담 기록
                  </h3>
                  <button
                    onClick={() => setIsConsultationFormOpen(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
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
                    
                    {/* 🔥 견적 동의 현황 (치료 상태 수정) */}
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
                      
                      {/* 🔥 예약 정보 표시 추가 */}
                      {isReservationConfirmed() && (selectedPatient.reservationDate || selectedPatient.reservationTime) && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-600 mb-1">예약 정보</p>
                          <p className="text-sm font-medium text-blue-600">
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
                      className="text-blue-600 hover:text-blue-800 underline"
                      disabled={consultationUpdateMutation.isPending}
                    >
                      최초 상담 정보 추가하기
                    </button>
                  </div>
                )}
              </div>

              {/* 담당자 정보 카드 추가 */}
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
              
              {/* 콜백 필요 알림 - 종결 처리되지 않은 경우에만 표시 */}
              {needsCallback && !isCompleted && (
                <div className="card bg-yellow-50 border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-md font-semibold text-yellow-800 mb-1">콜백 필요</h3>
                      <p className="text-yellow-600">이 환자는 콜백이 필요합니다. 콜백 관리 탭에서 다음 콜백을 예약해주세요.</p>
                    </div>
                    <button
                      className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
                      onClick={() => handleTabChange('콜백관리')}
                    >
                      콜백 관리로 이동
                    </button>
                  </div>
                </div>
              )}

              {/* 종결 처리 알림 - 종결 처리된 경우에만 표시 (수정된 부분) */}
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
                      
                      {/* 예약 정보와 상담 내용을 모두 표시 */}
                      {isReservationCompleted(selectedPatient) ? (
                        <div className="mt-1 space-y-2">
                          {/* 예약 정보 표시 */}
                          {getReservationInfo(selectedPatient) && (
                            <p className="text-sm text-green-600 font-medium">
                              {getReservationInfo(selectedPatient)}
                            </p>
                          )}
                          
                          {/* 상담 내용 표시 */}
                          {getReservationConsultationNotes(selectedPatient) && (
                            <p className="text-sm text-green-600">
                              상담내용: {getReservationConsultationNotes(selectedPatient)}
                            </p>
                          )}
                        </div>
                      ) : selectedPatient.completedReason ? (
                        // 일반 종결인 경우 기존 방식 유지
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
                      onClick={() => handleTabChange('콜백관리')}
                    >
                      <Icon icon={HiOutlineRefresh} size={18} />
                      <span>{isReservationCompleted(selectedPatient) ? '예약 취소' : '종결 취소'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 콜백 관리 탭 */}
          {activeTab === '콜백관리' && (
            <CallbackManagement patient={selectedPatient} />
          )}
          
          {/* 문자내역 탭 */}
          {activeTab === '문자내역' && (
            <PatientMessageHistory patient={selectedPatient} />
          )}
        </div>
      </div>
      
      {/* 🔥 환자 수정 모달 - refreshTrigger를 key로 전달하여 강제 리렌더링 */}
      {isEditModalOpen && (
        <PatientEditForm 
          key={`edit-${selectedPatient._id}-${refreshTrigger}`}
          patient={selectedPatient} 
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)} 
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
      
      {/* 🔥 상담 정보 모달 */}
      {isConsultationFormOpen && (
        <ConsultationFormModal
          isOpen={isConsultationFormOpen}
          onClose={() => setIsConsultationFormOpen(false)}
          patientId={selectedPatient._id}
          patientName={selectedPatient.name}
          existingConsultation={selectedPatient.consultation}
          onSave={handleConsultationUpdate}
        />
      )}
    </div>
  )
}