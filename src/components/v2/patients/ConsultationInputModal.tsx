// src/components/v2/patients/ConsultationInputModal.tsx
// 상담 결과 입력 모달 (전화상담 / 내원상담)
'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, XCircle, Clock, Calendar, DollarSign, AlertCircle, ChevronDown } from 'lucide-react';
import { ConsultationType, ConsultationStatus, DISAGREE_REASON_CATEGORIES } from '@/types/v2';

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
  aiGenerated?: boolean;
  aiSummary?: string;
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
}

interface CategoryItem {
  id: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Consultant {
  id: string;
  name: string;
  role: string;
  department: string;
}

const STATUS_OPTIONS: { value: ConsultationStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'agreed', label: '동의', icon: <Check className="w-5 h-5" />, color: 'bg-emerald-500 hover:bg-emerald-600' },
  { value: 'disagreed', label: '미동의', icon: <XCircle className="w-5 h-5" />, color: 'bg-rose-500 hover:bg-rose-600' },
  { value: 'pending', label: '보류', icon: <Clock className="w-5 h-5" />, color: 'bg-amber-500 hover:bg-amber-600' },
];

// 기본 치료 목록 (API에서 로드 실패 시 사용)
const DEFAULT_TREATMENTS = ['임플란트', '교정', '심미보철', '충치치료', '스케일링', '라미네이트', '틀니', '잇몸치료', '신경치료', '발치', '기타'];

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
  const today = new Date().toISOString().split('T')[0];

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
  const [submitting, setSubmitting] = useState(false);

  // 동적 데이터
  const [treatments, setTreatments] = useState<string[]>(DEFAULT_TREATMENTS);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showConsultantDropdown, setShowConsultantDropdown] = useState(false);

  // 관심시술 및 상담사 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // 병렬로 데이터 로드
      const [categoriesRes, consultantsRes] = await Promise.all([
        fetch('/api/settings/categories'),
        fetch('/api/v2/consultants'),
      ]);

      // 관심시술 로드
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        if (categoriesData.success && categoriesData.categories?.interestedServices) {
          const activeServices = categoriesData.categories.interestedServices
            .filter((item: CategoryItem) => item.isActive)
            .map((item: CategoryItem) => item.label);
          if (activeServices.length > 0) {
            setTreatments(activeServices);
          }
        }
      }

      // 상담사 목록 로드
      if (consultantsRes.ok) {
        const consultantsData = await consultantsRes.json();
        if (consultantsData.success && consultantsData.consultants) {
          setConsultants(consultantsData.consultants);
        }
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoadingData(false);
    }
  };

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
      }
      setShowConsultantDropdown(false);
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
    if (!status || !consultantName) {
      alert('상담 결과와 담당자를 선택해주세요.');
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
      }, existingData?.id);  // 수정 모드면 id 전달
      onClose();
    } catch (error) {
      console.error('상담 결과 저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsultantSelect = (name: string) => {
    setConsultantName(name);
    setShowConsultantDropdown(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {type === 'phone' ? '전화상담' : '내원상담'} 결과 {isEditMode ? '수정' : '입력'}
              </h2>
              {existingData?.aiGenerated && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  AI 자동분류
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{patientName} 환자</p>
            {existingData?.aiSummary && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                AI 요약: {existingData.aiSummary}
              </p>
            )}
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
            <div className="flex gap-3">
              {STATUS_OPTIONS.map(opt => (
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

          {/* 2. 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                관심 치료
              </label>
              <select
                value={treatment}
                onChange={e => setTreatment(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                disabled={loadingData}
              >
                <option value="">선택</option>
                {treatments.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                담당자 *
              </label>
              <div
                className="w-full border rounded-lg px-3 py-2 cursor-pointer flex items-center justify-between bg-white"
                onClick={() => setShowConsultantDropdown(!showConsultantDropdown)}
              >
                <span className={consultantName ? 'text-gray-900' : 'text-gray-400'}>
                  {consultantName || '담당자 선택'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showConsultantDropdown ? 'rotate-180' : ''}`} />
              </div>

              {/* 드롭다운 메뉴 */}
              {showConsultantDropdown && (
                <>
                  {/* 드롭다운 닫기용 오버레이 */}
                  <div
                    className="fixed inset-0"
                    onClick={() => setShowConsultantDropdown(false)}
                  />
                  <div className="absolute z-[100] w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {consultants.length > 0 ? (
                      consultants.map(c => (
                        <div
                          key={c.id}
                          onClick={() => handleConsultantSelect(c.name)}
                          className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${
                            consultantName === c.name ? 'bg-blue-100 text-blue-700' : ''
                          }`}
                        >
                          <div className="font-medium">{c.name}</div>
                          {c.department && (
                            <div className="text-xs text-gray-500">{c.department}</div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500 text-sm">
                        {loadingData ? '로딩 중...' : '등록된 담당자가 없습니다'}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

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
                    min={today}
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
                  min={today}
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
                  min={today}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  환자가 결정을 보류한 경우, 다음 연락 예정일을 설정하세요
                </p>
              </div>
            </div>
          )}

          {/* 6. 공통: 상담사 메모 (영역 확대) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              상담사 메모
            </label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="상담 내용, 환자 특이사항, 추가 메모 등을 자유롭게 입력하세요"
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
