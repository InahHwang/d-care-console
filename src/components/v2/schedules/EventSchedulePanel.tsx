// src/components/v2/schedules/EventSchedulePanel.tsx
// 일정관리 - 이벤트 탭 패널

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Target,
  Phone,
  MessageSquare,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { MarketingInfo, MarketingTargetReason } from '@/types/v2';
import { MARKETING_TARGET_REASON_OPTIONS } from '@/types/v2';

interface EventPatient {
  id: string;
  name: string;
  phone: string;
  marketingInfo: MarketingInfo;
}

interface EventSchedulePanelProps {
  selectedDate: string;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const isOverdue = (dateStr?: string) => {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate < today;
};

const isToday = (dateStr?: string) => {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate.getTime() === today.getTime();
};

const getReasonLabel = (reason: MarketingTargetReason, customReason?: string) => {
  if (reason === 'other' && customReason) {
    return customReason;
  }
  const option = MARKETING_TARGET_REASON_OPTIONS.find((opt) => opt.value === reason);
  return option?.label || reason;
};

type FilterType = 'all' | 'overdue' | 'today' | 'upcoming';

export function EventSchedulePanel({ selectedDate }: EventSchedulePanelProps) {
  const router = useRouter();
  const [patients, setPatients] = useState<EventPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedPatient, setSelectedPatient] = useState<EventPatient | null>(null);
  const [stats, setStats] = useState({ total: 0, overdue: 0, today: 0, upcoming: 0 });

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v2/marketing-targets?limit=100&sortBy=scheduledDate&sortOrder=asc');
      const data = await response.json();

      if (data.success) {
        const allPatients: EventPatient[] = data.data.patients;
        setPatients(allPatients);

        // 통계 계산
        let overdueCount = 0;
        let todayCount = 0;
        let upcomingCount = 0;

        allPatients.forEach((p) => {
          const schedDate = p.marketingInfo?.scheduledDate;
          if (isOverdue(schedDate)) {
            overdueCount++;
          } else if (isToday(schedDate)) {
            todayCount++;
          } else if (schedDate) {
            upcomingCount++;
          }
        });

        setStats({
          total: allPatients.length,
          overdue: overdueCount,
          today: todayCount,
          upcoming: upcomingCount,
        });
      }
    } catch (error) {
      console.error('이벤트 타겟 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // 필터링된 환자 목록
  const filteredPatients = patients.filter((p) => {
    const schedDate = p.marketingInfo?.scheduledDate;
    switch (filter) {
      case 'overdue':
        return isOverdue(schedDate);
      case 'today':
        return isToday(schedDate);
      case 'upcoming':
        return schedDate && !isOverdue(schedDate) && !isToday(schedDate);
      default:
        return true;
    }
  });

  // 첫 번째 항목 자동 선택
  useEffect(() => {
    if (filteredPatients.length > 0 && !selectedPatient) {
      setSelectedPatient(filteredPatients[0]);
    }
  }, [filteredPatients, selectedPatient]);

  const handleCall = (phone: string) => {
    window.dispatchEvent(new CustomEvent('cti-call', { detail: { phone } }));
  };

  const handlePatientClick = (patientId: string) => {
    router.push(`/v2/patients/${patientId}`);
  };

  const filterButtons = [
    { id: 'all' as const, label: '전체', count: stats.total, color: 'bg-gray-900' },
    { id: 'overdue' as const, label: '지남', count: stats.overdue, color: 'bg-red-500', icon: AlertTriangle },
    { id: 'today' as const, label: '오늘', count: stats.today, color: 'bg-blue-500', icon: Clock },
    { id: 'upcoming' as const, label: '예정', count: stats.upcoming, color: 'bg-emerald-500', icon: Calendar },
  ];

  return (
    <div className="flex-1 flex gap-4 min-h-0">
      {/* 좌측: 목록 */}
      <div className="w-80 flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* 필터 */}
        <div className="p-3 border-b flex items-center gap-2">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => { setFilter(btn.id); setSelectedPatient(null); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                filter === btn.id
                  ? `${btn.color} text-white`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {btn.icon && <btn.icon size={12} />}
              {btn.label}
              <span className={`ml-0.5 ${filter === btn.id ? 'opacity-80' : ''}`}>
                {btn.count}
              </span>
            </button>
          ))}
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-8 text-center">
              <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {filter === 'overdue' ? '지난 일정이 없습니다' :
                 filter === 'today' ? '오늘 예정된 발송이 없습니다' :
                 filter === 'upcoming' ? '예정된 발송이 없습니다' :
                 '이벤트 타겟이 없습니다'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {filteredPatients.map((patient, idx) => {
                const schedDate = patient.marketingInfo?.scheduledDate;
                const overdue = isOverdue(schedDate);
                const today = isToday(schedDate);

                return (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                      selectedPatient?.id === patient.id
                        ? 'bg-orange-50 border border-orange-200'
                        : overdue
                        ? 'bg-red-50 hover:bg-red-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 타임라인 인디케이터 */}
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          overdue ? 'bg-red-500' :
                          today ? 'bg-blue-500' : 'bg-emerald-500'
                        }`} />
                        {idx < filteredPatients.length - 1 && (
                          <div className="w-0.5 h-12 bg-gray-200 mt-1" />
                        )}
                      </div>
                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">{patient.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            overdue ? 'bg-red-100 text-red-700' :
                            today ? 'bg-blue-100 text-blue-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {overdue ? '지남' : today ? '오늘' : formatDate(schedDate)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {getReasonLabel(patient.marketingInfo.targetReason, patient.marketingInfo.customReason)}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{patient.phone}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 우측: 상세 패널 */}
      <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
        {selectedPatient ? (
          <EventDetailPanel
            patient={selectedPatient}
            onCall={handleCall}
            onPatientClick={handlePatientClick}
            onRemove={() => {
              setSelectedPatient(null);
              fetchPatients();
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Target size={48} className="mx-auto mb-3 opacity-30" />
              <p>좌측에서 이벤트 타겟을 선택하세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 상세 패널
function EventDetailPanel({
  patient,
  onCall,
  onPatientClick,
  onRemove,
}: {
  patient: EventPatient;
  onCall: (phone: string) => void;
  onPatientClick: (id: string) => void;
  onRemove: () => void;
}) {
  const { marketingInfo } = patient;
  const overdue = isOverdue(marketingInfo.scheduledDate);
  const today = isToday(marketingInfo.scheduledDate);

  const handleRemoveTarget = async () => {
    if (!confirm('이벤트 타겟에서 해제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/v2/patients/${patient.id}/marketing-target`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onRemove();
      }
    } catch (error) {
      console.error('타겟 해제 실패:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-6 border-b">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
              <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${
                overdue ? 'bg-red-100 text-red-700' :
                today ? 'bg-blue-100 text-blue-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {overdue ? '지난 일정' : today ? '오늘 예정' : '예정됨'}
              </span>
            </div>
            <p className="text-lg text-gray-600">{patient.phone}</p>
          </div>
          <button
            onClick={() => onPatientClick(patient.id)}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            환자 상세 →
          </button>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onCall(patient.phone)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            <Phone size={20} />
            전화하기
          </button>
          <button
            onClick={() => window.open(`/v2/marketing-targets`, '_blank')}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors"
          >
            <MessageSquare size={20} />
            문자 발송
          </button>
          <button
            onClick={handleRemoveTarget}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
          >
            <CheckCircle size={20} />
            타겟 해제
          </button>
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* 발송 예정일 */}
          {marketingInfo.scheduledDate && (
            <div className={`rounded-xl p-4 ${overdue ? 'bg-red-50' : today ? 'bg-blue-50' : 'bg-emerald-50'}`}>
              <div className="flex items-center gap-3">
                {overdue ? (
                  <AlertTriangle className="text-red-600" size={24} />
                ) : today ? (
                  <Clock className="text-blue-600" size={24} />
                ) : (
                  <Calendar className="text-emerald-600" size={24} />
                )}
                <div>
                  <div className={`text-sm ${overdue ? 'text-red-600' : today ? 'text-blue-600' : 'text-emerald-600'}`}>
                    발송 예정일
                  </div>
                  <div className={`text-lg font-bold ${overdue ? 'text-red-700' : today ? 'text-blue-700' : 'text-emerald-700'}`}>
                    {new Date(marketingInfo.scheduledDate).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {overdue && ' (지남)'}
                    {today && ' (오늘)'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 타겟 사유 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">타겟 사유</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <span className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                {getReasonLabel(marketingInfo.targetReason, marketingInfo.customReason)}
              </span>
            </div>
          </div>

          {/* 카테고리 */}
          {marketingInfo.categories && marketingInfo.categories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">카테고리</h3>
              <div className="bg-gray-50 rounded-xl p-4 flex flex-wrap gap-2">
                {marketingInfo.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 메모 */}
          {marketingInfo.note && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">메모</h3>
              <div className="bg-amber-50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare size={18} className="text-amber-600 mt-0.5" />
                  <p className="text-gray-900">{marketingInfo.note}</p>
                </div>
              </div>
            </div>
          )}

          {/* 지정 정보 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">지정 정보</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">지정일</span>
                <span className="text-gray-900">{formatDate(marketingInfo.createdAt)}</span>
              </div>
              {marketingInfo.createdBy && (
                <div className="flex justify-between">
                  <span className="text-gray-500">지정자</span>
                  <span className="text-gray-900">{marketingInfo.createdBy}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventSchedulePanel;
