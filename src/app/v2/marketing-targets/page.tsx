// src/app/v2/marketing-targets/page.tsx
// 이벤트 타겟 관리 페이지

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Target, MessageSquare, RefreshCw, FileText, History } from 'lucide-react';
import { MarketingTargetFilters, MarketingTargetList } from '@/components/v2/marketing';
import { MarketingTargetReason, MarketingInfo } from '@/types/v2';
import MessageSendModal from '@/components/management/MessageSendModal';
import MessageLogModal from '@/components/management/MessageLogModal';
import TemplateSettings from '@/components/settings/TemplateSettings';
import { Patient } from '@/types/patient';

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

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total: number;
  byReason: Record<string, number>;
}

// 탭 타입 정의
type TabType = 'targets' | 'message-logs' | 'templates';

// V2 MarketingPatient를 V1 Patient 형식으로 변환하는 함수
function convertToV1Patient(marketingPatient: MarketingPatient): Patient {
  return {
    _id: marketingPatient._id,
    id: marketingPatient.id,
    patientId: `PT-${marketingPatient._id.slice(-4).toUpperCase()}`,
    name: marketingPatient.name,
    phoneNumber: marketingPatient.phone,
    interestedServices: marketingPatient.interest ? [marketingPatient.interest] : [],
    lastConsultation: '',
    status: '잠재고객',
    reminderStatus: '-',
    callInDate: marketingPatient.createdAt?.split('T')[0] || '',
    firstConsultDate: '',
    createdAt: marketingPatient.createdAt || '',
    updatedAt: marketingPatient.createdAt || '',
    consultationType: 'outbound',
    consultation: {},
    nextCallbackDate: '',
    // 필수 필드 추가
    isTodayReservationPatient: false,
    paymentAmount: null,
    treatmentCost: null,
    memo: '',
    eventTargetInfo: marketingPatient.marketingInfo ? {
      isEventTarget: marketingPatient.marketingInfo.isTarget,
      targetReason: marketingPatient.marketingInfo.targetReason as any,
      customTargetReason: marketingPatient.marketingInfo.customReason,
      categories: marketingPatient.marketingInfo.categories as any[],
      scheduledDate: marketingPatient.marketingInfo.scheduledDate,
      notes: marketingPatient.marketingInfo.note,
      createdAt: marketingPatient.marketingInfo.createdAt,
      updatedAt: marketingPatient.marketingInfo.updatedAt,
    } : undefined,
  };
}

export default function MarketingTargetsPage() {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>('targets');

  // 필터 상태
  const [search, setSearch] = useState('');
  const [selectedReasons, setSelectedReasons] = useState<MarketingTargetReason[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'scheduledDate' | 'createdAt'>('scheduledDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // 데이터 상태
  const [patients, setPatients] = useState<MarketingPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState<Stats>({ total: 0, byReason: {} });

  // 선택 상태
  const [selectedPatients, setSelectedPatients] = useState<MarketingPatient[]>([]);

  // 모달 상태
  const [isMessageSendModalOpen, setIsMessageSendModalOpen] = useState(false);

  // 데이터 조회
  const fetchPatients = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      if (search) {
        params.set('search', search);
      }

      selectedReasons.forEach((reason) => {
        params.append('reason', reason);
      });

      const response = await fetch(`/api/v2/marketing-targets?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setPatients(data.data.patients);
        setPagination(data.data.pagination);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('이벤트 타겟 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [search, selectedReasons, sortBy, sortOrder]);

  // 검색/필터 변경 시 debounce 적용
  useEffect(() => {
    if (activeTab === 'targets') {
      const timer = setTimeout(() => {
        fetchPatients(1);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [search, selectedReasons, sortBy, sortOrder, activeTab]);

  // 페이지 변경
  const handlePageChange = (page: number) => {
    fetchPatients(page);
  };

  // 새로고침
  const handleRefresh = () => {
    fetchPatients(pagination.page);
  };

  // 문자 발송 모달 열기
  const handleSendMessage = () => {
    if (selectedPatients.length === 0) {
      alert('발송할 환자를 선택해주세요.');
      return;
    }
    setIsMessageSendModalOpen(true);
  };

  // 문자 발송 완료 처리
  const handleSendComplete = () => {
    setSelectedPatients([]);
    fetchPatients(pagination.page);
  };

  // V1 Patient 형식으로 변환된 선택 환자 목록
  const selectedPatientsForModal = selectedPatients.map(convertToV1Patient);

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">이벤트 타겟 관리</h1>
            <p className="text-sm text-gray-500">
              이벤트/프로모션 문자 발송 대상 환자를 관리합니다
            </p>
          </div>
        </div>
        {activeTab === 'targets' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw size={18} />
              새로고침
            </button>
            <button
              onClick={handleSendMessage}
              disabled={selectedPatients.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <MessageSquare size={18} />
              문자 발송 ({selectedPatients.length})
            </button>
          </div>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('targets')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'targets'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Target size={18} />
            이벤트 타겟
          </button>
          <button
            onClick={() => setActiveTab('message-logs')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'message-logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <History size={18} />
            문자발송 내역
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText size={18} />
            메시지 템플릿
          </button>
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'targets' && (
        <>
          {/* 필터 */}
          <MarketingTargetFilters
            search={search}
            onSearchChange={setSearch}
            selectedReasons={selectedReasons}
            onReasonsChange={setSelectedReasons}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            stats={stats}
          />

          {/* 목록 */}
          <MarketingTargetList
            patients={patients}
            loading={loading}
            pagination={pagination}
            onPageChange={handlePageChange}
            onRefresh={handleRefresh}
            selectedPatients={selectedPatients}
            onSelectionChange={setSelectedPatients}
          />
        </>
      )}

      {activeTab === 'message-logs' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <MessageLogModal
            isOpen={true}
            onClose={() => {}}
            embedded={true}
          />
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <TemplateSettings />
        </div>
      )}

      {/* 문자 발송 모달 */}
      <MessageSendModal
        isOpen={isMessageSendModalOpen}
        onClose={() => setIsMessageSendModalOpen(false)}
        selectedPatients={selectedPatientsForModal}
        onSendComplete={handleSendComplete}
      />
    </div>
  );
}
