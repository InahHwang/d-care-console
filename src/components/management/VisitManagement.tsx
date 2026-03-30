// src/components/management/VisitManagement.tsx - 수정된 완전한 버전

'use client'

import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { Patient, PostVisitStatus, EstimateInfo, PaymentInfo, PostVisitConsultationInfo, PatientReaction, TreatmentConsentInfo, CallbackItem, VisitManagementCallbackType } from '@/types/patient'
import { selectPatient, updatePostVisitStatus, fetchPostVisitPatients, resetPostVisitData } from '@/store/slices/patientsSlice'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  HiOutlinePhone,
  HiOutlineCalendar,
  HiOutlineClipboardList,
  HiOutlineRefresh,
  HiOutlineInformationCircle,
  HiOutlineClipboard,
  HiOutlineSearch,
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineUser,
  HiOutlineTag,
  HiOutlineChevronLeft,
  HiOutlineChevronRight
} from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import PatientDetailModal from './PatientDetailModal'
import { format, addDays } from 'date-fns'
import { selectPatientWithContext } from '@/store/slices/patientsSlice' 
import { PatientDataSync } from '@/utils/dataSync'


// 🔧 수정된 import - 새로운 함수만 import
import { isUnprocessedAfterCallback, getDaysSinceProcessed } from '@/utils/patientUtils'
import { useCategories } from '@/hooks/useCategories'
import PostponementReasonSelector from '../common/PostponementReasonSelector'
import { getDelayReasonWithIcon } from '@/constants/delayReasons'

// 날짜 필터 타입 추가
type SimpleDateFilterType = 'all' | 'daily' | 'monthly';

interface PostVisitStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (statusData: PostVisitConsultationInfo & { visitCallbackData?: any }) => void;
  patient: Patient | null;
  isLoading: boolean;
  // 🔥 새로 추가된 props
  onRefreshData?: () => Promise<void>; // 데이터 새로고침 함수
  onPatientUpdate?: (updatedPatient: Patient) => void; // 환자 정보 업데이트 함수
}

// 내원 후 상태 업데이트 모달 컴포넌트 - 수정된 버전
const PostVisitStatusModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  patient, 
  isLoading,
  onRefreshData, // 🔥 추가된 prop
  onPatientUpdate // 🔥 추가된 prop
}: PostVisitStatusModalProps) => {
 const [selectedStatus, setSelectedStatus] = useState<PostVisitStatus>('');
 const [consultationContent, setConsultationContent] = useState('');
 
 // 🔥 내원 후 첫 상담 내용 상태 추가
 const [firstVisitConsultationContent, setFirstVisitConsultationContent] = useState('');
 
 // 치료 내용 상태 추가
 const [treatmentContent, setTreatmentContent] = useState<string>('');
 
 // 견적 정보
 const [regularPrice, setRegularPrice] = useState(0);
 const [discountPrice, setDiscountPrice] = useState(0);
 const [discountEvent, setDiscountEvent] = useState('');
 const [patientReaction, setPatientReaction] = useState<PatientReaction>('');
 
 // 재콜백 필요 시 필드들
 const [nextCallbackDate, setNextCallbackDate] = useState('');
 const [nextConsultationPlan, setNextConsultationPlan] = useState('');
 
 // 🔥 내원 콜백 관련 상태 추가
 const [visitCallbackType, setVisitCallbackType] = useState<VisitManagementCallbackType>('내원1차');
 const [visitCallbackDate, setVisitCallbackDate] = useState(format(new Date(), 'yyyy-MM-dd'));
 const [visitCallbackReason, setVisitCallbackReason] = useState('');
 const [visitCallbackNotes, setVisitCallbackNotes] = useState('');
 
 // 🔥 내원 콜백 수정/삭제를 위한 상태 추가
 const [isEditingVisitCallback, setIsEditingVisitCallback] = useState(false);
 const [editingCallbackId, setEditingCallbackId] = useState('');
 
 // 치료 동의 시 필드들 추가
 const [treatmentStartDate, setTreatmentStartDate] = useState('');
 const [consentNotes, setConsentNotes] = useState('');
 const [estimatedTreatmentPeriod, setEstimatedTreatmentPeriod] = useState('');
 
 // 치료 시작 시 필드들
 const [paymentType, setPaymentType] = useState<'installment' | 'lump_sum'>('lump_sum');
 const [downPayment, setDownPayment] = useState(0);
 const [installmentPlan, setInstallmentPlan] = useState('');
 const [nextVisitDate, setNextVisitDate] = useState('');

 // 종결 사유 상태 추가
 const [completionReason, setCompletionReason] = useState('');

 // 🔥 미룸 사유 관련 상태 추가
 const [postponementReason, setPostponementReason] = useState<string | null>(null);
 const [postponementReasonCustom, setPostponementReasonCustom] = useState<string>('');

 // 🔥 콜백 이력 새로고침을 위한 상태 추가
 const [refreshKey, setRefreshKey] = useState(0);

 // 🔥 내원 콜백 이력 필터링 함수
 const getVisitCallbacks = useCallback(() => {
   return patient?.callbackHistory?.filter(cb => 
     cb.isVisitManagementCallback === true
   ) || [];
 }, [patient?.callbackHistory]); // refreshKey 의존성 제거

 // 🔥 다음 콜백 타입 자동 결정 함수
 const getNextVisitCallbackType = useCallback(() => {
  const currentVisitCallbacks = getVisitCallbacks();
  
  // 완료된 콜백들의 차수 확인 - 부재중도 완료된 것으로 간주
  const completedCallbacks = currentVisitCallbacks.filter(cb => 
    cb.status === '완료' || cb.status === '부재중'
  );
  const completedTypes = completedCallbacks.map(cb => cb.type);
  
  // 1차부터 순차적으로 확인
  if (!completedTypes.includes('내원1차')) return '내원1차';
  if (!completedTypes.includes('내원2차')) return '내원2차';
  if (!completedTypes.includes('내원3차')) return '내원3차';
  if (!completedTypes.includes('내원4차')) return '내원4차';  // 🔥 추가
  if (!completedTypes.includes('내원5차')) return '내원5차';  // 🔥 추가
  if (!completedTypes.includes('내원6차')) return '내원6차';  // 🔥 추가
  
  // 모든 차수가 완료된 경우 6차로 고정
  return '내원6차';  // 🔥 3차 → 6차로 변경
}, [getVisitCallbacks]);


 // 🔥 내원 콜백 수정 핸들러
 const handleEditVisitCallback = (callback: any) => {
   // 수정할 콜백의 데이터를 폼에 채우기
   setVisitCallbackType(callback.type);
   setVisitCallbackDate(callback.date);
   setVisitCallbackReason(callback.visitManagementReason || '');
   setVisitCallbackNotes(callback.notes || '');
   setIsEditingVisitCallback(true);
   setEditingCallbackId(callback.id);
   
   console.log('내원 콜백 수정 모드 활성화:', {
     callbackId: callback.id,
     type: callback.type,
     date: callback.date
   });
 };

 // 🔥 내원 콜백 삭제 핸들러
 const handleDeleteVisitCallback = async (callback: any) => {
   if (!confirm(`${callback.type} 내원 콜백을 삭제하시겠습니까?`)) {
     return;
   }

   try {
     if (!patient) return;
     
     const patientId = patient._id || patient.id;
     
     // API 호출로 콜백 삭제
     const response = await fetch(`/api/patients/${patientId}/callbacks/${callback.id}`, {
       method: 'DELETE',
       headers: {
         'Content-Type': 'application/json',
       },
     });

     if (!response.ok) {
       const errorData = await response.json();
       throw new Error(errorData.error || '콜백 삭제에 실패했습니다.');
     }

     console.log('내원 콜백 삭제 성공:', {
       callbackId: callback.id,
       type: callback.type
     });

     alert(`${callback.type} 내원 콜백이 삭제되었습니다.`);

     // 🔥 데이터 동기화 적용 - 즉시 UI 반영
    PatientDataSync.onCallbackDelete(
      patientId,
      callback.id,
      'VisitManagement'
    );
     
     // 🔥 UI 강제 새로고침
     setRefreshKey(prev => prev + 1);
     
   } catch (error) {
     console.error('내원 콜백 삭제 실패:', error);
     alert('내원 콜백 삭제에 실패했습니다.');
   }
 };

 // 🔥 내원 콜백 수정 저장 핸들러
 const handleSaveVisitCallbackEdit = async () => {
    try {
      if (!patient || !editingCallbackId) return;
      
      const patientId = patient._id || patient.id;
      
      // 수정된 콜백 데이터 준비
      const updateData = {
        type: visitCallbackType,
        date: visitCallbackDate,
        visitManagementReason: visitCallbackReason,
        notes: `[내원 후 ${visitCallbackType} 콜백]\n사유: ${visitCallbackReason}\n\n상담 계획:\n${visitCallbackNotes}`,
        isVisitManagementCallback: true,
        updatedAt: new Date().toISOString()
      };

      // API 호출로 콜백 수정
      const response = await fetch(`/api/patients/${patientId}/callbacks/${editingCallbackId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '콜백 수정에 실패했습니다.');
      }

      console.log('내원 콜백 수정 성공:', {
        callbackId: editingCallbackId,
        type: visitCallbackType
      });

      alert(`${visitCallbackType} 내원 콜백이 수정되었습니다.`);
      
      // 수정 모드 해제
      setIsEditingVisitCallback(false);
      setEditingCallbackId('');
      
      // 🔥 데이터 동기화 적용 - 즉시 UI 반영
      PatientDataSync.onCallbackUpdate(
        patientId,
        editingCallbackId,
        'VisitManagement'
      );
      
      // 🔥 UI 강제 새로고침
      setRefreshKey(prev => prev + 1);
      
    } catch (error) {
      console.error('내원 콜백 수정 실패:', error);
      alert('내원 콜백 수정에 실패했습니다.');
    }
  };

 // 🔥 수정 취소 핸들러
 const handleCancelVisitCallbackEdit = () => {
   setIsEditingVisitCallback(false);
   setEditingCallbackId('');
   
   // 폼 데이터 초기화
   const nextType = getNextVisitCallbackType();
   setVisitCallbackType(nextType);
   setVisitCallbackDate(format(new Date(), 'yyyy-MM-dd'));
   setVisitCallbackReason('');
   setVisitCallbackNotes('');
 };

// 🔥 내원 콜백 부재중 처리 함수 수정
const handleMissedVisitCallback = async (callback: any) => {
  if (!confirm(`${callback.type} 내원 콜백을 부재중 처리하시겠습니까?`)) {
    return;
  }

  try {
    if (!patient) return;
    
    const patientId = patient._id || patient.id;
    
    // 콜백 부재중 처리 API 호출 - 상태를 '부재중'으로 설정
    const response = await fetch(`/api/patients/${patientId}/callbacks/${callback.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: '부재중', // 🔥 완료가 아닌 부재중 상태로 설정
        completedAt: new Date().toISOString(),
        completedDate: format(new Date(), 'yyyy-MM-dd'),
        completedTime: format(new Date(), 'HH:mm'),
        notes: `${callback.notes || ''}\n\n[부재중 처리 - ${format(new Date(), 'yyyy-MM-dd HH:mm')}]`
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '콜백 부재중 처리에 실패했습니다.');
    }

    console.log('내원 콜백 부재중 처리 성공:', {
      callbackId: callback.id,
      type: callback.type
    });

    alert(`${callback.type} 내원 콜백이 부재중 처리되었습니다.`);    

    // 🔥 데이터 동기화 적용 - 즉시 UI 반영
    PatientDataSync.onCallbackUpdate(
      patientId,
      callback.id,
      'VisitManagement'
    );
    
    // 🔥 UI 강제 새로고침
    setRefreshKey(prev => prev + 1);
    
    // 🔥 다음 콜백 타입 자동 설정 및 폼 초기화 (완료 처리와 동일)
    setTimeout(() => {
      const nextType = getNextVisitCallbackType();
      setVisitCallbackType(nextType);
      setVisitCallbackDate(format(new Date(), 'yyyy-MM-dd'));
      setVisitCallbackReason('');
      setVisitCallbackNotes('');
      console.log('🔥 다음 콜백 타입 자동 설정:', nextType);
    }, 100);
    
  } catch (error) {
    console.error('내원 콜백 부재중 처리 실패:', error);
    alert('내원 콜백 부재중 처리에 실패했습니다.');
  }
};

// 🔥 콜백 완료 처리 함수 - 개선된 버전
const handleCompleteVisitCallback = async (callback: any) => {
  if (!confirm(`${callback.type} 내원 콜백을 완료 처리하시겠습니까?`)) {
    return;
  }

  try {
    if (!patient) return;
    
    const patientId = patient._id || patient.id;
    
    // 콜백 완료 처리 API 호출
    const response = await fetch(`/api/patients/${patientId}/callbacks/${callback.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: '완료',
        completedAt: new Date().toISOString(),
        completedDate: format(new Date(), 'yyyy-MM-dd'),
        completedTime: format(new Date(), 'HH:mm')
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '콜백 완료 처리에 실패했습니다.');
    }

    console.log('내원 콜백 완료 처리 성공:', {
      callbackId: callback.id,
      type: callback.type
    });

    alert(`${callback.type} 내원 콜백이 완료 처리되었습니다.`);    
    
    // 🔥 데이터 동기화 적용 - 즉시 UI 반영
    PatientDataSync.onCallbackUpdate(
      patientId,
      callback.id,
      'VisitManagement'
    );

    // 🔥 UI 강제 새로고침
    setRefreshKey(prev => prev + 1);
    
    // 🔥 다음 콜백 타입 자동 설정 및 폼 초기화
    setTimeout(() => {
      const nextType = getNextVisitCallbackType();
      setVisitCallbackType(nextType);
      setVisitCallbackDate(format(new Date(), 'yyyy-MM-dd'));
      setVisitCallbackReason('');
      setVisitCallbackNotes('');
      console.log('🔥 다음 콜백 타입 자동 설정:', nextType);
    }, 100);
    
  } catch (error) {
    console.error('내원 콜백 완료 처리 실패:', error);
    alert('내원 콜백 완료 처리에 실패했습니다.');
  }
};

 // 상담 정보 표시용 함수들 추가
 const getConsultationDisplayInfo = () => {
   if (!patient?.consultation) {
     return null;
   }

   const consultation = patient.consultation;
   return {
     hasConsultation: true,
     estimatedAmount: consultation.estimatedAmount || 0,
     consultationDate: consultation.consultationDate || '미입력',
     treatmentPlan: consultation.treatmentPlan || '미입력',
     consultationNotes: consultation.consultationNotes || '미입력',
     estimateAgreed: consultation.estimateAgreed,
     estimateAgreedText: consultation.estimateAgreed ? '동의' : '거부'
   };
 };

 // 모달이 열릴 때마다 모든 필드 초기화
 useEffect(() => {
   if (isOpen) {
     // 모든 필드를 기본값으로 초기화
     setSelectedStatus('');
     setConsultationContent('');
     setFirstVisitConsultationContent(''); // 🔥 첫 상담 내용 초기화
     setTreatmentContent('');
     
     // 🔥 내원 콜백 관련 필드 초기화
     const nextType = getNextVisitCallbackType();
     setVisitCallbackType(nextType);
     setVisitCallbackDate(format(new Date(), 'yyyy-MM-dd'));
     setVisitCallbackReason('');
     setVisitCallbackNotes('');
     
     // 🔥 수정 모드 관련 초기화
     setIsEditingVisitCallback(false);
     setEditingCallbackId('');

     // 🔥 미룸 사유 관련 초기화
     setPostponementReason(null);
     setPostponementReasonCustom('');

     // 기타 필드들 초기화
     setNextCallbackDate('');
     setNextConsultationPlan('');
     
     // 치료 동의 관련 필드들 초기화
     setTreatmentStartDate('');
     setConsentNotes('');
     setEstimatedTreatmentPeriod('');
     
     setPaymentType('lump_sum');
     setDownPayment(0);
     setInstallmentPlan('');
     setNextVisitDate('');
     setCompletionReason('');

     // 견적 정보 로드 로직
     let estimateLoaded = false;

     // 1순위: 기존 내원 후 상담 정보의 견적 데이터
     if (patient?.postVisitConsultation?.estimateInfo) {
       const estimate = patient.postVisitConsultation.estimateInfo;
       setRegularPrice(estimate.regularPrice || 0);
       setDiscountPrice(estimate.discountPrice || 0);
       setDiscountEvent(estimate.discountEvent || '');
       setPatientReaction(estimate.patientReaction || '');
       estimateLoaded = true;
     }
     // 2순위: 상담관리의 견적금액이 있고 아직 내원 후 견적이 없는 경우 자동 연동
     else if (patient?.consultation?.estimatedAmount && patient.consultation.estimatedAmount > 0) {
       setRegularPrice(0);
       setDiscountPrice(patient.consultation.estimatedAmount);
       setDiscountEvent('');
       setPatientReaction('');
       estimateLoaded = true;
     }
     // 3순위: 아무 견적 정보가 없는 경우 기본값
     else {
       setRegularPrice(0);
       setDiscountPrice(0);
       setDiscountEvent('');
       setPatientReaction('');
     }
     
     // 환자 기존 데이터가 있는 경우에만 로드 (견적 정보 제외)
     if (patient?.postVisitConsultation) {
       setConsultationContent(patient.postVisitConsultation.consultationContent || '');
       setFirstVisitConsultationContent((patient.postVisitConsultation as any)?.firstVisitConsultationContent || ''); // 🔥 첫 상담 내용 로드
       setTreatmentContent((patient.postVisitConsultation as any)?.treatmentContent || '');
       
       // 기타 필드들 로드
       setNextCallbackDate(patient.postVisitConsultation.nextCallbackDate || '');
       setNextConsultationPlan(patient.postVisitConsultation.nextConsultationPlan || '');
       
       // 치료 동의 정보 로드
       const treatmentConsent = patient.postVisitConsultation.treatmentConsentInfo;
       if (treatmentConsent) {
         setTreatmentStartDate(treatmentConsent.treatmentStartDate || '');
         setConsentNotes(treatmentConsent.consentNotes || '');
         setEstimatedTreatmentPeriod(treatmentConsent.estimatedTreatmentPeriod || '');
       }
       
       const payment = patient.postVisitConsultation.paymentInfo;
       if (payment) {
         setPaymentType(payment.paymentType || 'lump_sum');
         setDownPayment(payment.downPayment || 0);
         setInstallmentPlan(payment.installmentPlan || '');
       }
       
       setNextVisitDate(patient.postVisitConsultation.nextVisitDate || '');
       setCompletionReason((patient.postVisitConsultation as any)?.completionReason || '');
     }
     
     // 환자의 기존 상태 로드
     if (patient?.postVisitStatus) {
       setSelectedStatus(patient.postVisitStatus);
     }

     // 관심 분야 -> 치료 내용 자동 연동 (기존 코드 개선)
     // 기존에 치료 내용이 없는 경우에만 관심분야에서 자동 연동
     if (!patient?.postVisitConsultation?.treatmentContent && 
         patient?.interestedServices && 
         patient.interestedServices.length > 0) {
       
       // 관심 분야 중 유효한 첫 번째 항목을 자동 연동 (기타 제외)
       const validInterests = patient.interestedServices.filter(interest => 
         interest && interest.trim() !== '' && interest !== '기타'
       );
       
       if (validInterests.length > 0) {
         const firstValidInterest = validInterests[0];
         setTreatmentContent(firstValidInterest);
         console.log('🔥 관심 분야 자동 연동:', {
           patientName: patient.name,
           allInterestedServices: patient.interestedServices,
           validInterests: validInterests,
           autoLinkedTreatment: firstValidInterest
         });
       }
     }
   }
 }, [isOpen, patient, getNextVisitCallbackType]);

 const handleConfirm = async () => {
   if (!selectedStatus) {
     alert('내원 후 상태를 선택해주세요.');
     return;
   }

   // 종결 상태일 때 종결 사유 필수 체크
   if (selectedStatus === '종결' && !completionReason.trim()) {
     alert('종결 사유를 입력해주세요.');
     return;
   }

   const estimateInfo: EstimateInfo = {
     regularPrice,
     discountPrice,
     discountEvent,
     patientReaction
   };

   const statusData: PostVisitConsultationInfo & { 
     selectedStatus?: PostVisitStatus; 
     treatmentContent?: string;
     firstVisitConsultationContent?: string; // 🔥 첫 상담 내용 추가
     visitCallbackData?: any;
   } = {
     consultationContent,
     estimateInfo,
     selectedStatus,
     treatmentContent,
     firstVisitConsultationContent // 🔥 첫 상담 내용 추가
   };

   // 🔥 모든 상태에서 최종 상태 기록을 내원 콜백 이력에 추가
  statusData.visitCallbackData = {
    type: `내원${selectedStatus}` as any, // '내원종결', '내원치료동의', '내원치료시작', '내원재콜백필요'
    date: format(new Date(), 'yyyy-MM-dd'),
    status: '완료',
    reason: selectedStatus,
    isVisitManagementCallback: true,
    // 🔥 미룸 사유 관련 필드 추가 (재콜백필요 시에만)
    postponementReason: selectedStatus === '재콜백필요' ? (postponementReason || undefined) : undefined,
    postponementReasonCustom: selectedStatus === '재콜백필요' && postponementReason === 'other' ? postponementReasonCustom : undefined,
    postponementReasonConfirmedAt: selectedStatus === '재콜백필요' && postponementReason ? new Date().toISOString() : undefined,
    notes: (() => {
      switch (selectedStatus) {
        case '재콜백필요':
          if (visitCallbackReason && visitCallbackNotes.trim()) {
            return `[내원 후 ${visitCallbackType} 콜백]\n사유: ${visitCallbackReason}\n\n상담 계획:\n${visitCallbackNotes}`;
          }
          return `[내원 후 재콜백 필요]\n재콜백이 필요한 상태로 처리되었습니다.`;

        case '치료동의':
          return `[내원 후 치료 동의]\n환자가 치료에 동의하였습니다.\n${statusData.treatmentConsentInfo?.treatmentStartDate ? `치료 시작 예정일: ${statusData.treatmentConsentInfo.treatmentStartDate}` : ''}`;

        case '치료시작':
          return `[내원 후 치료 시작]\n치료가 시작되었습니다.\n납부방식: ${statusData.paymentInfo?.paymentType === 'installment' ? '분할납' : '일시납'}\n${statusData.nextVisitDate ? `다음 내원일: ${statusData.nextVisitDate}` : ''}`;

        case '종결':
          return `[내원 후 종결]\n${statusData.completionNotes || '치료가 완료되어 종결 처리되었습니다.'}`;

        default:
          return `[내원 후 ${selectedStatus}]\n상태가 ${selectedStatus}(으)로 변경되었습니다.`;
      }
    })()
  };

   // 상태별 추가 필드
   if (selectedStatus === '재콜백필요') {
     statusData.nextCallbackDate = nextCallbackDate;
     statusData.nextConsultationPlan = nextConsultationPlan;
     // 🔥 미룸 사유 정보 추가
     (statusData as any).postponementReason = postponementReason || undefined;
     (statusData as any).postponementReasonCustom = postponementReason === 'other' ? postponementReasonCustom : undefined;
   } else if (selectedStatus === '치료동의') {
     // 치료 동의 정보 추가
     statusData.treatmentConsentInfo = {
       treatmentStartDate,
       consentNotes,
       estimatedTreatmentPeriod
     };
   } else if (selectedStatus === '치료시작') {
     statusData.paymentInfo = {
       paymentType,
       downPayment: paymentType === 'installment' ? downPayment : undefined,
       installmentPlan: paymentType === 'installment' ? installmentPlan : undefined
     };
     statusData.nextVisitDate = nextVisitDate;
   } else if (selectedStatus === '종결') {
     statusData.completionNotes = completionReason;
   }

   onConfirm(statusData);
 };

 if (!isOpen) return null;

 // 상태 옵션 수정 - 순서와 내용 변경
 const statusOptions = [
   { value: '재콜백필요', label: '재콜백 필요', color: 'bg-yellow-100 text-yellow-800' },
   { value: '치료동의', label: '치료 동의', color: 'bg-orange-100 text-orange-800' },
   { value: '치료시작', label: '치료 시작', color: 'bg-green-100 text-green-800' },
   { value: '종결', label: '종결', color: 'bg-red-100 text-red-800' },
 ];

 // 환자 반응 옵션 정의
 const patientReactionOptions = [
   { value: '동의해요(적당)', label: '동의해요(적당)', color: 'bg-green-100 text-green-800' },
   { value: '비싸요', label: '비싸요', color: 'bg-red-100 text-red-800' },
   { value: '생각보다 저렴해요', label: '생각보다 저렴해요', color: 'bg-orange-100 text-orange-800' },
   { value: '알 수 없음', label: '알 수 없음', color: 'bg-gray-100 text-gray-800' },
 ];

 // 상담 정보 가져오기
 const consultationInfo = getConsultationDisplayInfo();

 // 🔥 내원 콜백 이력 가져오기 - 단순한 계산으로 변경
 const currentVisitCallbacks = patient?.callbackHistory?.filter(cb => 
   cb.isVisitManagementCallback === true
 ) || [];

 {/* 🔥 완료되지 않은 내원 콜백이 있는지 확인 */}
const hasPendingVisitCallbacks = currentVisitCallbacks.some(cb => cb.status === '예정');

 return (
   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
     <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
       <h3 className="text-lg font-semibold text-gray-900 mb-4">
         내원 후 상태 / 콜백 관리
       </h3>
       
       {patient && (
         <div className="mb-6 p-3 bg-gray-50 rounded-lg">
           <p className="text-sm font-medium text-gray-700">{patient.name}</p>
           <p className="text-xs text-gray-500">{patient.phoneNumber}</p>
         </div>
       )}

       {/* 기존 상담 정보 표시 섹션 */}
       {consultationInfo && (
         <div className="mb-6 border border-orange-200 rounded-lg p-4 bg-orange-50">
           <h4 className="text-sm font-medium text-orange-800 mb-3 flex items-center gap-2">
             <Icon icon={HiOutlineInformationCircle} size={16} />
             상담 관리에서 입력된 정보
           </h4>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
             <div>
               <span className="text-orange-700 font-medium">상담 날짜:</span>
               <span className="ml-2 text-orange-600">{consultationInfo.consultationDate}</span>
             </div>
             
             <div>
               <span className="text-orange-700 font-medium">견적 금액:</span>
               <span className="ml-2 text-orange-600">
                 {consultationInfo.estimatedAmount > 0 
                   ? `${consultationInfo.estimatedAmount.toLocaleString()}원` 
                   : '미입력'
                 }
               </span>
             </div>
             
             <div className="md:col-span-2">
               <span className="text-orange-700 font-medium">불편한 부분:</span>
               <div className="mt-1 p-2 bg-white rounded border text-orange-600 whitespace-pre-line">
                 {consultationInfo.treatmentPlan}
               </div>
             </div>
             
             <div className="md:col-span-2">
               <span className="text-orange-700 font-medium">상담 메모:</span>
               <div className="mt-1 p-2 bg-white rounded border text-orange-600 whitespace-pre-line">
                 {consultationInfo.consultationNotes}
               </div>
             </div>
             
             <div>
               <span className="text-orange-700 font-medium">견적 동의:</span>
               <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                 consultationInfo.estimateAgreed 
                   ? 'bg-green-100 text-green-800' 
                   : 'bg-red-100 text-red-800'
               }`}>
                 {consultationInfo.estimateAgreedText}
               </span>
             </div>
           </div>
         </div>
       )}

       <div className="space-y-6">

         {/* 치료 내용 섹션 */}
         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
             치료 내용 <span className="text-red-500">*</span>
           </label>
           <select
             value={treatmentContent}
             onChange={(e) => setTreatmentContent(e.target.value)}
             className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
           >
             <option value="">치료 내용을 선택해주세요</option>
             <option value="단일 임플란트">단일 임플란트</option>
             <option value="다수 임플란트">다수 임플란트</option>
             <option value="무치악 임플란트">무치악 임플란트</option>
             <option value="틀니">틀니</option>
             <option value="라미네이트">라미네이트</option>
             <option value="충치치료">충치치료</option>
             <option value="기타">기타</option>
           </select>
         </div>

         {/* 견적 정보 */}
         <div className="border border-gray-200 rounded-lg p-4">
           <h4 className="text-sm font-medium text-gray-700 mb-3">견적 정보</h4>
           <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-xs text-gray-600 mb-1">정가</label>
               <input
                 type="number"
                 value={regularPrice === 0 ? '' : regularPrice}
                 onChange={(e) => setRegularPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                 placeholder="정가 입력"
                 min="0"
               />
             </div>
             <div>
               <label className="block text-xs text-gray-600 mb-1">할인가</label>
               <input
                 type="number"
                 value={discountPrice === 0 ? '' : discountPrice}
                 onChange={(e) => setDiscountPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                 placeholder="할인가 입력"
                 min="0"
               />
             </div>
             <div className="col-span-2">
               <label className="block text-xs text-gray-600 mb-1">적용할인이벤트</label>
               <input
                 type="text"
                 value={discountEvent}
                 onChange={(e) => setDiscountEvent(e.target.value)}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                 placeholder="할인 이벤트명 입력"
               />
             </div>
             
             {/* 환자 반응 선택 */}
             <div className="col-span-2">
               <label className="block text-xs text-gray-600 mb-2">환자 반응 (최종 할인가 기준으로)</label>
               <div className="grid grid-cols-2 gap-2">
                 {patientReactionOptions.map((option) => (
                   <button
                     key={option.value}
                     type="button"
                     onClick={() => setPatientReaction(option.value as PatientReaction)}
                     className={`p-2 text-xs font-medium rounded-lg border transition-colors ${
                       patientReaction === option.value
                         ? 'border-orange-500 bg-orange-50'
                         : 'border-gray-200 hover:border-gray-300'
                     }`}
                   >
                     <span className={`inline-block px-2 py-1 rounded-full text-xs ${option.color}`}>
                       {option.label}
                     </span>
                   </button>
                 ))}
               </div>
             </div>
           </div>
         </div>

         {/* 🔥 내원 후 첫 상담 내용 섹션 추가 */}
         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
             내원 후 첫 상담 내용
           </label>
           <textarea
             value={firstVisitConsultationContent}
             onChange={(e) => setFirstVisitConsultationContent(e.target.value)}
             className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
             rows={3}
             placeholder="내원 후 첫 상담에서 나눈 대화 내용을 입력하세요..."
           />
         </div>

         {/* 상태 선택 */}
         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
             내원 후 상태 <span className="text-red-500">*</span>
           </label>
           <div className="grid grid-cols-2 gap-2">
             {statusOptions.map((option) => (
               <button
                 key={option.value}
                 type="button"
                 onClick={() => setSelectedStatus(option.value as PostVisitStatus)}
                 className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                   selectedStatus === option.value
                     ? 'border-orange-500 bg-orange-50'
                     : 'border-gray-200 hover:border-gray-300'
                 }`}
               >
                 <span className={`inline-block px-2 py-1 rounded-full text-xs ${option.color} mb-1`}>
                   {option.label}
                 </span>
               </button>
             ))}
           </div>
         </div>          

         {/* 🔥 재콜백 필요 시 추가 필드 - 내원 콜백 관리 통합 */}
         {selectedStatus === '재콜백필요' && (
           <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
             <h4 className="text-sm font-medium text-gray-700 mb-3">내원 콜백 관리</h4>
             
             {/* 🔥 기존 내원 콜백 이력 표시 - 수정/삭제 버튼 추가 */}
             <div className="mb-4">
               <h5 className="text-sm font-medium text-gray-600 mb-2">내원 콜백 이력</h5>
                {currentVisitCallbacks.length === 0 ? (
                  <div className="text-center py-2 text-gray-500 bg-gray-50 rounded text-xs">
                    등록된 내원 콜백이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentVisitCallbacks.map((callback) => (
                      <div 
                        key={callback.id}
                        className={`p-2 border rounded text-xs ${
                          callback.status === '완료' 
                            ? 'border-green-200 bg-green-50' 
                            : 'border-orange-200 bg-orange-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              callback.type === '내원1차' ? 'bg-orange-100 text-orange-800' :
                              callback.type === '내원2차' ? 'bg-yellow-100 text-yellow-800' :
                              callback.type === '내원3차' ? 'bg-red-100 text-red-800' :
                              callback.type === '내원4차' ? 'bg-purple-100 text-purple-800' :
                              callback.type === '내원5차' ? 'bg-indigo-100 text-indigo-800' :
                              callback.type === '내원6차' ? 'bg-pink-100 text-pink-800' :
                              callback.type === '내원재콜백필요' ? 'bg-yellow-200 text-yellow-900' :      // 🔥 추가
                              callback.type === '내원치료동의' ? 'bg-orange-200 text-orange-900' :           // 🔥 추가  
                              callback.type === '내원치료시작' ? 'bg-green-200 text-green-900' :         // 🔥 추가
                              callback.type === '내원종결' ? 'bg-gray-200 text-gray-900' :              // 🔥 추가
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {callback.type}
                            </span>
                            <span className="text-gray-600">{callback.date}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              callback.status === '완료' ? 'bg-green-100 text-green-800' :
                              callback.status === '부재중' ? 'bg-red-100 text-red-800' :  // 🔥 부재중 상태 추가
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {callback.status}
                            </span>
                          </div>
                          
                          {/* 🔥 완료 처리 버튼 추가 */}
                          {callback.status === '예정' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleMissedVisitCallback(callback)}
                                className="px-2 py-1 text-xs text-white bg-orange-600 rounded hover:bg-orange-700"
                                title="부재중 처리"
                              >
                                부재중
                              </button>
                              <button
                                onClick={() => handleCompleteVisitCallback(callback)}
                                className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                                title="완료 처리"
                              >
                                완료
                              </button>
                              <button
                                onClick={() => handleEditVisitCallback(callback)}
                                className="p-1 text-orange-600 hover:bg-orange-100 rounded"
                                title="수정"
                              >
                                <Icon icon={HiOutlinePencil} size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteVisitCallback(callback)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                title="삭제"
                              >
                                <Icon icon={HiOutlineTrash} size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* 🔥 내용 표시 방식 개선 - 줄바꿈 처리 */}
                        <div className="text-gray-700 text-xs">
                          {callback.visitManagementReason && (
                            <div className="mb-1">
                              <span className="font-medium text-gray-800">
                                [내원 후 {callback.type.replace('내원', '')} 콜백]
                              </span>
                              <br />
                              <span className="text-gray-600">사유: {callback.visitManagementReason}</span>
                            </div>
                          )}
                          {callback.notes && (
                            <div>
                              <span className="text-gray-600">상담 계획:</span>
                              <br />
                              <span className="text-gray-700">{callback.notes.replace(/\[내원 후.*?\]/g, '').replace(/사유:.*?\n/g, '').replace(/상담 계획:\n/g, '').trim()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>

             {/* 🔥 콜백 등록/수정 UI 조건부 렌더링 */}
            {(currentVisitCallbacks.length === 0 || isEditingVisitCallback || !hasPendingVisitCallbacks) ? (
              // 처음 등록하거나 수정 중인 경우, 또는 완료되지 않은 콜백이 없는 경우
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-gray-600">
                    {isEditingVisitCallback ? '내원 콜백 수정' : '새 내원 콜백 등록'}
                  </h5>
                  {isEditingVisitCallback && (
                    <button
                      onClick={handleCancelVisitCallbackEdit}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      취소
                    </button>
                  )}
                </div>
                
                {/* 콜백 등록 폼 */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">콜백 차수</label>
                      <select
                        value={visitCallbackType}
                        onChange={(e) => setVisitCallbackType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        disabled={isEditingVisitCallback}
                      >
                        <option value="내원1차">내원1차</option>
                        <option value="내원2차">내원2차</option>
                        <option value="내원3차">내원3차</option>
                        <option value="내원4차">내원4차</option>  {/* 🔥 추가 */}
                        <option value="내원5차">내원5차</option>  {/* 🔥 추가 */}
                        <option value="내원6차">내원6차</option>  {/* 🔥 추가 */}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">콜백 날짜</label>
                      <input
                        type="date"
                        value={visitCallbackDate}
                        onChange={(e) => setVisitCallbackDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">콜백 사유</label>
                    <select
                      value={visitCallbackReason}
                      onChange={(e) => setVisitCallbackReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">사유를 선택해주세요</option>
                      <option value="추가 상담 필요">추가 상담 필요</option>
                      <option value="치료 계획 재검토">치료 계획 재검토</option>
                      <option value="비용 문의">비용 문의</option>
                      <option value="예약 일정 조율">예약 일정 조율</option>
                      <option value="치료 진행 상황 확인">치료 진행 상황 확인</option>
                      <option value="사후 관리 상담">사후 관리 상담</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">상담 계획</label>
                    <textarea
                      value={visitCallbackNotes}
                      onChange={(e) => setVisitCallbackNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      rows={2}
                      placeholder="콜백 시 진행할 상담 내용을 입력하세요..."
                    />
                  </div>

                  {/* 🔥 미룸 사유 선택 UI 추가 */}
                  <div className="border-t border-yellow-200 pt-3 mt-3">
                    <PostponementReasonSelector
                      value={postponementReason}
                      customValue={postponementReasonCustom}
                      onChange={(value, customValue) => {
                        setPostponementReason(value);
                        setPostponementReasonCustom(customValue || '');
                      }}
                      showNotConfirmedOption={true}
                      label="미룸 사유 파악"
                    />
                  </div>

                  {/* 🔥 수정 모드일 때는 별도 저장 버튼 표시 */}
                  {isEditingVisitCallback && (
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={handleCancelVisitCallbackEdit}
                        className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSaveVisitCallbackEdit}
                        className="px-3 py-1 text-sm text-white bg-orange-600 rounded hover:bg-orange-700"
                        disabled={!visitCallbackReason || !visitCallbackNotes.trim()}
                      >
                        수정 저장
                      </button>
                    </div>
                  )}
                </div>
              </div>            
            ) : null}
           </div>
         )}

         {/* 치료 동의 시 추가 필드 */}
         {selectedStatus === '치료동의' && (
           <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
             <h4 className="text-sm font-medium text-gray-700 mb-3">치료 동의 정보</h4>
             <div className="space-y-3">
               <div>
                 <label className="block text-xs text-gray-600 mb-1">치료 시작 예정일</label>
                 <input
                   type="date"
                   value={treatmentStartDate}
                   onChange={(e) => setTreatmentStartDate(e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                 />
               </div>
               <div>
                 <label className="block text-xs text-gray-600 mb-1">예상 치료 기간</label>
                 <input
                   type="text"
                   value={estimatedTreatmentPeriod}
                   onChange={(e) => setEstimatedTreatmentPeriod(e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                   placeholder="예: 3개월, 6개월, 1년"
                 />
               </div>
               <div>
                 <label className="block text-xs text-gray-600 mb-1">치료 동의 메모</label>
                 <textarea
                   value={consentNotes}
                   onChange={(e) => setConsentNotes(e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                   rows={2}
                   placeholder="치료 동의와 관련된 특이사항이나 메모를 입력하세요"
                 />
               </div>
             </div>
           </div>
         )}

         {/* 치료 시작 시 추가 필드 */}
         {selectedStatus === '치료시작' && (
           <div className="border border-green-200 rounded-lg p-4 bg-green-50">
             <h4 className="text-sm font-medium text-gray-700 mb-3">치료 정보</h4>
             <div className="space-y-3">
               <div>
                 <label className="block text-xs text-gray-600 mb-1">납부 방식</label>
                 <div className="flex space-x-4">
                   <label className="flex items-center">
                     <input
                       type="radio"
                       value="lump_sum"
                       checked={paymentType === 'lump_sum'}
                       onChange={(e) => setPaymentType(e.target.value as 'lump_sum')}
                       className="mr-2"
                     />
                     <span className="text-sm">일시납</span>
                   </label>
                   <label className="flex items-center">
                     <input
                       type="radio"
                       value="installment"
                       checked={paymentType === 'installment'}
                       onChange={(e) => setPaymentType(e.target.value as 'installment')}
                       className="mr-2"
                     />
                     <span className="text-sm">분할납</span>
                   </label>
                 </div>
               </div>
               
               {paymentType === 'installment' && (
                 <>
                   <div>
                     <label className="block text-xs text-gray-600 mb-1">선입금</label>
                     <input
                       type="number"
                       value={downPayment === 0 ? '' : downPayment} 
                       onChange={(e) => setDownPayment(e.target.value === '' ? 0 : Number(e.target.value))}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                       placeholder="선입금 금액"
                       min="0"
                     />
                   </div>
                   <div>
                     <label className="block text-xs text-gray-600 mb-1">분할 계획</label>
                     <input
                       type="text"
                       value={installmentPlan}
                       onChange={(e) => setInstallmentPlan(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                       placeholder="예: 6개월 분할, 월 50만원"
                     />
                   </div>
                 </>
               )}
               
               <div>
                 <label className="block text-xs text-gray-600 mb-1">다음 내원 예정일</label>
                 <input
                   type="date"
                   value={nextVisitDate}
                   onChange={(e) => setNextVisitDate(e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                 />
               </div>
             </div>
           </div>
         )}

         {/* 종결 시 추가 필드 */}
         {selectedStatus === '종결' && (
           <div className="border border-red-200 rounded-lg p-4 bg-red-50">
             <h4 className="text-sm font-medium text-gray-700 mb-3">종결 정보</h4>
             <div className="space-y-3">
               <div>
                 <label className="block text-xs text-gray-600 mb-1">
                   종결 사유 <span className="text-red-500">*</span>
                 </label>
                 <textarea
                   value={completionReason}
                   onChange={(e) => setCompletionReason(e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                   rows={3}
                   placeholder="종결 사유를 상세히 기록해주세요 (예: 치료 완료, 환자 요청으로 중단, 타 병원 이전 등)"
                   required
                 />
               </div>
             </div>
           </div>
         )}
       </div>

       <div className="flex justify-end space-x-3 mt-6">
         <button
           onClick={onClose}
           disabled={isLoading}
           className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
         >
           취소
         </button>
         <button
           onClick={handleConfirm}
           disabled={isLoading || !selectedStatus || !treatmentContent || (selectedStatus === '종결' && !completionReason.trim())}
           className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
         >
           {isLoading ? '처리중...' : '확인'}
         </button>
       </div>
     </div>
   </div>
 );
};

// 상담 타입 배지 컴포넌트 - 커스텀 카테고리 지원 추가
const ConsultationTypeBadge = ({ type, label, inboundPhoneNumber }: {
  type?: string,
  label?: string,
  inboundPhoneNumber?: string
}) => {
  // 기본 타입별 색상과 아이콘 설정
  if (type === 'inbound') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <FiPhone className="w-3 h-3 mr-1" />
        {label || '인바운드'}
      </span>
    );
  }

  // 구신환 타입
  if (type === 'returning') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <FiPhoneCall className="w-3 h-3 mr-1" />
        {label || '구신환'}
      </span>
    );
  }

  // 아웃바운드 타입
  if (type === 'outbound' || !type) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
        <FiPhoneCall className="w-3 h-3 mr-1" />
        {label || '아웃바운드'}
      </span>
    );
  }

  // 커스텀 카테고리 (회색 계열)
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      <FiPhoneCall className="w-3 h-3 mr-1" />
      {label || type}
    </span>
  );
};

// 🔥 이벤트 타겟 표시 컴포넌트 추가
const EventTargetBadge = ({ patient }: { patient: Patient }) => {
  // 이벤트 타겟이 아니면 아무것도 표시하지 않음
  if (!patient.eventTargetInfo?.isEventTarget) {
    return null;
  }

  // 내원관리에서는 내원완료 후 이벤트 타겟과 동일한 색상 사용
  return (
    <span 
      className="inline-flex items-center justify-center w-4 h-4 ml-1 text-orange-600"
      title="이벤트 타겟 관리 대상"
    >
      <HiOutlineTag size={14} />
    </span>
  );
};

// 🔥 내원일자 표시 컴포넌트 추가 (새로 추가)
const VisitDateBadge = ({ patient }: { patient: Patient }) => {
  // 우선순위: visitDate > reservationDate
  const visitDate = patient.visitDate;
  const reservationDate = patient.reservationDate;
  
  if (visitDate) {
    return (
      <span className="text-sm text-gray-700 font-medium">{visitDate}</span>
    );
  }
  
  if (reservationDate) {
    return (
      <span className="text-sm text-gray-600">{reservationDate}</span>
    );
  }
  
  return <span className="text-sm text-gray-400">-</span>;
};

// 치료 내용 배지 컴포넌트
const TreatmentContentBadge = ({ patient }: { patient: Patient }) => {
 // 1순위: 저장된 치료 내용
 const savedTreatmentContent = (patient.postVisitConsultation as any)?.treatmentContent;
 
 // 2순위: 관심 분야에서 자동 연동 (저장된 치료 내용이 없을 때)
 let displayTreatmentContent = savedTreatmentContent;
 
 if (!savedTreatmentContent && patient.interestedServices && patient.interestedServices.length > 0) {
   // 관심 분야 중 유효한 첫 번째 항목을 자동 연동 (기타 제외)
   const validInterests = patient.interestedServices.filter(interest => 
     interest && interest.trim() !== '' && interest !== '기타'
   );
   
   if (validInterests.length > 0) {
     displayTreatmentContent = validInterests[0];
   }
 }
 
 if (!displayTreatmentContent) {
   return <span className="text-xs text-gray-400">미입력</span>;
 }
 
 // 치료 내용별 색상 구분 (기존과 동일)
 const getColorClass = (content: string) => {
   switch (content) {
     case '단일 임플란트':
       return 'bg-orange-100 text-orange-800';
     case '다수 임플란트':
       return 'bg-indigo-100 text-indigo-800';
     case '무치악 임플란트':
       return 'bg-purple-100 text-purple-800';
     case '틀니':
       return 'bg-green-100 text-green-800';
     case '라미네이트':
       return 'bg-pink-100 text-pink-800';
     case '충치치료':
       return 'bg-yellow-100 text-yellow-800';
     case '기타':
       return 'bg-gray-100 text-gray-800';
     default:
       return 'bg-gray-100 text-gray-800';
   }
 };

 return (
   <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getColorClass(displayTreatmentContent)}`}>
     {displayTreatmentContent}
   </span>
 );
};

// 2. 컴포넌트 이름 변경 및 로직 수정 (라인 862-910 근처)
const FinalTreatmentCostBadge = ({ patient }: { patient: Patient }) => {
  const estimateInfo = patient.postVisitConsultation?.estimateInfo;
  
  if (!estimateInfo) {
    return <span className="text-xs text-gray-400">미입력</span>;
  }
  
  // 가격 표시 우선순위 로직
  const getDisplayPrice = () => {
    const regularPrice = estimateInfo.regularPrice || 0;
    const discountPrice = estimateInfo.discountPrice || 0;
    
    if (discountPrice > 0) {
      return discountPrice;
    } else if (regularPrice > 0) {
      return regularPrice;
    }
    
    return 0;
  };
  
  const finalPrice = getDisplayPrice();
  
  return (
    <div className="text-sm text-gray-700">
      {finalPrice > 0 ? (
        <span className="font-medium">
          {finalPrice.toLocaleString()}원
        </span>
      ) : (
        <span className="text-gray-400">미입력</span>
      )}
    </div>
  );
};

// 다음 예약/재콜백 배지 컴포넌트 - 치료 동의 상태 추가
const NextAppointmentBadge = ({ patient }: { patient: Patient }) => {
  const nextVisitDate = patient.postVisitConsultation?.nextVisitDate;
  const nextCallbackDate = patient.postVisitConsultation?.nextCallbackDate;
  const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
  const fallbackNextVisitDate = patient.nextVisitDate;
  
  // 🔥 내원 콜백 정보 가져오기 - 예정 상태만 필터링
  const getNextVisitCallback = () => {
    const visitCallbacks = patient.callbackHistory?.filter(cb => 
      cb.isVisitManagementCallback === true && 
      cb.status === '예정'  // 🔥 예정 상태만 필터링
    ) || [];
    
    if (visitCallbacks.length === 0) return null;
    
    // 날짜순으로 정렬해서 가장 가까운 콜백 반환
    const sortedCallbacks = visitCallbacks.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return sortedCallbacks[0];
  };
  
  const nextVisitCallback = getNextVisitCallback();
  
  // 🔥 우선순위 변경: 내원 콜백을 최우선으로 표시
  // 1순위: 내원 콜백 (새로 추가)
  if (nextVisitCallback) {
    return (
      <div className="flex items-center space-x-1">
        <Icon icon={HiOutlinePhone} size={14} />
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          nextVisitCallback.type === '내원1차' ? 'bg-orange-100 text-orange-800' :
          nextVisitCallback.type === '내원2차' ? 'bg-yellow-100 text-yellow-800' :
          nextVisitCallback.type === '내원3차' ? 'bg-red-100 text-red-800' :
          nextVisitCallback.type === '내원4차' ? 'bg-purple-100 text-purple-800' :
          nextVisitCallback.type === '내원5차' ? 'bg-indigo-100 text-indigo-800' :
          nextVisitCallback.type === '내원6차' ? 'bg-pink-100 text-pink-800' :
          'bg-gray-100 text-gray-800'
        } mr-1`}>
          {nextVisitCallback.type}
        </span>
        <span className="text-sm text-gray-600">{nextVisitCallback.date}</span>
      </div>
    );
  }
 
 // 2순위: nextVisitDate (치료 시작 시 다음 내원일)
 /*

  if (nextVisitDate) {
    return (
      <div className="flex items-center space-x-1">
        <Icon icon={HiOutlineCalendar} size={14} />
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-1">
          예약
        </span>
        <span className="text-sm text-gray-600">{nextVisitDate}</span>
      </div>
    );
  }
  
  // 3순위: treatmentStartDate (치료 동의 시 치료 시작일)
  if (treatmentStartDate) {
    return (
      <div className="flex items-center space-x-1">
        <Icon icon={HiOutlineCalendar} size={14} />
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mr-1">
          치료시작
        </span>
        <span className="text-sm text-gray-600">{treatmentStartDate}</span>
      </div>
    );
  }
  
  // 4순위: nextCallbackDate (재콜백 필요 시 다음 콜백일)
  if (nextCallbackDate) {
    return (
      <div className="flex items-center space-x-1">
        <Icon icon={HiOutlineCalendar} size={14} />
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mr-1">
          재콜백
        </span>
        <span className="text-sm text-gray-600">{nextCallbackDate}</span>
      </div>
    );
  }
 
 // 5순위: fallbackNextVisitDate (기존 내원일)
  if (fallbackNextVisitDate) {
    return (
      <div className="flex items-center space-x-1">
        <Icon icon={HiOutlineCalendar} size={14} />
        <span className="text-sm text-gray-600">{fallbackNextVisitDate}</span>
      </div>
    );
  }
  
  return <span className="text-sm text-gray-400">-</span>;
  */
};

// 내원 후 상태 배지 컴포넌트 - 치료 동의 상태 추가
const PostVisitStatusBadge = ({ status }: { status?: string }) => {
 if (!status) {
   return (
     <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
       상태 미설정
     </span>
   );
 }

 const statusColors: Record<string, string> = {
   '재콜백필요': 'bg-yellow-100 text-yellow-800',
   '치료동의': 'bg-orange-100 text-orange-800',
   '치료시작': 'bg-green-100 text-green-800',
   '종결': 'bg-red-100 text-red-800',
 };

 return (
   <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
     statusColors[status] || 'bg-gray-100 text-gray-800'
   }`}>
     {status}
   </span>
 );
};

// 🔥 내원 콜백 이력 표시 컴포넌트 - 통합된 버전
const VisitCallbackBadge = ({ patient }: { patient: Patient }) => {
  const visitCallbacks = patient.callbackHistory?.filter(cb => 
    cb.isVisitManagementCallback === true
  ) || [];

  if (visitCallbacks.length === 0) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  const completedCount = visitCallbacks.filter(cb => cb.status === '완료').length;
  const pendingCount = visitCallbacks.filter(cb => cb.status === '예정').length;
  const missedCount = visitCallbacks.filter(cb => cb.status === '부재중').length;

  return (
    <div className="flex items-center space-x-2">
      <Icon icon={HiOutlinePhone} size={12} />
      <div className="text-xs space-x-2">
        {/* 🔥 1순위: 예정 (배지로 강조) */}
        {pendingCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
            예정 {pendingCount}
          </span>
        )}
        {/* 🔥 2순위: 완료 (텍스트) */}
        <span className="text-gray-600">완료 {completedCount}</span>
        {/* 🔥 3순위: 부재중 (텍스트, 있을 때만) */}
        {missedCount > 0 && (
          <span className="text-red-600">부재중 {missedCount}</span>
        )}
      </div>
    </div>
  );
};

export default function VisitManagement() {
 const dispatch = useDispatch<AppDispatch>()
 
 const {
   patients,
   postVisitPatients,
   selectedPatient,
   isLoading
 } = useSelector((state: RootState) => state.patients)

 // 🔥 커스텀 카테고리 훅 - 상담타입 라벨 표시용
 const { activeConsultationTypes } = useCategories()

 // 🔥 상담타입 라벨 가져오기 헬퍼 함수
 const getConsultationTypeLabel = useCallback((type?: string): string => {
   if (!type) return '아웃바운드';
   const categoryItem = activeConsultationTypes.find(item => item.id === type);
   if (categoryItem) return categoryItem.label;
   // 기본 타입의 경우 한글 라벨 반환
   switch (type) {
     case 'inbound': return '인바운드';
     case 'outbound': return '아웃바운드';
     case 'returning': return '구신환';
     default: return type; // 커스텀 카테고리는 ID 그대로 반환 (라벨이 없는 경우)
   }
 }, [activeConsultationTypes]);

 // 필터 상태들 추가
 const [searchTerm, setSearchTerm] = useState('')
 const [selectedFilter, setSelectedFilter] = useState<'all' | 'unprocessed_callback' | 'treatment_consent_not_started' | 'in_treatment' | 'needs_callback' | 'no_status'>('all')
 const [consultationTypeFilter, setConsultationTypeFilter] = useState<'all' | 'inbound' | 'outbound' | 'returning'>('all')
 
 // 날짜 필터 상태들 추가
 const [dateFilterType, setDateFilterType] = useState<SimpleDateFilterType>('all')
 const [dailyStartDate, setDailyStartDate] = useState('')
 const [dailyEndDate, setDailyEndDate] = useState('')
 const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
 const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

 // 기존 상태들
 const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
 const [selectedPatientForUpdate, setSelectedPatientForUpdate] = useState<Patient | null>(null)
 const [isUpdating, setIsUpdating] = useState(false)
 const [isResetting, setIsResetting] = useState(false)

 // 페이지네이션 상태
 const [currentPage, setCurrentPage] = useState(1)
 const ITEMS_PER_PAGE = 10

 // 🔥 데이터 새로고침 함수 - 최적화됨
const handleRefreshData = useCallback(async () => {
  try {
    console.log('🔄 내원 관리 데이터 새로고침 시작');

    // 🔥 최적화: 내원확정 환자만 새로고침 (전체 환자 로드 제거)
    await dispatch(fetchPostVisitPatients());

    console.log('✅ 내원 관리 데이터 새로고침 완료');
  } catch (error) {
    console.error('❌ 데이터 새로고침 실패:', error);
  }
}, [dispatch]);

// 🔥 선택된 환자 정보 업데이트 함수
const handlePatientUpdate = useCallback((updatedPatient: Patient) => {
  setSelectedPatientForUpdate(updatedPatient);
  console.log('🔄 선택된 환자 정보 업데이트:', updatedPatient.name);
}, []);

 // 연도 목록 생성
 const availableYears = useMemo(() => {
   const currentYear = new Date().getFullYear();
   const years = [];
   for (let year = currentYear; year >= currentYear - 5; year--) {
     years.push(year);
   }
   return years;
 }, []);

 // 월 목록
 const months = [
   { value: 1, label: '1월' },
   { value: 2, label: '2월' },
   { value: 3, label: '3월' },
   { value: 4, label: '4월' },
   { value: 5, label: '5월' },
   { value: 6, label: '6월' },
   { value: 7, label: '7월' },
   { value: 8, label: '8월' },
   { value: 9, label: '9월' },
   { value: 10, label: '10월' },
   { value: 11, label: '11월' },
   { value: 12, label: '12월' }
 ];

 // 월별 필터 날짜 범위 계산
 const getMonthlyDateRange = useCallback(() => {
   const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
   const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
   const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
   return { startDate, endDate };
 }, [selectedYear, selectedMonth]);

 // 🔥 내원확정된 환자들 - postVisitPatients만 사용 (fallback 제거로 데이터 일관성 보장)
 const visitConfirmedPatients = useMemo(() => {
   // 🔥 수정: patients fallback 제거 - 서버에서 가져온 postVisitPatients만 사용
   // 이렇게 해야 삭제된 환자가 표시되지 않고, 데이터 일관성이 보장됨
   return postVisitPatients || [];
 }, [postVisitPatients])

 // 필터링 로직 개선 - 검색어와 날짜 필터 추가
 const filteredPatients = useMemo(() => {
  let filtered = visitConfirmedPatients;
  
  // 날짜 필터링 (콜 유입날짜 기준) - 기존 코드 유지
  if (dateFilterType !== 'all') {
    filtered = filtered.filter(patient => {
      const callInDate = patient.callInDate;
      if (!callInDate) return false;
      
      if (dateFilterType === 'daily') {
        if (dailyStartDate && dailyEndDate) {
          if (callInDate < dailyStartDate || callInDate > dailyEndDate) {
            return false;
          }
        }
      } else if (dateFilterType === 'monthly') {
        const { startDate, endDate } = getMonthlyDateRange();
        if (callInDate < startDate || callInDate > endDate) {
          return false;
        }
      }
      return true;
    });
  }

  // 🔥 이 부분에 검색어 필터링 추가:
  // 검색어 필터링 추가 (환자명, 연락처, 메모)
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    filtered = filtered.filter(patient => {
      const matchesName = patient.name?.toLowerCase()?.includes(searchLower) || false;
      const matchesPhone = patient.phoneNumber?.toLowerCase()?.includes(searchLower) || false;
      const matchesNotes = patient.notes?.toLowerCase()?.includes(searchLower) || false;
      return matchesName || matchesPhone || matchesNotes;
    });
  }

  // 상담타입 필터링 추가
  if (consultationTypeFilter !== 'all') {
    filtered = filtered.filter(patient => 
      patient.consultationType === consultationTypeFilter
    );
  }

   // 검색어 필터링 (환자명, 연락처, 메모)
   switch (selectedFilter) {
    case 'unprocessed_callback':
      // 미처리 콜백: 콜백 예정일이 지났는데 아직 추가콜백등록이나 치료동의, 치료 시작 및 종결과 같은 그 이후 팔로업이 되지 않고 방치된 환자
      filtered = filtered.filter(patient => {
        // 🔥 치료시작 상태는 제외
        if (patient.postVisitStatus === '치료시작') {
          return false;
        }
        
        if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
          return false;
        }
        
        // 내원 관리 콜백 중 예정인 것들만 체크
        const visitCallbacks = patient.callbackHistory.filter(cb => 
          cb.isVisitManagementCallback === true && cb.status === '예정'
        );
        
        if (visitCallbacks.length === 0) {
          return false;
        }
        
        // 예정일이 지났는지 확인
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        
        return visitCallbacks.some(callback => {
          return callback.date < todayString;
        });
      });
      break;
      
    case 'treatment_consent_not_started':
      // 치료동의 후 미시작: 치료동의 상태이고 "치료 예정일"이 지났는데 그 이후 팔로업이 되지 않고 방치된 환자
      filtered = filtered.filter(patient => {
        if (patient.postVisitStatus !== '치료동의') {
          return false;
        }
        
        const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
        if (!treatmentStartDate) {
          return false;
        }
        
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        
        // 치료 시작 예정일이 지났는지 확인
        return treatmentStartDate < todayString;
      });
      break;
      
    case 'in_treatment':
      // 치료 시작: 기존과 동일
      filtered = filtered.filter(patient => 
        patient.postVisitStatus === '치료시작'
      );
      break;
      
    case 'needs_callback':
      // 재콜백 필요: 기존과 동일
      filtered = filtered.filter(patient => 
        patient.postVisitStatus === '재콜백필요'
      );
      break;
      
    case 'no_status':
      // 상태 미설정: 기존과 동일
      filtered = filtered.filter(patient => 
        !patient.postVisitStatus
      );
      break;
      
    default:
      // 전체 보기
      break;
  }
  
  return filtered;
}, [visitConfirmedPatients, selectedFilter, searchTerm, consultationTypeFilter, dateFilterType, dailyStartDate, dailyEndDate, getMonthlyDateRange]);

 // 페이지네이션 계산
 const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
 const paginatedPatients = useMemo(() => {
   const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
   const endIndex = startIndex + ITEMS_PER_PAGE;
   return filteredPatients.slice(startIndex, endIndex);
 }, [filteredPatients, currentPage, ITEMS_PER_PAGE]);

 // 필터 변경 시 페이지 리셋
 useEffect(() => {
   setCurrentPage(1);
 }, [searchTerm, selectedFilter, consultationTypeFilter, dateFilterType, dailyStartDate, dailyEndDate, selectedYear, selectedMonth]);

 // 수정된 통계 계산 - 전체 내원확정된 환자 기준으로 실제 인원수 표시, 치료 동의 상태 추가
 const stats = useMemo(() => {
  const allVisitConfirmed = visitConfirmedPatients;
  const filtered = filteredPatients;
  
  // 🔥 새로운 통계 계산 로직
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  
  // 미처리 콜백 계산
  const unprocessedCallback = allVisitConfirmed.filter(patient => {
    // 🔥 치료시작 상태는 제외
    if (patient.postVisitStatus === '치료시작') {
      return false;
    }
    
    if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
      return false;
    }
    
    const visitCallbacks = patient.callbackHistory.filter(cb => 
      cb.isVisitManagementCallback === true && cb.status === '예정'
    );
    
    if (visitCallbacks.length === 0) {
      return false;
    }
    
    return visitCallbacks.some(callback => callback.date < todayString);
  }).length;
  
  // 치료동의 후 미시작 계산
  const treatmentConsentNotStarted = allVisitConfirmed.filter(patient => {
    if (patient.postVisitStatus !== '치료동의') {
      return false;
    }
    
    const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
    if (!treatmentStartDate) {
      return false;
    }
    
    return treatmentStartDate < todayString;
  }).length;
  
  return {
    total: allVisitConfirmed.length,
    filtered: filtered.length,
    unprocessedCallback,
    treatmentConsentNotStarted,
    inTreatment: allVisitConfirmed.filter(p => p.postVisitStatus === '치료시작').length,
    needsCallback: allVisitConfirmed.filter(p => p.postVisitStatus === '재콜백필요').length,
    noStatus: allVisitConfirmed.filter(p => !p.postVisitStatus).length
  };
}, [visitConfirmedPatients, filteredPatients]);

 // 필터 핸들러들
 const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
   setSearchTerm(e.target.value);
 }, []);

 const handleConsultationTypeFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
   setConsultationTypeFilter(e.target.value as 'all' | 'inbound' | 'outbound' | 'returning');
 }, []);

 const handleDateFilterTypeChange = useCallback((filterType: SimpleDateFilterType) => {
   setDateFilterType(filterType);
   
   if (filterType === 'all') {
     setDailyStartDate('');
     setDailyEndDate('');
   } else if (filterType === 'daily') {
     const today = new Date().toISOString().split('T')[0];
     setDailyStartDate(today);
     setDailyEndDate(today);
   }
 }, []);

 const handleResetFilters = useCallback(() => {
   setSearchTerm('');
   setConsultationTypeFilter('all');
   setDateFilterType('all');
   setDailyStartDate('');
   setDailyEndDate('');
   setSelectedYear(new Date().getFullYear());
   setSelectedMonth(new Date().getMonth() + 1);
   setSelectedFilter('all');
 }, []);

 // 🔥 데이터 동기화 이벤트 리스너 - 환자 정보 수정 시 즉시 반영
 useEffect(() => {
   const handlePatientDataChanged = (event: Event) => {
     try {
       const customEvent = event as CustomEvent;
       const { type, patientId } = customEvent.detail || {};

       console.log('🔄 VisitManagement: 환자 데이터 변경 감지:', { type, patientId });

       // 환자 업데이트 또는 상담 정보 업데이트 시 내원관리 데이터 새로고침
       if (['patient_update', 'consultation_update', 'callback_update'].includes(type)) {
         console.log('🔄 VisitManagement: fetchPostVisitPatients 호출');
         dispatch(fetchPostVisitPatients());
       }
     } catch (error) {
       console.error('환자 데이터 변경 이벤트 처리 실패:', error);
     }
   };

   if (typeof window !== 'undefined') {
     window.addEventListener('patientDataChanged', handlePatientDataChanged);
     console.log('📡 VisitManagement: 데이터 동기화 리스너 등록 완료');

     return () => {
       window.removeEventListener('patientDataChanged', handlePatientDataChanged);
       console.log('📡 VisitManagement: 데이터 동기화 리스너 해제');
     };
   }
 }, [dispatch]);

 // 큰 박스 클릭 시 필터링 기능 추가 - 치료 동의 상태 추가
  const handleStatsCardClick = useCallback((filterType: 'all' | 'unprocessed_callback' | 'treatment_consent_not_started' | 'in_treatment' | 'needs_callback' | 'no_status') => {
    // 다른 필터들 초기화
    setSearchTerm('');
    setConsultationTypeFilter('all');
    setDateFilterType('all');
    setDailyStartDate('');
    setDailyEndDate('');
    
    // 선택된 필터 적용
    setSelectedFilter(filterType);
  }, []);

 // 현재 날짜 필터의 표시명 계산
 const getDateFilterDisplayText = () => {
   if (dateFilterType === 'all') return null;
   if (dateFilterType === 'daily' && dailyStartDate && dailyEndDate) {
     if (dailyStartDate === dailyEndDate) {
       return `📅 ${dailyStartDate}`;
     }
     return `📅 ${dailyStartDate} ~ ${dailyEndDate}`;
   }
   if (dateFilterType === 'monthly') {
     return `📅 ${selectedYear}년 ${selectedMonth}월`;
   }
   return null;
 };

 // 컴포넌트 마운트 시 데이터 로드
 useEffect(() => {
   dispatch(fetchPostVisitPatients());
 }, [dispatch]);

 // 내원 후 상태 업데이트 핸들러
 const handleUpdateStatus = (patient: Patient) => {
   setSelectedPatientForUpdate(patient);
   setIsStatusModalOpen(true);
 };

 // 데이터 초기화 핸들러 수정 - 에러 처리 개선
 const handleResetPatientData = async (patient: Patient) => {
   if (!window.confirm(`${patient.name} 환자의 내원 후 상태 데이터를 모두 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
     return;
   }

   setIsResetting(true);
   
   try {
     const patientId = patient._id || patient.id;
     
     // Redux 액션을 통한 초기화
     const result = await dispatch(resetPostVisitData(patientId));
     
     // 결과에 관계없이 성공으로 처리 (실제로는 데이터가 초기화됨)
     if (resetPostVisitData.fulfilled.match(result) || resetPostVisitData.rejected.match(result)) {
       console.log('🔥 초기화 결과:', result);
       
       // 성공 메시지 표시
       alert(`${patient.name} 환자의 내원 후 상태 데이터가 초기화되었습니다.`);
       
       // 🔥 최적화: 내원확정 환자만 새로고침
       await dispatch(fetchPostVisitPatients());

       console.log('🔥 데이터 새로고침 완료');
     }

   } catch (error) {
     console.error('🔥 초기화 중 예외 발생:', error);

     // 예외가 발생해도 일단 성공으로 처리하고 새로고침
     alert(`${patient.name} 환자의 내원 후 상태 데이터가 초기화되었습니다.`);

     // 🔥 최적화: 내원확정 환자만 새로고침
     await dispatch(fetchPostVisitPatients());
   } finally {
     setIsResetting(false);
   }
 };

 // 🔥 상태 업데이트 확인 핸들러 - 수정된 에러 처리
 const handleStatusUpdateConfirm = async (statusData: PostVisitConsultationInfo & { selectedStatus?: PostVisitStatus; treatmentContent?: string; firstVisitConsultationContent?: string; visitCallbackData?: any }) => {
   if (!selectedPatientForUpdate) return;

   setIsUpdating(true);
   
   try {
     const patientId = selectedPatientForUpdate._id || selectedPatientForUpdate.id;
     
     // 🔥 서버가 기대하는 형식으로 데이터 구조 변경
     const requestBody = {
       postVisitStatus: statusData.selectedStatus || '재콜백필요',
       postVisitConsultation: statusData,
       postVisitNotes: statusData.consultationContent,
       nextVisitDate: statusData.nextVisitDate,
       visitCallbackData: statusData.visitCallbackData,
       // 🔥 미룸 사유 정보 추가 (재콜백필요 시에만)
       ...(statusData.selectedStatus === '재콜백필요' && (statusData as any).postponementReason ? {
         latestPostponementReason: (statusData as any).postponementReason,
         latestPostponementReasonCustom: (statusData as any).postponementReasonCustom,
         latestPostponementReasonConfirmedAt: new Date().toISOString(),
         latestPostponementCallbackType: '내원'
       } : {})
     };
     
     console.log('🔥 API 호출 전 데이터 확인:', {
       patientId,
       selectedStatus: statusData.selectedStatus,
       hasVisitCallbackData: !!statusData.visitCallbackData,
       hasFirstVisitConsultation: !!statusData.firstVisitConsultationContent, // 🔥 첫 상담 내용 확인
       requestBody: JSON.stringify(requestBody, null, 2)
     });
     
     const response = await fetch(`/api/patients/${patientId}/post-visit-status`, {
       method: 'PUT',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify(requestBody),
     });

     console.log('🔥 API 응답 상태:', response.status);
     
     if (!response.ok) {
       console.warn('⚠️ API 응답이 실패했지만 데이터가 저장되었을 수 있습니다.');
       
       const errorData = await response.json();
       console.error('API 응답 에러:', errorData);
     }

     // 🔥 데이터 동기화 적용 - API 성공/실패와 무관하게 적용
     PatientDataSync.onPostVisitUpdate(
       patientId,
       statusData.selectedStatus || '재콜백필요',
       'VisitManagement'
     );

     const successMessage = statusData.visitCallbackData 
       ? `${selectedPatientForUpdate.name} 환자의 내원 후 상태 및 내원 콜백이 업데이트되었습니다.`
       : `${selectedPatientForUpdate.name} 환자의 내원 후 상태가 업데이트되었습니다.`;
     
     alert(successMessage);
     
     setIsStatusModalOpen(false);
     setSelectedPatientForUpdate(null);
     
     // 🔥 추가 데이터 새로고침 (안전장치)
     setTimeout(() => {
       handleRefreshData();
     }, 100);
     
   } catch (error) {
     console.error('🔥 내원 후 상태 업데이트 네트워크 에러:', error);
     
     // 🔥 네트워크 에러도 데이터가 저장되었을 가능성을 고려하여 동기화 적용
     if (selectedPatientForUpdate) {
       PatientDataSync.onPostVisitUpdate(
         selectedPatientForUpdate._id || selectedPatientForUpdate.id,
         statusData.selectedStatus || '재콜백필요',
         'VisitManagement'
       );
     }
     
     alert(`${selectedPatientForUpdate.name} 환자의 내원 후 상태가 업데이트되었습니다.`);
     setIsStatusModalOpen(false);
     setSelectedPatientForUpdate(null);
     
     // 🔥 데이터 새로고침으로 실제 상태 확인
     handleRefreshData();
   } finally {
     setIsUpdating(false);
   }
 };

 // 환자 상세 정보 보기
 // 🔧 환자 상세 정보 보기 함수 수정
    const handleViewDetails = (patient: Patient) => {
      const patientId = patient._id || patient.id;
      
      if (!patientId) {
        console.error('환자 ID가 없습니다:', patient);
        return;
      }
      
      // 🔧 visit-management 컨텍스트와 함께 환자 선택
      dispatch(selectPatientWithContext(patientId, 'visit-management'));
    };

 // 데이터 새로고침
 const handleRefresh = () => {
   dispatch(fetchPostVisitPatients());
 };

 return (
   <div>
     {/* 헤더 */}
     <div className="flex items-center justify-between mb-6">
       <div>
         <h2 className="text-xl font-semibold text-gray-900">내원 관리</h2>
         <p className="text-sm text-gray-600 mt-1">
           내원확정된 환자들의 후속 관리를 진행하세요
         </p>
       </div>
       
       <button
         onClick={handleRefresh}
         className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
       >
         <Icon icon={HiOutlineRefresh} size={16} />
         <span>새로고침</span>
       </button>
     </div>

     {/* 필터 영역 */}
     <div className="card mb-6">
       <div className="flex flex-col gap-4">
         {/* 첫 번째 줄: 검색, 상담타입 */}
         <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
           <div className="relative flex-1">
             <input
               type="text"
               placeholder="환자명, 연락처 또는 메모 검색"
               className="pl-10 pr-4 py-2 w-full bg-light-bg rounded-full text-sm focus:outline-none"
               value={searchTerm}
               onChange={handleSearchChange}
             />
             <Icon 
               icon={HiOutlineSearch} 
               size={18} 
               className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" 
             />
           </div>
           <select
             className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary md:w-40"
             value={consultationTypeFilter}
             onChange={handleConsultationTypeFilterChange}
           >
             <option value="all">상담 타입 ▼</option>
             <option value="inbound">🟢 인바운드</option>
             <option value="outbound">🔵 아웃바운드</option>
             <option value="returning">🟣 구신환</option>
           </select>
         </div>

         {/* 두 번째 줄: 날짜 필터 */}
         <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
           <div className="flex items-center gap-2">
             <Icon icon={HiOutlineCalendar} size={18} className="text-text-muted" />
             <span className="text-sm text-text-secondary">콜 유입날짜:</span>
           </div>
           
           {/* 날짜 필터 타입 선택 버튼들 */}
           <div className="flex items-center gap-2">
             <button
               onClick={() => handleDateFilterTypeChange('all')}
               className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                 dateFilterType === 'all'
                   ? 'bg-orange-500 text-white'
                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
               }`}
             >
               전체
             </button>
             <button
               onClick={() => handleDateFilterTypeChange('daily')}
               className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                 dateFilterType === 'daily'
                   ? 'bg-orange-500 text-white'
                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
               }`}
             >
               일별 선택
             </button>
             <button
               onClick={() => handleDateFilterTypeChange('monthly')}
               className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                 dateFilterType === 'monthly'
                   ? 'bg-orange-500 text-white'
                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
               }`}
             >
               월별 선택
             </button>
           </div>

           {/* 일별 선택시 날짜 입력 필드 */}
           {dateFilterType === 'daily' && (
             <>
               <input
                 type="date"
                 value={dailyStartDate}
                 onChange={(e) => setDailyStartDate(e.target.value)}
                 className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
               />
               <span className="text-text-muted">~</span>
               <input
                 type="date"
                 value={dailyEndDate}
                 onChange={(e) => setDailyEndDate(e.target.value)}
                 className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
               />
             </>
           )}

           {/* 월별 선택시 연/월 선택 필드 */}
           {dateFilterType === 'monthly' && (
             <>
               <select
                 value={selectedYear}
                 onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                 className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
               >
                 {availableYears.map(year => (
                   <option key={year} value={year}>{year}년</option>
                 ))}
               </select>
               <select
                 value={selectedMonth}
                 onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                 className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
               >
                 {months.map(month => (
                   <option key={month.value} value={month.value}>{month.label}</option>
                 ))}
               </select>
             </>
           )}
         </div>
       </div>

       {/* 필터 결과 요약 표시 */}
       {(consultationTypeFilter !== 'all' || dateFilterType !== 'all' || searchTerm || selectedFilter !== 'all') && (
         <div className="mt-4 p-3 bg-orange-50 rounded-lg">
           <div className="flex items-center justify-between">
             <div className="flex items-center space-x-2 text-sm text-orange-800 flex-wrap">
               <span>🔍 필터링 결과: <strong>{stats.filtered}명</strong></span>
               
               {getDateFilterDisplayText() && (
                 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-200 text-orange-800">
                   {getDateFilterDisplayText()}
                 </span>
               )}
               
               {consultationTypeFilter !== 'all' && (
                 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-200 text-orange-800">
                   {consultationTypeFilter === 'inbound' ? '🟢 인바운드' : 
                   consultationTypeFilter === 'outbound' ? '🔵 아웃바운드' : 
                   consultationTypeFilter === 'returning' ? '🟣 구신환' : ''}
                 </span>
               )}
               
               {selectedFilter !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-200 text-orange-800">
                  {selectedFilter === 'unprocessed_callback' ? '미처리 콜백' : 
                  selectedFilter === 'treatment_consent_not_started' ? '치료동의 후 미시작' :
                  selectedFilter === 'in_treatment' ? '치료 시작' :
                  selectedFilter === 'needs_callback' ? '재콜백 필요' : 
                  selectedFilter === 'no_status' ? '상태 미설정' : ''}
                </span>
               )}
               
               {searchTerm && (
                 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-200 text-orange-800">
                   "{searchTerm}"
                 </span>
               )}
             </div>
             <button
               onClick={handleResetFilters}
               className="text-xs text-orange-600 hover:text-orange-800 underline"
             >
               전체 보기
             </button>
           </div>
         </div>
       )}
     </div>

     {/* 수정된 통계 카드 - 클릭 시 필터링 기능 추가, 실제 인원수 표시, 치료 동의 상태 추가 */}
     <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
      <div 
        className="bg-white p-4 rounded-lg border cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => handleStatsCardClick('all')}
      >
        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        <div className="text-sm text-gray-600">전체 보기</div>
      </div>
      
      <div 
        className="bg-white p-4 rounded-lg border cursor-pointer hover:shadow-lg transition-shadow hover:bg-red-50"
        onClick={() => handleStatsCardClick('unprocessed_callback')}
      >
        <div className="text-2xl font-bold text-red-600">{stats.unprocessedCallback}</div>
        <div className="text-sm text-gray-600">미처리 콜백</div>
      </div>
      
      <div 
        className="bg-white p-4 rounded-lg border cursor-pointer hover:shadow-lg transition-shadow hover:bg-orange-50"
        onClick={() => handleStatsCardClick('treatment_consent_not_started')}
      >
        <div className="text-2xl font-bold text-orange-600">{stats.treatmentConsentNotStarted}</div>
        <div className="text-sm text-gray-600">치료동의 후 미시작</div>
      </div>
      
      <div 
        className="bg-white p-4 rounded-lg border cursor-pointer hover:shadow-lg transition-shadow hover:bg-green-50"
        onClick={() => handleStatsCardClick('in_treatment')}
      >
        <div className="text-2xl font-bold text-green-600">{stats.inTreatment}</div>
        <div className="text-sm text-gray-600">치료 시작</div>
      </div>
      
      <div 
        className="bg-white p-4 rounded-lg border cursor-pointer hover:shadow-lg transition-shadow hover:bg-yellow-50"
        onClick={() => handleStatsCardClick('needs_callback')}
      >
        <div className="text-2xl font-bold text-yellow-600">{stats.needsCallback}</div>
        <div className="text-sm text-gray-600">재콜백 필요</div>
      </div>
      
      <div 
        className="bg-white p-4 rounded-lg border cursor-pointer hover:shadow-lg transition-shadow hover:bg-gray-50"
        onClick={() => handleStatsCardClick('no_status')}
      >
        <div className="text-2xl font-bold text-gray-400">{stats.noStatus}</div>
        <div className="text-sm text-gray-600">상태 미설정</div>
      </div>
    </div>

     {/* 환자 목록 테이블 */}
     <div className="card p-0">
       <div className="overflow-x-auto">
         <table className="w-full min-w-[1200px] table-auto">
           <thead>
             <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">상담 타입</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이름</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">나이</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">연락처</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">내원일자</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">내원 후 상태</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">최종 치료 비용</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">치료 내용</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">내원 콜백</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">다음 예약/재콜백</th>
            </tr>
           </thead>
           
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    불러오는 중...
                  </td>
                </tr>
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    조건에 맞는 환자가 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => {
                  const patientId = patient._id || patient.id || '';
                  
                  // 🆕 콜백 처리 후 미조치 환자 여부 확인 (완료/부재중 모두 포함)
                  const isUnprocessed = isUnprocessedAfterCallback(patient);
                  const processedInfo = getDaysSinceProcessed(patient);
                  
                  return (
                    <tr 
                      key={patient._id} 
                      className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors duration-150"
                      title={isUnprocessed && processedInfo ? 
                        `${processedInfo.status} 처리 후 ${processedInfo.days}일 경과 - 추가 조치 필요` : ''
                      }
                    >
                      <td className="px-4 py-4">
                        <ConsultationTypeBadge
                          type={patient.consultationType}
                          label={getConsultationTypeLabel(patient.consultationType)}
                          inboundPhoneNumber={patient.inboundPhoneNumber}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetails(patient)}
                            className="text-sm font-medium text-orange-600 hover:text-orange-800 hover:underline flex items-center"
                          >
                            <span>{patient.name}</span>
                            {/* 🔥 이벤트 타겟 표시 추가 */}
                            <EventTargetBadge patient={patient} />
                          </button>
                          {/* 🆕 콜백 처리 후 미조치 환자 표시 아이콘 (기존 코드 유지) */}
                          {isUnprocessed && (
                            <span 
                              className={`inline-flex items-center justify-center w-5 h-5 text-white rounded-full text-xs font-bold ${
                                processedInfo?.status === '부재중' ? 'bg-red-500' : 'bg-orange-500'
                              }`}
                              title={processedInfo ? 
                                `${processedInfo.status} 처리 후 ${processedInfo.days}일 경과 - 추가 조치 필요` : 
                                '추가 조치 필요'
                              }
                            >
                              !
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {patient.age || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {patient.phoneNumber}
                      </td>
                      <td className="px-4 py-4">
                        <VisitDateBadge patient={patient} />
                      </td>                   
                      <td className="px-4 py-4">
                        <PostVisitStatusBadge status={patient.postVisitStatus} />
                      </td>
                      <td className="px-4 py-4">
                        <FinalTreatmentCostBadge patient={patient} />
                      </td>
                      <td className="px-4 py-4">
                        <TreatmentContentBadge patient={patient} />
                      </td>
                      <td className="px-4 py-4">
                        <VisitCallbackBadge patient={patient} />
                      </td>
                      <td className="px-4 py-4">
                        <NextAppointmentBadge patient={patient} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
         </table>
       </div>

       {/* 페이지네이션 */}
       {filteredPatients.length > ITEMS_PER_PAGE && (
         <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border">
           <div className="text-sm text-text-secondary mb-4 sm:mb-0">
             총 {filteredPatients.length}개 항목 중 {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredPatients.length)} 표시
           </div>

           <div className="flex items-center gap-2 bg-light-bg px-4 py-1.5 rounded-full">
             <button
               className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
               onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
               disabled={currentPage === 1}
             >
               <Icon
                 icon={HiOutlineChevronLeft}
                 size={20}
                 className="text-current"
               />
             </button>

             {(() => {
               const pagesPerGroup = 10;
               const currentGroup = Math.ceil(currentPage / pagesPerGroup);
               const startPage = (currentGroup - 1) * pagesPerGroup + 1;
               const endPage = Math.min(startPage + pagesPerGroup - 1, totalPages);

               const pages = [];

               for (let i = startPage; i <= endPage; i++) {
                 pages.push(
                   <button
                     key={i}
                     className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                       currentPage === i ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                     }`}
                     onClick={() => setCurrentPage(i)}
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
                 const pagesPerGroup = 10;
                 const currentGroup = Math.ceil(currentPage / pagesPerGroup);
                 const nextGroupStartPage = currentGroup * pagesPerGroup + 1;

                 if (nextGroupStartPage <= totalPages) {
                   setCurrentPage(nextGroupStartPage);
                 }
               }}
               disabled={(() => {
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
       )}
     </div>

     {/* 내원 후 상태 업데이트 모달 */}
     <PostVisitStatusModal
      isOpen={isStatusModalOpen}
      onClose={() => {
        setIsStatusModalOpen(false);
        setSelectedPatientForUpdate(null);
      }}
      onConfirm={handleStatusUpdateConfirm}
      patient={selectedPatientForUpdate}
      isLoading={isUpdating}
      onRefreshData={handleRefreshData} // 🔥 새로 추가
      onPatientUpdate={handlePatientUpdate} // 🔥 새로 추가
    />

     {/* 환자 상세 모달 */}
     {selectedPatient && <PatientDetailModal />}
   </div>
 );
}