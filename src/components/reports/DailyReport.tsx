'use client';

import React, { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/reduxHooks';
import { 
  Calendar, 
  Users, 
  RefreshCw,
  Eye,
  AlertCircle,
  FileText,
  DollarSign,
  Phone,
  CheckCircle,
  Clock,
  Target,
  MessageSquare,
  EyeOff,
  X
} from 'lucide-react';
import { Patient } from '@/types/patient';
import PatientListModal from '../management/PatientListModal';

// 🔥 일별 환자별 상담 내용 요약 타입 (월보고서 호환)
interface DailyPatientConsultationSummary {
  _id: string;
  name: string;
  age?: number;
  interestedServices?: string[];
  discomfort?: string;        // 🔥 월보고서 호환: 불편한 부분
  consultationSummary: string; // 상담 메모 요약
  fullDiscomfort?: string;     // 🔥 월보고서 호환: 전체 불편한 부분 내용
  fullConsultation?: string;   // 전체 상담 내용
  estimatedAmount: number;
  estimateAgreed?: boolean;    // 🔥 월보고서 호환: 견적 동의 여부
  
  // 🔥 일별보고서용 추가 필드
  callInDate: string;
  visitDate?: string;
  hasPhoneConsultation: boolean;
  hasVisitConsultation: boolean;
  phoneAmount?: number;
  visitAmount?: number;
  // 🔥 진행상황 계산을 위한 필드들
  status: string;
  visitConfirmed: boolean;
  postVisitStatus?: string;
  isCompleted: boolean;
}

// 🔥 일별 업무 현황을 위한 인터페이스 수정
interface DailyWorkSummary {
  selectedDate: string;
  callbackSummary: {
    overdueCallbacks: {
      total: number;
      processed: number;
      processingRate: number;
    };
    callbackUnregistered: {
      total: number;
      processed: number;
      processingRate: number;
    };
    absent: {
      total: number;
      processed: number;
      processingRate: number;
    };
    todayScheduled: {
      total: number;
      processed: number;
      processingRate: number;
    };
  };
  estimateSummary: {
    totalConsultationEstimate: number;        // 오늘 총 상담 견적
    visitConsultationEstimate: number;        // 내원 상담 환자 견적
    phoneConsultationEstimate: number;        // 유선 상담 환자 견적
    treatmentStartedEstimate: number;         // 치료 시작한 견적
  };
  // 🔥 새로 추가: 일별 환자별 상담 내용
  patientConsultations: DailyPatientConsultationSummary[];
}

// 일별 환자 데이터 타입 (내원관리용)
interface DailyPatientData {
  _id: string;
  name: string;
  treatmentContent: string;
  estimatedAmount: number;
  postVisitStatus: string;
  consultationContent: string;
  visitDate: string;
}

// 일별 상담관리 환자 데이터 타입
interface DailyConsultationData {
  _id: string;
  name: string;
  treatmentContent: string;
  estimatedAmount: number;
  status: string;
  callbackCount: number;
  consultationContent: string;
  callInDate: string;
}

// 🔥 환자별 상담 내용 상세 모달 컴포넌트 (월보고서와 완전 동일)
const PatientConsultationDetailModal: React.FC<{
  patient: DailyPatientConsultationSummary | null;
  onClose: () => void;
}> = ({ patient, onClose }) => {
  if (!patient) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">상담 내용 상세</h3>
            <p className="text-sm text-gray-600">
              {patient.name} {patient.age ? `(${patient.age}세)` : '(나이 정보 없음)'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* 🔥 관심분야 정보 (월보고서와 동일) */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">관심분야</h4>
            <div className="flex flex-wrap gap-2">
              {patient.interestedServices && patient.interestedServices.length > 0 ? (
                patient.interestedServices.map((service, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {service}
                  </span>
                ))
              ) : (
                <span className="text-blue-600 italic">관심분야 정보가 없습니다.</span>
              )}
            </div>
          </div>

          {/* 견적 정보 (월보고서와 동일 구조) */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">견적 정보</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">견적 금액:</span>
                <span className="ml-2 font-medium">
                  {patient.estimatedAmount && patient.estimatedAmount > 0 ? 
                    `${patient.estimatedAmount.toLocaleString()}원` : 
                    <span className="text-gray-400 italic">데이터 없음</span>
                  }
                </span>
              </div>
              <div>
                <span className="text-gray-600">동의 여부:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  patient.estimateAgreed 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {patient.estimateAgreed ? '동의' : '거부'}
                </span>
              </div>
            </div>
          </div>
          
          {/* 🔥 월보고서와 동일: 불편한 부분 섹션 추가 */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">불편한 부분</h4>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-line">
                {patient.fullDiscomfort || '기록된 내용이 없습니다.'}
              </p>
            </div>
          </div>
          
          {/* 상담 메모 (월보고서와 동일) */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">상담 메모</h4>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-line">
                {patient.fullConsultation ? 
                  patient.fullConsultation
                    .replace(/\[불편한 부분\][\s\S]*?(?=\n\[|$)/g, '') // [불편한 부분] 섹션 제거
                    .replace(/^\s*\n+/g, '') // 앞쪽 빈 줄 제거
                    .trim() || '기록된 내용이 없습니다.'
                  : '기록된 내용이 없습니다.'
                }
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// 🔥 진행상황 가이드 섹션 (월보고서와 동일)
const ProgressGuideSection: React.FC = () => {
  const progressStages = [
    {
      stage: '전화상담',
      description: '첫 문의 후 아직 예약이 확정되지 않은 상태',
      detail: '콜백필요, 잠재고객, 부재중 등 예약 전 단계',
      color: 'text-yellow-800',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300'
    },
    {
      stage: '예약완료',
      description: '상담을 통해 내원 예약이 확정된 상태',
      detail: '예약일시가 정해져 내원을 기다리는 단계',
      color: 'text-orange-800',
      bgColor: 'bg-orange-100',
      borderColor: 'border-orange-300'
    },
    {
      stage: '내원완료',
      description: '실제 병원에 내원하여 직접 상담을 받은 상태',
      detail: '내원 후 치료 여부가 아직 결정되지 않은 단계',
      color: 'text-purple-800',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300'
    },
    {
      stage: '치료동의',
      description: '내원 상담 후 치료에 동의한 상태',
      detail: '치료 계획에 동의했지만 아직 치료를 시작하지 않은 단계',
      color: 'text-blue-800',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300'
    },
    {
      stage: '치료시작',
      description: '실제 치료가 시작된 상태',
      detail: '치료 과정이 진행 중이거나 완료된 단계',
      color: 'text-green-800',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    },
    {
      stage: '종결',
      description: '상담이나 치료가 완전히 종료된 상태',
      detail: '더 이상 진행할 내용이 없는 최종 단계',
      color: 'text-gray-800',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300'
    }
  ];

  return (
    <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">?</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900">
          📋 환자 진행상황 가이드
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {progressStages.map((stage, index) => (
          <div 
            key={stage.stage}
            className={`p-3 rounded-lg border-2 ${stage.bgColor} ${stage.borderColor}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-500">
                  {index + 1}.
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stage.color} ${stage.bgColor}`}>
                  {stage.stage}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-700 font-medium mb-1">
              {stage.description}
            </p>
            <p className="text-xs text-slate-600">
              {stage.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// 🔥 환자별 상담 내용 요약 섹션 컴포넌트 - 기본적으로 펼쳐진 상태로 수정
const DailyPatientConsultationSection: React.FC<{ 
  consultations: DailyPatientConsultationSummary[];
  selectedDate: string;
  onPatientClick: (patient: DailyPatientConsultationSummary) => void;
}> = ({ consultations, selectedDate, onPatientClick }) => {
  const [isExpanded, setIsExpanded] = useState(true); // 🔥 기본값을 true로 변경
  
  // 🔥 진행상황 계산 함수 (월보고서와 동일)
  const calculatePatientProgress = (patient: DailyPatientConsultationSummary) => {
    // 6. 종결 (최우선 - 내원여부 무관)
    if (patient.isCompleted === true || patient.status === '종결') {
      return {
        stage: '종결',
        color: 'text-gray-800',
        bgColor: 'bg-gray-100'
      };
    }

    // 내원완료 여부로 크게 분기
    if (patient.visitConfirmed === true) {
      // 내원완료 환자들
      switch (patient.postVisitStatus) {
        case '치료시작':
          // 5. 치료시작
          return {
            stage: '치료시작',
            color: 'text-green-800',
            bgColor: 'bg-green-100'
          };
        
        case '치료동의':
          // 4. 치료동의
          return {
            stage: '치료동의',
            color: 'text-blue-800',
            bgColor: 'bg-blue-100'
          };
        
        case '재콜백':
        case '재콜백필요':
        case '':
        case null:
        case undefined:
          // 3. 내원완료 (재콜백 OR 상태미설정)
          return {
            stage: '내원완료',
            color: 'text-purple-800',
            bgColor: 'bg-purple-100'
          };
        
        default:
          // 기타 내원 후 상태들도 내원완료로 분류
          return {
            stage: '내원완료',
            color: 'text-purple-800',
            bgColor: 'bg-purple-100'
          };
      }
    } else {
      // 미내원 환자들
      if (patient.status === '예약확정') {
        // 2. 예약완료
        return {
          stage: '예약완료',
          color: 'text-orange-800',
          bgColor: 'bg-orange-100'
        };
      } else {
        // 1. 전화상담 (콜백필요, 잠재고객, 미처리콜백 등 모든 미내원 상태)
        return {
          stage: '전화상담',
          color: 'text-yellow-800',
          bgColor: 'bg-yellow-100'
        };
      }
    }
  };

  // 🔥 진행상황별 통계 계산
  const progressStats = consultations.reduce((stats, patient) => {
    const progress = calculatePatientProgress(patient);
    stats[progress.stage] = (stats[progress.stage] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);
  
  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-6 border-b bg-indigo-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            {selectedDate} 환자별 상담 내용 요약
            <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
              총 {consultations.length}명
            </span>
          </h2>
          
          {/* 🔥 펼침/접힘 토글 버튼 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 no-print transition-colors"
          >
            {isExpanded ? (
              <>
                <EyeOff className="w-4 h-4" />
                접기
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                상세보기 ({consultations.length}명)
              </>
            )}
          </button>
        </div>
        
        <ProgressGuideSection />

        {/* 🔥 접힌 상태일 때 진행상황별 요약 표시 */}
        {!isExpanded && consultations.length > 0 && (
          <div className="mt-4 p-4 bg-white rounded-lg border">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              {/* 6단계 진행상황별 표시 */}
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {progressStats['전화상담'] || 0}명
                </div>
                <div className="text-gray-600">전화상담</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {progressStats['예약완료'] || 0}명
                </div>
                <div className="text-gray-600">예약완료</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {progressStats['내원완료'] || 0}명
                </div>
                <div className="text-gray-600">내원완료</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {progressStats['치료동의'] || 0}명
                </div>
                <div className="text-gray-600">치료동의</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {progressStats['치료시작'] || 0}명
                </div>
                <div className="text-gray-600">치료시작</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {progressStats['종결'] || 0}명
                </div>
                <div className="text-gray-600">종결</div>
              </div>
            </div>
            {/* 🔥 견적금액 정보는 기존 유지 */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-center">
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-600">
                    {Math.round(
                      consultations
                        .filter(c => c.estimatedAmount && c.estimatedAmount > 0)
                        .reduce((sum, c) => sum + c.estimatedAmount, 0) / 10000
                    )}만원
                  </div>
                  <div className="text-gray-600">견적 합계</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!isExpanded && (
          <p className="text-sm text-gray-600 mt-3">
            {selectedDate} 상담 내용이 기록된 환자들의 진행상황별 요약입니다. "상세보기" 버튼을 클릭하면 전체 목록을 확인할 수 있습니다.
          </p>
        )}
      </div>
      
      {/* 🔥 펼쳐진 상태일 때만 테이블 표시 (월보고서와 동일한 구조) */}
      {isExpanded && (
        <>
          {consultations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{selectedDate}에 상담 내용이 기록된 환자가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    {/* 환자명: 좁게 - 이름은 보통 짧음 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      환자명
                    </th>
                    {/* 나이: 매우 좁게 - 숫자 2-3자리 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      나이
                    </th>
                    {/* 🔥 월보고서와 동일: 관심분야 열 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      관심분야
                    </th>
                    {/* 상담내용: 적당히 - 너무 크지 않게 조정 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-80">
                      상담내용 (전화+내원)
                    </th>
                    {/* 견적금액: 적당히 - 숫자가 길어질 수 있음 */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      견적금액
                    </th>
                    {/* 🔥 월보고서와 동일: "진행상황" */}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      진행상황
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consultations.map((patient) => {
                    const progress = calculatePatientProgress(patient);
                    
                    return (
                      <tr key={patient._id} onClick={() => onPatientClick(patient)} className="hover:bg-indigo-50 cursor-pointer transition-colors">
                        {/* 환자명 */}
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900 break-words">
                            {patient.name}
                          </div>
                        </td>
                        
                        {/* 나이 */}
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-600 whitespace-nowrap">
                            {patient.age ? `${patient.age}세` : '-'}
                          </div>
                        </td>
                        
                        {/* 관심분야 (월보고서와 동일) */}
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            {patient.interestedServices && patient.interestedServices.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {patient.interestedServices.slice(0, 2).map((service, index) => (
                                  <span 
                                    key={index}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 whitespace-nowrap"
                                  >
                                    {service}
                                  </span>
                                ))}
                                {patient.interestedServices.length > 2 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 whitespace-nowrap">
                                    +{patient.interestedServices.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">정보 없음</span>
                            )}
                          </div>
                        </td>
                        
                        {/* 상담내용 (월보고서와 동일) */}
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900">
                            {patient.consultationSummary && patient.consultationSummary !== '상담내용 없음' ? (
                              <>
                                {patient.consultationSummary.length > 120 ? (
                                  <details className="cursor-pointer">
                                    <summary className="font-medium text-blue-600 hover:text-blue-800">
                                      {patient.consultationSummary.substring(0, 120)}... (더보기)
                                    </summary>
                                    <div className="mt-2 p-3 bg-gray-50 rounded-lg whitespace-pre-line text-xs">
                                      {patient.fullConsultation}
                                    </div>
                                  </details>
                                ) : (
                                  <div className="whitespace-pre-line text-xs leading-relaxed">
                                    {patient.consultationSummary}
                                  </div>
                                )}
                                
                                {/* 상담 단계 표시 */}
                                <div className="flex items-center gap-1 mt-2">
                                  {patient.hasPhoneConsultation && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded whitespace-nowrap">
                                      📞 전화
                                    </span>
                                  )}
                                  {patient.hasVisitConsultation && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded whitespace-nowrap">
                                      🏥 내원
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-400 italic text-xs">상담내용 없음</span>
                            )}
                          </div>
                        </td>
                        
                        {/* 견적금액 (월보고서와 동일) */}
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.estimatedAmount && patient.estimatedAmount > 0 ? (
                              <div>
                                <div className="whitespace-nowrap">
                                  {patient.estimatedAmount.toLocaleString()}원
                                </div>
                                {/* 견적 출처 표시 */}
                                {patient.visitAmount && patient.visitAmount > 0 ? (
                                  <div className="text-xs text-green-600 whitespace-nowrap">내원견적</div>
                                ) : patient.phoneAmount && patient.phoneAmount > 0 ? (
                                  <div className="text-xs text-blue-600 whitespace-nowrap">전화견적</div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic whitespace-nowrap">데이터 없음</span>
                            )}
                          </div>
                        </td>
                        
                        {/* 🔥 진행상황 (월보고서와 동일) */}
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${progress.color} ${progress.bgColor}`}>
                            {progress.stage}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const DailyReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyPatients, setDailyPatients] = useState<DailyPatientData[]>([]);
  const [dailyConsultations, setDailyConsultations] = useState<DailyConsultationData[]>([]);
  const [dailyWorkSummary, setDailyWorkSummary] = useState<DailyWorkSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // 🔥 환자 상담 내용 상세 모달 상태
  const [selectedPatientConsultation, setSelectedPatientConsultation] = useState<DailyPatientConsultationSummary | null>(null);
  
  // 🔥 모달 상태 추가 - PatientFilterType 사용
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    filterType: 'overdueCallbacks' | 'callbackUnregistered' | 'absent' | 'todayScheduled' | null;
    title: string;
  }>({
    isOpen: false,
    filterType: null,
    title: ''
  });

  // Redux에서 환자 데이터 가져오기
  const { patients } = useAppSelector((state) => state.patients);

  // 🔥 모달 핸들러 수정 - 타입 안전성 확보
  const handleOpenModal = (filterType: 'overdueCallbacks' | 'callbackUnregistered' | 'absent' | 'todayScheduled', title: string) => {
    setModalState({
      isOpen: true,
      filterType,
      title
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      filterType: null,
      title: ''
    });
  };

  // 🔥 환자별 상담 내용 모달 핸들러들 추가
  const handlePatientConsultationClick = (patient: DailyPatientConsultationSummary) => {
    setSelectedPatientConsultation(patient);
  };

  const handleClosePatientConsultationModal = () => {
    setSelectedPatientConsultation(null);
  };

  // 🔥 일별 업무 현황 데이터 가져오기 함수
  const fetchDailyWorkSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/statistics/daily?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.warn('일별 업무 현황 조회 실패');
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        setDailyWorkSummary(result.data);
        console.log('일별 업무 현황 로드 완료:', result.data);
      }
    } catch (error) {
      console.error('일별 업무 현황 조회 오류:', error);
    }
  };

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억원`;
    }
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(0)}만원`;
    }
    return `${amount.toLocaleString()}원`;
  };

  // 상담관리 환자의 상담내용 조합 함수 - 수정된 버전
  const getConsultationContent = (patient: Patient): string => {
    const contents: string[] = [];
    
    // 🔥 디버깅 로그 추가
    console.log(`=== ${patient.name} 상담내용 분석 ===`);
    console.log('consultation 데이터:', patient.consultation);
    console.log('callbackHistory 길이:', patient.callbackHistory?.length || 0);
    
    // 최초 상담 - 불편한 부분과 상담메모 조합
    const consultation = patient.consultation;
    if (consultation) {
      let initialContent = '';
      if (consultation.treatmentPlan) {
        initialContent += `[불편한 부분] ${consultation.treatmentPlan}`;
      }
      if (consultation.consultationNotes) {
        if (initialContent) initialContent += '\n';
        initialContent += `[상담메모] ${consultation.consultationNotes}`;
      }
      if (initialContent) {
        contents.push(`[최초 상담]\n${initialContent}`);
      }
    }

    // 콜백 히스토리의 상담내용들 (상담관리용 - 모든 콜백 포함)
    if (patient.callbackHistory && patient.callbackHistory.length > 0) {
      console.log('콜백 히스토리 상세:', patient.callbackHistory);
      
      const consultationCallbacks = patient.callbackHistory
        .filter(callback => {
          console.log(`콜백 ${callback.type}: resultNotes="${callback.resultNotes}", notes="${callback.notes}", content="${callback.content}"`);
          
          // 🔥 수정된 로직: resultNotes가 유효하지 않으면 notes 사용
          const hasValidResultNotes = callback.resultNotes && 
                                    callback.resultNotes !== 'undefined' && 
                                    callback.resultNotes.trim() !== '';
          const hasValidNotes = callback.notes && 
                              callback.notes !== 'undefined' && 
                              callback.notes.trim() !== '';
          
          return hasValidResultNotes || hasValidNotes;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      console.log('유효한 상담내용이 있는 콜백 수:', consultationCallbacks.length);
      
      consultationCallbacks.forEach((callback) => {
        // 🔥 수정된 로직: resultNotes 우선, 없으면 notes 사용
        let consultationText = '';
        
        if (callback.resultNotes && 
            callback.resultNotes !== 'undefined' && 
            callback.resultNotes.trim() !== '') {
          consultationText = callback.resultNotes;
        } else if (callback.notes && 
                  callback.notes !== 'undefined' && 
                  callback.notes.trim() !== '') {
          consultationText = callback.notes;
        }
        
        if (consultationText) {
          // 콜백 타입과 날짜 정보 포함
          const callbackDate = new Date(callback.date).toLocaleDateString();
          contents.push(`[${callback.type} 콜백 - ${callbackDate}]\n${consultationText}`);
        }
      });
    }

    const finalContent = contents.length > 0 ? contents.join('\n\n') : '-';
    console.log('최종 상담내용:', finalContent);
    console.log('========================');
    
    return finalContent;
  };

  // 선택된 날짜의 상담관리 환자 데이터 필터링
  const filterConsultationsByDate = () => {
    if (!patients || patients.length === 0) {
      setDailyConsultations([]);
      return;
    }

    const filtered = patients
      .filter(patient => {
        // callInDate가 선택된 날짜와 일치하는 모든 환자 포함
        return patient.callInDate === selectedDate;
      })
      .map(patient => ({
        _id: patient._id,
        name: patient.name,
        treatmentContent: patient.consultation?.treatmentPlan || '-',
        estimatedAmount: patient.consultation?.estimatedAmount || 0,
        status: 'defaultStatus',
        callbackCount: patient.callbackHistory?.length || 0,
        consultationContent: getConsultationContent(patient),
        callInDate: patient.callInDate || ''
      }));

    setDailyConsultations(filtered);
  };

  // 날짜 변경 시 또는 환자 데이터 변경 시 필터링
  useEffect(() => {
    setIsLoading(true);
    // 실제 환경에서는 API 호출 대신 기존 데이터 필터링
    setTimeout(() => {
      filterConsultationsByDate();
      fetchDailyWorkSummary(); // 🔥 일별 업무 현황도 함께 조회
      setIsLoading(false);
    }, 300);
  }, [selectedDate, patients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">일별 보고서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 날짜 선택 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">일별마감보고</h2>
          <p className="text-sm text-gray-600 mt-1">선택한 날짜에 내원한 환자들의 상담 현황입니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              filterConsultationsByDate();
              fetchDailyWorkSummary(); // 🔥 업무 현황도 함께 새로고침
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* 🔥 일별 업무 현황 섹션 추가 */}
      {dailyWorkSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 오늘 처리한 업무 - 새로운 디자인 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">오늘 처리한 업무</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 미처리 콜백 */}
              <div 
                className="bg-white/70 rounded-lg p-4 border border-red-200 cursor-pointer hover:bg-red-50 transition-colors"
                onClick={() => handleOpenModal('overdueCallbacks', '🚨 미처리 콜백 - 즉시 대응 필요')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-3 h-3 text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-red-700">🚨 미처리 콜백</span>
                  </div>
                  <span className="text-xs text-blue-600">클릭하여 보기</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-red-900">
                    {dailyWorkSummary.callbackSummary.overdueCallbacks.total}건
                  </span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    dailyWorkSummary.callbackSummary.overdueCallbacks.processingRate === 100 
                      ? 'bg-green-100 text-green-800' 
                      : dailyWorkSummary.callbackSummary.overdueCallbacks.processingRate >= 80 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    처리율 {dailyWorkSummary.callbackSummary.overdueCallbacks.processingRate}%
                  </span>
                </div>
                
                <div className="text-xs text-red-600 mt-1">
                  {dailyWorkSummary.callbackSummary.overdueCallbacks.processed}건 처리완료
                </div>
              </div>

              {/* 콜백 미등록 */}
              <div 
                className="bg-white/70 rounded-lg p-4 border border-orange-200 cursor-pointer hover:bg-orange-50 transition-colors"
                onClick={() => handleOpenModal('callbackUnregistered', '📋 콜백 미등록 - 잠재고객 상담 등록 필요')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                      <FileText className="w-3 h-3 text-orange-600" />
                    </div>
                    <span className="text-sm font-medium text-orange-700">📋 콜백 미등록</span>
                  </div>
                  <span className="text-xs text-blue-600">클릭하여 보기</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-orange-900">
                    {dailyWorkSummary.callbackSummary.callbackUnregistered.total}명
                  </span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    dailyWorkSummary.callbackSummary.callbackUnregistered.processingRate === 100 
                      ? 'bg-green-100 text-green-800' 
                      : dailyWorkSummary.callbackSummary.callbackUnregistered.processingRate >= 80 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    처리율 {dailyWorkSummary.callbackSummary.callbackUnregistered.processingRate}%
                  </span>
                </div>
                
                <div className="text-xs text-orange-600 mt-1">
                  {dailyWorkSummary.callbackSummary.callbackUnregistered.processed}명 처리완료
                </div>
              </div>

              {/* 부재중 */}
              <div 
                className="bg-white/70 rounded-lg p-4 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleOpenModal('absent', '부재중 환자')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <Phone className="w-3 h-3 text-gray-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">부재중</span>
                  </div>
                  <span className="text-xs text-blue-600">클릭하여 보기</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    {dailyWorkSummary.callbackSummary.absent.total}명
                  </span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    dailyWorkSummary.callbackSummary.absent.processingRate === 100 
                      ? 'bg-green-100 text-green-800' 
                      : dailyWorkSummary.callbackSummary.absent.processingRate >= 80 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    처리율 {dailyWorkSummary.callbackSummary.absent.processingRate}%
                  </span>
                </div>
                
                <div className="text-xs text-gray-600 mt-1">
                  {dailyWorkSummary.callbackSummary.absent.processed}명 처리완료
                </div>
              </div>

              {/* 오늘 예정된 콜백 */}
              <div 
                className="bg-white/70 rounded-lg p-4 border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleOpenModal('todayScheduled', '오늘 예정된 콜백')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-3 h-3 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-blue-700">오늘 예정된 콜</span>
                  </div>
                  <span className="text-xs text-blue-600">클릭하여 보기</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-900">
                    {dailyWorkSummary.callbackSummary.todayScheduled.total}건
                  </span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    dailyWorkSummary.callbackSummary.todayScheduled.processingRate === 100 
                      ? 'bg-green-100 text-green-800' 
                      : dailyWorkSummary.callbackSummary.todayScheduled.processingRate >= 80 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    처리율 {dailyWorkSummary.callbackSummary.todayScheduled.processingRate}%
                  </span>
                </div>
                
                <div className="text-xs text-blue-600 mt-1">
                  {dailyWorkSummary.callbackSummary.todayScheduled.processed}건 처리완료
                </div>
              </div>
            </div>
          </div>

          {/* 견적금액 정보 - 새로운 디자인 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">견적금액 정보</h3>
            </div>
            
            {/* 상담 견적 섹션 */}
            <div className="space-y-3 mb-4">
              <div className="bg-white/50 rounded-lg p-4 border border-green-100">
                <div className="text-sm font-medium text-green-800 mb-3">📋 오늘 상담 견적</div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">• 내원 상담 환자 견적</span>
                    <span className="font-medium text-blue-900">
                      {formatAmount(dailyWorkSummary.estimateSummary.visitConsultationEstimate)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">• 유선 상담 환자 견적</span>
                    <span className="font-medium text-purple-900">
                      {formatAmount(dailyWorkSummary.estimateSummary.phoneConsultationEstimate)}
                    </span>
                  </div>
                </div>
                
                <div className="border-t border-green-200 mt-3 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800">📊 총 상담 견적</span>
                    <span className="text-xl font-bold text-green-900">
                      {formatAmount(dailyWorkSummary.estimateSummary.totalConsultationEstimate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 치료 시작 견적 섹션 (별도 구분) */}
            <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">🚀 치료 시작한 견적 (처리일 기준)</span>
                <span className="text-lg font-bold text-amber-800">
                  {formatAmount(dailyWorkSummary.estimateSummary.treatmentStartedEstimate)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 환자별 상담 내용 요약 섹션 추가 - 기본적으로 펼쳐진 상태 */}
      {dailyWorkSummary && dailyWorkSummary.patientConsultations && (
        <DailyPatientConsultationSection 
          consultations={dailyWorkSummary.patientConsultations}
          selectedDate={selectedDate}
          onPatientClick={handlePatientConsultationClick}
        />
      )}

      {/* 🔥 환자 상담 내용 상세 모달 */}
      <PatientConsultationDetailModal
        patient={selectedPatientConsultation}
        onClose={handleClosePatientConsultationModal}
      />

      {/* 🔥 환자 목록 모달 추가 */}
      {modalState.isOpen && modalState.filterType && (
        <PatientListModal
          isOpen={modalState.isOpen}
          onClose={handleCloseModal}
          filterType={modalState.filterType}
          title={modalState.title}
        />
      )}
    </div>
  );
};

export default DailyReport;