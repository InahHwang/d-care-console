// src/components/management/CallbackManagement.tsx - 실시간 데이터 동기화 추가

'use client'
import { format, addDays } from 'date-fns';
import EventTargetSection from './EventTargetSection'
import { useState, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { fetchCategories } from '@/store/slices/categoriesSlice'
import { getEventCategoryOptions, getCategoryDisplayName } from '@/utils/categoryUtils'
// 🔥 데이터 동기화 유틸리티 import 추가
import { PatientDataSync } from '@/utils/dataSync'
import {
  Patient,
  addCallback,
  updateCallback,
  deleteCallback,
  completePatient,
  cancelPatientCompletion,
  CallbackItem,
  CallbackStatus,
  selectPatient,
  updateEventTargetInfo,
  initializeEventTargets,
  EventTargetReason,
  fetchPatients,
  FirstConsultationStatus,
  PostReservationStatus,
  CallbackFollowupStatus,
  FirstConsultationResult,
  PostReservationResult,
  CallbackFollowupResult,
  updatePatient  
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
  const { categories } = useAppSelector((state: RootState) => state.categories)
  const { logCallbackAction, logPatientCompleteAction } = useActivityLogger()
  const [customTerminationReason, setCustomTerminationReason] = useState('');

  
  // 🔥 임시 사용자 정보
  const effectiveUser = currentUser || {
    id: 'temp-user-001',
    name: '임시 관리자',
    username: 'temp-admin',
    email: 'temp@example.com',
    role: 'staff' as const,
    isActive: true
  }

  // 🔥 새로운 첫 상담 후 상태 관리
  const [isAddingCallback, setIsAddingCallback] = useState(false);
  const [callbackDate, setCallbackDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [callbackTime, setCallbackTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 🔥 첫 상담 후 상태 관리
  const [firstConsultationStatus, setFirstConsultationStatus] = useState<FirstConsultationStatus>('');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [consultationContent, setConsultationContent] = useState('');
  const [consultationPlan, setConsultationPlan] = useState('');
  const [terminationReason, setTerminationReason] = useState('');

  // 🔥 예약 후 미내원 상태 관리
  const [postReservationStatus, setPostReservationStatus] = useState<PostReservationStatus>('');
  const [postReservationCallbackDate, setPostReservationCallbackDate] = useState('');
  const [postReservationReason, setPostReservationReason] = useState('');

  // 🔥 재예약 완료를 위한 상태 추가
  const [reReservationDate, setReReservationDate] = useState('');
  const [reReservationTime, setReReservationTime] = useState('');

  // 🔥 콜백 후속 상태 관리
  const [callbackFollowupStatus, setCallbackFollowupStatus] = useState<CallbackFollowupStatus>('');
  const [followupCallbackDate, setFollowupCallbackDate] = useState('');
  const [followupReason, setFollowupReason] = useState('');

  // 콜백 수정을 위한 상태 추가
const [isEditingCallback, setIsEditingCallback] = useState(false);
const [editingCallback, setEditingCallback] = useState<CallbackItem | null>(null);
const [editCallbackDate, setEditCallbackDate] = useState('');
const [editCallbackTime, setEditCallbackTime] = useState('');
const [editCallbackNotes, setEditCallbackNotes] = useState('');

// 🔥 콜백 수정 핸들러
const handleEditCallback = (callback: CallbackItem) => {
  setEditingCallback(callback);
  setEditCallbackDate(callback.date);
  setEditCallbackTime(callback.time || '');
  setEditCallbackNotes(callback.notes || '');
  setIsEditingCallback(true);
  
  console.log('콜백 수정 모드 활성화:', {
    callbackId: callback.id,
    type: callback.type,
    status: callback.status
  });
};

// 현재 콜백의 상담내용/계획 추출 함수 추가
const getCurrentCallbackPlan = (currentCallback: CallbackItem): string => {
  if (!currentCallback?.notes) return '';
  
  // 1. "상담내용/계획:" 패턴으로 추출
  let match = currentCallback.notes.match(/상담내용\/계획:\s*(.+?)(?:\n|$)/);
  if (match && match[1] && match[1].trim() !== '') {
    const content = match[1].trim();
    // 자동 생성 텍스트는 제외
    if (!content.includes('부재중으로 인한') && !content.includes('추가 상담 및')) {
      console.log(`🔄 현재 콜백(${currentCallback.type}) 상담내용/계획 추출:`, content);
      return content;
    }
  }
  
  // 2. [차수 콜백 - 설명] 패턴 이후의 텍스트 추출
  const lines = currentCallback.notes.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 헤더 라인들 건너뛰기
    if (line.startsWith('[') && line.includes('콜백')) continue;
    if (line.startsWith('상담내용/계획:')) continue;
    if (line === '') continue;
    
    // 자동 생성 텍스트가 아닌 의미있는 내용
    if (!line.includes('부재중으로 인한') && !line.includes('추가 상담 및')) {
      console.log(`🔄 현재 콜백(${currentCallback.type}) 순수 내용 추출:`, line);
      return line;
    }
  }
  
  return '';
};

// 1. 이전 차수 콜백의 상담내용/계획 추출 함수 추가 (파일 상단에 추가)
const getPreviousCallbackPlan = (currentCallbackType: string): string => {
  const callbackOrder = ['1차', '2차', '3차', '4차', '5차'];
  const currentIndex = callbackOrder.indexOf(currentCallbackType);
  
  if (currentIndex <= 0) return '';
  
  // 역순으로 이전 차수들 확인
  for (let i = currentIndex - 1; i >= 0; i--) {
    const prevType = callbackOrder[i];
    const prevCallback = callbackHistory.find(cb => cb.type === prevType && cb.status === '완료');
    
    if (prevCallback) {
      // 🔥 수정: getCurrentCallbackPlan 함수 사용
      const plan = getCurrentCallbackPlan(prevCallback);
      if (plan) {
        console.log(`🔄 ${currentCallbackType}에서 ${prevType} 상담내용 연동:`, plan);
        return plan;
      }
    }
  }
  
  return '';
};

// 🔥 콜백 수정 저장 핸들러
const handleSaveCallbackEdit = async () => {
  if (!editingCallback) return;

  setIsLoading(true);
  try {
    const updateData = {
      date: editCallbackDate,
      time: editCallbackTime || undefined,
      notes: editCallbackNotes,
      updatedAt: new Date().toISOString()
    };

    await dispatch(updateCallback({
      patientId: patient._id || patient.id,
      callbackId: editingCallback.id,
      updateData
    })).unwrap();

    // 🔥 즉시 데이터 동기화 트리거
    PatientDataSync.onCallbackUpdate(
      patient._id || patient.id, 
      editingCallback.id, 
      'CallbackManagement'
    );

    // 수정 모드 해제
    setIsEditingCallback(false);
    setEditingCallback(null);
    setEditCallbackDate('');
    setEditCallbackTime('');
    setEditCallbackNotes('');

    alert(`${editingCallback.type} 콜백이 수정되었습니다.`);
  } catch (error) {
    console.error('콜백 수정 실패:', error);
    alert('콜백 수정에 실패했습니다.');
  } finally {
    setIsLoading(false);
  }
};

// 🔥 콜백 수정 취소 핸들러
const handleCancelCallbackEdit = () => {
  setIsEditingCallback(false);
  setEditingCallback(null);
  setEditCallbackDate('');
  setEditCallbackTime('');
  setEditCallbackNotes('');
};

  // 🔥 콜백 이력 필터링 - 일반 콜백만 (메모화로 최적화)
  const callbackHistory = useMemo(() => {
    return patient.callbackHistory?.filter(cb => 
      !cb.isVisitManagementCallback
    ) || [];
  }, [patient.callbackHistory]);

  // 🔥 현재 환자의 상담 단계 판단 (메모화로 최적화)
  const currentStage = useMemo(() => {
    if (patient.isCompleted) return 'completed';
    if (patient.visitConfirmed) return 'completed';
    
    // 🔥 재예약 완료된 환자는 completed로 처리
    if (patient.status === '재예약확정') return 'completed';
    
    const lastCallback = callbackHistory[callbackHistory.length - 1];
    
    // 예약 후 미내원 환자인지 확인 (현재 미내원 상태인 경우만)
    if (patient.isPostReservationPatient) return 'post_reservation';
    
    // 첫 상담인지 확인 (콜백이 없거나 첫 콜백이 완료되지 않은 경우)
    if (!lastCallback || (lastCallback.type === '1차' && lastCallback.status === '예정')) {
      return 'first';
    }
    
    // 콜백 진행 중
    return 'callback';
  }, [patient.isCompleted, patient.visitConfirmed, patient.status, patient.isPostReservationPatient, callbackHistory]);

  // 🔥 다음 콜백 단계 결정 함수 (메모화로 최적화)
  const getNextCallbackType = useMemo((): CallbackType => {
    const existingCallbacks = callbackHistory || [];
    
    // 🔥 각 차수별 콜백이 이미 존재하는지 확인 (상태 무관)
    const has1st = existingCallbacks.some(cb => cb.type === '1차');
    const has2nd = existingCallbacks.some(cb => cb.type === '2차');
    const has3rd = existingCallbacks.some(cb => cb.type === '3차');
    const has4th = existingCallbacks.some(cb => cb.type === '4차');
    const has5th = existingCallbacks.some(cb => cb.type === '5차');
    
    // 🔥 명시적 타입 반환으로 TypeScript 에러 해결
    if (!has1st) return '1차' as CallbackType;
    if (!has2nd) return '2차' as CallbackType;
    if (!has3rd) return '3차' as CallbackType;
    if (!has4th) return '4차' as CallbackType;
    if (!has5th) return '5차' as CallbackType;
    
    return '5차' as CallbackType;
  }, [callbackHistory]);

  // 🔥 현재 완료 처리 중인 콜백을 고려하는 함수
  const getNextCallbackTypeForCompletion = (currentCallbackType: string): CallbackType => {
    // 현재 완료 처리 중인 콜백의 다음 차수를 반환
    switch (currentCallbackType) {
      case '1차': return '2차' as CallbackType;
      case '2차': return '3차' as CallbackType;
      case '3차': return '4차' as CallbackType;
      case '4차': return '5차' as CallbackType;
      case '5차': return '5차' as CallbackType; // 최대 5차
      default: return '2차' as CallbackType; // 기본값
    }
  };

  // 🔥 콜백에서 종결 처리 함수 추가
  const handleCallbackTermination = async (callback: CallbackItem) => {
    if (!terminationReason) {
      alert('종결 사유를 선택해주세요.');
      return;
    }

    if (terminationReason === '기타' && !customTerminationReason.trim()) {
      alert('기타 사유를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const finalTerminationReason = terminationReason === '기타' 
        ? customTerminationReason.trim() 
        : terminationReason;

      // 콜백 완료 처리
      const updateData = {
        status: '완료' as CallbackStatus,
        callbackFollowupResult: {
          status: '종결' as CallbackFollowupStatus,
          callbackType: callback.type as any,
          terminationReason: finalTerminationReason,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        notes: callback.notes + `\n\n종결사유: ${finalTerminationReason}`,
        // 🔥 완료 처리 시 현재 날짜와 시간으로 업데이트 (추가 필요)
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        completedAt: new Date().toISOString()
      };

      await dispatch(updateCallback({
        patientId: patient._id || patient.id,
        callbackId: callback.id,
        updateData
      })).unwrap();

      // 환자 종결 처리
      await dispatch(completePatient({
        patientId: patient._id || patient.id,
        reason: `[${callback.type} 콜백 후 종결] ${finalTerminationReason}`
      })).unwrap();

      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onComplete(patient._id || patient.id, finalTerminationReason, 'CallbackManagement');

      resetCallbackFollowupForm();
      alert(`${callback.type} 콜백 후 종결 처리가 완료되었습니다.`);

    } catch (error) {
      console.error('콜백 종결 처리 실패:', error);
      alert('콜백 종결 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 첫 상담 후 상태 처리
  // 🔥 handleFirstConsultationComplete 함수 수정 - 변수 스코프 문제 해결

const handleFirstConsultationComplete = async (callback: CallbackItem) => {
  if (!firstConsultationStatus) {
    alert('1차 상담 후 환자 상태를 선택해주세요.');
    return;
  }

  setIsLoading(true);
  try {
    let firstConsultationResult: FirstConsultationResult;
    let finalTerminationReason = '';
    // 🔥 변수를 switch문 밖에서 미리 선언
    let finalConsultationPlan = consultationPlan;

    switch (firstConsultationStatus) {
      case '예약완료':
        if (!reservationDate || !reservationTime || !consultationContent) {
          alert('예약 완료 시 예약날짜, 시간, 상담내용을 모두 입력해주세요.');
          return;
        }
        firstConsultationResult = {
          status: '예약완료',
          reservationDate,
          reservationTime,
          consultationContent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        break;

        // 🔥 handleFirstConsultationComplete 함수 내 수정 필요 부분

      case '상담진행중':
      case '부재중':
        if (!callbackDate) {
          alert('다음 콜백날짜를 입력해주세요.');
          return;
        }
        
        // 🔥 1차 콜백 상담내용/계획 처리 개선
        if (!finalConsultationPlan || finalConsultationPlan.trim() === '') {
          // 1차 콜백의 경우 의미있는 기본 메시지 설정
          if (firstConsultationStatus === '부재중') {
            finalConsultationPlan = '부재중으로 인한 재콜백 필요';
          } else if (firstConsultationStatus === '상담진행중') {
            finalConsultationPlan = '추가 상담 및 검토 필요';
          } else {
            finalConsultationPlan = '후속 상담 예정';
          }
          console.log(`🔄 1차 콜백 - 기본 상담계획 설정:`, finalConsultationPlan);
        }
        
        firstConsultationResult = {
          status: firstConsultationStatus,
          callbackDate,
          consultationPlan: finalConsultationPlan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        break;

      case '종결':
        if (!terminationReason) {
          alert('종결 사유를 입력해주세요.');
          return;
        }
        
        if (terminationReason === '기타' && !customTerminationReason.trim()) {
          alert('기타 사유를 입력해주세요.');
          return;
        }
        
        finalTerminationReason = terminationReason === '기타' 
          ? customTerminationReason.trim() 
          : terminationReason;
        
        firstConsultationResult = {
          status: '종결',
          terminationReason: finalTerminationReason,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        break;

      default:
        alert('올바른 상태를 선택해주세요.');
        return;
    }

      // 콜백 완료 처리 + 첫 상담 결과 저장
      const updateData = {
        status: '완료' as CallbackStatus,
        firstConsultationResult,
        notes: callback.notes + (
          firstConsultationStatus === '예약완료' && reservationDate && reservationTime 
            ? `\n예약일정: ${reservationDate} ${reservationTime}${consultationContent ? `\n상담내용: ${consultationContent}` : ''}` 
            : ''
        ),
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        completedAt: new Date().toISOString()
      };

      await dispatch(updateCallback({
        patientId: patient._id || patient.id,
        callbackId: callback.id,
        updateData
      })).unwrap();

      // 예약완료인 경우 환자 상태 업데이트
      if (firstConsultationStatus === '예약완료') {
        await dispatch(updatePatient({
          patientId: patient._id || patient.id,
          patientData: {
            status: '예약확정',
            reservationDate,
            reservationTime
          }
        })).unwrap();
      }

      // 종결인 경우 종결 처리
      if (firstConsultationStatus === '종결') {
        await dispatch(completePatient({
          patientId: patient._id || patient.id,
          reason: finalTerminationReason
        })).unwrap();
      }

      // 상담진행중/부재중인 경우 다음 콜백 등록
      if (firstConsultationStatus === '상담진행중' || firstConsultationStatus === '부재중') {
        const nextCallbackData: Omit<CallbackItem, 'id'> = {
          type: '2차' as CallbackType,
          date: callbackDate,
          status: '예정' as CallbackStatus,
          time: undefined,
          // 🔥 수정: 1차 콜백의 순수 내용을 2차로 연동
          notes: (() => {
            const currentContent = getCurrentCallbackPlan(callback);
            if (currentContent) {
              return `[2차 콜백 - 1차 상담 후속]\n${currentContent}`;
            } else if (finalConsultationPlan) {
              return `[2차 콜백 - 1차 상담 후속]\n${finalConsultationPlan}`;
            } else {
              return `[2차 콜백 - 1차 상담 후속]`;
            }
          })(),
          isVisitManagementCallback: false,
          isReReservationRecord: false
        };

        await dispatch(addCallback({
          patientId: patient._id || patient.id,
          callbackData: nextCallbackData
        })).unwrap();
      }

      PatientDataSync.onCallbackUpdate(
        patient._id || patient.id, 
        callback.id, 
        'CallbackManagement', 
      );

      resetFirstConsultationForm();
      alert('1차 상담이 완료 처리되었습니다.');

    } catch (error) {
      console.error('1차 상담 완료 처리 실패:', error);
      alert('1차 상담 완료 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 예약 후 미내원 상태 처리
  const handlePostReservationStatusUpdate = async () => {
    if (!postReservationStatus) {
      alert('예약 후 미내원 환자 상태를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      let postReservationResult: PostReservationResult;

      switch (postReservationStatus) {
        // 🔥 재예약 완료 케이스
        case '재예약 완료':
          if (!reReservationDate || !reReservationTime) {
            alert('재예약 날짜와 시간을 모두 입력해주세요.');
            return;
          }
          postReservationResult = {
            status: '재예약 완료',
            reReservationDate,
            reReservationTime,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // 🔥 재예약 완료 이력을 콜백 이력에 추가
          const reReservationCallbackData: Omit<CallbackItem, 'id'> = {
            type: '재예약완료' as any,
            date: format(new Date(), 'yyyy-MM-dd'),
            status: '완료' as CallbackStatus,
            time: format(new Date(), 'HH:mm'),
            notes: `[재예약 완료 처리 - ${format(new Date(), 'yyyy-MM-dd')}]\n` +
                  `원래 예약일: ${patient.reservationDate || '정보없음'} ${patient.reservationTime || ''}\n` +
                  `재예약일: ${reReservationDate} ${reReservationTime}\n` +
                  `처리사유: 예약 후 미내원으로 인한 재예약 처리`,
            postReservationResult,
            isVisitManagementCallback: false,
            isReReservationRecord: true
          };

          await dispatch(addCallback({
            patientId: patient._id || patient.id,
            callbackData: reReservationCallbackData
          })).unwrap();
          
          // 환자 상태를 재예약확정으로 변경
          await dispatch(updatePatient({
            patientId: patient._id || patient.id,
            patientData: {
              status: '재예약확정',
              reservationDate: reReservationDate,
              reservationTime: reReservationTime
            }
          })).unwrap();
          break;

        // 🔥 다음 콜백필요 케이스
        case '다음 콜백필요':
          if (!postReservationCallbackDate || !postReservationReason) {
            alert('콜백 날짜와 사유를 입력해주세요.');
            return;
          }
          postReservationResult = {
            status: '다음 콜백필요',
            callbackDate: postReservationCallbackDate,
            reason: postReservationReason,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // 새 콜백 등록
          const nextType = getNextCallbackType;
          const callbackData: Omit<CallbackItem, 'id'> = {
            type: nextType,
            date: postReservationCallbackDate,
            status: '예정' as CallbackStatus,
            time: undefined,
            notes: `[${nextType} 콜백 - 예약 후 미내원 후속]\n사유: ${postReservationReason}`,
            postReservationResult,
            isVisitManagementCallback: false,
            isReReservationRecord: false
          };

          await dispatch(addCallback({
            patientId: patient._id || patient.id,
            callbackData
          })).unwrap();
          break;

        // 🔥 부재중 처리 - 단순 상태 변경만
        case '부재중':
          if (!postReservationCallbackDate) {
            alert('다음 콜백 날짜를 선택해주세요.');
            return;
          }
          postReservationResult = {
            status: '부재중',
            callbackDate: postReservationCallbackDate,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          break;

        case '종결':
          if (!terminationReason) {
            alert('종결 사유를 선택해주세요.');
            return;
          }
          
          if (terminationReason === '기타' && !customTerminationReason.trim()) {
            alert('기타 사유를 입력해주세요.');
            return;
          }
          
          const finalTerminationReason = terminationReason === '기타' 
            ? customTerminationReason.trim() 
            : terminationReason;
          
          postReservationResult = {
            status: '종결',
            terminationReason: finalTerminationReason,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await dispatch(completePatient({
            patientId: patient._id || patient.id,
            reason: finalTerminationReason
          })).unwrap();
          break;

        default:
          alert('올바른 상태를 선택해주세요.');
          return;
      }

      // 환자 정보 업데이트
      await dispatch(updatePatient({
        patientId: patient._id || patient.id,
        patientData: {
          lastPostReservationResult: postReservationResult,
          isPostReservationPatient: postReservationStatus !== '재예약 완료',
          hasBeenPostReservationPatient: true,
          ...(postReservationStatus === '부재중' && { status: '부재중' })
        }
      })).unwrap();

      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onUpdate(
        patient._id || patient.id, 
        'CallbackManagement', 
        { postReservationStatus }
      );

      resetPostReservationForm();
      alert('예약 후 미내원 상태가 업데이트되었습니다.');

    } catch (error) {
      console.error('예약 후 미내원 상태 처리 실패:', error);
      alert('상태 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 콜백 후속 상태 처리
  const handleCallbackFollowupComplete = async (callback: CallbackItem) => {
    if (!callbackFollowupStatus) {
      alert(`${callback.type} 상담 후 환자 상태를 선택해주세요.`);
      return;
    }

    setIsLoading(true);
    try {
      // 🔥 추가: callbackFollowupResult 변수 정의
      let callbackFollowupResult: CallbackFollowupResult;

      switch (callbackFollowupStatus) {
        case '예약완료':
          if (!reservationDate || !reservationTime || !consultationContent) {
            alert('예약 완료 시 예약날짜, 시간, 상담내용을 모두 입력해주세요.');
            return;
          }
          callbackFollowupResult = {
            status: '예약완료',
            callbackType: callback.type as any,
            reservationDate,
            reservationTime,
            consultationContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // 환자 상태를 예약확정으로 변경
          await dispatch(updatePatient({
            patientId: patient._id || patient.id,
            patientData: {
              status: '예약확정',
              reservationDate,
              reservationTime
            }
          })).unwrap();
          break;

      case '상담진행중':
      case '부재중':
        if (!followupCallbackDate) {
          alert('다음 콜백 날짜를 선택해주세요.');
          return;
        }
        
        // 🔥 수정: 상담내용 연동 우선순위 변경
        let finalFollowupReason = followupReason;
        if (!finalFollowupReason || finalFollowupReason.trim() === '') {
          // 🔥 1단계: 현재 콜백(n차)의 순수 상담내용 추출
          const currentCallbackPlan = getCurrentCallbackPlan(callback);
          
          if (currentCallbackPlan) {
            finalFollowupReason = currentCallbackPlan;
            console.log(`🔄 ${callback.type} 콜백 - 현재 차수 상담내용 연동:`, finalFollowupReason);
          } else {
            // 🔥 2단계: 현재 콜백에 없으면 이전 차수에서 찾기
            const previousPlan = getPreviousCallbackPlan(callback.type);
            if (previousPlan) {
              finalFollowupReason = previousPlan;
              console.log(`🔄 ${callback.type} 콜백 - 이전 차수 상담내용 연동:`, finalFollowupReason);
            } else {
              // 🔥 3단계: 빈 문자열로 설정 (기본 텍스트 생성 안 함)
              finalFollowupReason = '';
              console.log(`🔄 ${callback.type} 콜백 - 상담내용 없음`);
            }
          }
        }
        
        callbackFollowupResult = {
          status: callbackFollowupStatus,
          callbackType: callback.type as any,
          nextCallbackDate: followupCallbackDate,
          reason: finalFollowupReason,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // 다음 콜백 등록
        const nextType = getNextCallbackTypeForCompletion(callback.type);
        const nextCallbackData: Omit<CallbackItem, 'id'> = {
          type: nextType,
          date: followupCallbackDate,
          status: '예정' as CallbackStatus,
          time: undefined,
          // 🔥 수정: 순수 상담내용만 저장 (접두사 제거)
          notes: finalFollowupReason 
            ? `[${nextType} 콜백 - ${callback.type} 후속]\n${finalFollowupReason}`
            : `[${nextType} 콜백 - ${callback.type} 후속]`,
          callbackFollowupResult,
          isVisitManagementCallback: false,
          isReReservationRecord: false
        };

        await dispatch(addCallback({
          patientId: patient._id || patient.id,
          callbackData: nextCallbackData
        })).unwrap();
        break;

        default:
          alert('올바른 상태를 선택해주세요.');
          return;
      }

      // 현재 콜백 완료 처리
      const updateData = {
        status: '완료' as CallbackStatus,
        callbackFollowupResult,
        // 🔥 수정: 상담내용을 notes에 명확히 포함
        notes: callback.notes + (
          callbackFollowupStatus === '예약완료' && reservationDate && reservationTime 
            ? `\n예약일정: ${reservationDate} ${reservationTime}${consultationContent ? `\n상담내용: ${consultationContent}` : ''}` 
            : '' // 🔥 부재중/상담진행중일 때는 추가 텍스트 없음 (이미 뱃지로 표시됨)
        ),
        // 완료 처리 시 현재 날짜와 시간으로 업데이트  
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        completedAt: new Date().toISOString()
      };

      await dispatch(updateCallback({
        patientId: patient._id || patient.id,
        callbackId: callback.id,
        updateData
      })).unwrap();

      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onCallbackUpdate(
        patient._id || patient.id, 
        callback.id, 
        'CallbackManagement', 
      );

      resetCallbackFollowupForm();
      alert(`${callback.type} 콜백이 완료 처리되었습니다.`);

    } catch (error) {
      console.error('콜백 후속 처리 실패:', error);
      alert('콜백 후속 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 콜백 추가 핸들러 - 수정된 버전
  const handleAddCallback = async () => {
    setIsLoading(true);
    try {
      // 🔥 실행 시점에 최신 차수 계산 (메모화된 값 사용)
      const currentCallbackType = getNextCallbackType;
      
      const callbackData: Omit<CallbackItem, 'id'> = {
        type: currentCallbackType,
        date: callbackDate,
        status: '예정' as CallbackStatus,
        time: callbackTime || undefined,
        notes: `[${currentCallbackType} 콜백 등록]`,
        isVisitManagementCallback: false,
        isReReservationRecord: false
      };

      await dispatch(addCallback({
        patientId: patient._id || patient.id,
        callbackData
      })).unwrap();

      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onCallbackAdd(
        patient._id || patient.id, 
        currentCallbackType, 
        'CallbackManagement'
      );

      // 초기화
      setIsAddingCallback(false);
      alert(`${currentCallbackType} 콜백이 등록되었습니다.`);
    } catch (error) {
      console.error('콜백 추가 실패:', error);
      alert('콜백 등록에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 폼 초기화 함수들
  const resetFirstConsultationForm = () => {
    setFirstConsultationStatus('');
    setReservationDate('');
    setReservationTime('');
    setConsultationContent('');
    setConsultationPlan('');
    setTerminationReason('');
    setCustomTerminationReason('');
  };

  const resetPostReservationForm = () => {
    setPostReservationStatus('');
    setPostReservationCallbackDate('');
    setPostReservationReason('');
    setTerminationReason('');
    setCustomTerminationReason('');
    setReReservationDate('');
    setReReservationTime('');
  };

  const resetCallbackFollowupForm = () => {
    setCallbackFollowupStatus('');
    setFollowupCallbackDate('');
    setFollowupReason('');
    setTerminationReason('');
    setCustomTerminationReason('');
  };

  // 🔥 콜백 삭제
  const handleDeleteCallback = async (callback: CallbackItem) => {
    if (!confirm(`${callback.type} 콜백을 삭제하시겠습니까?`)) return;

    try {
      await dispatch(deleteCallback({
        patientId: patient._id || patient.id,
        callbackId: callback.id
      })).unwrap();

      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onCallbackDelete(
        patient._id || patient.id, 
        callback.id, 
        'CallbackManagement'
      );

      alert('콜백이 삭제되었습니다.');
    } catch (error) {
      alert('콜백 삭제에 실패했습니다.');
    }
  };

  // 🔥 컴포넌트 마운트 시 설정 - 수정된 버전 (카테고리만 fetch)
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  return (
    <div className="space-y-6">
      {/* 🔥 헤더 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">콜백 관리</h2>
          <div className="flex items-center space-x-4">
            {effectiveUser && (
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                담당자: {effectiveUser.name}
              </div>
            )}
            
            {/* 현재 상담 단계 표시 */}
            <div className={`text-sm px-3 py-1 rounded-full font-medium ${
              currentStage === 'first' ? 'bg-blue-100 text-blue-800' :
              currentStage === 'callback' ? 'bg-yellow-100 text-yellow-800' :
              currentStage === 'post_reservation' ? 'bg-orange-100 text-orange-800' :
              'bg-green-100 text-green-800'
            }`}>
              {currentStage === 'first' ? '첫 상담' :
               currentStage === 'callback' ? '콜백 진행' :
               currentStage === 'post_reservation' ? '예약 후 미내원' :
               '완료'}
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 예약 후 미내원 환자 처리 섹션 */}
      {currentStage === 'post_reservation' && (
        <div className="card border-orange-200 bg-orange-50">
          <h3 className="text-md font-semibold text-orange-800 mb-4">예약 후 미내원 환자상태</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {(['재예약 완료', '다음 콜백필요', '부재중', '종결'] as PostReservationStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setPostReservationStatus(status)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    postReservationStatus === status
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* 재예약 완료 선택시 입력 필드 */}
            {postReservationStatus === '재예약 완료' && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">재예약 날짜</label>
                    <input
                      type="date"
                      value={reReservationDate}
                      onChange={(e) => setReReservationDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">재예약 시간</label>
                    <input
                      type="time"
                      value={reReservationTime}
                      onChange={(e) => setReReservationTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 다음 콜백필요/부재중 선택시 입력 필드 */}
            {(postReservationStatus === '다음 콜백필요' || postReservationStatus === '부재중') && (
              <div className="space-y-3 p-3 bg-orange-100 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">다음 콜백 날짜</label>
                  <input
                    type="date"
                    value={postReservationCallbackDate}
                    onChange={(e) => setPostReservationCallbackDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                {postReservationStatus === '다음 콜백필요' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">콜백 정보</label>
                    <textarea
                      value={postReservationReason}
                      onChange={(e) => setPostReservationReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      rows={2}
                      placeholder="미내원 사유 및 재콜백 계획을 입력하세요..."
                    />
                  </div>
                )}
              </div>
            )}

            {/* 종결 선택시 입력 필드 */}
            {postReservationStatus === '종결' && (
              <div className="space-y-3 p-3 bg-red-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종결사유</label>
                  <select
                    value={terminationReason}
                    onChange={(e) => setTerminationReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">종결 사유를 선택하세요</option>
                    {TERMINATION_REASONS.map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
                
                {terminationReason === '기타' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">기타 사유 (상세 입력)</label>
                    <textarea
                      value={customTerminationReason}
                      onChange={(e) => setCustomTerminationReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows={2}
                      placeholder="구체적인 종결 사유를 입력해주세요..."
                    />
                  </div>
                )}
              </div>
            )}
            
            {postReservationStatus && (
              <div className="flex justify-end">
                <button
                  onClick={handlePostReservationStatusUpdate}
                  disabled={isLoading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {isLoading ? '처리 중...' : '상태 업데이트'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔥 콜백 이력 및 상태별 처리 */}
      <div className="card">
        <h3 className="text-md font-semibold text-text-primary mb-4">콜백 이력 및 처리</h3>
        
        {callbackHistory.length === 0 ? (
          <div className="text-center py-6 text-text-secondary bg-gray-50 rounded-lg">
            아직 기록된 콜백 이력이 없습니다.
            <div className="mt-4">
              <button
                onClick={() => setIsAddingCallback(true)}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                첫 콜백 등록하기
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {callbackHistory.map((callback) => (
              <div 
                key={callback.id}
                className={`p-4 border rounded-lg ${
                  callback.status === '완료' 
                    ? 'border-green-200 bg-green-50' 
                    : callback.status === '예정'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-orange-200 bg-orange-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      callback.isReReservationRecord ? 'bg-blue-100 text-blue-800' :
                      callback.type === '1차' ? 'bg-orange-100 text-orange-800' :
                      callback.type === '2차' ? 'bg-yellow-100 text-yellow-800' :
                      callback.type === '3차' ? 'bg-red-100 text-red-800' :
                      callback.type === '4차' ? 'bg-purple-100 text-purple-800' :
                      'bg-indigo-100 text-indigo-800'
                    }`}>
                      {callback.isReReservationRecord ? '재예약완료' : callback.type}
                    </span>
                    <span className="text-sm text-gray-600">{callback.date}</span>
                    {callback.time && <span className="text-sm text-gray-600">{callback.time}</span>}
                    <div className="flex items-center gap-2">
                      <span className={`text-sm px-2 py-1 rounded ${
                        callback.status === '완료' ? 'bg-green-100 text-green-800' :
                        callback.status === '예정' ? 'bg-blue-100 text-blue-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {callback.status}
                      </span>
                      
                      {/* 🔥 완료 상태일 때 추가 상태 뱃지 표시 */}
                      {callback.status === '완료' && (
                        <>
                          {/* 첫 상담 결과 상태 */}
                          {callback.firstConsultationResult?.status === '예약완료' && (
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                              예약완료
                            </span>
                          )}
                          {callback.firstConsultationResult?.status === '상담진행중' && (
                            <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                              상담중
                            </span>
                          )}
                          {callback.firstConsultationResult?.status === '부재중' && (
                            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                              부재중
                            </span>
                          )}
                          {callback.firstConsultationResult?.status === '종결' && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                              종결
                            </span>
                          )}
                          
                          {/* 콜백 후속 결과 상태 */}
                          {callback.callbackFollowupResult?.status === '예약완료' && (
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                              예약완료
                            </span>
                          )}
                          {callback.callbackFollowupResult?.status === '상담진행중' && (
                            <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                              상담중
                            </span>
                          )}
                          {callback.callbackFollowupResult?.status === '부재중' && (
                            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                              부재중
                            </span>
                          )}
                          {callback.callbackFollowupResult?.status === '종결' && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                              종결
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* 🔥 수정/삭제 버튼 추가 - 예정 상태이고 재예약완료가 아닌 경우에만 표시 */}
                  {!patient.isCompleted && callback.status === '예정' && !callback.isReReservationRecord && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditCallback(callback)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        title="수정"
                      >
                        <Icon icon={HiOutlinePencil} size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCallback(callback)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="삭제"
                      >
                        <Icon icon={HiOutlineTrash} size={16} />
                      </button>
                    </div>
                  )}
                </div>
                
                {callback.notes && (
                      <div className="text-sm text-gray-700 whitespace-pre-line mb-3">
                        {callback.notes
                          .replace(/\[.*?차 콜백 - .*? 후속\]\n?/g, '')
                          .replace(/\[.*?상담.*? 완료 - \d{4}-\d{2}-\d{2}\]\n?/g, '')
                          .replace(/\[.*?부재중.*? 완료 - \d{4}-\d{2}-\d{2}\]\n?/g, '')
                          .replace(/\[.*?예약완료.*? 완료 - \d{4}-\d{2}-\d{2}\]\n?/g, '')
                          .replace(/\n\n종결사유:.*$/g, '') // 🔥 종결사유 중복 표시 방지
                          .trim()}
                      </div>
                    )}

                    {/* 🔥 NEW: 종결 사유 별도 표시 섹션 추가 */}
                    {callback.status === '완료' && (
                      <>
                        {/* 첫 상담 종결 사유 표시 */}
                        {callback.firstConsultationResult?.status === '종결' && callback.firstConsultationResult?.terminationReason && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon icon={HiOutlineStop} size={16} className="text-red-600" />
                              <span className="text-sm font-medium text-red-800">1차 상담 후 종결</span>
                            </div>
                            <p className="text-sm text-red-700">
                              종결사유: {callback.firstConsultationResult.terminationReason}
                            </p>
                          </div>
                        )}

                        {/* 콜백 후속 종결 사유 표시 */}
                        {callback.callbackFollowupResult?.status === '종결' && callback.callbackFollowupResult?.terminationReason && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon icon={HiOutlineStop} size={16} className="text-red-600" />
                              <span className="text-sm font-medium text-red-800">{callback.type} 콜백 후 종결</span>
                            </div>
                            <p className="text-sm text-red-700">
                              종결사유: {callback.callbackFollowupResult.terminationReason}
                            </p>
                          </div>
                        )}

                        {/* 🔥 예약완료 정보 별도 표시 */}
                        {(callback.firstConsultationResult?.status === '예약완료' || 
                          callback.callbackFollowupResult?.status === '예약완료') && (
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon icon={HiOutlineCheck} size={16} className="text-blue-600" />
                              <span className="text-sm font-medium text-blue-800">예약 완료</span>
                            </div>
                            {callback.firstConsultationResult?.status === '예약완료' && (
                              <div className="text-sm text-blue-700">
                                <p>예약일정: {callback.firstConsultationResult.reservationDate} {callback.firstConsultationResult.reservationTime}</p>
                                {callback.firstConsultationResult.consultationContent && (
                                  <p className="mt-1">상담내용: {callback.firstConsultationResult.consultationContent}</p>
                                )}
                              </div>
                            )}
                            {callback.callbackFollowupResult?.status === '예약완료' && (
                              <div className="text-sm text-blue-700">
                                <p>예약일정: {callback.callbackFollowupResult.reservationDate} {callback.callbackFollowupResult.reservationTime}</p>
                                {callback.callbackFollowupResult.consultationContent && (
                                  <p className="mt-1">상담내용: {callback.callbackFollowupResult.consultationContent}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                {/* 🔥 콜백 상태별 처리 UI */}
                {callback.status === '예정' && !patient.isCompleted && !callback.isReReservationRecord && (
                  <div className="border-t pt-3 mt-3">
                    {callback.type === '1차' && currentStage === 'first' ? (
                      // 🔥 1차 상담 후 환자 상태 처리
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-800">1차 상담 후 환자 상태</h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {(['예약완료', '상담진행중', '부재중', '종결'] as FirstConsultationStatus[]).map((status) => (
                            <button
                              key={status}
                              onClick={() => setFirstConsultationStatus(status)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                firstConsultationStatus === status
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>

                        {/* 예약완료 선택시 입력 필드 */}
                        {firstConsultationStatus === '예약완료' && (
                          <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">예약날짜</label>
                                <input
                                  type="date"
                                  value={reservationDate}
                                  onChange={(e) => setReservationDate(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">예약시간</label>
                                <input
                                  type="time"
                                  value={reservationTime}
                                  onChange={(e) => setReservationTime(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">상담내용</label>
                              <textarea
                                value={consultationContent}
                                onChange={(e) => setConsultationContent(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                placeholder="상담 내용을 입력하세요..."
                              />
                            </div>
                          </div>
                        )}

                        {/* 상담진행중/부재중 선택시 입력 필드 */}
                        {(firstConsultationStatus === '상담진행중' || firstConsultationStatus === '부재중') && (
                          <div className="space-y-3 p-3 bg-yellow-50 rounded-lg">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">다음 콜백날짜</label>
                              <input
                                type="date"
                                value={callbackDate}
                                onChange={(e) => setCallbackDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">상담내용/계획</label>
                              <textarea
                                value={consultationPlan}
                                onChange={(e) => setConsultationPlan(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="다음 상담 계획을 입력하세요..."
                              />
                            </div>
                          </div>
                        )}

                        {/* 종결 선택시 입력 필드 */}
                        {firstConsultationStatus === '종결' && (
                          <div className="space-y-3 p-3 bg-red-50 rounded-lg">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">종결사유</label>
                              <select
                                value={terminationReason}
                                onChange={(e) => setTerminationReason(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">종결 사유를 선택하세요</option>
                                {TERMINATION_REASONS.map(reason => (
                                  <option key={reason} value={reason}>{reason}</option>
                                ))}
                              </select>
                            </div>
                            
                            {terminationReason === '기타' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">기타 사유 (상세 입력)</label>
                                <textarea
                                  value={customTerminationReason}
                                  onChange={(e) => setCustomTerminationReason(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  rows={2}
                                  placeholder="구체적인 종결 사유를 입력해주세요..."
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* 1차 상담 완료 버튼 */}
                        {firstConsultationStatus && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleFirstConsultationComplete(callback)}
                              disabled={isLoading}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {isLoading ? '처리 중...' : '1차 상담 완료'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (callback.type !== '1차') ? (
                      // 🔥 N차 콜백 후속 처리 (수정된 버전 - 중복 종결 버튼 제거)
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-800">{callback.type} 상담 후 환자 상태</h4>
                        
                        {/* 🔥 수정: 4개 버튼을 한 줄에 깔끔하게 배치 */}
                        <div className="flex gap-2">
                          {(['예약완료', '상담진행중', '부재중', '종결'] as CallbackFollowupStatus[]).map((status) => (
                            <button
                              key={status}
                              onClick={() => setCallbackFollowupStatus(status)}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                callbackFollowupStatus === status
                                  ? (status === '종결' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white')
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>

                        {/* 예약완료 선택시 입력 필드 */}
                        {callbackFollowupStatus === '예약완료' && (
                          <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">예약날짜</label>
                                <input
                                  type="date"
                                  value={reservationDate}
                                  onChange={(e) => setReservationDate(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">예약시간</label>
                                <input
                                  type="time"
                                  value={reservationTime}
                                  onChange={(e) => setReservationTime(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">상담내용</label>
                              <textarea
                                value={consultationContent}
                                onChange={(e) => setConsultationContent(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                placeholder="상담 내용을 입력하세요..."
                              />
                            </div>
                          </div>
                        )}

                        {/* 부재중/상담중 선택시 입력 필드 */}
                        {(callbackFollowupStatus === '부재중' || callbackFollowupStatus === '상담진행중') && (
                          <div className="space-y-3 p-3 bg-yellow-50 rounded-lg">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">다음 콜백 날짜</label>
                              <input
                                type="date"
                                value={followupCallbackDate}
                                onChange={(e) => setFollowupCallbackDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">상담내용/계획</label>
                              {/* 🔥 textarea로 변경하고 placeholder도 수정 */}
                              <textarea
                                value={followupReason}
                                onChange={(e) => setFollowupReason(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="다음 상담 계획을 입력하세요..."
                              />
                            </div>
                          </div>
                        )}


                        {/* 🔥 종결 선택시 입력 필드 */}
                        {callbackFollowupStatus === '종결' && (
                          <div className="space-y-3 p-3 bg-red-50 rounded-lg">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">종결사유</label>
                              <select
                                value={terminationReason}
                                onChange={(e) => setTerminationReason(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                              >
                                <option value="">종결 사유를 선택하세요</option>
                                {TERMINATION_REASONS.map(reason => (
                                  <option key={reason} value={reason}>{reason}</option>
                                ))}
                              </select>
                            </div>
                            
                            {terminationReason === '기타' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">기타 사유 (상세 입력)</label>
                                <textarea
                                  value={customTerminationReason}
                                  onChange={(e) => setCustomTerminationReason(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                  rows={2}
                                  placeholder="구체적인 종결 사유를 입력해주세요..."
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* N차 상담 완료 버튼 */}
                        {callbackFollowupStatus && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => {
                                if (callbackFollowupStatus === '종결') {
                                  handleCallbackTermination(callback);
                                } else {
                                  handleCallbackFollowupComplete(callback);
                                }
                              }}
                              disabled={isLoading}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {isLoading ? '처리 중...' : 
                               callbackFollowupStatus === '종결' ? `${callback.type} 상담 종결` : 
                               `${callback.type} 상담 완료`}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* 담당자 정보 */}
                {(callback.handledByName || callback.createdByName) && (
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    {callback.handledByName && (
                      <span>처리자: {callback.handledByName}</span>
                    )}
                    {callback.createdByName && (
                      <span>등록자: {callback.createdByName}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>      

      {/* 🔥 콜백 추가 버튼 - 실시간 차수 표시 */}
      {!patient.isCompleted && !isAddingCallback && currentStage !== 'post_reservation' && (
        <div className="flex justify-start">
          <button
            onClick={() => {
              setIsAddingCallback(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Icon icon={HiOutlinePlus} size={18} />
            <span>{getNextCallbackType} 콜백 추가</span>
          </button>
        </div>
      )}

      {/* 🔥 콜백 추가 폼 - 실시간 차수 표시 */}
      {isAddingCallback && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <h4 className="font-medium text-blue-800 mb-3">{getNextCallbackType} 콜백 등록</h4>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  콜백 날짜
                </label>
                <input
                  type="date"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  콜백 시간 (선택)
                </label>
                <input
                  type="time"
                  value={callbackTime}
                  onChange={(e) => setCallbackTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => {
                setIsAddingCallback(false);
                setCallbackTime('');
              }}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={isLoading}
            >
              취소
            </button>
            <button
              onClick={handleAddCallback}
              disabled={isLoading || !callbackDate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? '등록 중...' : `${getNextCallbackType} 콜백 등록`}
            </button>
          </div>
        </div>
      )}

      {/* 🔥 이벤트 타겟 섹션 */}
      <EventTargetSection patient={patient} />

      {/* 🔥 콜백 수정 모달 */}
{isEditingCallback && editingCallback && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-md">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {editingCallback.type} 콜백 수정
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            콜백 날짜
          </label>
          <input
            type="date"
            value={editCallbackDate}
            onChange={(e) => setEditCallbackDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            콜백 시간 (선택)
          </label>
          <input
            type="time"
            value={editCallbackTime}
            onChange={(e) => setEditCallbackTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            메모
          </label>
          <textarea
            value={editCallbackNotes}
            onChange={(e) => setEditCallbackNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="콜백 관련 메모를 입력하세요..."
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={handleCancelCallbackEdit}
          disabled={isLoading}
          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          취소
        </button>
        <button
          onClick={handleSaveCallbackEdit}
          disabled={isLoading || !editCallbackDate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}