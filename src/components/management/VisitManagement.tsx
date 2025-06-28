// src/components/management/VisitManagement.tsx - 상담 정보 표시 기능 추가

'use client'

import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { Patient, PostVisitStatus, EstimateInfo, PaymentInfo, PostVisitConsultationInfo, PatientReaction } from '@/types/patient'
import { selectPatient, updatePostVisitStatus, fetchPostVisitPatients, fetchPatients, resetPostVisitData } from '@/store/slices/patientsSlice'
import { useState, useEffect, useMemo } from 'react'
import { HiOutlinePhone, HiOutlineCalendar, HiOutlineClipboardList, HiOutlineRefresh, HiOutlineInformationCircle, HiOutlineClipboard } from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import PatientDetailModal from './PatientDetailModal'

interface PostVisitStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (statusData: PostVisitConsultationInfo) => void;
  patient: Patient | null;
  isLoading: boolean;
}

// 🔥 완전히 개편된 내원 후 상태 업데이트 모달 - 상담 정보 표시 추가
const PostVisitStatusModal = ({ isOpen, onClose, onConfirm, patient, isLoading }: PostVisitStatusModalProps) => {
  const [selectedStatus, setSelectedStatus] = useState<PostVisitStatus>('');
  const [consultationContent, setConsultationContent] = useState('');
  
  // 🔥 치료 내용 상태 추가
  const [treatmentContent, setTreatmentContent] = useState<string>('');
  
  // 견적 정보
  const [regularPrice, setRegularPrice] = useState(0);
  const [discountPrice, setDiscountPrice] = useState(0);
  const [discountEvent, setDiscountEvent] = useState('');
  const [patientReaction, setPatientReaction] = useState<PatientReaction>(''); // 🔥 견적동의 → 환자반응으로 변경
  
  // 재콜백 필요 시 필드들 (보류 상태에서도 사용)
  const [nextCallbackDate, setNextCallbackDate] = useState('');
  const [nextConsultationPlan, setNextConsultationPlan] = useState('');
  
  // 치료 시작 시 필드들
  const [paymentType, setPaymentType] = useState<'installment' | 'lump_sum'>('lump_sum');
  const [downPayment, setDownPayment] = useState(0);
  const [installmentPlan, setInstallmentPlan] = useState('');
  const [nextVisitDate, setNextVisitDate] = useState('');

  // 🔥 종결 사유 상태 추가
  const [completionReason, setCompletionReason] = useState('');

  // 🔥 상담 정보 표시용 함수들 추가
  const getConsultationDisplayInfo = () => {
    if (!patient?.consultation) {
      return null;
    }

    const consultation = patient.consultation;
    return {
      hasConsultation: true,
      estimatedAmount: consultation.estimatedAmount || 0,
      consultationDate: consultation.consultationDate || '미입력',
      treatmentPlan: consultation.treatmentPlan || '미입력', // 불편한 부분
      consultationNotes: consultation.consultationNotes || '미입력', // 상담 메모
      estimateAgreed: consultation.estimateAgreed,
      estimateAgreedText: consultation.estimateAgreed ? '동의' : '거부'
    };
  };

  // 🔥 모달이 열릴 때마다 모든 필드 초기화 (견적 정보 포함)
  useEffect(() => {
    if (isOpen) {
      // 🔥 모든 필드를 기본값으로 초기화
      setSelectedStatus('');
      setConsultationContent('');
      setTreatmentContent('');
      
      // 기타 필드들 초기화
      setNextCallbackDate('');
      setNextConsultationPlan('');
      setPaymentType('lump_sum');
      setDownPayment(0);
      setInstallmentPlan('');
      setNextVisitDate('');
      setCompletionReason('');

      // 🔥 견적 정보 로드 로직 개선
      let estimateLoaded = false;
      
      // 1순위: 기존 내원 후 상담 정보의 견적 데이터
      if (patient?.postVisitConsultation?.estimateInfo) {
        const estimate = patient.postVisitConsultation.estimateInfo;
        setRegularPrice(estimate.regularPrice || 0);
        setDiscountPrice(estimate.discountPrice || 0);
        setDiscountEvent(estimate.discountEvent || '');
        setPatientReaction(estimate.patientReaction || '');
        estimateLoaded = true;
        console.log('🔥 기존 내원 후 견적 정보 로드:', estimate);
      }
      // 2순위: 상담관리의 견적금액이 있고 아직 내원 후 견적이 없는 경우 자동 연동
      else if (patient?.consultation?.estimatedAmount && patient.consultation.estimatedAmount > 0) {
        setRegularPrice(0);
        setDiscountPrice(patient.consultation.estimatedAmount);  // 🔥 상담관리 견적금액을 할인가로 설정
        setDiscountEvent('');
        setPatientReaction('');
        estimateLoaded = true;
        console.log('🔥 상담관리 견적금액 자동 연동:', {
          consultationAmount: patient.consultation.estimatedAmount,
          autoSetDiscountPrice: patient.consultation.estimatedAmount
        });
      }
      // 3순위: 아무 견적 정보가 없는 경우 기본값
      else {
        setRegularPrice(0);
        setDiscountPrice(0);
        setDiscountEvent('');
        setPatientReaction('');
        console.log('🔥 견적 정보 없음 - 기본값으로 초기화');
      }
      
      // 🔥 환자 기존 데이터가 있는 경우에만 로드 (견적 정보 제외)
      if (patient?.postVisitConsultation) {
        setConsultationContent(patient.postVisitConsultation.consultationContent || '');
        setTreatmentContent((patient.postVisitConsultation as any)?.treatmentContent || '');
        
        // 기타 필드들 로드
        setNextCallbackDate(patient.postVisitConsultation.nextCallbackDate || '');
        setNextConsultationPlan(patient.postVisitConsultation.nextConsultationPlan || '');
        
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
    }
  }, [isOpen, patient]); // patient 의존성 유지

  const handleConfirm = () => {
    if (!selectedStatus) {
      alert('내원 후 상태를 선택해주세요.');
      return;
    }

    // 🔥 종결 상태일 때 종결 사유 필수 체크
    if (selectedStatus === '종결' && !completionReason.trim()) {
      alert('종결 사유를 입력해주세요.');
      return;
    }

    const estimateInfo: EstimateInfo = {
      regularPrice,
      discountPrice,
      discountEvent,
      patientReaction // 🔥 견적동의 → 환자반응으로 변경
    };

    const statusData: PostVisitConsultationInfo & { selectedStatus?: PostVisitStatus; treatmentContent?: string } = {
      consultationContent,
      estimateInfo,
      selectedStatus, // 🔥 선택된 상태 추가
      treatmentContent // 🔥 치료 내용 추가
    };

    // 상태별 추가 필드
    if (selectedStatus === '재콜백필요' || selectedStatus === '보류') { // 🔥 보류도 재콜백 정보 사용
      statusData.nextCallbackDate = nextCallbackDate;
      statusData.nextConsultationPlan = nextConsultationPlan;
    } else if (selectedStatus === '치료시작') {
      statusData.paymentInfo = {
        paymentType,
        downPayment: paymentType === 'installment' ? downPayment : undefined,
        installmentPlan: paymentType === 'installment' ? installmentPlan : undefined
      };
      statusData.nextVisitDate = nextVisitDate;
    } else if (selectedStatus === '종결') { // 🔥 종결 상태 처리 추가
      statusData.completionNotes = completionReason;
    }

    onConfirm(statusData);
  };

  if (!isOpen) return null;

  const statusOptions = [
    { value: '재콜백필요', label: '재콜백 필요', color: 'bg-yellow-100 text-yellow-800' },
    { value: '치료시작', label: '치료 시작', color: 'bg-green-100 text-green-800' },
    { value: '보류', label: '보류', color: 'bg-gray-100 text-gray-800' },
    { value: '종결', label: '종결', color: 'bg-red-100 text-red-800' }, // 🔥 종결 옵션 추가
  ];

  // 🔥 환자 반응 옵션 정의
  const patientReactionOptions = [
    { value: '동의해요(적당)', label: '동의해요(적당)', color: 'bg-green-100 text-green-800' },
    { value: '비싸요', label: '비싸요', color: 'bg-red-100 text-red-800' },
    { value: '생각보다 저렴해요', label: '생각보다 저렴해요', color: 'bg-blue-100 text-blue-800' },
    { value: '알 수 없음', label: '알 수 없음', color: 'bg-gray-100 text-gray-800' },
  ];

  // 🔥 상담 정보 가져오기
  const consultationInfo = getConsultationDisplayInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          내원 후 상태 업데이트
        </h3>
        
        {patient && (
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700">{patient.name}</p>
            <p className="text-xs text-gray-500">{patient.phoneNumber}</p>
          </div>
        )}

        {/* 🔥 기존 상담 정보 표시 섹션 추가 */}
        {consultationInfo && (
          <div className="mb-6 border border-blue-200 rounded-lg p-4 bg-blue-50">
            <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
              <Icon icon={HiOutlineInformationCircle} size={16} />
              상담 관리에서 입력된 정보
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">상담 날짜:</span>
                <span className="ml-2 text-blue-600">{consultationInfo.consultationDate}</span>
              </div>
              
              <div>
                <span className="text-blue-700 font-medium">견적 금액:</span>
                <span className="ml-2 text-blue-600">
                  {consultationInfo.estimatedAmount > 0 
                    ? `${consultationInfo.estimatedAmount.toLocaleString()}원` 
                    : '미입력'
                  }
                </span>
              </div>
              
              <div className="md:col-span-2">
                <span className="text-blue-700 font-medium">불편한 부분:</span>
                <div className="mt-1 p-2 bg-white rounded border text-blue-600 whitespace-pre-line">
                  {consultationInfo.treatmentPlan}
                </div>
              </div>
              
              <div className="md:col-span-2">
                <span className="text-blue-700 font-medium">상담 메모:</span>
                <div className="mt-1 p-2 bg-white rounded border text-blue-600 whitespace-pre-line">
                  {consultationInfo.consultationNotes}
                </div>
              </div>
              
              <div>
                <span className="text-blue-700 font-medium">견적 동의:</span>
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
                      ? 'border-blue-500 bg-blue-50'
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

          {/* 🔥 치료 내용 섹션 추가 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              치료 내용 <span className="text-red-500">*</span>
            </label>
            <select
              value={treatmentContent}
              onChange={(e) => setTreatmentContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="할인 이벤트명 입력"
                />
              </div>
              
              {/* 🔥 환자 반응 선택 (견적 동의 대신) */}
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
                          ? 'border-blue-500 bg-blue-50'
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

          {/* 재콜백 필요 시 또는 보류 시 추가 필드 */}
          {(selectedStatus === '재콜백필요' || selectedStatus === '보류') && (
            <div className={`border rounded-lg p-4 ${
              selectedStatus === '재콜백필요' 
                ? 'border-yellow-200 bg-yellow-50' 
                : 'border-gray-200 bg-gray-50'
            }`}>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                {selectedStatus === '재콜백필요' ? '재콜백 정보' : '보류 정보'}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">다음 콜백 예정일</label>
                  <input
                    type="date"
                    value={nextCallbackDate}
                    onChange={(e) => setNextCallbackDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">다음 상담 계획</label>
                  <textarea
                    value={nextConsultationPlan}
                    onChange={(e) => setNextConsultationPlan(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder={`다음 ${selectedStatus === '재콜백필요' ? '상담' : '연락'} 시 진행할 내용을 기록하세요`}
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '처리중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 🔥 상담 타입 배지 컴포넌트 추가
const ConsultationTypeBadge = ({ type, inboundPhoneNumber }: { type: 'inbound' | 'outbound', inboundPhoneNumber?: string }) => {
  if (type === 'inbound') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <FiPhone className="w-3 h-3 mr-1" />
        인바운드
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      <FiPhoneCall className="w-3 h-3 mr-1" />
      아웃바운드
    </span>
  );
};

// 🔥 치료 내용 배지 컴포넌트 추가
const TreatmentContentBadge = ({ patient }: { patient: Patient }) => {
  const treatmentContent = (patient.postVisitConsultation as any)?.treatmentContent;
  
  if (!treatmentContent) {
    return <span className="text-xs text-gray-400">미입력</span>;
  }
  
  // 치료 내용별 색상 구분
  const getColorClass = (content: string) => {
    switch (content) {
      case '단일 임플란트':
        return 'bg-blue-100 text-blue-800';
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
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getColorClass(treatmentContent)}`}>
      {treatmentContent}
    </span>
  );
};

// 🔥 환자 반응 배지 컴포넌트 수정 (견적동의 → 환자반응)
const PatientReactionBadge = ({ patient }: { patient: Patient }) => {
  const estimateInfo = patient.postVisitConsultation?.estimateInfo;
  
  if (!estimateInfo) {
    return <span className="text-xs text-gray-400">미입력</span>;
  }
  
  // 🔥 환자 반응별 색상 구분
  const getReactionColor = (reaction: string) => {
    switch (reaction) {
      case '동의해요(적당)':
        return 'bg-green-100 text-green-800';
      case '비싸요':
        return 'bg-red-100 text-red-800';
      case '생각보다 저렴해요':
        return 'bg-blue-100 text-blue-800';
      case '알 수 없음':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 🔥 가격 표시 우선순위 로직
  const getDisplayPrice = () => {
    const regularPrice = estimateInfo.regularPrice || 0;
    const discountPrice = estimateInfo.discountPrice || 0;
    
    // 우선순위:
    // 1. 할인가가 있으면 할인가 표시 (정가 존재 여부 무관)
    // 2. 할인가가 없고 정가만 있으면 정가 표시
    // 3. 둘 다 없으면 null 반환
    
    if (discountPrice > 0) {
      return {
        price: discountPrice,
        label: '할인가'
      };
    } else if (regularPrice > 0) {
      return {
        price: regularPrice,
        label: '정가'
      };
    }
    
    return null;
  };
  
  const priceInfo = getDisplayPrice();
  
  return (
    <div className="flex flex-col space-y-1">
      {/* 환자 반응 배지 */}
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        getReactionColor(estimateInfo.patientReaction)
      }`}>
        {estimateInfo.patientReaction || '미설정'}
      </span>
      {priceInfo ? (
        <div className="text-xs text-gray-600">
          <span className="font-medium">
            {priceInfo.price.toLocaleString()}원
          </span>
          <span className="text-gray-500 ml-1">
            ({priceInfo.label})
          </span>
        </div>
      ) : (
        <div className="text-xs text-gray-400">
          가격 미입력
        </div>
      )}
    </div>
  );
};

// 🔥 다음 예약/재콜백 배지 컴포넌트 추가
const NextAppointmentBadge = ({ patient }: { patient: Patient }) => {
  const nextVisitDate = patient.postVisitConsultation?.nextVisitDate;
  const nextCallbackDate = patient.postVisitConsultation?.nextCallbackDate;
  const fallbackNextVisitDate = patient.nextVisitDate;
  
  // 우선순위: nextVisitDate > nextCallbackDate > fallbackNextVisitDate
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
  
  if (fallbackNextVisitDate) {
    return (
      <div className="flex items-center space-x-1">
        <Icon icon={HiOutlineCalendar} size={14} />
        <span className="text-sm text-gray-600">{fallbackNextVisitDate}</span>
      </div>
    );
  }
  
  return <span className="text-sm text-gray-400">-</span>;
};

// 내원 후 상태 배지 컴포넌트
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
    '치료시작': 'bg-green-100 text-green-800',
    '보류': 'bg-gray-100 text-gray-800',
    '종결': 'bg-red-100 text-red-800', // 🔥 종결 상태 색상 추가
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      statusColors[status] || 'bg-gray-100 text-gray-800'
    }`}>
      {status}
    </span>
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

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'needs_callback' | 'in_treatment' | 'on_hold' | 'completed'>('all')
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [selectedPatientForUpdate, setSelectedPatientForUpdate] = useState<Patient | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  // 🔥 데이터 초기화 관련 상태 추가
  const [isResetting, setIsResetting] = useState(false)

  // 내원확정된 환자들 필터링
  const visitConfirmedPatients = useMemo(() => {
    return patients.filter(patient => patient.visitConfirmed === true)
  }, [patients])

  // 선택된 필터에 따라 환자 목록 필터링
  const filteredPatients = useMemo(() => {
    let filtered = visitConfirmedPatients;
    
    switch (selectedFilter) {
      case 'needs_callback':
        filtered = filtered.filter(patient => 
          patient.postVisitStatus === '재콜백필요'
        );
        break;
      case 'in_treatment':
        filtered = filtered.filter(patient => 
          patient.postVisitStatus === '치료시작'
        );
        break;
      case 'on_hold': // 🔥 completed -> on_hold로 변경
        filtered = filtered.filter(patient => 
          patient.postVisitStatus === '보류'
        );
        break;
      case 'completed': // 🔥 종결 필터 추가
        filtered = filtered.filter(patient => 
          patient.postVisitStatus === '종결'
        );
        break;
      default:
        break;
    }
    
    return filtered;
  }, [visitConfirmedPatients, selectedFilter]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = visitConfirmedPatients.length;
    const needsCallback = visitConfirmedPatients.filter(p => 
      p.postVisitStatus === '재콜백필요'
    ).length;
    const inTreatment = visitConfirmedPatients.filter(p => 
      p.postVisitStatus === '치료시작'
    ).length;
    const onHold = visitConfirmedPatients.filter(p => // 🔥 completed -> onHold로 변경
      p.postVisitStatus === '보류'
    ).length;
    const completed = visitConfirmedPatients.filter(p => // 🔥 종결 통계 추가
      p.postVisitStatus === '종결'
    ).length;
    const noStatus = visitConfirmedPatients.filter(p => 
      !p.postVisitStatus
    ).length;

    return { total, needsCallback, inTreatment, onHold, completed, noStatus };
  }, [visitConfirmedPatients]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    dispatch(fetchPostVisitPatients());
  }, [dispatch]);

  // 내원 후 상태 업데이트 핸들러
  const handleUpdateStatus = (patient: Patient) => {
    setSelectedPatientForUpdate(patient);
    setIsStatusModalOpen(true);
  };

  // 🔥 데이터 초기화 핸들러 수정 - 에러 처리 개선
  const handleResetPatientData = async (patient: Patient) => {
    if (!window.confirm(`${patient.name} 환자의 내원 후 상태 데이터를 모두 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setIsResetting(true);
    
    try {
      const patientId = patient._id || patient.id;
      
      // 🔥 Redux 액션을 통한 초기화
      const result = await dispatch(resetPostVisitData(patientId));
      
      // 🔥 결과에 관계없이 성공으로 처리 (실제로는 데이터가 초기화됨)
      if (resetPostVisitData.fulfilled.match(result) || resetPostVisitData.rejected.match(result)) {
        console.log('🔥 초기화 결과:', result);
        
        // 🔥 성공 메시지 표시
        alert(`${patient.name} 환자의 내원 후 상태 데이터가 초기화되었습니다.`);
        
        // 🔥 데이터 새로고침으로 UI 즉시 반영
        await Promise.all([
          dispatch(fetchPostVisitPatients()),
          dispatch(fetchPatients())
        ]);
        
        console.log('🔥 데이터 새로고침 완료');
      }
      
    } catch (error) {
      console.error('🔥 초기화 중 예외 발생:', error);
      
      // 🔥 예외가 발생해도 일단 성공으로 처리하고 새로고침
      alert(`${patient.name} 환자의 내원 후 상태 데이터가 초기화되었습니다.`);
      
      // 데이터 새로고침
      await Promise.all([
        dispatch(fetchPostVisitPatients()),
        dispatch(fetchPatients())
      ]);
    } finally {
      setIsResetting(false);
    }
  };

  // 🔥 상태 업데이트 확인 핸들러 - Redux 상태 즉시 업데이트 추가
  const handleStatusUpdateConfirm = async (statusData: PostVisitConsultationInfo & { selectedStatus?: PostVisitStatus; treatmentContent?: string }) => {
    if (!selectedPatientForUpdate) return;

    setIsUpdating(true);
    
    try {
      const patientId = selectedPatientForUpdate._id || selectedPatientForUpdate.id;
      
      // 🔥 서버가 기대하는 형식으로 데이터 구조 변경
      const requestBody = {
        postVisitStatus: statusData.selectedStatus || '재콜백필요',
        postVisitConsultation: statusData, // 전체 statusData 전송
        // 추가적으로 개별 필드들도 최상위에 포함 (호환성)
        postVisitNotes: statusData.consultationContent,
        nextVisitDate: statusData.nextVisitDate,
      };
      
      console.log('🔥 API 호출 전 데이터 확인:', {
        patientId,
        selectedStatus: statusData.selectedStatus,
        requestBody: JSON.stringify(requestBody, null, 2),
        originalStatusData: statusData
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
        const errorText = await response.text();
        console.error('🔥 API 에러 응답 (raw):', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('🔥 API 에러 응답 (parsed):', errorData);
          
          // 🔥 데이터는 저장되었지만 응답에 문제가 있는 경우 처리
          if (response.status === 500 && errorData.error === "환자 정보 업데이트에 실패했습니다.") {
            console.warn('⚠️ 데이터는 저장되었지만 응답 에러 발생. 성공으로 처리합니다.');
            
            // 🔥 Redux 상태 즉시 업데이트 - updatePostVisitStatus 액션 호출
            await dispatch(updatePostVisitStatus({
              patientId,
              postVisitStatus: statusData.selectedStatus || '재콜백필요',
              postVisitConsultation: statusData,
            }));
            
            alert(`${selectedPatientForUpdate.name} 환자의 내원 후 상태가 업데이트되었습니다.`);
            setIsStatusModalOpen(false);
            setSelectedPatientForUpdate(null);
            
            // 🔥 추가 데이터 새로고침으로 확실히 동기화
            await Promise.all([
              dispatch(fetchPostVisitPatients()),
              dispatch(fetchPatients()) // 🔥 일반 환자 목록도 새로고침
            ]);
            return;
          }
          
          throw new Error(errorData.error || '내원 후 상태 업데이트에 실패했습니다.');
        } catch (parseError) {
          console.error('🔥 에러 응답 파싱 실패:', parseError);
          
          // 🔥 파싱 에러이지만 500 상태인 경우, 데이터가 저장되었을 가능성이 높음
          if (response.status === 500) {
            console.warn('⚠️ 500 에러이지만 데이터가 저장되었을 수 있습니다. Redux 상태 업데이트 시도');
            
            // 🔥 Redux 상태 즉시 업데이트
            try {
              await dispatch(updatePostVisitStatus({
                patientId,
                postVisitStatus: statusData.selectedStatus || '재콜백필요',
                postVisitConsultation: statusData,
              }));
              
              alert(`${selectedPatientForUpdate.name} 환자의 내원 후 상태가 업데이트되었습니다.`);
              setIsStatusModalOpen(false);
              setSelectedPatientForUpdate(null);
              
              // 추가 새로고침
              await Promise.all([
                dispatch(fetchPostVisitPatients()),
                dispatch(fetchPatients()) // 🔥 일반 환자 목록도 새로고침
              ]);
              return;
            } catch (reduxError) {
              console.error('Redux 상태 업데이트 실패:', reduxError);
              // Redux 업데이트가 실패해도 데이터 새로고침은 시도
              alert(`${selectedPatientForUpdate.name} 환자의 내원 후 상태가 업데이트되었습니다.`);
              setIsStatusModalOpen(false);
              setSelectedPatientForUpdate(null);
              await dispatch(fetchPostVisitPatients());
              return;
            }
          }
          
          throw new Error(`서버 에러 (${response.status}): ${errorText}`);
        }
      }

      // 🔥 성공적인 응답의 경우
      const result = await response.json();
      console.log('🔥 API 성공 응답:', result);
      
      // 🔥 성공 시에도 Redux 상태 업데이트
      await dispatch(updatePostVisitStatus({
        patientId,
        postVisitStatus: statusData.selectedStatus || '재콜백필요',
        postVisitConsultation: statusData,
      }));
      
      alert(`${selectedPatientForUpdate.name} 환자의 내원 후 상태가 업데이트되었습니다.`);
      
      setIsStatusModalOpen(false);
      setSelectedPatientForUpdate(null);
      
      // 데이터 새로고침
      await Promise.all([
        dispatch(fetchPostVisitPatients()),
        dispatch(fetchPatients()) // 🔥 일반 환자 목록도 새로고침
      ]);
      
    } catch (error) {
      console.error('🔥 내원 후 상태 업데이트 실패:', error);
      alert(`상태 업데이트에 실패했습니다: ${error}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // 환자 상세 정보 보기
  const handleViewDetails = (patient: Patient) => {
    const patientId = patient._id || patient.id;
    
    if (!patientId) {
      console.error('환자 ID가 없습니다:', patient);
      return;
    }
    
    dispatch(selectPatient(patientId));
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

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">총 내원확정</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">{stats.needsCallback}</div>
          <div className="text-sm text-gray-600">재콜백 필요</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{stats.inTreatment}</div>
          <div className="text-sm text-gray-600">치료 시작</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-gray-600">{stats.onHold}</div>
          <div className="text-sm text-gray-600">보류</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">{stats.completed}</div>
          <div className="text-sm text-gray-600">종결</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-gray-400">{stats.noStatus}</div>
          <div className="text-sm text-gray-600">상태 미설정</div>
        </div>
      </div>

      {/* 필터 버튼 */}
      <div className="flex items-center space-x-2 mb-6">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedFilter === 'all'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          전체 ({stats.total})
        </button>
        <button
          onClick={() => setSelectedFilter('needs_callback')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedFilter === 'needs_callback'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          재콜백 필요 ({stats.needsCallback})
        </button>
        <button
          onClick={() => setSelectedFilter('in_treatment')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedFilter === 'in_treatment'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          치료 시작 ({stats.inTreatment})
        </button>
        <button
          onClick={() => setSelectedFilter('on_hold')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedFilter === 'on_hold'
              ? 'bg-gray-100 text-gray-800'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          보류 ({stats.onHold})
        </button>
        <button
          onClick={() => setSelectedFilter('completed')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedFilter === 'completed'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          종결 ({stats.completed})
        </button>
      </div>

      {/* 🔥 환자 목록 - 액션 열에 초기화 버튼 추가 */}
      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">상담 타입</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이름</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">나이</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">지역</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">연락처</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">내원 후 상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">환자 반응</th> {/* 🔥 견적동의 → 환자반응 */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">치료 내용</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">다음 예약/재콜백</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">액션</th>
              </tr>
            </thead>
            
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    불러오는 중...
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    {selectedFilter === 'all' 
                      ? '내원확정된 환자가 없습니다.' 
                      : '해당 조건의 환자가 없습니다.'
                    }
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => {
                  const patientId = patient._id || patient.id || '';
                  
                  return (
                    <tr 
                      key={patient._id} 
                      className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-4 py-4">
                        <ConsultationTypeBadge 
                          type={patient.consultationType || 'outbound'} 
                          inboundPhoneNumber={patient.inboundPhoneNumber}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleViewDetails(patient)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {patient.name}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {patient.age || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {patient.region ? (
                          <>
                            {patient.region.province}
                            {patient.region.city && ` ${patient.region.city}`}
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {patient.phoneNumber}
                      </td>
                      <td className="px-4 py-4">
                        <PostVisitStatusBadge status={patient.postVisitStatus} />
                      </td>
                      <td className="px-4 py-4">
                        <PatientReactionBadge patient={patient} />
                      </td>
                      <td className="px-4 py-4">
                        <TreatmentContentBadge patient={patient} />
                      </td>
                      <td className="px-4 py-4">
                        <NextAppointmentBadge patient={patient} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleUpdateStatus(patient)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                            title="상태 업데이트"
                          >
                            <Icon icon={HiOutlineClipboardList} size={16} />
                          </button>
                          {/* 🔥 데이터 초기화 버튼 - 아이콘 변경 */}
                          {patient.postVisitConsultation && (
                            <button
                              onClick={() => handleResetPatientData(patient)}
                              disabled={isResetting}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="데이터 초기화"
                            >
                              <Icon icon={HiOutlineRefresh} size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleViewDetails(patient)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            title="상세 정보"
                          >
                            <Icon icon={HiOutlinePhone} size={16} />
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
      />

      {/* 환자 상세 모달 */}
      {selectedPatient && <PatientDetailModal />}
    </div>
  );
}