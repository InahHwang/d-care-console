// src/components/v2/patients/ConsultationInputModal.tsx
// 상담 결과 입력 모달 (전화상담 / 내원상담)
'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, XCircle, Clock, Calendar, DollarSign, AlertCircle, Ban, PhoneMissed } from 'lucide-react';
import { ConsultationType, ConsultationStatus, DISAGREE_REASON_CATEGORIES, MarketingTargetReason, ClosedReason, CLOSED_REASON_OPTIONS } from '@/types/v2';
import { MarketingTargetCheckbox, MarketingTargetData } from '@/components/v2/marketing';

// 기존 상담 데이터 (수정 모드용)
export interface ExistingConsultationData {
  id: string;
  status: ConsultationStatus;
  treatment: string;
  originalAmount: number;
  discountRate: number;
  discountReason?: string;
  disagreeReasons?: string[];
  correctionPlan?: string;
  appointmentDate?: string;
  callbackDate?: string;
  consultantName: string;
  memo?: string;
}

interface ConsultationInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ConsultationFormData, existingId?: string) => Promise<void>;
  type: ConsultationType;  // 'phone' | 'visit'
  patientName: string;
  patientInterest?: string;
  consultantName?: string;
  // 수정 모드용
  existingData?: ExistingConsultationData;
}

export interface ConsultationFormData {
  type: ConsultationType;
  status: ConsultationStatus;
  treatment: string;
  originalAmount: number;
  discountRate: number;
  discountReason: string;
  disagreeReasons: string[];
  correctionPlan: string;
  appointmentDate: string;
  callbackDate: string;
  consultantName: string;
  inquiry: string;
  memo: string;
  // 종결 관련 필드
  closedReason?: ClosedReason;
  closedReasonCustom?: string;
  // 마케팅 타겟 관련 필드
  isMarketingTarget?: boolean;
  marketingTargetData?: {
    reason: MarketingTargetReason;
    customReason?: string;
    categories: string[];
    scheduledDate?: string;
    note?: string;
  };
}

const BASE_STATUS_OPTIONS: { value: ConsultationStatus; label: string; icon: React.ReactNode; color: string; phoneOnly?: boolean }[] = [
  { value: 'agreed', label: '동의', icon: <Check className="w-5 h-5" />, color: 'bg-emerald-500 hover:bg-emerald-600' },
  { value: 'disagreed', label: '미동의', icon: <XCircle className="w-5 h-5" />, color: 'bg-rose-500 hover:bg-rose-600' },
  { value: 'pending', label: '보류', icon: <Clock className="w-5 h-5" />, color: 'bg-amber-500 hover:bg-amber-600' },
  { value: 'no_answer', label: '부재중', icon: <PhoneMissed className="w-5 h-5" />, color: 'bg-orange-500 hover:bg-orange-600', phoneOnly: true },
  { value: 'closed', label: '종결', icon: <Ban className="w-5 h-5" />, color: 'bg-gray-600 hover:bg-gray-700' },
];

export function ConsultationInputModal({
  isOpen,
  onClose,
  onSubmit,
  type,
  patientName,
  patientInterest,
  consultantName: defaultConsultant,
  existingData,
}: ConsultationInputModalProps) {
  // 수정 모드 여부
  const isEditMode = !!existingData;
  const [status, setStatus] = useState<ConsultationStatus | null>(null);
  const [treatment, setTreatment] = useState(patientInterest || '');
  const [originalAmount, setOriginalAmount] = useState<number>(0);
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState('');
  const [disagreeReasons, setDisagreeReasons] = useState<string[]>([]);
  const [correctionPlan, setCorrectionPlan] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [consultantName, setConsultantName] = useState(defaultConsultant || '');
  const [memo, setMemo] = useState('');
  const [closedReason, setClosedReason] = useState<ClosedReason | ''>('');
  const [closedReasonCustom, setClosedReasonCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 마케팅 타겟 관련 상태
  const [isMarketingTarget, setIsMarketingTarget] = useState(false);
  const [marketingTargetData, setMarketingTargetData] = useState<MarketingTargetData>({
    reason: 'price_hesitation',
    customReason: '',
    categories: [],
    scheduledDate: '',
    note: '',
  });

  // 동적 데이터 (더 이상 사용하지 않지만 호환성 유지)
  const [loadingData, setLoadingData] = useState(false);


  // 모달 열릴 때 초기화 (수정 모드면 기존 데이터로 채움)
  useEffect(() => {
    if (isOpen) {
      if (existingData) {
        // 수정 모드: 기존 데이터로 채움
        setStatus(existingData.status);
        setTreatment(existingData.treatment || patientInterest || '');
        setOriginalAmount(existingData.originalAmount || 0);
        setDiscountRate(existingData.discountRate || 0);
        setDiscountReason(existingData.discountReason || '');
        setDisagreeReasons(existingData.disagreeReasons || []);
        setCorrectionPlan(existingData.correctionPlan || '');
        setAppointmentDate(existingData.appointmentDate || '');
        setCallbackDate(existingData.callbackDate || '');
        setConsultantName(existingData.consultantName || defaultConsultant || '');
        setMemo(existingData.memo || '');
      } else {
        // 신규 모드: 초기화
        setStatus(null);
        setTreatment(patientInterest || '');
        setOriginalAmount(0);
        setDiscountRate(0);
        setDiscountReason('');
        setDisagreeReasons([]);
        setCorrectionPlan('');
        setAppointmentDate('');
        setCallbackDate('');
        setConsultantName(defaultConsultant || '');
        setMemo('');
        // 종결 초기화
        setClosedReason('');
        setClosedReasonCustom('');
        // 마케팅 타겟 초기화
        setIsMarketingTarget(false);
        setMarketingTargetData({
          reason: 'price_hesitation',
          customReason: '',
          categories: [],
          scheduledDate: '',
          note: '',
        });
      }
    }
  }, [isOpen, patientInterest, defaultConsultant, existingData]);

  if (!isOpen) return null;

  const handleReasonToggle = (reason: string) => {
    setDisagreeReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  // 내원상담에서만 할인 계산
  const discountAmount = type === 'visit' ? Math.round(originalAmount * (discountRate / 100)) : 0;
  const finalAmount = type === 'visit' ? originalAmount - discountAmount : originalAmount;

  const handleSubmit = async () => {
    if (!status) {
      alert('상담 결과를 선택해주세요.');
      return;
    }

    if (status === 'agreed' && !appointmentDate) {
      alert('예약일을 선택해주세요.');
      return;
    }

    if ((status === 'disagreed' || status === 'pending') && !callbackDate) {
      alert('콜백 예정일을 선택해주세요.');
      return;
    }

    if (status === 'closed' && !closedReason) {
      alert('종결 사유를 선택해주세요.');
      return;
    }

    if (status === 'closed' && closedReason === '기타' && !closedReasonCustom.trim()) {
      alert('기타 종결 사유를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        type,
        status,
        treatment,
        originalAmount,
        discountRate: type === 'visit' ? discountRate : 0,
        discountReason: type === 'visit' ? discountReason : '',
        disagreeReasons,
        correctionPlan,
        appointmentDate,
        callbackDate,
        consultantName,
        inquiry: '', // 삭제됨
        memo,
        // 종결 관련 데이터
        closedReason: status === 'closed' ? (closedReason as ClosedReason) : undefined,
        closedReasonCustom: status === 'closed' && closedReason === '기타' ? closedReasonCustom : undefined,
        // 마케팅 타겟 관련 데이터
        isMarketingTarget: (status === 'disagreed' || status === 'pending') ? isMarketingTarget : false,
        marketingTargetData: isMarketingTarget && (status === 'disagreed' || status === 'pending')
          ? marketingTargetData
          : undefined,
      }, existingData?.id);  // 수정 모드면 id 전달
      onClose();
    } catch (error) {
      console.error('상담 결과 저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold">
              {type === 'phone' ? '전화상담' : '내원상담'} 결과 {isEditMode ? '수정' : '입력'}
            </h2>
            <p className="text-sm text-gray-500">{patientName} 환자</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {/* 1. 상담 결과 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상담 결과 *
            </label>
            <div className="flex gap-2">
              {BASE_STATUS_OPTIONS.filter(opt => !opt.phoneOnly || type === 'phone').map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-white transition-all ${
                    status === opt.value
                      ? `${opt.color} ring-2 ring-offset-2 ring-gray-400`
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                >
                  {opt.icon}
                  <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 담당자 표시 (자동 설정됨) */}
          {consultantName && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
              <span>담당자:</span>
              <span className="font-medium text-gray-900">{consultantName}</span>
            </div>
          )}

          {/* 3. 동의 시: 예약일 + 금액 */}
          {status === 'agreed' && (
            <div className="p-4 bg-emerald-50 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 font-medium">
                <Check className="w-5 h-5" />
                동의 정보
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {type === 'phone' ? '내원예약일' : '치료예약일'} *
                  </label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={e => setAppointmentDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    예상 금액 (원)
                  </label>
                  <input
                    type="number"
                    value={originalAmount || ''}
                    onChange={e => setOriginalAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* 내원상담일 경우에만 할인 관련 필드 표시 */}
              {type === 'visit' && originalAmount > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      할인율 (%)
                    </label>
                    <input
                      type="number"
                      value={discountRate || ''}
                      onChange={e => setDiscountRate(Number(e.target.value))}
                      min={0}
                      max={100}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      할인 사유
                    </label>
                    <input
                      type="text"
                      value={discountReason}
                      onChange={e => setDiscountReason(e.target.value)}
                      placeholder="예: 첫 방문 할인"
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      최종 금액
                    </label>
                    <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 font-semibold text-emerald-600">
                      {finalAmount.toLocaleString()}원
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. 미동의 시: 사유 선택 + 시정계획 + 콜백일 */}
          {status === 'disagreed' && (
            <div className="p-4 bg-rose-50 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-rose-700 font-medium">
                <XCircle className="w-5 h-5" />
                미동의 정보
              </div>

              {/* 미동의 사유 (카테고리별) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  미동의 사유 (복수 선택 가능)
                </label>
                <div className="space-y-3">
                  {Object.entries(DISAGREE_REASON_CATEGORIES).map(([key, category]) => (
                    <div key={key}>
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        {category.label}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {category.reasons.map(reason => (
                          <button
                            key={reason}
                            onClick={() => handleReasonToggle(reason)}
                            className={`px-3 py-1 text-sm rounded-full transition-all ${
                              disagreeReasons.includes(reason)
                                ? 'bg-rose-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 시정 계획 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시정 계획
                </label>
                <textarea
                  value={correctionPlan}
                  onChange={e => setCorrectionPlan(e.target.value)}
                  placeholder="다음 상담 시 어떻게 대응할지 계획을 작성하세요"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* 콜백 예정일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  콜백 예정일 *
                </label>
                <input
                  type="date"
                  value={callbackDate}
                  onChange={e => setCallbackDate(e.target.value)}

                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}

          {/* 5. 보류 시: 콜백일만 */}
          {status === 'pending' && (
            <div className="p-4 bg-amber-50 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-amber-700 font-medium">
                <Clock className="w-5 h-5" />
                보류 정보
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  콜백 예정일 *
                </label>
                <input
                  type="date"
                  value={callbackDate}
                  onChange={e => setCallbackDate(e.target.value)}

                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  환자가 결정을 보류한 경우, 다음 연락 예정일을 설정하세요
                </p>
              </div>
            </div>
          )}

          {/* 5-0.5. 부재중 시: 콜백일 */}
          {status === 'no_answer' && (
            <div className="p-4 bg-orange-50 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-orange-700 font-medium">
                <PhoneMissed className="w-5 h-5" />
                부재중 정보
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  콜백 예정일
                </label>
                <input
                  type="date"
                  value={callbackDate}
                  onChange={e => setCallbackDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  재통화할 날짜를 설정하세요
                </p>
              </div>
            </div>
          )}

          {/* 5-1. 종결 시: 종결 사유 선택 */}
          {status === 'closed' && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <Ban className="w-5 h-5" />
                종결 사유 *
              </div>

              <div className="space-y-2">
                {CLOSED_REASON_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      closedReason === opt.value
                        ? 'bg-gray-200 ring-2 ring-gray-400'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="closedReason"
                      value={opt.value}
                      checked={closedReason === opt.value}
                      onChange={() => setClosedReason(opt.value)}
                      className="w-4 h-4 text-gray-600"
                    />
                    <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* 기타 선택 시 사유 입력 */}
              {closedReason === '기타' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종결 사유 입력 *
                  </label>
                  <input
                    type="text"
                    value={closedReasonCustom}
                    onChange={e => setClosedReasonCustom(e.target.value)}
                    placeholder="종결 사유를 입력하세요"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              )}
            </div>
          )}

          {/* 6. 미동의/보류 시: 이벤트 타겟 지정 옵션 */}
          {(status === 'disagreed' || status === 'pending') && (
            <MarketingTargetCheckbox
              checked={isMarketingTarget}
              onChange={setIsMarketingTarget}
              targetData={marketingTargetData}
              onTargetDataChange={setMarketingTargetData}
            />
          )}

          {/* 7. 공통: 상담 내용 (내원상담) / 메모 (전화상담) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {type === 'visit' ? '상담 내용' : '상담사 메모'}
            </label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder={type === 'visit'
                ? "내원 상담 내용을 입력하세요 (상담이력에 자동 기록됩니다)"
                : "상담 내용, 환자 특이사항, 추가 메모 등을 자유롭게 입력하세요"
              }
              rows={5}
              className="w-full border rounded-lg px-3 py-2 resize-none"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!status || submitting}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

    </div>
  );
}
