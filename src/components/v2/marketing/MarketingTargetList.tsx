// src/components/v2/marketing/MarketingTargetList.tsx
// 이벤트 타겟 환자 목록 컴포넌트

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import {
  MarketingTargetReason,
  MARKETING_TARGET_REASON_OPTIONS,
  MarketingInfo,
} from '@/types/v2';

interface MarketingPatient {
  id: string;
  _id: string;
  name: string;
  phone: string;
  status: string;
  temperature: string;
  interest?: string;
  marketingInfo: MarketingInfo;
  createdAt: string;
}

interface MarketingTargetListProps {
  patients: MarketingPatient[];
  loading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  selectedPatients: MarketingPatient[];
  onSelectionChange: (patients: MarketingPatient[]) => void;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const formatFullDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

// 지정일이 오늘 이전인지 확인 (지난 일정)
const isOverdue = (dateStr?: string) => {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate < today;
};

// 지정일이 오늘인지 확인
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

export function MarketingTargetList({
  patients,
  loading,
  pagination,
  onPageChange,
  onRefresh,
  selectedPatients,
  onSelectionChange,
}: MarketingTargetListProps) {
  const router = useRouter();

  // 전체 선택 상태
  const allSelected =
    patients.length > 0 &&
    patients.every((p) => selectedPatients.some((sp) => sp.id === p.id));

  const handleSelectAll = () => {
    if (allSelected) {
      // 현재 페이지 환자들 선택 해제
      onSelectionChange(
        selectedPatients.filter(
          (sp) => !patients.some((p) => p.id === sp.id)
        )
      );
    } else {
      // 현재 페이지 환자들 선택 추가
      const newSelection = [...selectedPatients];
      patients.forEach((p) => {
        if (!newSelection.some((sp) => sp.id === p.id)) {
          newSelection.push(p);
        }
      });
      onSelectionChange(newSelection);
    }
  };

  const handleSelectPatient = (patient: MarketingPatient) => {
    const isSelected = selectedPatients.some((sp) => sp.id === patient.id);
    if (isSelected) {
      onSelectionChange(selectedPatients.filter((sp) => sp.id !== patient.id));
    } else {
      onSelectionChange([...selectedPatients, patient]);
    }
  };

  const handleRowClick = (patientId: string) => {
    router.push(`/v2/patients/${patientId}`);
  };

  const handleRemoveTarget = async (
    e: React.MouseEvent,
    patientId: string
  ) => {
    e.stopPropagation();
    if (!confirm('이벤트 타겟에서 해제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/v2/patients/${patientId}/marketing-target`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('타겟 해제 실패:', error);
    }
  };

  // 페이지네이션 렌더링
  const renderPagination = () => {
    const { page, totalPages, total } = pagination;

    if (totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="text-sm text-gray-500">
          총 {total}명 중 {(page - 1) * pagination.limit + 1}-
          {Math.min(page * pagination.limit, total)}명
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          {pages.map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={idx}
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 rounded text-sm ${
                  p === page
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="px-1 text-gray-400">
                {p}
              </span>
            )
          )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border">
        <div className="p-8 text-center text-gray-500">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
          로딩 중...
        </div>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-xl border">
        <div className="p-8 text-center text-gray-500">
          이벤트 타겟으로 지정된 환자가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* 선택 정보 */}
      {selectedPatients.length > 0 && (
        <div className="px-4 py-3 bg-blue-50 border-b flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">
            {selectedPatients.length}명 선택됨
          </span>
          <button
            onClick={() => onSelectionChange([])}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                환자명
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                연락처
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                타겟 사유
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                카테고리
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                발송예정일
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                지정일
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {patients.map((patient) => {
              const isSelected = selectedPatients.some(
                (sp) => sp.id === patient.id
              );
              const { marketingInfo } = patient;
              const overdue = isOverdue(marketingInfo.scheduledDate);
              const todaySchedule = isToday(marketingInfo.scheduledDate);

              return (
                <tr
                  key={patient.id}
                  onClick={() => handleRowClick(patient.id)}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50' : overdue ? 'bg-red-50' : ''
                  }`}
                >
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectPatient(patient)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {patient.name}
                      </span>
                      <ExternalLink
                        size={14}
                        className="text-gray-400"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {patient.phone}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                      {getReasonLabel(
                        marketingInfo.targetReason,
                        marketingInfo.customReason
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {marketingInfo.categories?.slice(0, 2).map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600"
                        >
                          {cat}
                        </span>
                      ))}
                      {marketingInfo.categories?.length > 2 && (
                        <span className="text-xs text-gray-400">
                          +{marketingInfo.categories.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {marketingInfo.scheduledDate ? (
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          overdue
                            ? 'bg-red-100 text-red-700'
                            : todaySchedule
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600'
                        }`}
                      >
                        {overdue && '⚠️ '}
                        {formatFullDate(marketingInfo.scheduledDate)}
                        {overdue && ' (지남)'}
                        {todaySchedule && ' (오늘)'}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(marketingInfo.createdAt)}
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => handleRemoveTarget(e, patient.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="타겟 해제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {renderPagination()}
    </div>
  );
}

export default MarketingTargetList;
