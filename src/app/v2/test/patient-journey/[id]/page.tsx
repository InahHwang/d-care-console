// src/app/v2/test/patient-journey/[id]/page.tsx
// 테스트 페이지: 여정(Journey) 모델 UI 프리뷰
'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/v2/ui/Card';
import { PatientStatus, PATIENT_STATUS_CONFIG } from '@/types/v2';

// ============================================
// 여정(Journey) 타입 정의
// ============================================
interface Journey {
  id: string;
  treatmentType: string;        // 치료 유형 (임플란트, 교정 등)
  status: PatientStatus;
  startedAt: string;
  closedAt?: string;
  estimatedAmount?: number;
  actualAmount?: number;
  isActive: boolean;            // 현재 진행 중인 여정
}

// 상태 진행 단계 정의
const statusSteps: Array<{ id: PatientStatus; label: string; color: string }> = [
  { id: 'consulting', label: '전화상담', color: 'bg-orange-500' },
  { id: 'reserved', label: '내원예약', color: 'bg-purple-500' },
  { id: 'visited', label: '내원완료', color: 'bg-amber-500' },
  { id: 'treatmentBooked', label: '치료예약', color: 'bg-teal-500' },
  { id: 'treatment', label: '치료중', color: 'bg-emerald-500' },
  { id: 'completed', label: '치료완료', color: 'bg-green-500' },
  { id: 'followup', label: '사후관리', color: 'bg-slate-500' },
];

// ============================================
// 더미 데이터 (실제로는 API에서 가져옴)
// ============================================
const MOCK_PATIENT = {
  id: '1',
  name: '김영희',
  phone: '010-1234-5678',
};

const MOCK_JOURNEYS: Journey[] = [
  {
    id: 'j1',
    treatmentType: '임플란트',
    status: 'completed',
    startedAt: '2024-01-15',
    closedAt: '2024-06-20',
    estimatedAmount: 5000000,
    actualAmount: 4500000,
    isActive: false,
  },
  {
    id: 'j2',
    treatmentType: '치아교정',
    status: 'treatment',
    startedAt: '2025-01-10',
    estimatedAmount: 3500000,
    actualAmount: 1500000,
    isActive: true,
  },
];

// ============================================
// 컴포넌트
// ============================================
export default function PatientJourneyTestPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;

  // 상태
  const [journeys] = useState<Journey[]>(MOCK_JOURNEYS);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(
    MOCK_JOURNEYS.find(j => j.isActive)?.id || MOCK_JOURNEYS[0]?.id || ''
  );
  const [isJourneyDropdownOpen, setIsJourneyDropdownOpen] = useState(false);
  const [isNewJourneyModalOpen, setIsNewJourneyModalOpen] = useState(false);

  const selectedJourney = journeys.find(j => j.id === selectedJourneyId);
  const activeJourney = journeys.find(j => j.isActive);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
  };

  const getStatusLabel = (status: PatientStatus) => {
    return PATIENT_STATUS_CONFIG[status]?.label || status;
  };

  const getStatusColor = (status: PatientStatus) => {
    return statusSteps.find(s => s.id === status)?.color || 'bg-gray-500';
  };

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} />
          환자 목록
        </button>
        <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
          테스트 페이지 - Journey UI 프리뷰
        </div>
      </div>

      {/* ============================================ */}
      {/* 🆕 여정 선택 영역 - 새로 추가되는 UI */}
      {/* ============================================ */}
      <Card className="p-4 mb-6 border-2 border-orange-200 bg-orange-50/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 환자 기본 정보 */}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{MOCK_PATIENT.name}</h1>
              <p className="text-sm text-gray-500">{MOCK_PATIENT.phone}</p>
            </div>

            {/* 여정 선택 드롭다운 */}
            <div className="relative">
              <button
                onClick={() => setIsJourneyDropdownOpen(!isJourneyDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm text-gray-500">현재 여정:</span>
                <span className="font-medium text-gray-900">
                  {selectedJourney?.treatmentType || '선택'}
                </span>
                {selectedJourney && (
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(selectedJourney.status)}`}>
                    {getStatusLabel(selectedJourney.status)}
                  </span>
                )}
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isJourneyDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* 드롭다운 메뉴 */}
              {isJourneyDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500 px-2">치료 여정 목록</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {journeys.map((journey) => (
                      <button
                        key={journey.id}
                        onClick={() => {
                          setSelectedJourneyId(journey.id);
                          setIsJourneyDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                          selectedJourneyId === journey.id ? 'bg-orange-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {journey.isActive ? (
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-gray-300" />
                          )}
                          <div className="text-left">
                            <p className="font-medium text-gray-900">{journey.treatmentType}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(journey.startedAt)}
                              {journey.closedAt && ` ~ ${formatDate(journey.closedAt)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(journey.status)}`}>
                            {getStatusLabel(journey.status)}
                          </span>
                          {journey.isActive && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              진행중
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* 새 여정 시작 버튼 */}
                  <div className="p-2 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setIsNewJourneyModalOpen(true);
                        setIsJourneyDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                    >
                      <Plus size={16} />
                      새 여정 시작 (구신환)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 여정 요약 */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-gray-500">총 여정</p>
              <p className="text-xl font-bold text-gray-900">{journeys.length}개</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">완료</p>
              <p className="text-xl font-bold text-green-600">
                {journeys.filter(j => j.status === 'completed' || j.closedAt).length}개
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">진행중</p>
              <p className="text-xl font-bold text-orange-600">
                {journeys.filter(j => j.isActive).length}개
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ============================================ */}
      {/* 🆕 여정 타임라인 - 새로 추가되는 UI */}
      {/* ============================================ */}
      <Card className="p-4 mb-6 border-2 border-purple-200 bg-purple-50/30">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-purple-500" />
          치료 여정 타임라인
        </h3>
        <div className="relative">
          {/* 타임라인 라인 */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-purple-200" />

          {/* 여정들 */}
          <div className="space-y-4">
            {journeys.map((journey, index) => (
              <div
                key={journey.id}
                onClick={() => setSelectedJourneyId(journey.id)}
                className={`relative pl-10 cursor-pointer ${
                  selectedJourneyId === journey.id ? 'opacity-100' : 'opacity-60 hover:opacity-80'
                }`}
              >
                {/* 타임라인 점 */}
                <div className={`absolute left-2.5 top-2 w-4 h-4 rounded-full border-2 ${
                  journey.isActive
                    ? 'bg-green-500 border-green-500'
                    : journey.closedAt
                      ? 'bg-gray-400 border-gray-400'
                      : 'bg-white border-purple-400'
                }`}>
                  {journey.isActive && (
                    <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-50" />
                  )}
                </div>

                {/* 여정 카드 */}
                <div className={`p-4 rounded-lg border transition-colors ${
                  selectedJourneyId === journey.id
                    ? 'bg-white border-purple-300 shadow-sm'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{journey.treatmentType}</span>
                      <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(journey.status)}`}>
                        {getStatusLabel(journey.status)}
                      </span>
                      {journey.isActive && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                          현재 진행중
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(journey.startedAt)}
                      {journey.closedAt && ` ~ ${formatDate(journey.closedAt)}`}
                    </span>
                  </div>

                  {/* 진행 상태 바 */}
                  <div className="flex items-center gap-1 mt-3">
                    {statusSteps.map((step, stepIndex) => {
                      const currentStepIndex = statusSteps.findIndex(s => s.id === journey.status);
                      const isPast = stepIndex < currentStepIndex;
                      const isCurrent = step.id === journey.status;

                      return (
                        <div key={step.id} className="flex-1 flex items-center gap-1">
                          <div className={`h-1.5 flex-1 rounded-full ${
                            isPast || isCurrent ? step.color : 'bg-gray-200'
                          }`} />
                        </div>
                      );
                    })}
                  </div>

                  {/* 금액 정보 */}
                  {(journey.estimatedAmount || journey.actualAmount) && (
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-sm">
                      <span className="text-gray-500">
                        예상: {journey.estimatedAmount?.toLocaleString()}원
                      </span>
                      <span className="text-emerald-600 font-medium">
                        결제: {journey.actualAmount?.toLocaleString()}원
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 기존 환자 상세 페이지 내용이 여기에 표시됨 */}
      <Card className="p-6 border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg font-medium mb-2">[ 기존 환자 상세 UI ]</p>
          <p className="text-sm">
            선택된 여정: <span className="font-bold text-gray-900">{selectedJourney?.treatmentType}</span>
          </p>
          <p className="text-sm mt-1">
            이 영역에 기존 환자 상세 페이지 내용이 표시됩니다.
          </p>
          <p className="text-sm mt-1">
            (상담 진행 단계, AI 분석 결과, 통화 기록 등)
          </p>
          <p className="text-xs text-gray-400 mt-4">
            * 각 여정별로 독립적인 상태/이력을 관리할 수 있습니다
          </p>
        </div>
      </Card>

      {/* 새 여정 시작 모달 */}
      {isNewJourneyModalOpen && (
        <NewJourneyModal
          onClose={() => setIsNewJourneyModalOpen(false)}
          patientName={MOCK_PATIENT.name}
        />
      )}

      {/* 클릭 외부 영역 닫기 */}
      {isJourneyDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsJourneyDropdownOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================
// 새 여정 시작 모달 컴포넌트
// ============================================
interface NewJourneyModalProps {
  onClose: () => void;
  patientName: string;
}

function NewJourneyModal({ onClose, patientName }: NewJourneyModalProps) {
  const [treatmentType, setTreatmentType] = useState('');
  const [customType, setCustomType] = useState('');

  const TREATMENT_TYPES = [
    '임플란트',
    '치아교정',
    '보철치료',
    '잇몸치료',
    '심미치료',
    '일반진료',
    '기타',
  ];

  const handleSubmit = () => {
    const type = treatmentType === '기타' ? customType : treatmentType;
    if (!type) {
      alert('치료 유형을 선택해주세요');
      return;
    }

    // 실제로는 API 호출
    alert(`새 여정 생성: ${type}\n(실제 구현 시 API 호출)`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">새 여정 시작</h2>
          <p className="text-sm text-gray-500 mt-1">
            {patientName} 님의 새로운 치료 여정을 시작합니다
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* 안내 메시지 */}
          <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
            <AlertCircle size={18} className="text-orange-500 mt-0.5" />
            <div className="text-sm text-orange-700">
              <p className="font-medium">구신환 등록</p>
              <p className="text-orange-600 mt-1">
                기존 치료가 완료된 환자가 새로운 치료를 시작할 때 사용합니다.
                이전 여정 기록은 그대로 유지됩니다.
              </p>
            </div>
          </div>

          {/* 치료 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              치료 유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TREATMENT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setTreatmentType(type)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    treatmentType === type
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {treatmentType === '기타' && (
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="치료 유형 직접 입력"
                className="w-full mt-2 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            )}
          </div>

          {/* 시작 상태 안내 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">시작 단계:</span> 전화상담
            </p>
            <p className="text-xs text-gray-500 mt-1">
              새 여정은 &apos;전화상담&apos; 단계부터 시작됩니다
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            여정 시작
          </button>
        </div>
      </div>
    </div>
  );
}
