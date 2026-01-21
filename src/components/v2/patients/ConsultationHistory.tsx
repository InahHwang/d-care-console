// src/components/v2/patients/ConsultationHistory.tsx
// 환자별 상담 이력 컴포넌트
'use client';

import React from 'react';
import { Phone, Building, Check, XCircle, Clock, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface ConsultationRecord {
  id: string;
  type?: 'phone' | 'visit';  // optional for backwards compatibility
  status: 'agreed' | 'disagreed' | 'pending';
  treatment: string;
  originalAmount: number;
  finalAmount: number;
  disagreeReasons?: string[];
  correctionPlan?: string;
  appointmentDate?: string;
  callbackDate?: string;
  consultantName: string;
  memo?: string;
  date: string;
  createdAt: string;
}

interface ConsultationHistoryProps {
  consultations: ConsultationRecord[];
  loading?: boolean;
}

const STATUS_CONFIG = {
  agreed: { label: '동의', icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  disagreed: { label: '미동의', icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-100' },
  pending: { label: '보류', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
};

const TYPE_CONFIG = {
  phone: { label: '전화', icon: Phone, color: 'text-blue-600' },
  visit: { label: '내원', icon: Building, color: 'text-purple-600' },
};

export function ConsultationHistory({ consultations, loading }: ConsultationHistoryProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-400">
        상담 이력 로딩 중...
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        상담 이력이 없습니다
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-700">
          상담 이력 ({consultations.length}회)
        </h4>
      </div>

      <div className="space-y-2">
        {consultations.map((consultation, index) => {
          const statusConfig = STATUS_CONFIG[consultation.status] || STATUS_CONFIG.pending;
          const typeConfig = TYPE_CONFIG[consultation.type || 'phone'] || TYPE_CONFIG.phone;  // default to phone
          const StatusIcon = statusConfig.icon;
          const TypeIcon = typeConfig.icon;
          const isExpanded = expandedId === consultation.id;
          const consultNumber = consultations.length - index;

          return (
            <div
              key={consultation.id}
              className="border rounded-lg overflow-hidden"
            >
              {/* 요약 행 */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : consultation.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
              >
                {/* 회차 */}
                <span className="text-sm font-medium text-gray-500 w-8">
                  {consultNumber}차
                </span>

                {/* 날짜 */}
                <span className="text-sm text-gray-600 w-12">
                  {formatDate(consultation.date)}
                </span>

                {/* 유형 */}
                <span className={`flex items-center gap-1 text-sm ${typeConfig.color}`}>
                  <TypeIcon className="w-4 h-4" />
                  {typeConfig.label}
                </span>

                {/* 상태 */}
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm ${statusConfig.bg} ${statusConfig.color}`}>
                  <StatusIcon className="w-4 h-4" />
                  {statusConfig.label}
                </span>

                {/* 결과 요약 */}
                <span className="flex-1 text-sm text-gray-600 text-left truncate">
                  {consultation.status === 'agreed' && consultation.appointmentDate && (
                    <>예약 {formatDate(consultation.appointmentDate)}</>
                  )}
                  {consultation.status === 'disagreed' && consultation.disagreeReasons?.length && (
                    <>"{consultation.disagreeReasons[0]}"</>
                  )}
                  {consultation.status === 'pending' && consultation.callbackDate && (
                    <>콜백 {formatDate(consultation.callbackDate)}</>
                  )}
                </span>

                {/* 확장 아이콘 */}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* 상세 내용 */}
              {isExpanded && (
                <div className="px-4 py-3 bg-gray-50 border-t space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">상담일:</span>{' '}
                      <span className="font-medium">{formatFullDate(consultation.date)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">담당자:</span>{' '}
                      <span className="font-medium">{consultation.consultantName}</span>
                    </div>
                    {consultation.treatment && (
                      <div>
                        <span className="text-gray-500">관심 치료:</span>{' '}
                        <span className="font-medium">{consultation.treatment}</span>
                      </div>
                    )}
                    {consultation.originalAmount > 0 && (
                      <div>
                        <span className="text-gray-500">금액:</span>{' '}
                        <span className="font-medium">
                          {consultation.finalAmount > 0
                            ? `${consultation.finalAmount.toLocaleString()}원`
                            : `${consultation.originalAmount.toLocaleString()}원`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 미동의 사유 */}
                  {consultation.status === 'disagreed' && consultation.disagreeReasons && consultation.disagreeReasons.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-500">미동의 사유:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {consultation.disagreeReasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 시정 계획 */}
                  {consultation.correctionPlan && (
                    <div>
                      <span className="text-sm text-gray-500">시정 계획:</span>
                      <p className="text-sm mt-1 p-2 bg-white rounded border">
                        {consultation.correctionPlan}
                      </p>
                    </div>
                  )}

                  {/* 예약일 / 콜백일 */}
                  {consultation.appointmentDate && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600">
                      <Calendar className="w-4 h-4" />
                      예약일: {formatFullDate(consultation.appointmentDate)}
                    </div>
                  )}
                  {consultation.callbackDate && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <Calendar className="w-4 h-4" />
                      콜백 예정: {formatFullDate(consultation.callbackDate)}
                    </div>
                  )}

                  {/* 메모 */}
                  {consultation.memo && (
                    <div>
                      <span className="text-sm text-gray-500">메모:</span>
                      <p className="text-sm mt-1 p-2 bg-white rounded border text-gray-600">
                        {consultation.memo}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
