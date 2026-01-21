// src/components/v2/patients/PatientList.tsx
'use client';

import React from 'react';
import { PhoneCall, ChevronRight, Flame, Thermometer, Snowflake, PhoneIncoming, PhoneOutgoing, AlertTriangle, Layers } from 'lucide-react';
import { PatientStatus, Temperature } from '@/types/v2';

type CallDirection = 'inbound' | 'outbound';
type UrgencyType = 'noshow' | 'today' | 'overdue' | 'normal';

type PaymentStatus = 'none' | 'partial' | 'completed';

// 간소화된 여정 정보 (목록 표시용)
interface JourneySummary {
  id: string;
  treatmentType: string;
  status: PatientStatus;
  isActive: boolean;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
  status: PatientStatus;
  temperature: Temperature;
  consultationType?: string;
  interest: string;
  source?: string;
  createdAt: string;
  lastContactAt: string;
  lastCallDirection?: CallDirection;
  nextAction?: string;
  nextActionDate?: string | null;
  nextActionNote?: string;
  daysInStatus?: number;
  urgency?: UrgencyType;
  age?: number;
  region?: {
    province: string;
    city?: string;
  };
  // 금액 관련 필드
  estimatedAmount?: number;
  actualAmount?: number;
  paymentStatus?: PaymentStatus;
  // 치료 진행 관련 필드
  expectedCompletionDate?: string | null;
  // 여정(Journey) 관련 필드
  journeys?: JourneySummary[];
  activeJourneyId?: string;
}

interface PatientListProps {
  patients: Patient[];
  onPatientClick?: (patient: Patient) => void;
  onCallClick?: (patient: Patient) => void;
  loading?: boolean;
}

function TableSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-3 px-5 py-3 animate-pulse">
      <div className="col-span-1"><div className="w-8 h-8 bg-gray-200 rounded-full" /></div>
      <div className="col-span-2"><div className="h-4 w-16 bg-gray-200 rounded" /></div>
      <div className="col-span-1"><div className="h-4 w-8 bg-gray-200 rounded" /></div>
      <div className="col-span-1"><div className="h-4 w-12 bg-gray-200 rounded" /></div>
      <div className="col-span-2"><div className="h-4 w-24 bg-gray-200 rounded" /></div>
      <div className="col-span-1"><div className="h-4 w-10 bg-gray-200 rounded" /></div>
      <div className="col-span-1"><div className="h-4 w-10 bg-gray-200 rounded" /></div>
      <div className="col-span-1"><div className="h-4 w-12 bg-gray-200 rounded" /></div>
      <div className="col-span-1"><div className="h-4 w-14 bg-gray-200 rounded" /></div>
      <div className="col-span-1"></div>
    </div>
  );
}

function formatPhone(phone: string) {
  if (!phone) return '-';
  if (phone.includes('-')) return phone;
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
  }
  return phone;
}

function getDaysInStatus(createdAt: string) {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// 상태별 체류일 경고 임계값
const DAYS_THRESHOLD: Record<PatientStatus, { warning: number; danger: number }> = {
  consulting: { warning: 3, danger: 7 },
  reserved: { warning: 0, danger: 0 }, // 예약은 nextActionDate로 판단
  visited: { warning: 3, danger: 7 }, // 내원완료 후 치료예약 유도
  treatmentBooked: { warning: 0, danger: 0 }, // 치료예약은 nextActionDate로 판단
  treatment: { warning: 14, danger: 30 },
  completed: { warning: 999, danger: 999 }, // 완료는 경고 없음
  followup: { warning: 30, danger: 90 },
  closed: { warning: 999, danger: 999 }, // 종결은 경고 없음
};

// 다음 일정 통합 표기 (액션 + D-day)
function getScheduleDisplay(
  status: PatientStatus,
  nextAction: string | undefined,
  nextActionDate: string | null | undefined,
  daysInStatus: number
): { text: string; style: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // nextActionDate가 있는 경우: 액션 + D-day 표시
  if (nextActionDate && nextAction) {
    const actionDate = new Date(nextActionDate);
    actionDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((actionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      // 미래: D-N
      if (diffDays <= 3) {
        return { text: `${nextAction} D-${diffDays}`, style: 'text-orange-500 font-medium' };
      }
      return { text: `${nextAction} D-${diffDays}`, style: 'text-gray-600' };
    } else if (diffDays === 0) {
      // 오늘
      return { text: `${nextAction} D-Day`, style: 'text-blue-600 font-bold' };
    } else {
      // 과거: +N일 (지연)
      const overdue = Math.abs(diffDays);
      return { text: `${nextAction} +${overdue}일`, style: 'text-red-500 font-medium' };
    }
  }

  // nextAction만 있고 날짜 없는 경우
  if (nextAction && !nextActionDate) {
    return { text: nextAction, style: 'text-gray-500' };
  }

  // nextActionDate가 없는 경우: N일째 표시
  if (status === 'completed') {
    return { text: `${daysInStatus}일째`, style: 'text-gray-400' };
  }

  // 다른 상태들: 임계값에 따라 색상 변경
  const threshold = DAYS_THRESHOLD[status];
  if (daysInStatus >= threshold.danger) {
    return { text: `${daysInStatus}일째`, style: 'text-red-500 font-medium' };
  } else if (daysInStatus >= threshold.warning) {
    return { text: `${daysInStatus}일째`, style: 'text-orange-500 font-medium' };
  }
  return { text: `${daysInStatus}일째`, style: 'text-gray-500' };
}

function getStatusStyle(status: PatientStatus) {
  switch (status) {
    case 'consulting': return 'bg-blue-100 text-blue-700';
    case 'reserved': return 'bg-purple-100 text-purple-700';
    case 'visited': return 'bg-amber-100 text-amber-700';
    case 'treatmentBooked': return 'bg-teal-100 text-teal-700';
    case 'treatment': return 'bg-emerald-100 text-emerald-700';
    case 'completed': return 'bg-green-100 text-green-700';
    case 'followup': return 'bg-slate-100 text-slate-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getStatusLabel(status: PatientStatus) {
  switch (status) {
    case 'consulting': return '전화상담';
    case 'reserved': return '내원예약';
    case 'visited': return '내원완료';
    case 'treatmentBooked': return '치료예약';
    case 'treatment': return '치료중';
    case 'completed': return '치료완료';
    case 'followup': return '사후관리';
    default: return status;
  }
}

// 긴급도별 행 스타일
function getUrgencyRowStyle(urgency?: UrgencyType): string {
  switch (urgency) {
    case 'noshow':
      return 'bg-red-50 border-l-4 border-l-red-500';
    case 'today':
      return 'bg-blue-50 border-l-4 border-l-blue-500';
    case 'overdue':
      return 'bg-amber-50 border-l-4 border-l-amber-500';
    default:
      return '';
  }
}

function TemperatureDisplay({ temperature }: { temperature: Temperature }) {
  const config = {
    hot: { icon: Flame, color: 'text-red-500', label: '높음' },
    warm: { icon: Thermometer, color: 'text-amber-500', label: '중간' },
    cold: { icon: Snowflake, color: 'text-blue-400', label: '낮음' },
  };

  const { icon: Icon, color, label } = config[temperature] || config.warm;
  return (
    <div className="flex items-center gap-1">
      <Icon size={14} className={color} />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
}

function CallDirectionIcon({ direction }: { direction?: CallDirection }) {
  if (direction === 'outbound') {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
        <PhoneOutgoing size={16} className="text-blue-600" />
      </div>
    );
  }
  if (direction === 'inbound') {
    return (
      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
        <PhoneIncoming size={16} className="text-green-600" />
      </div>
    );
  }
  // 방향 정보 없음
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
      <PhoneCall size={16} className="text-gray-400" />
    </div>
  );
}

export function PatientList({ patients, onPatientClick, onCallClick, loading }: PatientListProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center px-5 py-3 bg-gray-50 border-b text-sm font-medium text-gray-500">
          <div className="w-[5%] min-w-[40px]">유형</div>
          <div className="w-[14%] min-w-[100px]">환자명</div>
          <div className="w-[6%] min-w-[45px]">나이</div>
          <div className="w-[10%] min-w-[95px]">금액</div>
          <div className="w-[14%] min-w-[110px]">전화번호</div>
          <div className="w-[12%] min-w-[80px]">관심시술</div>
          <div className="w-[10%] min-w-[70px]">상태</div>
          <div className="w-[23%] min-w-[150px]">예정일</div>
          <div className="w-[6%] min-w-[50px]"></div>
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <TableSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="py-16 text-center text-gray-400">
          검색 결과가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 테이블 헤더 */}
      <div className="flex items-center px-5 py-3 bg-gray-50 border-b text-sm font-medium text-gray-500">
        <div className="w-[5%] min-w-[40px]">유형</div>
        <div className="w-[14%] min-w-[100px]">환자명</div>
        <div className="w-[6%] min-w-[45px]">나이</div>
        <div className="w-[10%] min-w-[95px]">금액</div>
        <div className="w-[14%] min-w-[110px]">전화번호</div>
        <div className="w-[12%] min-w-[80px]">관심시술</div>
        <div className="w-[10%] min-w-[70px]">상태</div>
        <div className="w-[23%] min-w-[150px]">예정일</div>
        <div className="w-[6%] min-w-[50px]"></div>
      </div>

      {/* 테이블 바디 */}
      <div className="divide-y">
        {patients.map((patient) => {
          const days = patient.daysInStatus ?? getDaysInStatus(patient.createdAt);
          const scheduleDisplay = getScheduleDisplay(
            patient.status,
            patient.nextAction,
            patient.nextActionDate,
            days
          );

          const urgencyStyle = getUrgencyRowStyle(patient.urgency);

          return (
            <div
              key={patient.id}
              onClick={() => onPatientClick?.(patient)}
              className={`flex items-center px-5 py-3 cursor-pointer transition-colors
                ${urgencyStyle || 'hover:bg-gray-50'}
                ${patient.urgency && patient.urgency !== 'normal' ? 'hover:opacity-90' : ''}
              `}
            >
              {/* 수발신 유형 */}
              <div className="w-[5%] min-w-[40px]">
                <CallDirectionIcon direction={patient.lastCallDirection} />
              </div>

              {/* 환자명 + 배지들 */}
              <div className="w-[14%] min-w-[100px] flex items-center gap-1 overflow-hidden">
                <span className="font-medium text-gray-900 truncate">{patient.name}</span>
                {patient.journeys && patient.journeys.length > 1 && (
                  <span className="flex items-center gap-0.5 px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium shrink-0" title={`${patient.journeys.length}개 치료 여정`}>
                    <Layers size={10} />
                    {patient.journeys.length}
                  </span>
                )}
                {patient.status === 'treatment' && (() => {
                  const now = new Date();
                  if (patient.expectedCompletionDate) {
                    return new Date(patient.expectedCompletionDate) < now;
                  }
                  return days >= 30;
                })() && (
                  <span className="flex items-center px-1 py-0.5 bg-orange-100 text-orange-600 rounded text-xs font-medium shrink-0">
                    <AlertTriangle size={10} />
                  </span>
                )}
              </div>

              {/* 나이 */}
              <div className="w-[6%] min-w-[45px] text-sm text-gray-600">
                {patient.age ? `${patient.age}세` : '-'}
              </div>

              {/* 금액 */}
              <div className="w-[10%] min-w-[95px] text-sm">
                {patient.actualAmount ? (
                  <span className={`font-medium ${
                    patient.paymentStatus === 'completed'
                      ? 'text-emerald-600'
                      : patient.paymentStatus === 'partial'
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }`}>
                    {patient.actualAmount.toLocaleString()}원
                  </span>
                ) : patient.estimatedAmount ? (
                  <span className="text-gray-400 text-xs">
                    ({patient.estimatedAmount.toLocaleString()}원)
                  </span>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </div>

              {/* 전화번호 */}
              <div className="w-[14%] min-w-[110px] text-sm text-gray-600">
                {formatPhone(patient.phone)}
              </div>

              {/* 관심시술 */}
              <div className="w-[12%] min-w-[80px]">
                {(() => {
                  const activeJourney = patient.journeys?.find(j => j.isActive);
                  const displayInterest = activeJourney?.treatmentType || patient.interest;

                  if (displayInterest) {
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-xs inline-block max-w-full truncate ${
                        activeJourney ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
                      }`} title={displayInterest}>
                        {displayInterest}
                      </span>
                    );
                  }
                  return <span className="text-gray-300">-</span>;
                })()}
              </div>

              {/* 상태 */}
              <div className="w-[10%] min-w-[70px]">
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusStyle(patient.status)}`}>
                  {getStatusLabel(patient.status)}
                </span>
              </div>

              {/* 예정일 + 메모 */}
              <div className="w-[23%] min-w-[150px] text-sm">
                {patient.nextActionDate ? (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col shrink-0">
                      <span className={`font-medium ${scheduleDisplay.style}`}>
                        {(() => {
                          const date = new Date(patient.nextActionDate);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        })()}
                      </span>
                      <span className={`text-xs ${scheduleDisplay.style}`}>
                        {(() => {
                          const now = new Date();
                          now.setHours(0, 0, 0, 0);
                          const target = new Date(patient.nextActionDate);
                          target.setHours(0, 0, 0, 0);
                          const diff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          if (diff > 0) return `D-${diff}`;
                          if (diff === 0) return 'D-Day';
                          return `D+${Math.abs(diff)}`;
                        })()}
                      </span>
                    </div>
                    {patient.nextActionNote && (
                      <span className="text-xs text-gray-600 bg-amber-50 px-1.5 py-0.5 rounded truncate" title={patient.nextActionNote}>
                        {patient.nextActionNote}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className={`truncate block ${scheduleDisplay.style}`}>
                    {scheduleDisplay.text}
                  </span>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="w-[6%] min-w-[50px] flex justify-end gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCallClick?.(patient);
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-emerald-500"
                >
                  <PhoneCall size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPatientClick?.(patient);
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PatientList;
