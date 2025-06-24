// src/components/management/CallbackManagement.tsx
// 🔥 에러 수정: unwrap() 제거 및 중복 함수 정의 제거

'use client'
import { format, addDays } from 'date-fns';
import EventTargetSection from './EventTargetSection'
import { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { fetchCategories } from '@/store/slices/categoriesSlice'
import { getEventCategoryOptions, getCategoryDisplayName } from '@/utils/categoryUtils'
import {
  Patient,
  addCallback,
  cancelCallback,
  updatePatient,
  CallbackItem,
  deleteCallback,
  completePatient,
  cancelPatientCompletion,
  CallbackStatus,
  selectPatient,
  updateEventTargetInfo,
  initializeEventTargets,
  EventTargetReason,
  updateCallback,
  // 🔥 환자 목록 새로고침을 위한 액션 추가
  fetchPatients
} from '@/store/slices/patientsSlice'
import { EventCategory } from '@/types/messageLog'
import {
  HiOutlinePlus,
  HiOutlineCalendar,
  HiOutlineClipboardCheck,
  HiOutlinePencil,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineTrash,
  HiOutlineThumbUp,
  HiOutlineThumbDown,
  HiOutlineStop,
  HiOutlineClock,
  HiOutlinePhone,
  HiOutlineBan,
  HiOutlineExclamation,
  HiOutlineRefresh,
  HiOutlineMinus
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { RootState } from '@/store';
import { useActivityLogger } from '@/hooks/useActivityLogger'
import { validatePatientForAPI } from '@/utils/patientUtils';

interface CallbackManagementProps {
  patient: Patient
}

type CallbackType = '1차' | '2차' | '3차' | '4차' | '5차';

const TERMINATION_REASONS = [
  '타원 치료 예정',
  '비용 부담', 
  '시간 부족',
  '통증 우려',
  '가족과 상의 필요',
  '건강상 이유',
  '보험 이슈',
  '기타'
] as const;

type TerminationReason = typeof TERMINATION_REASONS[number];

export default function CallbackManagement({ patient }: CallbackManagementProps) {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((state: RootState) => state.auth.user)

   // 🔍 디버깅 로그 추가 - 컴포넌트 시작 직후
  useEffect(() => {
    console.log('🔍 CallbackManagement 환자 객체 분석:', {
      patient,
      hasPatient: !!patient,
      patientKeys: patient ? Object.keys(patient) : [],
      _id: patient?._id,
      _idType: typeof patient?._id,
      id: patient?.id,
      idType: typeof patient?.id,
      patientId: patient?.patientId,
      patientIdType: typeof patient?.patientId,
      name: patient?.name,
      // 전체 환자 객체의 구조 확인
      patientStructure: patient ? JSON.stringify(patient, null, 2) : null
    });
  }, [patient]);
  
  // ✅ 컴포넌트 내부에서 훅 호출
  const { logCallbackAction, logPatientCompleteAction } = useActivityLogger()
  
  // 🔥 임시: 로그인 시스템이 구현되기 전까지 기본 사용자 사용
  const effectiveUser = currentUser || {
    id: 'temp-user-001',
    name: '임시 관리자',
    username: 'temp-admin',
    email: 'temp@example.com',
    role: 'staff' as const,
    isActive: true
  }
  
  // Redux store에서 카테고리 데이터 가져오기 - 추가
  const { categories } = useAppSelector((state: RootState) => state.categories)
  
  // 부재중 메시지 여부 확인
  const isMissedCallNote = (note?: string) => {
    return note?.startsWith('부재중:');
  }
  
  // 대신, 부재중 상태는 직접 확인 가능
  const isMissedCall = (callback: CallbackItem) => {
    return callback.status === '부재중';
  }
  
  // 이벤트 타겟 설정 관련 상태 추가
  const [eventTargetReason, setEventTargetReason] = useState<EventTargetReason>('price_hesitation')
  const [eventTargetCategory, setEventTargetCategory] = useState<EventCategory>('discount')
  const [eventTargetNotes, setEventTargetNotes] = useState('')
  const [eventTargetScheduledDate, setEventTargetScheduledDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  
  // 콜백 이력 상태 - 컴포넌트 내부에서 관리하도록 변경
  const [callbackType, setCallbackType] = useState<CallbackType>('1차');
  const [nextCallbackType, setNextCallbackType] = useState<string>('');
  const [callbackHistory, setCallbackHistory] = useState<CallbackItem[]>([]);
  const [nextPlanNotes, setNextPlanNotes] = useState('');
  const [callbackResult, setCallbackResult] = useState<string>('상담중');
  const [terminationReason, setTerminationReason] = useState('');
  const [nextCallbackPlan, setNextCallbackPlan] = useState('');

  // 🔥 강제 리렌더링을 위한 상태 추가
  const [forceUpdate, setForceUpdate] = useState(0);

  // 🔥 환자 상태 업데이트 헬퍼 함수 추가 - unwrap() 제거
  const refreshPatientData = async () => {
    try {
      // 1. 환자 상세 정보 새로고침
      if (patient._id || patient.id) {
        const patientId = patient._id || patient.id;
        console.log('🔍 환자 데이터 새로고침 시작:', patientId);
        
        // Redux에서 환자 선택 새로고침
        dispatch(selectPatient(patientId));
      }
      
      // 2. 환자 목록 새로고침 (필터 적용된 상태로)
      await dispatch(fetchPatients()).unwrap();
      
      // 3. 강제 리렌더링 트리거
      setForceUpdate(prev => prev + 1);
      
      console.log('✅ 환자 데이터 새로고침 완료');
    } catch (error) {
      console.error('🚨 환자 데이터 새로고침 실패:', error);
    }
  };

  
  // 컴포넌트 마운트 시 카테고리 불러오기 - 추가
  useEffect(() => {
    dispatch(fetchCategories())
  }, [dispatch])
  
  // 콜백 유형이 변경될 때 다음 콜백 유형 자동 설정
  useEffect(() => {
    if (callbackType === '1차') {
      setNextCallbackType('2차');
    } else if (callbackType === '2차') {
      setNextCallbackType('3차');
    } else if (callbackType === '3차') {
      setNextCallbackType('4차');
    } else if (callbackType === '4차') {
      setNextCallbackType('5차');
    } else {
      setNextCallbackType('예약완료');
    }
  }, [callbackType]);
  
  // 환자 데이터가 변경될 때마다 콜백 이력 업데이트
  useEffect(() => {
    if (patient && patient.callbackHistory) {
      console.log('🔍 콜백 이력 업데이트:', {
        patientName: patient.name,
        callbackCount: patient.callbackHistory.length,
        forceUpdateValue: forceUpdate
      });
      // 중복 제거 로직 추가: 동일한 날짜의 종결 기록은 하나만 표시
      let historyToDisplay = [...patient.callbackHistory];
      
      // 예약 확정 처리된 콜백 중, 예약 정보가 포함된 완료 콜백이 있는지 확인
      const hasCompletedWithReservationInfo = historyToDisplay.some(cb => 
        cb.status === '완료' && cb.notes && cb.notes.includes('[예약 정보]')
      );
      
      // 종결 기록(예약 확정) 필터링 (기존 로직 유지)
      const completionRecords = historyToDisplay.filter(
        cb => cb.isCompletionRecord === true
      );
      
      if (completionRecords.length > 0) {
        const latestCompletionRecord = completionRecords.sort((a, b) => {
          const aTimestamp = parseInt(a.id.split('-')[1] || '0');
          const bTimestamp = parseInt(b.id.split('-')[1] || '0');
          return bTimestamp - aTimestamp;
        })[0];
        
        if (hasCompletedWithReservationInfo) {
          historyToDisplay = historyToDisplay.filter(
            cb => !cb.isCompletionRecord || cb.id === latestCompletionRecord.id
          );
        }
      }

      // 날짜 기준 정렬 (기존 로직 유지)
      const sortedHistory = historyToDisplay.sort((a, b) => {
        if (a.isCompletionRecord && !b.isCompletionRecord) return -1;
        if (!a.isCompletionRecord && b.isCompletionRecord) return 1;
        
        const aHasReservationInfo = a.status === '완료' && a.notes && a.notes.includes('[예약 정보]');
        const bHasReservationInfo = b.status === '완료' && b.notes && b.notes.includes('[예약 정보]');
        
        if (aHasReservationInfo && !bHasReservationInfo) return -1;
        if (!aHasReservationInfo && bHasReservationInfo) return 1;
        
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        
        const aTimestamp = parseInt(a.id.split('-')[1] || '0');
        const bTimestamp = parseInt(b.id.split('-')[1] || '0');
        return bTimestamp - aTimestamp;
      });

      // 콜백 이력 업데이트
      setCallbackHistory(sortedHistory);
    
      console.log('✅ 콜백 이력 화면 업데이트 완료:', sortedHistory.length);
    } else {
      setCallbackHistory([]);
    }
  }, [patient, forceUpdate]); // forceUpdate 의존성 유지
  
  // 상태 추가 - 컴포넌트 상단에 추가
  const [nextCallbackDate, setNextCallbackDate] = useState(
    format(addDays(new Date(), 7), 'yyyy-MM-dd') // 기본값: 1주일 후
  );
  
  // 예정된 콜백 개수
  const scheduledCallbacks = callbackHistory.filter(cb => cb.status === '예정').length;
  
  // 완료된 콜백 개수 (부재중 제외) - 수정된 로직
  const completedNonMissedCallbacks = callbackHistory.filter(cb => {
    // 예약 확정으로 완료된 콜백도 포함
    const isCompletedNormal = cb.status === '완료' && !isMissedCallNote(cb.notes);
    // 예약 확정으로 인한 종결 기록은 콜백 카운트에서 제외 (이미 위에서 완료로 카운트됨)
    const isCompletionRecord = cb.isCompletionRecord === true;
    return isCompletedNormal && !isCompletionRecord;
  }).length;
  
  // 부재중 콜백 개수
  const missedCallbacks = callbackHistory.filter(cb => {
    // status가 '부재중'이거나, '완료'면서 부재중 메모가 있는 경우 모두 포함
    const isPurelyMissed = cb.status === '부재중';
    const isCompletedWithMissedNote = cb.status === '완료' && isMissedCallNote(cb.notes);
    return isPurelyMissed || isCompletedWithMissedNote;
  }).length;
  
  // 환자가 종결되었지만 콜백 이력이 없는 경우 (바로 종결/예약완료 처리된 경우)
  // 최소 1회는 콜백을 진행한 것으로 간주
  const adjustedCompletedCallbacks = patient.isCompleted && completedNonMissedCallbacks === 0 && missedCallbacks === 0
    ? 1  // 종결되었는데 콜백 이력이 전혀 없으면 1회로 간주
    : completedNonMissedCallbacks;
  
  // 콜백 현황 표시에서 사용할 값
  const displayCompletedCallbacks = adjustedCompletedCallbacks;
  
  // 새 콜백 관련 상태
  const [isAddingCallback, setIsAddingCallback] = useState(false);
  const [callbackDate, setCallbackDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [callbackStatus, setCallbackStatus] = useState<CallbackStatus>('예정');
  const [callbackNotes, setCallbackNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 콜백 취소 관련 상태
  const [isCanceling, setIsCanceling] = useState(false)
  const [selectedCallback, setSelectedCallback] = useState<CallbackItem | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  
  // 콜백 삭제 관련 상태
  const [isDeleting, setIsDeleting] = useState(false)
  const [callbackToDelete, setCallbackToDelete] = useState<CallbackItem | null>(null)
  
  // 콜백 종결 관련 상태
  const [isConfirmingComplete, setIsConfirmingComplete] = useState(false)
  const [completionNote, setCompletionNote] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  
  // 예약 날짜 관련 상태
  const [reservationDate, setReservationDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [reservationTime, setReservationTime] = useState('10:00')
  
  // 부재중 콜백 관련 상태
  const [isAddingMissedCall, setIsAddingMissedCall] = useState(false)
  
  // 종결 취소 관련 상태
  const [isConfirmingCancelCompletion, setIsConfirmingCancelCompletion] = useState(false)
  
  // 완료 처리를 위한 상태 추가
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [callbackToComplete, setCallbackToComplete] = useState<CallbackItem | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');
  
  // 수정 모달 상태 추가
  const [isEditingCallback, setIsEditingCallback] = useState(false);
  const [callbackToEdit, setCallbackToEdit] = useState<CallbackItem | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  
  // 상태 추가
  const [resultNotes, setResultNotes] = useState('');
  const [customerResponse, setCustomerResponse] = useState<string>('neutral');
  const [nextStep, setNextStep] = useState<string>('');
  
  // 🔥 종결 사유 관련 상태 추가
  const [selectedTerminationReason, setSelectedTerminationReason] = useState<TerminationReason>('타원 치료 예정');
  const [customTerminationReason, setCustomTerminationReason] = useState('');
  
  // 🔥 담당자 정보 표시 함수 (getUserDisplayName 함수 근처에 추가)
  const getUserDisplayName = (userId?: string, userName?: string) => {
    if (!userId && !userName) return '';
    if (userName) return userName;
    if (userId === 'system') return '시스템';
    return userId || '';
  }
  
// 1. resetEditForm 함수 추가
  // 수정 모달을 초기화하는 별도의 함수 추가
  const resetEditForm = () => {
    setIsEditingCallback(false);
    setCallbackToEdit(null);
    setEditNotes('');
    setEditDate('');
  };
  
  // 수정 모달 열기
  const handleOpenEditModal = (callback: CallbackItem) => {
    // 종결 처리된 환자인 경우 콜백 수정 불가
    if (patient.isCompleted) {
      alert('종결 처리된 환자의 콜백은 수정할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
      return;
    }
    // 취소된 콜백은 수정 불가
    if (callback.status === '취소') {
      alert('취소된 콜백은 수정할 수 없습니다.');
      return;
    }

    // 종결 기록은 수정 불가
    if (callback.isCompletionRecord) {
      alert('종결 처리 기록은 수정할 수 없습니다.');
      return;
    }

    setCallbackToEdit(callback);
    setEditNotes(callback.notes || '');
    setEditDate(callback.date);
    setIsEditingCallback(true);
  };

// 콜백 수정 처리
  const handleEditCallback = async () => {
    if (!callbackToEdit) return;
    // 종결 처리된 환자인 경우 콜백 수정 불가
    if (patient.isCompleted) {
      alert('종결 처리된 환자의 콜백은 수정할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
      resetEditForm();
      return;
    }

    try {
      setIsLoading(true);
      
      // 기존 콜백 복사
      const updatedCallback = { ...callbackToEdit };
      
      // 수정된 정보 업데이트
      updatedCallback.notes = editNotes;
      updatedCallback.date = editDate;
      
      // 환자 정보 복사
      const updatedPatient = { ...patient };
      
      // 환자의 콜백 이력 복사
      const updatedCallbacks = [...(updatedPatient.callbackHistory || [])];
      
      // 수정할 콜백 찾기
      const callbackIndex = updatedCallbacks.findIndex(cb => cb.id === callbackToEdit.id);
      
      if (callbackIndex !== -1) {
        // 콜백 이력 업데이트
        updatedCallbacks[callbackIndex] = updatedCallback;
        
        // Redux 액션 디스패치하여 환자 정보 업데이트
        await dispatch(updatePatient({
          patientId: patient.id,
          patientData: {
            callbackHistory: updatedCallbacks
          }
        })).unwrap();
        
        // selectPatient를 호출하여 환자 정보 새로고침
        dispatch(selectPatient(patient.id));

        await logCallbackAction(
          'callback_update', // 수정 액션
          patient.id,
          patient.name,
          {
            callbackId: callbackToEdit.id,
            callbackType: callbackToEdit.type,
            callbackDate: editDate,
            previousNotes: callbackToEdit.notes,
            newNotes: editNotes,
            handledBy: effectiveUser.name,
            notes: `${callbackToEdit.type} 콜백 수정`
          }
        );
        
        // 성공 처리
        resetEditForm();
        alert('콜백 정보가 수정되었습니다.');
      } else {
        throw new Error('수정할 콜백을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('콜백 수정 오류:', error);

      // 🔥 에러 로깅도 수정
      try {
        await logCallbackAction(
          'callback_update', // ✅ 수정
          patient.id,
          patient.name,
          {
            error: error instanceof Error ? error.message : '알 수 없는 오류',
            callbackType: callbackToEdit.type, // ✅ 수정
            attemptedBy: effectiveUser.name
          }
        )
      } catch (logError) {
        console.warn('활동 로그 기록 실패:', logError)
      }
      
      alert('콜백 수정 중 오류가 발생했습니다.') // ✅ 메시지 수정
    } finally {
      setIsLoading(false)
    }
  }

// 완료 처리 모달 초기화
  const resetMarkCompleteForm = () => {
    setIsMarkingComplete(false);
    setCallbackToComplete(null);
    setCompleteNotes('');
    setResultNotes('');
    setCustomerResponse('neutral');
    setNextStep('');
    setNextCallbackDate(format(addDays(new Date(), 7), 'yyyy-MM-dd')); // 초기화
    setNextCallbackPlan(''); // 다음 상담 계획 초기화 추가
    setEventTargetReason('price_hesitation');
    setEventTargetCategory('discount'); // 🔥 단일값으로 초기화
    setEventTargetNotes('');
    setEventTargetScheduledDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    // 🔥 종결 사유 관련 상태 초기화 추가
    setSelectedTerminationReason('타원 치료 예정');
    setCustomTerminationReason('');
  };
  
  // 완료 처리 모달 열기
  const handleOpenMarkCompleteModal = (callback: CallbackItem) => {
    // 종결된 환자인 경우 완료 처리 불가
    if (patient.isCompleted) {
      alert('종결 처리된 환자의 콜백은 수정할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
      return;
    }
    if (callback.status !== '예정') {
      alert('예정된 콜백만 완료 처리할 수 있습니다.');
      return;
    }

    setCallbackToComplete(callback);
    // 이전 메모가 있으면 초기값으로 설정
    setCompleteNotes(callback.notes || '');
    setIsMarkingComplete(true);
  };

// 🔥 콜백 완료 처리 함수 - 핵심 수정 부분
  const handleMarkCallbackComplete = async () => {
    if (!callbackToComplete) return;

    // 🔍 디버깅 로그 - API 호출 직전
    console.log('🔍 handleMarkCallbackComplete 시작:', {
      patient,
      patientId: patient?.id,
      patientObjectId: patient?._id,
      patientPatientId: patient?.patientId,
      callbackToComplete,
      nextStep
    });
    
    try {
      setIsLoading(true);

      // 🔥 환자 ID 안전하게 가져오기 - 수정된 부분
      const safePatientId = patient._id || patient.id || patient.patientId;
      
      // 🔍 디버깅 로그 - ID 확인
      console.log('🔍 환자 ID 확인:', {
        original_id: patient?.id,
        original_objectId: patient?._id,
        original_patientId: patient?.patientId,
        safePatientId,
        safePatientIdType: typeof safePatientId
      });
      
      if (!safePatientId) {
        console.error('환자 ID가 없습니다:', { 
          hasPatient: !!patient, 
          hasMongoId: !!patient?._id, 
          hasId: !!patient?.id,
          patient: patient 
        });
        alert('환자 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
        setIsLoading(false);
        return;
      }
      
      // 부재중 처리 로직 - 전체 교체
      if (nextStep === '부재중') {
        console.log('🔍 부재중 처리 시작:', {
          callbackToComplete: {
            id: callbackToComplete.id,
            date: callbackToComplete.date,
            type: callbackToComplete.type,
            status: callbackToComplete.status
          },
          nextCallbackDate: nextCallbackDate
        });
        
        // 🔥 기존 콜백을 삭제하지 말고 부재중으로 업데이트
        const missedCallData: Omit<CallbackItem, 'id'> = {
          date: callbackToComplete.date, // 🔥 원래 콜백 날짜 유지 (오늘 날짜 아님)
          status: '부재중',
          notes: '부재중: 연락이 되지 않았습니다.',
          type: callbackToComplete.type,
          time: undefined,
          // 담당자 정보 추가
          handledBy: effectiveUser.id,
          handledByName: effectiveUser.name,
          createdBy: callbackToComplete.createdBy || effectiveUser.id,
          createdByName: callbackToComplete.createdByName || effectiveUser.name
        };
        
        // 🔥 1단계: 기존 예정 콜백을 삭제
        await dispatch(deleteCallback({
          patientId: safePatientId,
          callbackId: callbackToComplete.id
        })).unwrap();

        // 🔥 2단계: 같은 날짜에 부재중 콜백으로 추가 (원래 콜백 날짜 유지)
        await dispatch(addCallback({
          patientId: safePatientId,
          callbackData: missedCallData
        })).unwrap();

        // 🔥 3단계: 재콜백 예약 (사용자가 선택한 날짜로)
        const nextCallbackData: Omit<CallbackItem, 'id'> = {
          date: nextCallbackDate, // 사용자가 선택한 재콜백 날짜
          status: '예정',
          notes: `${callbackToComplete.date} 부재중 이후 재콜백 예정`,
          type: callbackToComplete.type, // 같은 단계 유지 (2차는 2차로)
          time: undefined,
          // 담당자 정보 추가
          handledBy: effectiveUser.id,
          handledByName: effectiveUser.name,
          createdBy: effectiveUser.id,
          createdByName: effectiveUser.name
        };
        
        await dispatch(addCallback({
          patientId: safePatientId,
          callbackData: nextCallbackData
        })).unwrap();

        // 🔥 활동 로그 기록 - 부재중 처리
        await logCallbackAction(
          'callback_complete',
          safePatientId,
          patient.name,
          {
            callbackType: callbackToComplete.type,
            result: '부재중',
            originalCallbackDate: callbackToComplete.date, // 🔥 원래 콜백 날짜 기록
            nextCallbackDate: nextCallbackDate, // 🔥 재콜백 예정 날짜 기록
            handledBy: effectiveUser.name,
            notes: `${callbackToComplete.date} ${callbackToComplete.type} 콜백 부재중 → ${nextCallbackDate} 재콜백 예약`
          }
        )

        // 🔥 환자 정보 새로고침
        await refreshPatientData();
        
        // 성공 처리
        resetMarkCompleteForm();
        alert(`${callbackToComplete.date} ${callbackToComplete.type} 콜백이 부재중 처리되었으며, ${nextCallbackDate}에 재콜백이 예약되었습니다.`);
        return; // 여기서 함수 종료
      }
    
      // 부재중 처리 로직 아래에 추가
      // 예약 확정이 선택된 경우
      if (nextStep === '예약_확정') {
        if (!reservationDate || !reservationTime) {
          alert('예약 날짜와 시간을 모두 입력해주세요.');
          setIsLoading(false);
          return;
        }
        
        // 현재 콜백을 완료 처리하고, 완료된 콜백 데이터에 예약 정보 추가
        const completedCallbackData: Omit<CallbackItem, 'id'> = {
          date: format(new Date(), 'yyyy-MM-dd'), // 오늘 날짜로 업데이트
          status: '완료',
          notes: `[상담 내용]\n${resultNotes}\n\n[예약 정보]\n예약일시: ${reservationDate} ${reservationTime}`,
          customerResponse: customerResponse as any,
          nextStep: '예약_확정',
          type: callbackToComplete.type,
          time: undefined
        };
        
        // 기존 콜백 삭제
        await dispatch(deleteCallback({
          patientId: safePatientId, // 🔥 수정
          callbackId: callbackToComplete.id
        })).unwrap();
          
        // 새 (완료된) 콜백 추가
        await dispatch(addCallback({
          patientId: safePatientId, // 🔥 수정
          callbackData: completedCallbackData
        })).unwrap();
    
        // 예약 정보 포맷팅 - 상담 내용도 포함 (줄바꿈 추가)
        const reservationDateTime = `${reservationDate} ${reservationTime}`;
        const reservationNote = resultNotes.trim() 
          ? `[예약완료] 예약일시: ${reservationDateTime}\n\n${resultNotes}`  // \n\n으로 변경
          : `[예약완료] 예약일시: ${reservationDateTime}`;
        
        // 종결 처리 (예약 완료로)
        await dispatch(completePatient({
          patientId: safePatientId, // 🔥 수정
          reason: reservationNote
        })).unwrap();
        
        // 🔥 활동 로그 기록 - 예약 확정
        await logPatientCompleteAction( // 🔥 함수명 변경
          'patient_complete',
          safePatientId, // 🔥 수정
          patient.name,
          {
            callbackType: callbackToComplete.type,
            result: '예약확정',
            reservationDate: reservationDate,
            reservationTime: reservationTime,
            consultationNotes: resultNotes,
            handledBy: effectiveUser.name,
            notes: `${callbackToComplete.type} 콜백 완료 - 예약 확정`
          }
        )
    
        // 🔥 환자 정보 새로고침
        await refreshPatientData();
        
        // 성공 처리
        resetMarkCompleteForm();
        alert('환자의 예약이 완료되었습니다.');
        return;
      }


      // 종결 처리 로직 추가
      if (nextStep === '종결_처리') {
        // 🔥 종결 사유 조합하기
        const finalTerminationReason = selectedTerminationReason === '기타' 
          ? customTerminationReason.trim() || '기타 사유'
          : selectedTerminationReason;

        // 현재 콜백을 완료 처리하고, 완료된 콜백 데이터에 종결 정보 추가
        const completedCallbackData: Omit<CallbackItem, 'id'> = {
          date: format(new Date(), 'yyyy-MM-dd'),
          status: '완료',
          notes: `[상담 내용]\n${resultNotes}\n\n[종결 사유]\n${finalTerminationReason}`,
          customerResponse: customerResponse as any,
          nextStep: '종결_처리',
          type: callbackToComplete.type,
          time: undefined
        };
        
        // 기존 콜백 삭제
        await dispatch(deleteCallback({
          patientId: safePatientId, // 🔥 수정: patient.id → safePatientId
          callbackId: callbackToComplete.id
        })).unwrap();
          
        // 새 (완료된) 콜백 추가
        await dispatch(addCallback({
          patientId: safePatientId, // 🔥 수정: patient.id → safePatientId
          callbackData: completedCallbackData
        })).unwrap();
        
        // 🔥 종결 사유 포맷팅 수정
        const terminationNote = `[종결처리] ${format(new Date(), 'yyyy-MM-dd')} 종결 완료\n사유: ${finalTerminationReason}\n상담내용: ${resultNotes}`;
        
        // 종결 처리
        await dispatch(completePatient({
          patientId: safePatientId, // 🔥 수정: patient.id → safePatientId
          reason: terminationNote
        })).unwrap();

  // 🔥 활동 로그 기록 - 종결 처리
        await logCallbackAction(
          'callback_complete',
          safePatientId, // 🔥 수정: patient.id → safePatientId
          patient.name,
          {
            callbackType: callbackToComplete.type,
            result: '종결처리',
            terminationReason: finalTerminationReason,
            consultationNotes: resultNotes,
            handledBy: effectiveUser.name,
            notes: `${callbackToComplete.type} 콜백 완료 - 종결 처리 (사유: ${finalTerminationReason})`
          }
        )
        
        // 🔥 환자 정보 새로고침 - 즉시 반영을 위해 추가
        await refreshPatientData();
        
        // 🔥 추가: Redux에서 환자 선택 새로고침
        dispatch(selectPatient(safePatientId));
        
        // 🔥 추가: 약간의 딜레이 후 한 번 더 새로고침 (안전장치)
        setTimeout(() => {
          dispatch(selectPatient(safePatientId));
          setForceUpdate(prev => prev + 1);
        }, 100);
        
        // 성공 처리
        resetMarkCompleteForm();
        alert(`환자가 종결 처리되었습니다. (사유: ${finalTerminationReason})`);
        return;
      }


// 이벤트 타겟 설정 로직 추가
      if (nextStep === '이벤트_타겟_설정') {
        // 현재 콜백을 완료 처리
        const completedCallbackData: Omit<CallbackItem, 'id'> = {
          date: format(new Date(), 'yyyy-MM-dd'),
          status: '완료',
          notes: `[상담 내용]\n${resultNotes}`,
          customerResponse: customerResponse as any,
          nextStep: '이벤트_타겟_설정',
          type: callbackToComplete.type,
          time: undefined
        };
        
        // 이벤트 타겟으로 설정 - 카테고리 검증 추가
        const availableCategories = getEventCategoryOptions([], categories);
        const isValidCategory = availableCategories.some(cat => cat.value === eventTargetCategory);
        
        if (!isValidCategory && availableCategories.length > 0) {
          // 유효하지 않은 카테고리인 경우 첫 번째 카테고리로 대체
          setEventTargetCategory(availableCategories[0].value as EventCategory);
        }
        
        await dispatch(updateEventTargetInfo({
          patientId: patient.id,
          eventTargetInfo: {
            isEventTarget: true,
            targetReason: eventTargetReason,
            categories: [eventTargetCategory], // 단일값을 배열로 감싸서 전송
            scheduledDate: eventTargetScheduledDate,
            notes: `콜백 완료 후 이벤트 타겟으로 설정됨\n상담 내용: ${resultNotes}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        })).unwrap();
  
        // 기존 콜백 삭제
        await dispatch(deleteCallback({
          patientId: patient.id,
          callbackId: callbackToComplete.id
        })).unwrap();
          
        // 새 (완료된) 콜백 추가
        await dispatch(addCallback({
          patientId: patient.id,
          callbackData: completedCallbackData
        })).unwrap();
        
        // 이벤트 타겟으로 설정
        await dispatch(updateEventTargetInfo({
          patientId: patient.id,
          eventTargetInfo: {
            isEventTarget: true,
            targetReason: eventTargetReason,
            categories: [eventTargetCategory], // 🔥 단일값을 배열로 감싸서 전송
            scheduledDate: eventTargetScheduledDate,
            notes: `콜백 완료 후 이벤트 타겟으로 설정됨\n상담 내용: ${resultNotes}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        })).unwrap();
        
        // 이벤트 타겟 목록 새로고침
        await dispatch(initializeEventTargets()).unwrap();
  
        // 🔥 활동 로그 기록 - 이벤트 타겟 설정
        await logCallbackAction(
          'callback_complete',
          patient.id,
          patient.name,
          {
            callbackType: callbackToComplete.type,
            result: '이벤트타겟설정',
            eventTargetReason: eventTargetReason,
            eventTargetCategory: eventTargetCategory,
            scheduledDate: eventTargetScheduledDate,
            consultationNotes: resultNotes,
            handledBy: effectiveUser.name,
            notes: `${callbackToComplete.type} 콜백 완료 - 이벤트 타겟 설정`
          }
        )
        
        // 🔥 환자 정보 새로고침
        await refreshPatientData();
        
        // 성공 처리
        resetMarkCompleteForm();
        alert('환자가 이벤트 타겟으로 설정되었습니다. 추후 프로모션 발송 시 포함됩니다.');
        return;
      }

      // 완료된 콜백 데이터 준비
      // 상담 내용과 다음 상담 계획을 포함한 구조화된 메모 포맷 생성
      let completedCallbackNotes = '';
      if (nextStep && nextStep.endsWith('_콜백') && nextCallbackPlan) {
        completedCallbackNotes = `[상담 내용]\n${resultNotes}\n\n[다음 상담 계획]\n${nextCallbackPlan}`;
      } else {
        completedCallbackNotes = `[상담 내용]\n${resultNotes}`;
      }
      
      const completedCallbackData: Omit<CallbackItem, 'id'> = {
        date: format(new Date(), 'yyyy-MM-dd'),
        status: '완료',
        notes: completedCallbackNotes,
        customerResponse: customerResponse as any,
        nextStep: nextStep as any,
        type: callbackToComplete.type,
        time: undefined,
        // 🔥 담당자 정보 추가
        handledBy: effectiveUser.id,
        handledByName: effectiveUser.name,
        createdBy: callbackToComplete.createdBy || effectiveUser.id,
        createdByName: callbackToComplete.createdByName || effectiveUser.name
      };

      // 🔥 변경: PUT (추가)
      await dispatch(updateCallback({
        patientId: safePatientId,
        callbackId: callbackToComplete.id,
        updateData: completedCallbackData
      })).unwrap();
      
      // 🔥 환자 정보 새로고침
      await refreshPatientData();
      
      // 다음 단계가 3차 콜백이고, 현재 2차 콜백인 경우 자동으로 3차 콜백 예약
      if ((nextStep === '2차_콜백' && callbackToComplete.type === '1차') ||
          (nextStep === '3차_콜백' && callbackToComplete.type === '2차') ||
          (nextStep === '4차_콜백' && callbackToComplete.type === '3차') ||
          (nextStep === '5차_콜백' && callbackToComplete.type === '4차')) {
        
        // 다음 콜백 날짜 - 사용자가 선택한 날짜 사용
        const nextCallbackDateFormatted = nextCallbackDate;
      
        // 다음 단계 콜백 타입 결정
        const nextCallbackType = nextStep === '2차_콜백' ? '2차' :
                                nextStep === '3차_콜백' ? '3차' : 
                                nextStep === '4차_콜백' ? '4차' : '5차';
    
        // 간단한 메모만 포함
        const notes = `다음 ${nextCallbackType} 콜백 예정`;
        
        // 다음 콜백 자동 예약
        await dispatch(addCallback({
          patientId: patient.id,
          callbackData: {
            date: nextCallbackDateFormatted,
            status: '예정',
            notes: notes,
            type: nextCallbackType,
            time: undefined
          }
        })).unwrap();

    
  // 🔥 활동 로그 기록 - 일반 콜백 완료
        await logCallbackAction(
          'callback_complete',
          patient.id,
          patient.name,
          {
            callbackType: callbackToComplete.type,
            result: '완료',
            nextStep: nextStep,
            consultationNotes: resultNotes,
            customerResponse: customerResponse,
            handledBy: effectiveUser.name,
            notes: `${callbackToComplete.type} 콜백 완료`
          }
        )
        
        // 🔥 환자 정보 새로고침
        await refreshPatientData();
      }
      
      // 성공 처리
      resetMarkCompleteForm();
      alert('콜백이 완료 처리되었습니다.');
      
    } catch (error) {
      console.error('콜백 완료 처리 오류:', error);
  
      // 🔥 활동 로그 기록 - 콜백 완료 실패
      try {
        await logCallbackAction(
          'callback_complete',
          patient._id || patient.id, // 🔥 여기도 안전하게 처리
          patient.name,
          {
            error: error instanceof Error ? error.message : '알 수 없는 오류',
            callbackType: callbackToComplete.type,
            attemptedBy: effectiveUser.name
          }
        )
      } catch (logError) {
        console.warn('활동 로그 기록 실패:', logError)
      }

      // 🔍 디버깅 로그 - 오류 상세 정보
      console.log('🔍 오류 발생 시 환자 정보:', {
        patient,
        patientId: patient?.id,
        patientObjectId: patient?._id,
        error: error instanceof Error ? error.message : error
      });
      
      alert('콜백 완료 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

// 콜백 생성 폼 초기화
  const resetForm = () => {
    setCallbackDate(format(new Date(), 'yyyy-MM-dd'))
    setCallbackStatus('예정')
    setCallbackNotes('')
    setCallbackType(getNextCallbackType())
    setIsAddingCallback(false)
    setIsAddingMissedCall(false)
    if (callbackType === '1차') {
      setNextCallbackType('2차');
    } else if (callbackType === '2차') {
      setNextCallbackType('3차');
    } else if (callbackType === '3차') {
      setNextCallbackType('4차');
    } else if (callbackType === '4차') {
      setNextCallbackType('5차');
    } else {
      setNextCallbackType('예약완료');
    }
    // 새로 추가된 상태 초기화
    setCallbackResult('상담중')
    setNextPlanNotes('')
    setTerminationReason('')
    setReservationDate(format(new Date(), 'yyyy-MM-dd'))
    setReservationTime('10:00')

    // 수정 모달 상태도 초기화
    setIsEditingCallback(false)
    setCallbackToEdit(null)
    setEditNotes('')
    setEditDate('')
  }

// 취소 모달 초기화
  const resetCancelForm = () => {
    setIsCanceling(false)
    setSelectedCallback(null)
    setCancelReason('')
  }
  
  // 삭제 모달 초기화
  const resetDeleteForm = () => {
    setIsDeleting(false)
    setCallbackToDelete(null)
  }
  
  // 종결 모달 초기화
  const resetCompleteForm = () => {
    setIsConfirmingComplete(false)
    setCompletionNote('')
    setIsSuccess(false)
    setReservationDate(format(new Date(), 'yyyy-MM-dd'))
    setReservationTime('10:00')
  }
  
  // 종결 취소 모달 초기화
  const resetCancelCompletionForm = () => {
    setIsConfirmingCancelCompletion(false)
  }

// 이전 단계 콜백이 완료되었는지 확인
  const isCallbackSequenceValid = (requestedType: CallbackType): boolean => {
    if (requestedType === '1차') return true;
    const validCallbacks = callbackHistory.filter(cb => cb.status === '완료');

    // 2차 콜백을 요청하는 경우 1차가 완료되어야 함
    if (requestedType === '2차') {
      return validCallbacks.some(cb => cb.type === '1차');
    }

    // 3차 콜백을 요청하는 경우 2차가 완료되어야 함
    if (requestedType === '3차') {
      return validCallbacks.some(cb => cb.type === '2차');
    }

    // 4차 콜백을 요청하는 경우 3차가 완료되어야 함
    if (requestedType === '4차') {
      return validCallbacks.some(cb => cb.type === '3차');
    }

    // 5차 콜백을 요청하는 경우 4차가 완료되어야 함
    if (requestedType === '5차') {
      return validCallbacks.some(cb => cb.type === '4차');
    }

    return false;
}
// 다음 콜백 타입 결정 (1차 -> 2차 -> 3차)
  const getNextCallbackType = (): CallbackType => {
    if (callbackHistory.length === 0) {
      return '1차'
    }
    const completedTypes = callbackHistory
      .filter(cb => cb.status === '완료') // 완료된 콜백만 고려
      .map(cb => cb.type)

    // 완료된 콜백을 기준으로 다음 단계 결정
    if (completedTypes.includes('4차')) return '5차'
    if (completedTypes.includes('3차')) return '4차'
    if (completedTypes.includes('2차')) return '3차'
    if (completedTypes.includes('1차')) return '2차'
    return '1차'
  }
  
// 콜백 추가 폼 열기
const handleOpenAddCallback = () => {
// 종결된 환자인 경우 콜백 추가 불가
if (patient.isCompleted) {
alert('종결 처리된 환자에게는 콜백을 추가할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
return;
}
const nextType = getNextCallbackType();
setCallbackType(nextType);

// 이전 단계 콜백 완료 여부 확인
if (!isCallbackSequenceValid(nextType)) {
  alert(`${nextType} 콜백을 추가하기 전에 이전 단계의 콜백을 완료해야 합니다.`);
  return;
}

setIsAddingCallback(true);
setIsAddingMissedCall(false);
}
// 부재중 콜백 추가 폼 열기
const handleOpenAddMissedCall = () => {
// 종결된 환자인 경우 콜백 추가 불가
if (patient.isCompleted) {
alert('종결 처리된 환자에게는 콜백을 추가할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
return;
}
const nextType = getNextCallbackType();
setCallbackType(nextType);

// 이전 단계 콜백 완료 여부 확인
if (!isCallbackSequenceValid(nextType)) {
  alert(`${nextType} 콜백을 추가하기 전에 이전 단계의 콜백을 완료해야 합니다.`);
  return;
}

setIsAddingCallback(true);
setIsAddingMissedCall(true);
setCallbackNotes('부재중: 연락이 되지 않았습니다.');
// 부재중 상태로 변경
setCallbackStatus('부재중'); // '완료' 대신 '부재중' 상태로 설정
}
// 🔥 콜백 생성 함수 수정 - 환자 정보 검증 강화
const handleAddCallback = async () => {
// 🔥 환자 정보 검증 추가 및 강화
if (!patient) {
console.error('환자 정보가 없습니다.');
alert('환자 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
return;
}
// 🔥 환자 ID 검증 - _id와 id 모두 확인
const safePatientId = patient._id || patient.id;
if (!safePatientId) {
  console.error('환자 정보가 부족합니다:', { 
    hasPatient: !!patient, 
    hasMongoId: !!patient?._id, 
    hasId: !!patient?.id,
    patient: patient 
  });
  alert('환자 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
  return;
}

console.log('콜백 추가 시 사용할 환자 ID:', safePatientId);

 // 필수 입력 항목 확인
if (!callbackDate || !callbackResult) return

// 한 번 더 이전 단계 콜백 완료 여부 확인
if (!isCallbackSequenceValid(callbackType)) {
  alert(`${callbackType} 콜백을 추가하기 전에 이전 단계의 콜백을 완료해야 합니다.`);
  return;
}
try {
setIsLoading(true)
// 콜백 결과에 따른 처리
if (callbackResult === '상담중') {
  // 상담 중인 경우 - 현재 상담 저장과 다음 상담 예약
  const combinedNotes = `[상담 내용]\n${callbackNotes}\n\n[다음 상담 계획]\n${nextPlanNotes}`;
  
  let nextStepValue = '';
    if (nextCallbackType === '2차') {
      nextStepValue = '2차_콜백';
    } else if (nextCallbackType === '3차') {
      nextStepValue = '3차_콜백';
    } else if (nextCallbackType === '4차') {
      nextStepValue = '4차_콜백';
    } else if (nextCallbackType === '5차') {
      nextStepValue = '5차_콜백';
    } else if (nextCallbackType === '예약완료') {
      nextStepValue = '예약_확정';
    } else if (nextCallbackType === '재검토') {
      nextStepValue = ''; // 재검토는 빈 문자열로 처리
    }

  // 1. 현재 상담 완료 처리 부분
  await dispatch(addCallback({
    patientId: safePatientId, // 🔥 검증된 ID 사용
    callbackData: {
      date: callbackDate,
      status: '완료',
      notes: combinedNotes,
      type: callbackType,
      time: undefined,
      nextStep: nextStepValue as any,
      handledBy: effectiveUser.id,
      handledByName: effectiveUser.name,
      createdBy: effectiveUser.id,
      createdByName: effectiveUser.name
    }
  })).unwrap();

  // 🔥 활동 로그 기록 - 콜백 완료
    await logCallbackAction(
      'callback_complete',
      patient.id,
      patient.name,
      {
        callbackType: callbackType,
        callbackDate: callbackDate,
        result: '상담중',
        nextStep: nextStepValue,
        handledBy: effectiveUser.name,
        handledByName: effectiveUser.name,
        notes: `${callbackType} 콜백 완료 - 다음 단계: ${nextCallbackType}`
      }
    )
  
  // 2. 다음 상담 예약 자동 생성
  if (nextCallbackType !== '예약완료' && nextCallbackType !== '재검토') {
    await dispatch(addCallback({
      patientId: safePatientId, // 🔥 검증된 ID 사용
      callbackData: {
        date: nextCallbackDate,
        status: '예정',
        notes: `다음 ${nextCallbackType} 콜백 예정`, // 간단한 메모로 변경
        type: nextCallbackType as any,
        time: undefined
      }
    })).unwrap();

    // 🔥 이 부분 추가 - 다음 콜백 등록 로깅
    await logCallbackAction(
      'callback_create',
      patient.id,
      patient.name,
      {
        callbackType: nextCallbackType,
        callbackDate: nextCallbackDate,
        status: '예정',
        handledBy: effectiveUser.name,
        notes: `${nextCallbackType} 콜백 예약 등록`
      }
    )      
  }
  
} else if (callbackResult === '부재중') {
  // 부재중인 경우
  const notes = '부재중: 연락이 되지 않았습니다.';
  
  await dispatch(addCallback({
    patientId: safePatientId, // 🔥 검증된 ID 사용
    callbackData: {
      date: callbackDate,
      status: '부재중',
      notes: notes,
      type: callbackType,
      time: undefined,
      // 🔥 담당자 정보 추가
      handledBy: effectiveUser.id,
      handledByName: effectiveUser.name,
      createdBy: effectiveUser.id,
      createdByName: effectiveUser.name
    }
  })).unwrap()

  
  // 마지막 콜백(3차)이 부재중인 경우 '부재중'으로 상태 변경
  if (callbackType === '3차') {
    await dispatch(updatePatient({
      patientId: safePatientId, // 🔥 검증된 ID 사용
      patientData: {
        status: '부재중'
      }
    })).unwrap();
  }
  
} else if (callbackResult === '예약완료') {
  // 🔥 예약 완료 처리 수정
  const today = new Date().toISOString().split('T')[0];
  const reservationDateTime = `${reservationDate} ${reservationTime}`;
  
  const terminationNote = callbackNotes.trim() 
    ? `[예약완료] 예약일시: ${reservationDateTime}\n\n${callbackNotes}`
    : `[예약완료] 예약일시: ${reservationDateTime}`;
  
  console.log('예약 완료 처리 시 환자 ID:', safePatientId);
  
  // 환자 종결 처리만 수행 (콜백 추가는 이 안에서 자동으로 처리됨)
  await dispatch(completePatient({
    patientId: safePatientId, // 🔥 검증된 ID 사용
    reason: terminationNote
  })).unwrap();

  // 🔥 활동 로그 기록 - 부재중
    await logPatientCompleteAction( // 🔥 함수명 변경
      'patient_complete',
        patient.id,
        patient.name,
        {
          callbackType: callbackType,
          result: '종결',
          terminationReason: terminationReason,
          handledBy: effectiveUser.name,
          notes: `${callbackType} 콜백 - 종결 처리`
        }
      )
  
  // 환자 정보 새로고침
  dispatch(selectPatient(patient.id));
} else if (callbackResult === '종결') {
  // 🔥 종결 처리 수정
  console.log('종결 처리 시 환자 ID:', safePatientId);
  
  await dispatch(completePatient({
    patientId: safePatientId, // 🔥 검증된 ID 사용
    reason: terminationReason
  })).unwrap();

     // 🔥 활동 로그 기록 - 종결 처리
    await logPatientCompleteAction(
      'patient_complete',
      patient.id,
      patient.name,
      {
        callbackType: callbackType,
        result: '종결',
        terminationReason: terminationReason,
        handledBy: effectiveUser.name,
        notes: `${callbackType} 콜백 - 종결 처리`
      }
    )
    
    // 환자 정보 새로고침
    dispatch(selectPatient(patient.id));
  }

// 결과에 따른 알림 표시
if (callbackResult === '부재중' && callbackType === '3차') {
  alert('3차 부재중 콜백이 기록되었습니다. 환자 상태가 "부재중"으로 자동 변경되었습니다.');
} else if (callbackResult === '예약완료') {
  alert('환자의 예약이 완료되었습니다.');
} else if (callbackResult === '종결') {
  alert('환자가 성공적으로 종결 처리되었습니다.');
} else {
  alert('콜백이 등록되었습니다.');
}

// 모든 조건에서 성공 후 폼 초기화
resetForm();
} catch (error) {
console.error('콜백 추가 오류:', error)
alert('콜백 추가 중 오류가 발생했습니다.')
} finally {
setIsLoading(false)
}
}
// 콜백 취소 모달 열기
const handleOpenCancelModal = (callback: CallbackItem) => {
// 종결된 환자인 경우 콜백 취소 불가
if (patient.isCompleted) {
alert('종결 처리된 환자의 콜백은 취소할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
return;
}
if (callback.status === '취소') {
  alert('이미 취소된 콜백입니다.')
  return
}

if (callback.status === '완료') {
  alert('이미 완료된 콜백은 취소할 수 없습니다.')
  return
}

setSelectedCallback(callback)
setIsCanceling(true)
}
// 콜백 삭제 모달 열기
const handleOpenDeleteModal = (callback: CallbackItem) => {
// 종결된 환자인 경우, 종결 레코드는 삭제 불가
if (patient.isCompleted && callback.isCompletionRecord === true) {
alert('종결 처리 기록은 삭제할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
return;
}
setCallbackToDelete(callback)
setIsDeleting(true)
}
// 콜백 종결 모달 열기
const handleOpenCompleteModal = (isSuccessful: boolean) => {
// 종결된 환자인 경우 종결 처리 불가
if (patient.isCompleted) {
alert('이미 종결 처리된 환자입니다.');
return;
}
setIsSuccess(isSuccessful)
setIsConfirmingComplete(true)
}
// 종결 취소 모달 열기
const handleOpenCancelCompletionModal = () => {
if (!patient.isCompleted) {
alert('종결 처리되지 않은 환자입니다.');
return;
}
setIsConfirmingCancelCompletion(true);
}
// 콜백 취소 함수 수정 - 중복 생성 문제 해결
const handleCancelCallback = async () => {
if (!selectedCallback) return
// 종결된 환자인 경우 콜백 취소 불가
if (patient.isCompleted) {
  alert('종결 처리된 환자의 콜백은 취소할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
  resetCancelForm();
  return;
}

try {
  setIsLoading(true)
  
  // Redux 액션 디스패치
  await dispatch(cancelCallback({
    patientId: patient.id,
    callbackId: selectedCallback.id,
    cancelReason: cancelReason
  })).unwrap()

  // 🔥 이 부분 추가
  await logCallbackAction(
    'callback_cancel',
    patient.id,
    patient.name,
    {
      callbackId: selectedCallback.id,
      callbackType: selectedCallback.type,
      callbackDate: selectedCallback.date,
      cancelReason: cancelReason,
      handledBy: effectiveUser.name,
      notes: `${selectedCallback.type} 콜백 취소`
    }
  )
  
  // selectPatient를 호출하여 환자 정보 새로고침
  // 이 시점에서 Redux 스토어는 이미 업데이트되었고, useEffect에 의해 
  // callbackHistory 상태가 자동으로 업데이트됨 
  // -> 로컬에서 추가로 상태 업데이트 필요 없음
   dispatch(selectPatient(patient.id));
     
     // 성공 처리
     resetCancelForm()
   } catch (error) {
     console.error('콜백 취소 오류:', error)

     // 🔥 활동 로그 기록 - 콜백 취소 실패
     try {
       await logCallbackAction(
         'callback_cancel',
         patient.id,
         patient.name,
         {
           error: error instanceof Error ? error.message : '알 수 없는 오류',
           callbackId: selectedCallback.id,
           attemptedBy: effectiveUser.name
         }
       )
     } catch (logError) {
       console.warn('활동 로그 기록 실패:', logError)
     }

     alert('콜백 취소 중 오류가 발생했습니다.')
   } finally {
     setIsLoading(false)
   }
 }
 
 // 🔥 콜백 삭제 함수 수정 - 즉시 반영
const handleDeleteCallback = async () => {
  if (!callbackToDelete) return
  
  // 종결된 환자인 경우, 종결 레코드는 삭제 불가
  if (patient.isCompleted && callbackToDelete.isCompletionRecord === true) {
    alert('종결 처리 기록은 삭제할 수 없습니다. 먼저 종결 처리를 취소해주세요.');
    resetDeleteForm();
    return;
  }
  
  try {
    setIsLoading(true)
    
    // 🔥 환자 ID 검증
    const validPatientId = validatePatientForAPI(patient, 'handleDeleteCallback');
    if (!validPatientId) {
      resetDeleteForm();
      setIsLoading(false);
      return;
    }
    
    console.log('🔍 콜백 삭제 시작:', {
      patientId: validPatientId,
      callbackId: callbackToDelete.id,
      callbackType: callbackToDelete.type,
      callbackDate: callbackToDelete.date
    });
    
    // Redux 액션 디스패치
    const result = await dispatch(deleteCallback({
      patientId: validPatientId,
      callbackId: callbackToDelete.id
    })).unwrap()

    console.log('🔍 콜백 삭제 Redux 결과:', result);

    // 🔥 활동 로그 기록
    await logCallbackAction(
      'callback_delete',
      validPatientId,
      patient.name,
      {
        callbackId: callbackToDelete.id,
        callbackType: callbackToDelete.type,
        callbackDate: callbackToDelete.date,
        handledBy: effectiveUser.name,
        notes: `${callbackToDelete.type} 콜백 삭제`
      }
    )
    
    // 🔥 1. Redux 상태에서 환자 정보 새로고침 (selectPatient 호출)
    dispatch(selectPatient(validPatientId));
    
    // 🔥 2. 강제 리렌더링 트리거
    setForceUpdate(prev => prev + 1);
    
    // 🔥 3. 환자 목록도 새로고침 (필요한 경우)
    await refreshPatientData();
    
    // 🔥 4. 약간의 지연 후 추가 새로고침 (안전장치)
    setTimeout(() => {
      dispatch(selectPatient(validPatientId));
      setForceUpdate(prev => prev + 1);
      console.log('🔍 지연된 콜백 삭제 후 새로고침 완료');
    }, 100);
    
    // 성공 처리
    resetDeleteForm()
    alert('콜백이 삭제되었습니다.')
    
    console.log('✅ 콜백 삭제 완료 및 화면 갱신');
    
  } catch (error) {
    console.error('🚨 콜백 삭제 오류:', error)
    
    // 🔥 오류 로그에도 환자 ID 정보 포함
    console.log('🔍 삭제 실패 시 환자 정보:', {
      patient: patient,
      callbackToDelete: callbackToDelete,
      error: error instanceof Error ? error.message : error
    });
    
    alert('콜백 삭제 중 오류가 발생했습니다.')
    resetDeleteForm()
  } finally {
    setIsLoading(false)
  }
}

 
 // 콜백 종결 처리 함수 - 중복 생성 문제 해결
 const handleCompleteProcess = async () => {
 // 🔥 환자 정보 검증 추가
 if (!patient || !patient._id || !patient.id) {
   console.error('환자 정보가 부족합니다:', patient);
   alert('환자 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
   resetCompleteForm();
   return;
 }

 try {
   setIsLoading(true);
   
   const today = new Date().toISOString().split('T')[0];
   const safePatientId = patient._id || patient.id;
   
   // 중복 제거: 이미 종결 처리된 환자인지 확인
   if (patient.isCompleted) {
     alert('이미 종결 처리된 환자입니다.');
     resetCompleteForm();
     setIsLoading(false);
     return;
   }
   
   console.log('종결 처리 시 환자 ID:', safePatientId);
   
   // 예약 성공인 경우
   if (isSuccess) {
     const reservationDateTime = `${reservationDate} ${reservationTime}`;
     const terminationReason = `[예약완료] 예약일시: ${reservationDateTime}\n${completionNote}`;
     
     await dispatch(completePatient({
       patientId: safePatientId, // 🔥 검증된 ID 사용
       reason: terminationReason
     })).unwrap();
     
     // 🔥 활동 로그 기록 - 예약 완료
     await logPatientCompleteAction(
       'patient_complete',
       patient.id,
       patient.name,
       {
         callbackType: '수동처리',
         result: '예약완료',
         reservationDate: reservationDate,
         reservationTime: reservationTime,
         completionNote: completionNote,
         handledBy: effectiveUser.name,
         notes: '수동 예약 완료 처리'
       }
     )
     
     // 환자 정보 새로고침
     dispatch(selectPatient(patient.id));
     
     // 성공 처리
     resetCompleteForm();
     alert('환자의 예약이 완료되었습니다.');
   } 
   // 일반 종결 처리
   else {
     const terminationReason = completionNote || '종결 처리';
     
     await dispatch(completePatient({
       patientId: safePatientId, // 🔥 검증된 ID 사용
       reason: terminationReason
     })).unwrap();
     
     // 🔥 활동 로그 기록 - 종결 처리
     await logPatientCompleteAction(
       'patient_complete',
       patient.id,
       patient.name,
       {
         callbackType: '수동처리',
         result: '종결',
         terminationReason: terminationReason,
         handledBy: effectiveUser.name,
         notes: '수동 종결 처리'
       }
     )
     
     // 환자 정보 새로고침
     dispatch(selectPatient(patient.id));
     
     // 성공 처리
     resetCompleteForm();
     alert('환자가 종결 처리되었습니다.');
   }
 } catch (error) {
   console.error('종결 처리 오류:', error);
   resetCompleteForm();
   alert('종결 처리 중 오류가 발생했습니다.');
 } finally {
   setIsLoading(false);
 }
}
 
 // 🔥 종결 취소 처리 함수 수정 - 새로고침 추가
  // 🔥 종결 취소 처리 함수 수정 - 새로고침 강화
const handleCancelCompletionProcess = async () => {
  try {
    setIsLoading(true)
    
    const safePatientId = patient._id || patient.id;
    if (!safePatientId) {
      console.error('환자 ID가 없습니다:', { 
        hasPatient: !!patient, 
        hasMongoId: !!patient?._id, 
        hasId: !!patient?.id,
        patient: patient 
      });
      alert('환자 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      resetCancelCompletionForm();
      setIsLoading(false);
      return;
    }
    
    console.log('종결 취소 시 사용할 환자 ID:', safePatientId);
    
    // Redux 액션 디스패치
    await dispatch(cancelPatientCompletion(safePatientId)).unwrap();
      
    // 🔥 강화된 새로고침 로직
    // 1. 환자 목록 새로고침
    await dispatch(fetchPatients()).unwrap();
    
    // 2. 현재 선택된 환자 정보 새로고침
    dispatch(selectPatient(safePatientId));
    
    // 3. 강제 리렌더링 트리거
    setForceUpdate(prev => prev + 1);
    
    // 4. 약간의 딜레이 후 추가 새로고침 (안전장치)
    setTimeout(() => {
      dispatch(selectPatient(safePatientId));
    }, 100);
    
    // 성공 처리
    resetCancelCompletionForm();
    alert('환자 종결 처리가 취소되었습니다.');
  } catch (error) {
    console.error('종결 취소 오류:', error);
    alert('종결 취소 중 오류가 발생했습니다.');
  } finally {
    setIsLoading(false);
  }
}
 
 // 콜백 진행 상태에 따른 아이콘과 색상
 const getStatusInfo = (status: string) => {
   if (status === '완료') {
     return {
       icon: HiOutlineCheck,
       color: 'text-green-600 bg-green-100'
     }
   }
   if (status === '예정') {
     return {
       icon: HiOutlineCalendar,
       color: 'text-blue-600 bg-blue-100'
     }
   }
   if (status === '취소') {
     return {
       icon: HiOutlineX,
       color: 'text-red-600 bg-red-100'
     }
   }
   if (status === '종결') {
     return {
       icon: HiOutlineStop,
       color: 'text-gray-600 bg-gray-100'
     }
   }
   if (status === '부재중') {
     return {
       icon: HiOutlineBan,
       color: 'text-orange-600 bg-orange-100'
     }
   }
   return {
     icon: HiOutlinePencil,
     color: 'text-gray-600 bg-gray-100'
   }
 }
 
 // 콜백 유형에 따른 스타일
 const getCallbackTypeStyle = (type: string) => {
   const style = {
     '1차': 'bg-orange-100 text-orange-800',
     '2차': 'bg-orange-200 text-orange-900',
     '3차': 'bg-red-100 text-red-800',
     '4차': 'bg-red-200 text-red-900', 
     '5차': 'bg-red-300 text-red-900'  
   }
   return style[type as keyof typeof style] || 'bg-gray-100 text-gray-800'
 }  

 // 예약 완료 여부 확인 함수 추가
 const isReservationCompleted = (patient: Patient) => {
 return patient.isCompleted && 
        patient.completedReason && 
        patient.completedReason.includes('[예약완료]');
};
 
 // 환자 상태가 종결 가능한 상태인지 확인
 const canComplete = ['잠재고객', '콜백필요', '미응답'].includes(patient.status) && !patient.isCompleted;

 // 디버깅을 위한 로그 추가
 console.log('상태 디버깅:', {
   isAddingCallback,
   patientIsCompleted: patient.isCompleted,
   canComplete,
   patientStatus: patient.status
 });

 // 예약 완료 상담 내용 추출 함수 추가
 const getReservationConsultationNotes = (patient: Patient) => {
   if (!patient.completedReason) return '';
   
   // 공백으로 분할해서 처리 (현재는 줄바꿈이 없이 저장되고 있음)
   const text = patient.completedReason;
   
   // [예약완료] 예약일시: YYYY-MM-DD HH:MM 뒤의 내용을 상담 내용으로 처리
   const match = text.match(/\[예약완료\]\s*예약일시:\s*[\d-]+\s+[\d:]+\s*(.*)/);
   if (match && match[1]) {
     return match[1].trim();
   }
   
   return '';
 };
 
 // 예약 정보 추출 함수 추가
 const getReservationInfo = (patient: Patient) => {
   if (!patient.completedReason) return '';
   
   // [예약완료] 예약일시: YYYY-MM-DD HH:MM 부분만 추출
   const match = patient.completedReason.match(/\[예약완료\]\s*(예약일시:\s*[\d-]+\s+[\d:]+)/);
   if (match && match[1]) {
     return match[1].trim();
   }
   
   return '';
 };


  return (
    <div className="space-y-6">
      {/* 🔥 헤더 추가 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">콜백 관리</h2>
          <div className="flex items-center space-x-4">
            {effectiveUser && (
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                담당자: {effectiveUser.name}
              </div>
            )}
            
            {/* 콜백 현황 표시 */}
            <div className="flex items-center space-x-3 text-sm">
              <div className="flex items-center space-x-1">
                <Icon icon={HiOutlineClipboardCheck} className="text-blue-500" />
                <span className="text-gray-600">예정: {scheduledCallbacks}건</span>
              </div>
              <div className="flex items-center space-x-1">
                <Icon icon={HiOutlineCheck} className="text-green-500" />
                <span className="text-gray-600">완료: {displayCompletedCallbacks}건</span>
              </div>
              <div className="flex items-center space-x-1">
                <Icon icon={HiOutlineBan} className="text-orange-500" />
                <span className="text-gray-600">부재중: {missedCallbacks}건</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    
      {/* 콜백 요약 정보 - 수정된 부분 */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-md font-semibold text-blue-800 mb-3">콜백 현황</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-md border border-blue-200">
            <div className="text-sm text-blue-600 mb-1">총 콜백 횟수</div>
            <div className="text-2xl font-semibold text-text-primary">
              {completedNonMissedCallbacks}회
              {scheduledCallbacks > 0 && 
                <span className="text-sm font-normal text-blue-600 ml-2">
                  (예정: {scheduledCallbacks}회)
                </span>
              }
              {missedCallbacks > 0 && 
                <span className="text-sm font-normal text-orange-600 ml-2">
                  (부재중: {missedCallbacks}회)
                </span>
              }
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-md border border-blue-200">
            <div className="text-sm text-blue-600 mb-1">다음 콜백 단계</div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isReservationCompleted(patient)
                ? 'bg-green-100 text-green-800'  // 예약 완료인 경우 녹색으로 표시
                : patient.isCompleted 
                  ? 'bg-gray-100 text-gray-800'  // 일반 종결인 경우 회색으로 표시
                  : getCallbackTypeStyle(getNextCallbackType())
            }`}>
              {isReservationCompleted(patient)
                ? '예약 완료'  // 예약 완료로 문구 변경
                : patient.isCompleted 
                  ? '종결됨' 
                  : getNextCallbackType()}
            </div>
            {patient.isCompleted && patient.completedAt && (
              <div className="mt-1 text-xs text-gray-600">
                {isReservationCompleted(patient) 
                  ? '예약일: ' // 예약 완료인 경우 '예약일'로 표시
                  : '종결일: '}{patient.completedAt}
              </div>
            )}
          </div>
        </div>
      </div>
            
      {/* 환자 종결 알림 배너 */}
      {patient.isCompleted && (
        <div className={`card ${
          isReservationCompleted(patient)
            ? 'bg-green-50 border-green-300'  // 예약 완료인 경우 녹색으로 표시
            : 'bg-gray-50 border-gray-300'    // 일반 종결인 경우 회색으로 표시
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${
              isReservationCompleted(patient)
                ? 'bg-green-200 text-green-700'  // 예약 완료인 경우 녹색으로 표시
                : 'bg-gray-200 text-gray-700'    // 일반 종결인 경우 회색으로 표시
            } flex items-center justify-center`}>
              <Icon icon={isReservationCompleted(patient) ? HiOutlineCheck : HiOutlineStop} size={20} />
            </div>
            <div className="flex-1">
              <h3 className={`text-md font-semibold ${
                isReservationCompleted(patient) ? 'text-green-800' : 'text-gray-800'
              }`}>
                {isReservationCompleted(patient)
                  ? '이 환자는 예약 완료되었습니다'  // 예약 완료로 문구 변경
                  : '이 환자는 종결 처리되었습니다'}
              </h3>
              
              {/* 예약 정보와 상담 내용을 모두 표시 - PatientDetailModal과 동일한 구조 적용 */}
              {isReservationCompleted(patient) ? (
                <div className="mt-1 space-y-2">
                  {/* 예약 정보 표시 */}
                  {getReservationInfo(patient) && (
                    <p className="text-sm text-green-600 font-medium">
                      {getReservationInfo(patient)}
                    </p>
                  )}
                  
                  {/* 상담 내용 표시 */}
                  {getReservationConsultationNotes(patient) && (
                    <p className="text-sm text-green-600">
                      상담내용: {getReservationConsultationNotes(patient)}
                    </p>
                  )}
                </div>
              ) : patient.completedReason ? (
                // 일반 종결인 경우 기존 방식 유지
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
                  상담내용: {patient.completedReason}
                </p>
              ) : (
                <p className="text-sm text-gray-600 mt-1">
                  {isReservationCompleted(patient)
                    ? '예약 정보가 기록되지 않았습니다.'
                    : '종결 사유가 기록되지 않았습니다.'}
                </p>
              )}
              
              {patient.completedAt && (
                <p className={`text-xs ${
                  isReservationCompleted(patient) ? 'text-green-500' : 'text-gray-500'
                } mt-2`}>
                  {isReservationCompleted(patient) ? '예약 확정일: ' : '종결일: '}{patient.completedAt}
                </p>
              )}
            </div>
            <button
              className={`px-4 py-2 ${
                isReservationCompleted(patient)
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-gray-500 hover:bg-gray-600'
              } text-white rounded-md transition-colors flex items-center gap-2`}
              onClick={handleOpenCancelCompletionModal}
            >
              <Icon icon={HiOutlineRefresh} size={18} />
              <span>{isReservationCompleted(patient) ? '예약 취소' : '종결 취소'}</span>
            </button>
          </div>
        </div>
      )}
      
      {/* 이벤트 타겟 섹션 추가 */}
      <EventTargetSection patient={patient} />

      {/* 콜백 액션 영역 */}
      <div className="flex flex-wrap gap-3">
        {/* 콜백 추가 버튼 - 종결되지 않은 환자만 표시 */}
        {!patient.isCompleted && (
          <>
            {!isAddingCallback && (
              <>
                {!isAddingCallback && (
                  <>
                    <button
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
                      onClick={handleOpenAddCallback}
                    >
                      <Icon icon={HiOutlinePlus} size={18} />
                      <span>새 콜백 추가</span>
                    </button>
                    
                    {/* 부재중 기록 버튼 제거됨 */}
                  </>
                )}
              </>
            )}
          </>
        )}
        
        {/* 종결 버튼은 이미 삭제됨 */}
      </div>
      
      {/* 콜백 추가 폼 */}
      {isAddingCallback && (
        <div className="card mt-4 mb-6">
          <h3 className="text-md font-semibold text-text-primary mb-4">
            새 콜백 추가
          </h3>
          <div className="space-y-4">
            {/* 콜백 날짜 */}
            <div>
              <label htmlFor="callbackDate" className="block text-sm font-medium text-text-primary mb-1">
                콜백 날짜 <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="callbackDate"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="form-input pl-10"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlineCalendar} size={18} />
                </span>
              </div>
            </div>
            
            {/* 콜백 유형 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                콜백 유형 <span className="text-error">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={callbackType === '5차'}
                    onChange={() => setCallbackType('5차')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-text-secondary">5차</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={callbackType === '4차'}
                    onChange={() => setCallbackType('4차')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-text-secondary">4차</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={callbackType === '3차'}
                    onChange={() => setCallbackType('3차')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-text-secondary">3차</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={callbackType === '2차'}
                    onChange={() => setCallbackType('2차')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-text-secondary">2차</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={callbackType === '1차'}
                    onChange={() => setCallbackType('1차')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-text-secondary">1차</span>
                </label>
              </div>
            </div>
            
            {/* 콜백 결과 - 새로 추가 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                콜백 결과 <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="flex items-center justify-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-light-bg/50 transition-colors">
                  <input
                    type="radio"
                    name="callbackResult"
                    value="상담중"
                    checked={callbackResult === '상담중'}
                    onChange={() => setCallbackResult('상담중')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-text-primary">상담 중</span>
                </label>
                
                <label className="flex items-center justify-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-light-bg/50 transition-colors">
                  <input
                    type="radio"
                    name="callbackResult"
                    value="부재중"
                    checked={callbackResult === '부재중'}
                    onChange={() => setCallbackResult('부재중')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-text-primary">부재중</span>
                </label>
                
                <label className="flex items-center justify-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-light-bg/50 transition-colors">
                  <input
                    type="radio"
                    name="callbackResult"
                    value="예약완료"
                    checked={callbackResult === '예약완료'}
                    onChange={() => setCallbackResult('예약완료')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-text-primary">예약 완료</span>
                </label>
                
                <label className="flex items-center justify-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-light-bg/50 transition-colors">
                  <input
                    type="radio"
                    name="callbackResult"
                    value="종결"
                    checked={callbackResult === '종결'}
                    onChange={() => setCallbackResult('종결')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-text-primary">종결</span>
                </label>
              </div>
            </div>
            
            {/* 상담 중인 경우 다음 상담 예정일 필드 추가 */}
            {callbackResult === '상담중' && (
              <div className="border rounded-md overflow-hidden p-4 bg-blue-50 border-blue-200">
                <h4 className="font-medium text-blue-700 mb-3">다음 상담 예약</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="nextCallbackDate" className="block text-sm font-medium text-blue-700 mb-1">
                      다음 상담 예정일 <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        id="nextCallbackDate"
                        value={nextCallbackDate}
                        onChange={(e) => setNextCallbackDate(e.target.value)}
                        className="form-input pl-10 w-full"
                        min={format(addDays(new Date(callbackDate), 1), 'yyyy-MM-dd')} // 현재 콜백 날짜보다 이후로 설정
                        required
                      />
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600">
                        <Icon icon={HiOutlineCalendar} size={18} />
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="nextCallbackType" className="block text-sm font-medium text-blue-700 mb-1">
                      다음 콜백 유형 <span className="text-error">*</span>
                    </label>
                    <select
                      id="nextCallbackType"
                      value={nextCallbackType}
                      onChange={(e) => setNextCallbackType(e.target.value as any)}
                      className="form-input pl-4 w-full"
                      required
                    >
                      {callbackType === '1차' && <option value="2차">2차 콜백</option>}
                      {callbackType === '2차' && <option value="3차">3차 콜백</option>}
                      {callbackType === '3차' && <option value="4차">4차 콜백</option>}
                      {callbackType === '4차' && <option value="5차">5차 콜백</option>}
                      {/* 모든 단계에서 선택 가능한 옵션 */}
                      <option value="예약완료">예약 확정</option>
                      <option value="재검토">재검토</option>
                    </select>
                  </div>
                </div>
                
                {/* 빠른 날짜 선택 버튼 추가 */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded border border-blue-200 hover:bg-blue-200"
                    onClick={() => setNextCallbackDate(format(addDays(new Date(), 3), 'yyyy-MM-dd'))}
                  >
                    3일 후
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded border border-blue-200 hover:bg-blue-200"
                    onClick={() => setNextCallbackDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'))}
                  >
                    7일 후
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded border border-blue-200 hover:bg-blue-200"
                    onClick={() => setNextCallbackDate(format(addDays(new Date(), 14), 'yyyy-MM-dd'))}
                  >
                    14일 후
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded border border-blue-200 hover:bg-blue-200"
                    onClick={() => setNextCallbackDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'))}
                  >
                    30일 후
                  </button>
                </div>
                
                <p className="text-xs text-blue-600 mt-3">
                  현재 상담이 완료되면 자동으로 다음 상담이 예약됩니다.
                </p>
              </div>
            )}

            {/* 예약 완료인 경우 예약 정보 입력 필드 추가 */}
            {callbackResult === '예약완료' && (
              <div className="border rounded-md overflow-hidden p-4 bg-green-50 border-green-200">
                <h4 className="font-medium text-green-700 mb-3">예약 정보</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reservationDate" className="block text-sm font-medium text-green-700 mb-1">
                      예약 날짜 <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        id="reservationDate"
                        value={reservationDate}
                        onChange={(e) => setReservationDate(e.target.value)}
                        className="form-input pl-10 w-full"
                        required
                      />
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                        <Icon icon={HiOutlineCalendar} size={18} />
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="reservationTime" className="block text-sm font-medium text-green-700 mb-1">
                      예약 시간 <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        id="reservationTime"
                        value={reservationTime}
                        onChange={(e) => setReservationTime(e.target.value)}
                        className="form-input pl-10 w-full"
                        required
                      />
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                        <Icon icon={HiOutlineClock} size={18} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 종결인 경우 종결 사유 입력 필드 추가 */}
            {callbackResult === '종결' && (
              <div className="border rounded-md overflow-hidden p-4 bg-gray-50 border-gray-200">
                <label htmlFor="terminationReason" className="block text-sm font-medium text-gray-700 mb-1">
                  종결 사유 <span className="text-error">*</span>
                </label>
                <textarea
                  id="terminationReason"
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  className="form-input min-h-[80px] w-full"
                  placeholder="환자 종결 사유를 입력하세요..."
                  required
                />
              </div>
            )}

            {/* 상담 내용 - 부재중/예약완료/종결 시 비활성화 */}
            <div>
              <label htmlFor="callbackNotes" className="block text-sm font-medium text-text-primary mb-1">
                상담 내용 <span className="text-error">*</span>
              </label>
              <textarea
                id="callbackNotes"
                value={callbackNotes}
                onChange={(e) => setCallbackNotes(e.target.value)}
                className="form-input min-h-[100px]"
                placeholder="상담 내용을 입력하세요"
                disabled={callbackResult === '부재중' || callbackResult === '종결'} // 예약완료 제거
                required={callbackResult === '상담중' || callbackResult === '예약완료'} // 예약완료 추가
              />
              {(callbackResult === '부재중' || callbackResult === '종결') && (
                <p className="text-xs text-gray-500 mt-1">
                  {callbackResult === '부재중' ? '부재중인 경우 상담 내용을 입력할 수 없습니다.' : 
                  '종결 처리 시 상담 내용이 자동으로 설정됩니다.'}
                </p>
              )}
            </div>
            
            {/* 다음 상담 계획 - 부재중/예약완료/종결 시 비활성화 */}
            <div>
              <label htmlFor="nextPlanNotes" className="block text-sm font-medium text-text-primary mb-1">
                다음 상담 계획 <span className="text-error">*</span>
              </label>
              <textarea
                id="nextPlanNotes"
                value={nextPlanNotes}
                onChange={(e) => setNextPlanNotes(e.target.value)}
                className="form-input min-h-[100px]"
                placeholder="다음 상담 시 논의할 내용이나 계획을 입력하세요"
                disabled={callbackResult === '부재중' || callbackResult === '예약완료' || callbackResult === '종결'}
                required={callbackResult === '상담중'}
              />
              {(callbackResult === '부재중' || callbackResult === '예약완료' || callbackResult === '종결') && (
                <p className="text-xs text-gray-500 mt-1">
                  {callbackResult === '부재중' ? '부재중인 경우 다음 상담 계획을 입력할 수 없습니다.' : 
                  callbackResult === '예약완료' ? '예약 완료 처리 시 다음 상담 계획은 필요하지 않습니다.' : 
                  '종결 처리 시 다음 상담 계획은 필요하지 않습니다.'}
                </p>
              )}
            </div>
            
            {/* 버튼 영역 */}
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                className="btn btn-outline"
                onClick={resetForm}
                disabled={isLoading}
              >
                취소
              </button>
              <button
                type="button"
                className="btn bg-primary hover:bg-primary/90 text-white"
                onClick={handleAddCallback}
                disabled={isLoading || !callbackDate || 
                        (callbackResult === '상담중' && (!callbackNotes || !nextPlanNotes)) || 
                        (callbackResult === '예약완료' && (!reservationDate || !reservationTime || !callbackNotes)) || // callbackNotes 필수 추가
                        (callbackResult === '종결' && !terminationReason) ||
                        !callbackResult}
              >
                {isLoading ? '처리 중...' : '콜백 추가하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 콜백 이력 */}
      <div className="card">
        <h3 className="text-md font-semibold text-text-primary mb-4">콜백 이력</h3>
        
        {callbackHistory.length === 0 ? (
          <div className="text-center py-6 text-text-secondary">
            아직 기록된 콜백 이력이 없습니다. 
          </div>
        ) : (
          <div className="space-y-4">
            

            {callbackHistory.map((callback) => {
              // 콜백 상태에 따른 변수 설정
              const statusInfo = getStatusInfo(callback.status);
              const isCanceled = callback.status === '취소';
              const isCompleted = callback.status === '완료';
              const isTerminated = callback.status === '종결';
              const isMissed = isCompleted && isMissedCallNote(callback.notes);
              const isCompletionRecord = callback.isCompletionRecord === true;
              const isPurelyMissed = callback.status === '부재중';
              
              // 예약 확정 콜백 여부 확인
               const isReservationCompletion = isCompletionRecord && 
                callback.notes && 
                callback.notes.includes('[예약완료]');

              // 종결 처리 여부 확인 - 새로 추가
              const isTerminationCompletion = isCompletionRecord && 
                callback.notes && 
                !callback.notes.includes('[예약완료]');

              // 완료된 콜백에서 예약 정보가 있는지 확인 (2차 완료 후 예약 확정한 경우)
              const hasReservationInfo = isCompleted && 
                callback.notes &&
                callback.notes.includes('[예약 정보]');

              return (
                <div 
                  key={callback.id} 
                  className={`p-4 border rounded-md flex flex-col md:flex-row md:items-start gap-4 ${
                    isReservationCompletion
                      ? 'border-green-300 bg-green-50/40'
                      : isTerminationCompletion
                        ? 'border-gray-300 bg-gray-50/60'
                        : hasReservationInfo
                          ? 'border-green-200 bg-green-50/30'
                          : isCompletionRecord || isTerminated
                            ? 'border-gray-300 bg-gray-50'
                            : isCanceled 
                              ? 'border-red-200 bg-red-50/30' 
                              : isPurelyMissed
                                ? 'border-orange-200 bg-orange-50/30'
                                : isMissed
                                  ? 'border-orange-200 bg-orange-50/30'
                                  : isCompleted
                                    ? 'border-green-200 bg-green-50/30'
                                    : 'border-border'
                  }`}
                >
                  {/* 왼쪽 부분 - 콜백 날짜와 상태 정보 */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className={`w-10 h-10 rounded-full ${
                      isReservationCompletion
                        ? 'bg-green-200 text-green-700'
                        : isTerminationCompletion
                          ? 'bg-gray-200 text-gray-700'
                          : hasReservationInfo
                            ? 'bg-green-100 text-green-600'
                            : isCompletionRecord || isTerminated
                              ? 'bg-gray-200 text-gray-700'
                              : isPurelyMissed
                                ? 'bg-orange-100 text-orange-600'
                                : isMissed 
                                  ? 'bg-orange-100 text-orange-600' 
                                  : statusInfo.color
                    } flex items-center justify-center`}>
                      <Icon icon={
                        isReservationCompletion
                          ? HiOutlineCheck 
                          : isTerminationCompletion
                            ? HiOutlineStop
                            : hasReservationInfo
                              ? HiOutlineCheck
                              : isCompletionRecord || isTerminated
                                ? HiOutlineStop 
                                : isPurelyMissed
                                  ? HiOutlineBan
                                  : isMissed 
                                    ? HiOutlineBan 
                                    : statusInfo.icon
                      } size={20} />
                    </div>
                    <div>
                      {!isCompletionRecord ? (
                        // 일반 콜백 (날짜 표시)
                        <>
                          <div className="text-sm text-text-secondary">
                            {/* 🔥 원래 예정일과 실제 처리일 구분 표시 */}
                            {callback.status === '완료' && callback.originalScheduledDate && callback.originalScheduledDate !== callback.date ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-orange-600 text-xs bg-orange-50 px-2 py-1 rounded">
                                    예정: {callback.originalScheduledDate}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded">
                                    완료: {callback.date}
                                  </span>
                                  {callback.isDelayed && (
                                    <span className="text-red-500 text-xs bg-red-50 px-2 py-1 rounded">
                                      {Math.abs(new Date(callback.date).getTime() - new Date(callback.originalScheduledDate).getTime()) / (1000 * 60 * 60 * 24)}일 지연
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              callback.date
                            )}
                          </div>
                          {/* 🔥 담당자 정보 추가 */}
                          <div className="flex items-center space-x-4 mb-2 text-xs text-gray-500">
                            {callback.handledBy && (
                              <span>
                                처리자: {getUserDisplayName(callback.handledBy, callback.handledByName)}
                              </span>
                            )}
                            {callback.createdBy && (
                              <span>
                                등록자: {getUserDisplayName(callback.createdBy, callback.createdByName)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isTerminated ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                                종결 기록
                              </span>
                            ) : (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCallbackTypeStyle(callback.type)}`}>
                                {callback.type}
                              </span>
                            )}
                            <span className={`text-sm ${
                              isReservationCompletion ? 'text-green-700' :
                              isTerminationCompletion ? 'text-gray-700' :
                              hasReservationInfo ? 'text-green-600' :
                              isCompletionRecord || isTerminated ? 'text-gray-700' :
                              callback.status === '취소' ? 'text-red-600' : 
                              isPurelyMissed ? 'text-orange-600' :
                              isMissed ? 'text-orange-600' :
                              callback.status === '완료' ? 'text-green-600' : 
                              'text-text-primary'
                            }`}>
                              {isReservationCompletion ? '예약 확정됨' : 
                              isTerminationCompletion ? '종결 처리됨' :
                              hasReservationInfo ? '완료 (예약 확정)' :
                              isCompletionRecord || isTerminated ? '종결' : 
                              isPurelyMissed ? '부재중' :
                              isMissed ? '부재중' : 
                              callback.status}
                            </span>
                          </div>
                        </>
                      ) : isTerminationCompletion ? (
                        // 종결 처리 표시 블록 (예약 확정 블록과 유사하지만 회색)
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                            종결 처리
                          </span>
                          <span className="text-sm text-gray-700">종결 처리됨</span>
                        </div>
                      ) : isReservationCompletion ? (
                        // 예약 확정 블록
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-200 text-green-800">
                            예약 확정
                          </span>
                          <span className="text-sm text-green-700">예약 확정됨</span>
                        </div>
                      ) : (
                        // 기타 완료 블록
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                            기타
                          </span>
                          <span className="text-sm text-gray-700">기타 처리</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 오른쪽 부분 - 메모 내용 */}
                  <div className="flex-1 text-text-primary text-sm border-l border-border pl-4 ml-2">
                      {isCompletionRecord ? (
                        isTerminationCompletion ? (
                          // 종결 블록 - 최소한의 정보만 표시
                          <div className="text-gray-600 font-medium">
                            {callback.completedAt && `${format(new Date(callback.completedAt), 'yyyy-MM-dd')}에 `}
                            종결 처리되었습니다.
                          </div>
                        ) : isReservationCompletion ? (
                          // 예약 확정 블록 - 최소한의 정보만 표시
                          <div className="text-green-600 font-medium">
                            {callback.completedAt && `${format(new Date(callback.completedAt), 'yyyy-MM-dd')}에 `}
                            예약이 확정되었습니다.
                          </div>
                        ) : (
                          // 기타 완료 블록
                          <div className="text-gray-600">콜백이 완료되었습니다.</div>
                        )
                      ) : callback.status === '완료' ? (
                        <div>
                          <div className="space-y-2">
                            {callback.notes && (callback.notes.includes('[상담 내용]') || callback.notes.includes('[예약 정보]')) ? (
                              // 구조화된 포맷으로 저장된 경우
                              <>
                                {callback.notes.split('\n\n').map((section, idx) => {
                                  if (section.startsWith('[상담 내용]')) {
                                    return (
                                      <div key={idx}>
                                        <p className="font-bold text-blue-700">[상담 내용]</p>
                                        <p className="text-gray-700">{section.replace('[상담 내용]', '').trim()}</p>
                                      </div>
                                    );
                                  } else if (section.startsWith('[다음 상담 계획]')) {
                                    return (
                                      <div key={idx}>
                                        <p className="font-bold text-green-700 mt-2">[다음 상담 계획]</p>
                                        <p className="text-gray-700">{section.replace('[다음 상담 계획]', '').trim()}</p>
                                      </div>
                                    );
                                } else if (section.startsWith('[예약 정보]')) {
                                  return (
                                    <div key={idx} className="mt-2 border-t border-green-200 pt-2">
                                      <p className="font-bold text-green-700">[예약 정보]</p>
                                      <p className="text-green-600">{section.replace('[예약 정보]', '').trim()}</p>
                                    </div>
                                  );
                                }
                                return <p key={idx}>{section}</p>;
                              })}
                            </>
                          ) : (
                            // 기타 케이스 (이전 데이터 호환성 유지)
                            callback.resultNotes ? (
                              <>
                                <div>
                                  <p className="font-bold text-blue-700">[상담 내용]</p>
                                  <p className="text-gray-700">{callback.resultNotes}</p>
                                </div>
                              </>
                            ) : (
                              // 부재중이거나 일반 메모인 경우
                              isMissed ? (
                                <div className="text-orange-700">{callback.notes}</div>
                              ) : (
                                <div className="text-gray-700">{callback.notes || '-'}</div>
                              )
                            )
                          )}
                          
                          {/* 종결 처리인 경우 아래에 구분선 추가 */}
                          {callback.nextStep === '종결_처리' && (
                            <div className="mt-2 border-t border-gray-200 pt-2"></div>
                          )}
                          
                          {/* 고객 반응 표시 */}
                          {callback.customerResponse && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-text-secondary">고객 반응:</span>
                              <span className={`text-xs ${
                                callback.customerResponse === 'very_positive' ? 'text-green-600' :
                                callback.customerResponse === 'positive' ? 'text-green-500' :
                                callback.customerResponse === 'neutral' ? 'text-blue-500' :
                                callback.customerResponse === 'negative' ? 'text-orange-500' :
                                'text-red-500'
                              }`}>
                                {callback.customerResponse === 'very_positive' ? '매우 긍정적' :
                                callback.customerResponse === 'positive' ? '관심 있음' :
                                callback.customerResponse === 'neutral' ? '중립적' :
                                callback.customerResponse === 'negative' ? '부정적' : '매우 부정적'}
                              </span>
                            </div>
                          )}
                          
                          {/* 다음 단계 표시 */}
                          {callback.nextStep && (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs text-text-secondary">다음 단계:</span>
                              <span className={`text-xs ${
                                callback.nextStep === '예약_확정' ? 'text-green-600 font-medium' : 
                                callback.nextStep === '종결_처리' ? 'text-gray-600 font-medium' : 
                                callback.nextStep === '이벤트_타겟_설정' ? '이벤트 타겟 설정' :
                                'text-blue-600'
                              }`}>
                                {callback.nextStep === '2차_콜백' ? '2차 콜백 예정' :
                                callback.nextStep === '3차_콜백' ? '3차 콜백 예정' :
                                callback.nextStep === '4차_콜백' ? '4차 콜백 예정' :
                                callback.nextStep === '5차_콜백' ? '5차 콜백 예정' :
                                callback.nextStep === '예약_확정' ? '예약 확정' : 
                                callback.nextStep === '종결_처리' ? '종결 처리' : 
                                callback.nextStep === '이벤트_타겟_설정' ? '이벤트 타겟 설정' : '기타'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : callback.status === '예정' ? (
                      // 예정 상태일 때
                      <div>
                        {callback.notes && callback.notes.includes('[상담 내용]') ? (
                          <div className="space-y-2">
                            {callback.notes.split('\n\n').map((section, idx) => {
                              if (section.startsWith('[상담 내용]')) {
                                return (
                                  <div key={idx}>
                                    <p className="font-bold text-blue-700">[상담 내용]</p>
                                    <p className="text-blue-600">{section.replace('[상담 내용]', '').trim()}</p>
                                  </div>
                                );
                              } else if (section.startsWith('[다음 상담 계획]')) {
                                return (
                                  <div key={idx}>
                                    <p className="font-bold text-green-700 mt-2">[다음 상담 계획]</p>
                                    <p className="text-blue-600">{section.replace('[다음 상담 계획]', '').trim()}</p>
                                  </div>
                                );
                              }
                              return <p key={idx} className="text-blue-600">{section}</p>;
                            })}
                          </div>
                        ) : (
                          <p className="text-blue-600">{callback.notes || '예약된 콜백'}</p>
                        )}
                      </div>
                    ) : (
                      // 기타 상태 (부재중, 취소 등)
                      <div>
                        <p className={`${
                          callback.status === '취소' ? 'text-red-500' : 
                          callback.status === '부재중' ? 'text-orange-600' : 
                          'text-gray-700'
                        }`}>{callback.notes || '-'}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* 버튼 영역 */}
                  <div className="flex items-center gap-2">
                    {/* 예정된 콜백의 경우에만 완료 버튼 표시 */}
                    {callback.status === '예정' && !isCompletionRecord && !patient.isCompleted && (
                      <button
                        className="inline-flex items-center justify-center px-3 py-1 rounded border border-green-300 text-green-600 hover:bg-green-50 transition-colors duration-150"
                        onClick={() => handleOpenMarkCompleteModal(callback)}
                        title="콜백 완료 처리"
                      >
                        <Icon icon={HiOutlineCheck} size={16} className="mr-1" />
                        완료
                      </button>
                    )}

                    {/* 수정 버튼 추가 - 예정/완료된 콜백이면서 종결 레코드가 아닌 경우에만 표시 */}
                    {(callback.status === '예정' || callback.status === '완료' || callback.status === '부재중') && 
                    !isCompletionRecord && !isTerminated && !patient.isCompleted && (
                      <button
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-150"
                        onClick={() => handleOpenEditModal(callback)}
                        title="콜백 수정"
                      >
                        <Icon icon={HiOutlinePencil} size={16} />
                      </button>
                    )}
                    
                    {/* 삭제 버튼 - 종결 레코드가 아닌 경우에만 표시 */}
                    {(!isCompletionRecord || !patient.isCompleted) && !isTerminated && (
                      <button
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors duration-150"
                        onClick={() => handleOpenDeleteModal(callback)}
                        title="콜백 삭제"
                      >
                        <Icon icon={HiOutlineTrash} size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 콜백 취소 모달 */}
      {isCanceling && selectedCallback && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">콜백 취소</h3>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={resetCancelForm}
                disabled={isLoading}
              >
                <Icon icon={HiOutlineX} size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-light-bg rounded-md mb-4">
                  <div className={`w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center`}>
                    <Icon icon={HiOutlineCalendar} size={20} />
                  </div>
                  <div>
                    <div className="text-text-primary font-medium">
                      {selectedCallback.date} ({selectedCallback.type} 콜백)
                    </div>
                    <div className="text-sm text-text-secondary">
                      {selectedCallback.notes || '메모 없음'}
                    </div>
                  </div>
                </div>
                
                <p className="text-text-secondary mb-4">
                  정말 이 콜백을 취소하시겠습니까? 취소 사유를 입력해주세요.
                </p>
                
                <label htmlFor="cancelReason" className="block text-sm font-medium text-text-primary mb-1">
                  취소 사유
                </label>
                <textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="form-input min-h-[100px]"
                  placeholder="콜백 취소 사유를 입력하세요..."
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={resetCancelForm}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCancelCallback}
                  disabled={isLoading}
                >
                  {isLoading ? '처리 중...' : '콜백 취소하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 콜백 수정 모달 추가 */}
      {isEditingCallback && callbackToEdit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">콜백 정보 수정</h3>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={resetEditForm}
                disabled={isLoading}
              >
                <Icon icon={HiOutlineX} size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-md mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Icon icon={HiOutlinePencil} size={20} />
                  </div>
                  <div>
                    <div className="text-text-primary font-medium">
                      {callbackToEdit.type} 콜백 수정
                    </div>
                    <div className="text-sm text-text-secondary">
                      상태: {callbackToEdit.status}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="editDate" className="block text-sm font-medium text-text-primary mb-1">
                      콜백 날짜
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        id="editDate"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="form-input pl-10"
                        // min 속성 제거하여 과거 날짜 선택 가능
                      />
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                        <Icon icon={HiOutlineCalendar} size={18} />
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="editNotes" className="block text-sm font-medium text-text-primary mb-1">
                      메모
                    </label>
                    <textarea
                      id="editNotes"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="form-input min-h-[100px]"
                      placeholder="콜백 내용에 대한 메모를 입력하세요..."
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={resetEditForm}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleEditCallback}
                  disabled={isLoading}
                >
                  {isLoading ? '처리 중...' : '저장하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 콜백 삭제 모달 */}
      {isDeleting && callbackToDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">콜백 삭제</h3>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={resetDeleteForm}
                disabled={isLoading}
              >
                <Icon icon={HiOutlineX} size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-md mb-4">
                  <div className={`w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center`}>
                    <Icon icon={HiOutlineExclamation} size={20} />
                  </div>
                  <div>
                    <div className="text-red-600 font-medium">
                      정말 이 콜백을 삭제하시겠습니까?
                    </div>
                    <div className="text-sm text-red-500">
                      이 작업은 되돌릴 수 없습니다.
                    </div>
                  </div>
                </div>
                
                <div className="bg-light-bg p-4 rounded-md">
                  <div className="font-medium mb-1">삭제될 콜백 정보:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-text-secondary">날짜:</div>
                    <div>{callbackToDelete.date}</div>
                    <div className="text-text-secondary">유형:</div>
                    <div>{callbackToDelete.isCompletionRecord === true ? '종결 기록' : `${callbackToDelete.type} 콜백`}</div>
                    <div className="text-text-secondary">상태:</div>
                    <div>{callbackToDelete.isCompletionRecord === true ? '종결' : callbackToDelete.status}</div>
                    <div className="text-text-secondary">메모:</div>
                    <div>{callbackToDelete.notes || '-'}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={resetDeleteForm}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDeleteCallback}
                  disabled={isLoading}
                >
                  {isLoading ? '처리 중...' : '영구 삭제하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 콜백 종결 모달 */}
      {isConfirmingComplete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">
                {isSuccess ? '예약 완료 처리' : '종결 처리'}
              </h3>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={resetCompleteForm}
                disabled={isLoading}
              >
                <Icon icon={HiOutlineX} size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-light-bg rounded-md mb-4">
                  <div className={`w-10 h-10 rounded-full ${isSuccess ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'} flex items-center justify-center`}>
                    <Icon icon={isSuccess ? HiOutlineThumbUp : HiOutlineStop} size={20} />
                  </div>
                  <div>
                    <div className="text-text-primary font-medium">
                      {isSuccess ? '예약 완료 처리' : '콜백 종결 처리'}
                    </div>
                    <div className="text-sm text-text-secondary">
                      환자명: {patient.name} ({patient.patientId})
                    </div>
                  </div>
                </div>
                
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <Icon icon={HiOutlineExclamation} size={18} />
                    <span className="font-medium">주의</span>
                  </div>
                  <p className="text-sm text-yellow-600 mt-1">
                    환자를 종결 처리하면 더 이상 콜백을 추가하거나 수정할 수 없습니다. 종결은 나중에 취소할 수 있습니다.
                  </p>
                </div>
                
                <p className="text-text-secondary mb-4">
                  {isSuccess 
                    ? '환자의 상태를 예약 완료로 변경하고 콜백 프로세스를 종료합니다. 예약 날짜와 시간을 입력해주세요.'
                    : '환자에 대한 콜백 프로세스를 종료하고 미응답 상태로 표시합니다.'}
                </p>
                
                {/* 예약 날짜 및 시간 (예약 완료인 경우만 표시) */}
                {isSuccess && (
                  <div className="space-y-4 mb-4">
                    <div>
                      <label htmlFor="reservationDate" className="block text-sm font-medium text-text-primary mb-1">
                        예약 날짜 <span className="text-error">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          id="reservationDate"
                          value={reservationDate}
                          onChange={(e) => setReservationDate(e.target.value)}
                          className="form-input pl-10"
                          required
                        />
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                          <Icon icon={HiOutlineCalendar} size={18} />
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="reservationTime" className="block text-sm font-medium text-text-primary mb-1">
                        예약 시간 <span className="text-error">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="time"
                          id="reservationTime"
                          value={reservationTime}
                          onChange={(e) => setReservationTime(e.target.value)}
                          className="form-input pl-10"
                          required
                        />
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                          <Icon icon={HiOutlineClock} size={18} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <label htmlFor="completionNote" className="block text-sm font-medium text-text-primary mb-1">
                  {isSuccess ? '예약 메모' : '종결 메모'}
                </label>
                <textarea
                  id="completionNote"
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  className="form-input min-h-[100px]"
                  placeholder={isSuccess 
                    ? "치료 내용이나 담당 의사 등 예약 관련 메모를 입력하세요..." 
                    : "종결 사유 등을 입력하세요..."}
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={resetCompleteForm}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className={`btn ${isSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white`}
                  onClick={handleCompleteProcess}
                  disabled={isLoading || (isSuccess && (!reservationDate || !reservationTime))}
                >
                  {isLoading ? '처리 중...' : isSuccess ? '예약 완료 처리하기' : '종결 처리하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 콜백 완료 처리 모달 */}
      {isMarkingComplete && callbackToComplete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-auto">
            {/* 모달 헤더 */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">콜백 완료 처리</h3>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={resetMarkCompleteForm}
                disabled={isLoading}
              >
                <Icon icon={HiOutlineX} size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-md mb-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                    <Icon icon={HiOutlineCheck} size={20} />
                  </div>
                  <div>
                    <div className="text-text-primary font-medium">
                      예정된 콜백을 완료 처리합니다
                    </div>
                    <div className="text-sm text-text-secondary">
                      {callbackToComplete.date} ({callbackToComplete.type} 콜백)
                    </div>
                  </div>
                </div>
                
                <p className="text-text-secondary mb-4">
                  콜백 상태를 '완료'로 변경하고 오늘 날짜로 업데이트합니다. 콜백 결과를 입력해주세요.
                </p>

                
                {/* 결과 메모 입력 */}
                <div className="mb-4">
                  <label htmlFor="resultNotes" className="block text-sm font-medium text-text-primary mb-1">
                    결과 메모 {nextStep !== '부재중' && <span className="text-error">*</span>}
                  </label>
                  <textarea
                    id="resultNotes"
                    value={resultNotes}
                    onChange={(e) => setResultNotes(e.target.value)}
                    className="form-input min-h-[100px]"
                    placeholder="고객 응대 내용, 요청 사항, 특이사항 등을 구체적으로 기록하세요..."
                    disabled={nextStep === '부재중'} // 🔥 부재중 선택 시 비활성화
                    required={nextStep !== '부재중'}
                  />
                  {nextStep === '부재중' && (
                    <p className="text-xs text-gray-500 mt-1">
                      부재중인 경우 결과 메모를 입력할 필요가 없습니다.
                    </p>
                  )}
                </div>
                
                {/* 고객 반응 선택 */}
                {nextStep !== '부재중' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    고객 반응
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="customerResponse"
                        value="very_positive"
                        checked={customerResponse === 'very_positive'}
                        onChange={() => setCustomerResponse('very_positive')}
                        className="sr-only"
                      />
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${customerResponse === 'very_positive' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <Icon icon={HiOutlineThumbUp} size={18} />
                      </div>
                      <span className="text-xs text-text-secondary">매우 긍정적</span>
                    </label>
                    
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="customerResponse"
                        value="positive"
                        checked={customerResponse === 'positive'}
                        onChange={() => setCustomerResponse('positive')}
                        className="sr-only"
                      />
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${customerResponse === 'positive' ? 'bg-green-300 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <Icon icon={HiOutlineThumbUp} size={16} />
                      </div>
                      <span className="text-xs text-text-secondary">관심 있음</span>
                    </label>
                    
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="customerResponse"
                        value="neutral"
                        checked={customerResponse === 'neutral'}
                        onChange={() => setCustomerResponse('neutral')}
                        className="sr-only"
                      />
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${customerResponse === 'neutral' ? 'bg-blue-300 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <Icon icon={HiOutlineMinus} size={18} />
                      </div>
                      <span className="text-xs text-text-secondary">중립적</span>
                    </label>
                    
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="customerResponse"
                        value="negative"
                        checked={customerResponse === 'negative'}
                        onChange={() => setCustomerResponse('negative')}
                        className="sr-only"
                      />
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${customerResponse === 'negative' ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <Icon icon={HiOutlineThumbDown} size={16} />
                      </div>
                      <span className="text-xs text-text-secondary">부정적</span>
                    </label>
                    
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="customerResponse"
                        value="very_negative"
                        checked={customerResponse === 'very_negative'}
                        onChange={() => setCustomerResponse('very_negative')}
                        className="sr-only"
                      />
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${customerResponse === 'very_negative' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <Icon icon={HiOutlineThumbDown} size={18} />
                      </div>
                      <span className="text-xs text-text-secondary">매우 부정적</span>
                    </label>
                  </div>
                </div>)}              
                       
                
                {/* 다음 단계 선택 - 2차 콜백에서만 표시 */}
                {(callbackToComplete.type === '1차' || callbackToComplete.type === '2차' || callbackToComplete.type === '3차' || callbackToComplete.type === '4차') && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      다음 단계 <span className="text-error">*</span>
                    </label>
                    <div className="flex flex-col gap-4">
                      {/* 5차 콜백 옵션 - 4차 콜백 완료 시 표시 */}
                      {callbackToComplete.type === '4차' && (
                        <div className="border rounded-md overflow-hidden">
                          <label className="flex items-center gap-2 p-3 cursor-pointer hover:bg-light-bg/50 border-b">
                            <input
                              type="radio"
                              name="nextStep"
                              value="이벤트_타겟_설정"
                              checked={nextStep === '이벤트_타겟_설정'}
                              onChange={() => setNextStep('이벤트_타겟_설정')}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm text-text-primary">이벤트 타겟 설정 (프로모션 대상자로 등록)</span>
                          </label>
                          
                          {/* 날짜 선택 및 상담 계획 - 5차 콜백이 선택된 경우만 표시 */}
                          {nextStep === '5차_콜백' && (
                            <div className="p-3 bg-blue-50">
                              {/* 콜백 일자 입력 필드 */}
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                5차 콜백 일자 <span className="text-error">*</span>
                              </label>
                              <div className="relative mb-3">
                                <input
                                  type="date"
                                  value={nextCallbackDate}
                                  onChange={(e) => setNextCallbackDate(e.target.value)}
                                  className="form-input pl-10 w-full"
                                />
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                                  <Icon icon={HiOutlineCalendar} size={18} />
                                </span>
                              </div>
                              <p className="text-xs text-blue-600 mb-3">
                                기본값: 1주일 후 ({format(addDays(new Date(), 7), 'yyyy-MM-dd')})
                              </p>
                              
                              {/* 상담 계획 입력 필드 추가 */}
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                5차 상담 계획
                              </label>
                              <textarea
                                value={nextCallbackPlan}
                                onChange={(e) => setNextCallbackPlan(e.target.value)}
                                className="form-input w-full min-h-[80px]"
                                placeholder="다음 상담 시 논의할 내용이나 계획을 입력하세요..."
                              />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 4차 콜백 옵션 - 3차 콜백 완료 시 표시 */}
                      {callbackToComplete.type === '3차' && (
                        <div className="border rounded-md overflow-hidden">
                          <label className="flex items-center gap-2 p-3 cursor-pointer hover:bg-light-bg/50 border-b">
                            <input
                              type="radio"
                              name="nextStep"
                              value="4차_콜백"
                              checked={nextStep === '4차_콜백'}
                              onChange={() => setNextStep('4차_콜백')}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm text-text-primary">4차 콜백 예정</span>
                          </label>
                          
                          {/* 날짜 선택 및 상담 계획 - 4차 콜백이 선택된 경우만 표시 */}
                          {nextStep === '4차_콜백' && (
                            <div className="p-3 bg-blue-50">
                              {/* 콜백 일자 입력 필드 */}
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                4차 콜백 일자 <span className="text-error">*</span>
                              </label>
                              <div className="relative mb-3">
                                <input
                                  type="date"
                                  value={nextCallbackDate}
                                  onChange={(e) => setNextCallbackDate(e.target.value)}
                                  className="form-input pl-10 w-full"
                                />
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                                  <Icon icon={HiOutlineCalendar} size={18} />
                                </span>
                              </div>
                              <p className="text-xs text-blue-600 mb-3">
                                기본값: 1주일 후 ({format(addDays(new Date(), 7), 'yyyy-MM-dd')})
                              </p>
                              
                              {/* 상담 계획 입력 필드 추가 */}
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                4차 상담 계획
                              </label>
                              <textarea
                                value={nextCallbackPlan}
                                onChange={(e) => setNextCallbackPlan(e.target.value)}
                                className="form-input w-full min-h-[80px]"
                                placeholder="다음 상담 시 논의할 내용이나 계획을 입력하세요..."
                              />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 3차 콜백 옵션 - 2차 콜백 완료 시 표시 */}
                      {callbackToComplete.type === '2차' && (
                        <div className="border rounded-md overflow-hidden">
                          <label className="flex items-center gap-2 p-3 cursor-pointer hover:bg-light-bg/50 border-b">
                            <input
                              type="radio"
                              name="nextStep"
                              value="3차_콜백"
                              checked={nextStep === '3차_콜백'}
                              onChange={() => setNextStep('3차_콜백')}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm text-text-primary">3차 콜백 예정</span>
                          </label>
                          
                          {/* 날짜 선택 및 상담 계획 - 3차 콜백이 선택된 경우만 표시 */}
                          {nextStep === '3차_콜백' && (
                            <div className="p-3 bg-blue-50">
                              {/* 콜백 일자 입력 필드 */}
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                3차 콜백 일자 <span className="text-error">*</span>
                              </label>
                              <div className="relative mb-3">
                                <input
                                  type="date"
                                  value={nextCallbackDate}
                                  onChange={(e) => setNextCallbackDate(e.target.value)}
                                  className="form-input pl-10 w-full"
                                />
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                                  <Icon icon={HiOutlineCalendar} size={18} />
                                </span>
                              </div>
                              <p className="text-xs text-blue-600 mb-3">
                                기본값: 1주일 후 ({format(addDays(new Date(), 7), 'yyyy-MM-dd')})
                              </p>
                              
                              {/* 상담 계획 입력 필드 추가 */}
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                3차 상담 계획
                              </label>
                              <textarea
                                value={nextCallbackPlan}
                                onChange={(e) => setNextCallbackPlan(e.target.value)}
                                className="form-input w-full min-h-[80px]"
                                placeholder="다음 상담 시 논의할 내용이나 계획을 입력하세요..."
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2차 콜백 옵션 추가 (1차 콜백 완료 시) */}
                      {callbackToComplete.type === '1차' && (
                        <div className="border rounded-md overflow-hidden">
                          <label className="flex items-center gap-2 p-3 cursor-pointer hover:bg-light-bg/50 border-b">
                            <input
                              type="radio"
                              name="nextStep"
                              value="2차_콜백"
                              checked={nextStep === '2차_콜백'}
                              onChange={() => setNextStep('2차_콜백')}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm text-text-primary">2차 콜백 예정</span>
                          </label>
                          
                          {/* 날짜 선택 및 상담 계획 - 2차 콜백이 선택된 경우만 표시 */}
                          {nextStep === '2차_콜백' && (
                            <div className="p-3 bg-blue-50">
                              {/* 콜백 일자 입력 필드 */}
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                2차 콜백 일자 <span className="text-error">*</span>
                              </label>
                              <div className="relative mb-3">
                                <input
                                  type="date"
                                  value={nextCallbackDate}
                                  onChange={(e) => setNextCallbackDate(e.target.value)}
                                  className="form-input pl-10 w-full"
                                />
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                                  <Icon icon={HiOutlineCalendar} size={18} />
                                </span>
                              </div>
                              <p className="text-xs text-blue-600 mb-3">
                                기본값: 1주일 후 ({format(addDays(new Date(), 7), 'yyyy-MM-dd')})
                              </p>
                              
                              {/* 상담 계획 입력 필드 추가 */}
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                2차 상담 계획
                              </label>
                              <textarea
                                value={nextCallbackPlan}
                                onChange={(e) => setNextCallbackPlan(e.target.value)}
                                className="form-input w-full min-h-[80px]"
                                placeholder="다음 상담 시 논의할 내용이나 계획을 입력하세요..."
                              />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 예약 확정 옵션 - 항상 표시 */}
                      <div className="border rounded-md overflow-hidden">
                        <label className="flex items-center gap-2 p-3 cursor-pointer hover:bg-light-bg/50 border-b">
                          <input
                            type="radio"
                            name="nextStep"
                            value="예약_확정"
                            checked={nextStep === '예약_확정'}
                            onChange={() => setNextStep('예약_확정')}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm text-text-primary">예약 확정 (예약 완료 처리)</span>
                        </label>
                        
                        {/* 예약 확정 추가 정보 - 예약 확정 선택 시 표시 */}
                        {nextStep === '예약_확정' && (
                          <div className="p-3 bg-green-50">
                            {/* 예약 날짜 입력 필드 */}
                            <label className="block text-sm font-medium text-green-700 mb-2">
                              예약 날짜 <span className="text-error">*</span>
                            </label>
                            <div className="relative mb-3">
                              <input
                                type="date"
                                value={reservationDate}
                                onChange={(e) => setReservationDate(e.target.value)}
                                className="form-input pl-10 w-full"
                                required
                              />
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                                <Icon icon={HiOutlineCalendar} size={18} />
                              </span>
                            </div>
                            
                            {/* 예약 시간 입력 필드 */}
                            <label className="block text-sm font-medium text-green-700 mb-2">
                              예약 시간 <span className="text-error">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="time"
                                value={reservationTime}
                                onChange={(e) => setReservationTime(e.target.value)}
                                className="form-input pl-10 w-full"
                                required
                              />
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                                <Icon icon={HiOutlineClock} size={18} />
                              </span>
                            </div>
                            
                            <p className="text-xs text-green-600 mt-2">
                              환자가 예약한 날짜와 시간을 입력하세요.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 종결 처리 옵션 - 사유 선택 기능 추가 */}
                      <div className="border rounded-md overflow-hidden">
                        <label className="flex items-center gap-2 p-3 cursor-pointer hover:bg-light-bg/50 border-b">
                          <input
                            type="radio"
                            name="nextStep"
                            value="종결_처리"
                            checked={nextStep === '종결_처리'}
                            onChange={() => setNextStep('종결_처리')}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm text-text-primary">종결 처리 (더 이상 콜백 없음)</span>
                        </label>
                        
                        {/* 🔥 종결 사유 선택 추가 정보 */}
                        {nextStep === '종결_처리' && (
                          <div className="p-3 bg-gray-50">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              종결 사유 <span className="text-error">*</span>
                            </label>
                            <select
                              value={selectedTerminationReason}
                              onChange={(e) => setSelectedTerminationReason(e.target.value as TerminationReason)}
                              className="form-input w-full mb-3"
                              required
                            >
                              {TERMINATION_REASONS.map(reason => (
                                <option key={reason} value={reason}>
                                  {reason}
                                </option>
                              ))}
                            </select>
                            
                            {/* 🔥 기타 선택 시 텍스트 입력 필드 표시 */}
                            {selectedTerminationReason === '기타' && (
                              <div className="mb-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  기타 사유 입력 <span className="text-error">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={customTerminationReason}
                                  onChange={(e) => setCustomTerminationReason(e.target.value)}
                                  className="form-input w-full"
                                  placeholder="구체적인 종결 사유를 입력하세요"
                                  required
                                />
                              </div>
                            )}
                            
                            <p className="text-xs text-gray-600">
                              환자를 종결 처리하는 사유를 선택해주세요.
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* 이벤트 타겟 설정 옵션 - 확장된 폼으로 수정 */}
                      <div className="border rounded-md overflow-hidden">
                        <label className="flex items-center gap-2 p-3 cursor-pointer hover:bg-light-bg/50 border-b">
                          <input
                            type="radio"
                            name="nextStep"
                            value="이벤트_타겟_설정"
                            checked={nextStep === '이벤트_타겟_설정'}
                            onChange={() => setNextStep('이벤트_타겟_설정')}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm text-text-primary">이벤트 타겟 설정 (프로모션 대상자로 등록)</span>
                        </label>
                        
                        {/* 이벤트 타겟 설정 추가 정보 - 선택 시 표시 */}
                        {nextStep === '이벤트_타겟_설정' && (
                          <div className="p-3 bg-purple-50">
                            {/* 타겟 사유 선택 */}
                            <label className="block text-sm font-medium text-purple-700 mb-2">
                              타겟 사유 <span className="text-error">*</span>
                            </label>
                            <select
                              value={eventTargetReason}
                              onChange={(e) => setEventTargetReason(e.target.value as EventTargetReason)}
                              className="form-input w-full mb-3"
                            >
                              <option value="price_hesitation">가격 문의 후 망설임</option>
                              <option value="treatment_consideration">치료 방법 고민 중</option>
                              <option value="scheduling_issue">시간 조율 필요</option>
                              <option value="competitor_comparison">경쟁업체 비교 중</option>
                              <option value="other">기타</option>
                            </select>
                            
                            {/* 이벤트 카테고리 선택 */}
                            <label className="block text-sm font-medium text-purple-700 mb-2">
                              이벤트 카테고리 <span className="text-error">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {getEventCategoryOptions([], categories).map(category => (
                                <label
                                  key={category.value}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <input
                                    type="radio"
                                    name="eventTargetCategory"
                                    value={category.value}
                                    checked={eventTargetCategory === category.value}
                                    onChange={() => setEventTargetCategory(category.value as EventCategory)}
                                    className="w-4 h-4 accent-purple-600"
                                  />
                                  <span className="text-sm text-purple-700">{category.label}</span>
                                </label>
                              ))}
                            </div>
                            
                            {/* 발송 예정일 */}
                            <label className="block text-sm font-medium text-purple-700 mb-2">
                              발송 예정일
                            </label>
                            <input
                              type="date"
                              value={eventTargetScheduledDate}
                              onChange={(e) => setEventTargetScheduledDate(e.target.value)}
                              className="form-input w-full mb-3"
                              min={format(new Date(), 'yyyy-MM-dd')}
                            />
                            
                            <p className="text-xs text-purple-600">
                              환자를 이벤트 타겟으로 설정하여 추후 프로모션 발송 시 포함됩니다.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 종결 처리 옵션 - 항상 표시 */}
                      <label className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-light-bg/50">
                        <input
                          type="radio"
                          name="nextStep"
                          value="종결_처리"
                          checked={nextStep === '종결_처리'}
                          onChange={() => setNextStep('종결_처리')}
                          className="w-4 h-4 accent-primary"
                        />
                        <span className="text-sm text-text-primary">종결 처리 (더 이상 콜백 없음)</span>
                      </label>

                      {/* "부재중" 옵션 추가 - 항상 표시 */}
                      <label className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-light-bg/50">
                        <input
                          type="radio"
                          name="nextStep"
                          value="부재중"
                          checked={nextStep === '부재중'}
                          onChange={() => setNextStep('부재중')}
                          className="w-4 h-4 accent-primary"
                        />
                        <div className="flex items-center gap-2">
                          <Icon icon={HiOutlineBan} size={18} className="text-orange-500" />
                          <span className="text-sm text-text-primary">부재중 (재콜백 필요)</span>
                        </div>
                      </label>
                      {/* 부재중 추가 정보 - 부재중 선택 시 표시 */}
                      {nextStep === '부재중' && (
                        <div className="p-3 bg-orange-50 mt-2 border border-orange-200 rounded-md">
                          <label className="block text-sm font-medium text-orange-700 mb-2">
                            재콜백 일자 <span className="text-error">*</span>
                          </label>
                          <div className="relative">
                            {/* 🔥 수정사항 3: min 속성 제거하여 과거 날짜 선택 가능 */}
                            <input
                              type="date"
                              value={nextCallbackDate}
                              onChange={(e) => setNextCallbackDate(e.target.value)}
                              className="form-input pl-10 w-full"
                              // min={format(new Date(), 'yyyy-MM-dd')} // 🔥 이 줄을 제거
                            />
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                              <Icon icon={HiOutlineCalendar} size={18} />
                            </span>
                          </div>
                          
                          {/* 빠른 날짜 선택 버튼 */}
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded border border-orange-200 hover:bg-orange-200"
                              onClick={() => setNextCallbackDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                            >
                              내일
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded border border-orange-200 hover:bg-orange-200"
                              onClick={() => setNextCallbackDate(format(addDays(new Date(), 3), 'yyyy-MM-dd'))}
                            >
                              3일 후
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded border border-orange-200 hover:bg-orange-200"
                              onClick={() => setNextCallbackDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'))}
                            >
                              1주일 후
                            </button>
                          </div>
                        </div>
                      )}                      
                    </div>
                  </div>
                )} 
              
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={resetMarkCompleteForm}
                    disabled={isLoading}
                  >
                    취소
                  </button>
                  <button
                  type="button"
                  className="btn bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleMarkCallbackComplete}
                  disabled={isLoading || 
                    (nextStep !== '부재중' && !resultNotes) || 
                    ((callbackToComplete?.type === '2차' || 
                      callbackToComplete?.type === '3차' || 
                      callbackToComplete?.type === '4차' || 
                      callbackToComplete?.type === '1차') && !nextStep) ||
                    (nextStep === '예약_확정' && (!reservationDate || !reservationTime)) ||
                    // 🔥 종결 처리인 경우 사유 선택 필수 (기타일 때는 텍스트 입력도 필수)
                    (nextStep === '종결_처리' && (!selectedTerminationReason || 
                      (selectedTerminationReason === '기타' && !customTerminationReason.trim())))
                  }
                >
                  {isLoading ? '처리 중...' : '완료 처리하기'}
                </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 종결 취소 확인 모달 */}
      {isConfirmingCancelCompletion && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">종결 취소</h3>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={resetCancelCompletionForm}
                disabled={isLoading}
              >
                <Icon icon={HiOutlineX} size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-md mb-4">
                  <div className={`w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center`}>
                    <Icon icon={HiOutlineRefresh} size={20} />
                  </div>
                  <div>
                    <div className="text-text-primary font-medium">
                      환자 종결 취소
                    </div>
                    <div className="text-sm text-text-secondary">
                      환자명: {patient.name} ({patient.patientId})
                    </div>
                  </div>
                </div>
                
                <p className="text-text-secondary mb-4">
                  이 환자의 종결 처리를 취소하고, 이전 상태로 되돌립니다. 종결 취소 후에는 다시 콜백을 추가하거나 수정할 수 있습니다.
                </p>
                
                <div className="bg-light-bg p-4 rounded-md">
                  <div className="font-medium mb-1">종결 정보:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-text-secondary">종결일:</div>
                    <div>{patient.completedAt || '-'}</div>
                    <div className="text-text-secondary">종결 사유:</div>
                    <div>{patient.completedReason || '-'}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={resetCancelCompletionForm}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleCancelCompletionProcess}
                  disabled={isLoading}
                >
                  {isLoading ? '처리 중...' : '종결 취소하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}