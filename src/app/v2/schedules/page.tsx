// src/app/v2/schedules/page.tsx
'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Phone,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  History,
  PhoneMissed,
  Send,
  RefreshCw,
  MessageSquare,
  X,
  Check,
} from 'lucide-react';
import { TemperatureIcon } from '@/components/v2/common/TemperatureIcon';
import type { Temperature, CallbackType, CallbackStatus } from '@/types/v2';

// ============= Types =============
interface CallbackItem {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientInterest: string;
  patientTemperature: Temperature;
  patientStatus: string;
  type: CallbackType;
  scheduledAt: string;
  status: CallbackStatus;
  note?: string;
  completedAt?: string;
}

interface TodayStats {
  total: number;
  pending: number;
  completed: number;
  missed: number;
  callback: number;
  recall: number;
}

interface RecallSchedule {
  id: string;
  timing: string;
  timingDays: number;
  message: string;
  enabled: boolean;
}

interface RecallSetting {
  id: string;
  treatment: string;
  schedules: RecallSchedule[];
}

interface RecallMessage {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  treatment: string;
  timing: string;
  status: string;
  scheduledAt: string;
  sentAt?: string;
  bookedAt?: string;
  lastVisit: string;
  daysPassed?: number;
}


// ============= Constants =============
type RecallSubTab = 'pending' | 'history' | 'call-needed';

const TIMING_OPTIONS = [
  { label: '1주 후', days: 7 },
  { label: '2주 후', days: 14 },
  { label: '1개월 후', days: 30 },
  { label: '3개월 후', days: 90 },
  { label: '6개월 후', days: 180 },
  { label: '1년 후', days: 365 },
];

// ============= Main Component =============
function SchedulesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as 'callback' | 'recall' | null;

  // Main state
  const [activeTab, setActiveTab] = useState<'callback' | 'recall'>(tabParam || 'callback');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<CallbackStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Callback state
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Recall state
  const [recallSubTab, setRecallSubTab] = useState<RecallSubTab>('pending');
  const [recallSettings, setRecallSettings] = useState<RecallSetting[]>([]);
  const [recallMessages, setRecallMessages] = useState<RecallMessage[]>([]);
  const [recallStats, setRecallStats] = useState({ pending: 0, sent: 0, booked: 0, noResponse: 0, callNeeded: 0 });
  const [showAddTreatmentModal, setShowAddTreatmentModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<{ settingId: string; schedule?: RecallSchedule } | null>(null);

  // ============= Callbacks API =============
  const fetchCallbacks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('date', selectedDate);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/v2/callbacks?${params}`);
      const result = await response.json();

      if (result.success) {
        let filtered = result.data.callbacks.filter((c: CallbackItem) => c.type === 'callback');
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter((c: CallbackItem) =>
            c.patientName.toLowerCase().includes(q) || c.patientPhone.includes(searchQuery)
          );
        }
        setCallbacks(filtered);
        setTodayStats(result.data.todayStats);
      }
    } catch (error) {
      console.error('Failed to fetch callbacks:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter, searchQuery]);

  // ============= Recall Settings API =============
  const fetchRecallSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/recall-settings');
      const result = await response.json();
      if (result.success) {
        setRecallSettings(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch recall settings:', error);
    }
  }, []);

  // ============= Recall Messages API =============
  const fetchRecallMessages = useCallback(async (status?: string) => {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);

      const response = await fetch(`/api/v2/recall-messages?${params}`);
      const result = await response.json();

      if (result.success) {
        setRecallMessages(result.data.messages);
        setRecallStats(result.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch recall messages:', error);
    }
  }, []);

  // ============= Effects =============
  useEffect(() => {
    if (activeTab === 'callback') {
      fetchCallbacks();
    } else if (activeTab === 'recall') {
      if (recallSubTab === 'pending') {
        fetchRecallMessages('pending');
      } else if (recallSubTab === 'history') {
        fetchRecallMessages();
      } else if (recallSubTab === 'call-needed') {
        fetchRecallMessages('call-needed');
      }
    }
  }, [activeTab, recallSubTab, fetchCallbacks, fetchRecallMessages]);

  // ============= Handlers =============
  const handleDateChange = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleCall = (phone: string) => {
    window.dispatchEvent(new CustomEvent('cti-call', { detail: { phone } }));
  };

  const handleCallbackStatusChange = async (id: string, status: CallbackStatus) => {
    try {
      const response = await fetch('/api/v2/callbacks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (response.ok) {
        fetchCallbacks();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleRecallSend = async (id: string) => {
    try {
      const response = await fetch(`/api/v2/recall-messages/${id}/send`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchRecallMessages('pending');
        alert('알림톡이 발송되었습니다 (Mock)');
      }
    } catch (error) {
      console.error('Failed to send:', error);
    }
  };

  const handleRecallCancel = async (id: string) => {
    if (!confirm('이 리콜 일정을 제거하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/v2/recall-messages/${id}/cancel`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchRecallMessages('pending');
      }
    } catch (error) {
      console.error('Failed to cancel:', error);
    }
  };

  const handleRecallComplete = async (id: string) => {
    try {
      const response = await fetch(`/api/v2/recall-messages/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'contacted' }),
      });
      if (response.ok) {
        fetchRecallMessages('call-needed');
      }
    } catch (error) {
      console.error('Failed to complete:', error);
    }
  };

  const handleAddTreatment = async (treatment: string) => {
    try {
      const response = await fetch('/api/v2/recall-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treatment, schedules: [] }),
      });
      if (response.ok) {
        setShowAddTreatmentModal(false);
        fetchRecallSettings();
      }
    } catch (error) {
      console.error('Failed to add treatment:', error);
    }
  };

  const handleDeleteTreatment = async (id: string) => {
    if (!confirm('이 치료 설정을 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/v2/recall-settings?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchRecallSettings();
      }
    } catch (error) {
      console.error('Failed to delete treatment:', error);
    }
  };

  const handleSaveSchedule = async (settingId: string, schedule: RecallSchedule, isNew: boolean) => {
    try {
      const setting = recallSettings.find(s => s.id === settingId);
      if (!setting) return;

      let newSchedules: RecallSchedule[];
      if (isNew) {
        newSchedules = [...setting.schedules, { ...schedule, id: Date.now().toString() }];
      } else {
        newSchedules = setting.schedules.map(s => s.id === schedule.id ? schedule : s);
      }

      const response = await fetch('/api/v2/recall-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: settingId, schedules: newSchedules }),
      });

      if (response.ok) {
        setEditingSchedule(null);
        fetchRecallSettings();
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const handleDeleteSchedule = async (settingId: string, scheduleId: string) => {
    try {
      const setting = recallSettings.find(s => s.id === settingId);
      if (!setting) return;

      const newSchedules = setting.schedules.filter(s => s.id !== scheduleId);

      const response = await fetch('/api/v2/recall-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: settingId, schedules: newSchedules }),
      });

      if (response.ok) {
        fetchRecallSettings();
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handleToggleSchedule = async (settingId: string, scheduleId: string, enabled: boolean) => {
    try {
      const setting = recallSettings.find(s => s.id === settingId);
      if (!setting) return;

      const newSchedules = setting.schedules.map(s =>
        s.id === scheduleId ? { ...s, enabled } : s
      );

      const response = await fetch('/api/v2/recall-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: settingId, schedules: newSchedules }),
      });

      if (response.ok) {
        fetchRecallSettings();
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const handlePatientClick = (patientId: string) => {
    router.push(`/v2/patients/${patientId}`);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    const diff = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return '오늘';
    if (diff === 1) return '내일';
    if (diff === -1) return '어제';
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  };

  const tabs = [
    { id: 'callback' as const, label: '콜백', icon: <Phone size={18} />, count: todayStats?.callback ?? 0 },
    { id: 'recall' as const, label: '리콜', icon: <RefreshCw size={18} />, count: recallStats.pending + recallStats.callNeeded },
  ];

  const recallSubTabs = [
    { id: 'pending' as const, label: '발송 대기', icon: <Clock size={16} />, count: recallStats.pending },
    { id: 'history' as const, label: '발송 이력', icon: <History size={16} /> },
    { id: 'call-needed' as const, label: '전화 필요', icon: <PhoneMissed size={16} />, count: recallStats.callNeeded },
  ];

  // 선택된 콜백/리콜 항목
  const [selectedItem, setSelectedItem] = useState<CallbackItem | null>(null);
  const [selectedRecallItem, setSelectedRecallItem] = useState<RecallMessage | null>(null);

  // 첫 번째 항목 자동 선택 (콜백)
  useEffect(() => {
    if (callbacks.length > 0 && !selectedItem) {
      setSelectedItem(callbacks[0]);
    }
  }, [callbacks, selectedItem]);

  // 첫 번째 항목 자동 선택 (리콜)
  useEffect(() => {
    if (recallMessages.length > 0 && !selectedRecallItem) {
      setSelectedRecallItem(recallMessages[0]);
    }
  }, [recallMessages, selectedRecallItem]);

  // ============= Render =============
  return (
    <div className="p-6 space-y-4 h-[calc(100vh-64px)] flex flex-col">
      {/* 상단 헤더 + 컴팩트 통계 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-gray-900">일정 관리</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Phone size={14} className="text-blue-600" />
              <span className="text-gray-500">콜백</span>
              <span className="font-bold text-gray-900">{todayStats?.callback ?? 0}</span>
              <span className="text-amber-600">({todayStats?.pending ?? 0}대기)</span>
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1.5">
              <RefreshCw size={14} className="text-purple-600" />
              <span className="text-gray-500">리콜</span>
              <span className="font-bold text-gray-900">{recallStats.pending + recallStats.callNeeded}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 날짜 네비게이션 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
            <button onClick={() => handleDateChange(-1)} className="p-1 hover:bg-gray-200 rounded">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium min-w-[90px] text-center">{formatDateLabel(selectedDate)}</span>
            <button onClick={() => handleDateChange(1)} className="p-1 hover:bg-gray-200 rounded">
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} />
            일정 추가
          </button>
        </div>
      </div>

      {/* 메인 탭 */}
      <div className="flex items-center gap-1 border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedItem(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium transition-colors relative ${
              activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {tab.count}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      {/* 콜백 탭: 타임라인 + 상세 */}
      {activeTab === 'callback' && (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* 좌측: 타임라인 */}
          <div className="w-80 flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* 필터 */}
            <div className="p-3 border-b flex items-center gap-2">
              {(['all', 'pending', 'completed', 'missed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? status === 'pending' ? 'bg-amber-500 text-white'
                        : status === 'completed' ? 'bg-emerald-500 text-white'
                        : status === 'missed' ? 'bg-red-500 text-white'
                        : 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? '전체' : status === 'pending' ? '대기' : status === 'completed' ? '완료' : '미연결'}
                </button>
              ))}
            </div>
            {/* 타임라인 목록 */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">로딩 중...</div>
              ) : callbacks.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">등록된 콜백이 없습니다</p>
                </div>
              ) : (
                <div className="p-2">
                  {callbacks.map((callback, idx) => (
                    <button
                      key={callback.id}
                      onClick={() => setSelectedItem(callback)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                        selectedItem?.id === callback.id
                          ? 'bg-blue-50 border border-blue-200'
                          : callback.status === 'completed'
                          ? 'bg-gray-50 opacity-60 hover:bg-gray-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 타임라인 인디케이터 */}
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${
                            callback.status === 'completed' ? 'bg-emerald-500' :
                            callback.status === 'missed' ? 'bg-red-500' : 'bg-blue-500'
                          }`} />
                          {idx < callbacks.length - 1 && (
                            <div className="w-0.5 h-12 bg-gray-200 mt-1" />
                          )}
                        </div>
                        {/* 내용 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-gray-900">{formatTime(callback.scheduledAt)}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              callback.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              callback.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {callback.status === 'pending' ? '대기' : callback.status === 'completed' ? '완료' : '미연결'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900 truncate">{callback.patientName}</span>
                            <TemperatureIcon temperature={callback.patientTemperature} size={14} />
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{callback.patientInterest}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 우측: 상세 패널 */}
          <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
            {selectedItem ? (
              <CallbackDetailPanel
                callback={selectedItem}
                onCall={handleCall}
                onStatusChange={handleCallbackStatusChange}
                onPatientClick={handlePatientClick}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Phone size={48} className="mx-auto mb-3 opacity-30" />
                  <p>좌측에서 콜백을 선택하세요</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 리콜 탭: 타임라인 + 상세 */}
      {activeTab === 'recall' && (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* 좌측: 리콜 목록 */}
          <div className="w-96 flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* 서브탭 */}
            <div className="p-3 border-b flex items-center gap-2">
              {recallSubTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setRecallSubTab(tab.id); setSelectedRecallItem(null); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    recallSubTab === tab.id
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`px-1 py-0.5 rounded-full text-xs ${
                      recallSubTab === tab.id ? 'bg-purple-200' : 'bg-gray-200'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* 리콜 목록 */}
            <div className="flex-1 overflow-y-auto">
              {recallMessages.length === 0 ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {recallSubTab === 'pending' ? '발송 대기 중인 리콜이 없습니다' :
                     recallSubTab === 'call-needed' ? '전화가 필요한 환자가 없습니다' :
                     '발송 이력이 없습니다'}
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {recallMessages.map((msg, idx) => (
                    <button
                      key={msg.id}
                      onClick={() => setSelectedRecallItem(msg)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                        selectedRecallItem?.id === msg.id
                          ? 'bg-purple-50 border border-purple-200'
                          : msg.status === 'booked'
                          ? 'bg-gray-50 opacity-60 hover:bg-gray-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 타임라인 인디케이터 */}
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${
                            msg.status === 'booked' ? 'bg-emerald-500' :
                            msg.status === 'call-needed' || msg.status === 'no-response' ? 'bg-red-500' :
                            'bg-purple-500'
                          }`} />
                          {idx < recallMessages.length - 1 && (
                            <div className="w-0.5 h-12 bg-gray-200 mt-1" />
                          )}
                        </div>
                        {/* 내용 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 truncate">{msg.patientName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              msg.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              msg.status === 'booked' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {msg.status === 'pending' ? '대기' :
                               msg.status === 'booked' ? '예약완료' :
                               msg.status === 'call-needed' ? '전화필요' : '미응답'}
                            </span>
                          </div>
                          <div className="text-xs text-purple-600 font-medium">{msg.treatment} {msg.timing}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{msg.patientPhone}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 우측: 상세 패널 */}
          <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
            {selectedRecallItem ? (
              <RecallDetailPanel
                recall={selectedRecallItem}
                allRecalls={recallMessages}
                onCall={handleCall}
                onSend={handleRecallSend}
                onCancel={handleRecallCancel}
                onComplete={handleRecallComplete}
                onSelectRecall={setSelectedRecallItem}
                formatDate={formatDate}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <RefreshCw size={48} className="mx-auto mb-3 opacity-30" />
                  <p>좌측에서 리콜을 선택하세요</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 모달들 */}
      {showAddModal && (
        <AddCallbackModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchCallbacks();
          }}
        />
      )}

      {showAddTreatmentModal && (
        <AddTreatmentModal
          onClose={() => setShowAddTreatmentModal(false)}
          onAdd={handleAddTreatment}
        />
      )}

      {editingSchedule && (
        <EditScheduleModal
          settingId={editingSchedule.settingId}
          schedule={editingSchedule.schedule}
          onClose={() => setEditingSchedule(null)}
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  );
}

// ============= Sub Components =============

// 콜백 상세 패널 컴포넌트
function CallbackDetailPanel({
  callback,
  onCall,
  onStatusChange,
  onPatientClick,
}: {
  callback: CallbackItem;
  onCall: (phone: string) => void;
  onStatusChange: (id: string, status: CallbackStatus) => void;
  onPatientClick: (id: string) => void;
}) {
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-6 border-b">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{callback.patientName}</h2>
              <TemperatureIcon temperature={callback.patientTemperature} size={20} />
              <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${
                callback.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                callback.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                'bg-red-100 text-red-700'
              }`}>
                {callback.status === 'pending' ? '대기' : callback.status === 'completed' ? '완료' : '미연결'}
              </span>
            </div>
            <p className="text-lg text-gray-600">{callback.patientPhone}</p>
          </div>
          <button
            onClick={() => onPatientClick(callback.patientId)}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            환자 상세 →
          </button>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-3">
          {callback.status === 'pending' && (
            <>
              <button
                onClick={() => onCall(callback.patientPhone)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                <Phone size={20} />
                전화하기
              </button>
              <button
                onClick={() => onStatusChange(callback.id, 'completed')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle size={20} />
                완료
              </button>
              <button
                onClick={() => onStatusChange(callback.id, 'missed')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                <XCircle size={20} />
                미연결
              </button>
            </>
          )}
          {callback.status === 'missed' && (
            <>
              <button
                onClick={() => onCall(callback.patientPhone)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                <Phone size={20} />
                재시도
              </button>
              <button
                onClick={() => onStatusChange(callback.id, 'pending')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
              >
                <RefreshCw size={20} />
                대기로 변경
              </button>
            </>
          )}
          {callback.status === 'completed' && (
            <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl">
              <CheckCircle size={20} />
              {callback.completedAt ? `${callback.completedAt.slice(0, 16).replace('T', ' ')} 완료` : '완료됨'}
            </div>
          )}
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* 예약 정보 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">콜백 정보</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">예정 시간</div>
                  <div className="font-medium text-gray-900">{formatDateTime(callback.scheduledAt)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">관심 분야</div>
                  <div className="font-medium text-gray-900">{callback.patientInterest}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 메모 */}
          {callback.note && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">메모</h3>
              <div className="bg-amber-50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare size={18} className="text-amber-600 mt-0.5" />
                  <p className="text-gray-900">{callback.note}</p>
                </div>
              </div>
            </div>
          )}

          {/* 환자 상태 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">환자 상태</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                  {callback.patientStatus || '신규'}
                </span>
                <span className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                  {callback.patientInterest}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 리콜 상세 패널 컴포넌트
function RecallDetailPanel({
  recall,
  allRecalls,
  onCall,
  onSend,
  onCancel,
  onComplete,
  onSelectRecall,
  formatDate,
}: {
  recall: RecallMessage;
  allRecalls: RecallMessage[];
  onCall: (phone: string) => void;
  onSend: (id: string) => void;
  onCancel: (id: string) => void;
  onComplete: (id: string) => void;
  onSelectRecall: (recall: RecallMessage) => void;
  formatDate: (date: string) => string;
}) {
  const [showPatientModal, setShowPatientModal] = useState(false);

  // 같은 환자 + 같은 치료의 모든 리콜 찾기
  const relatedRecalls = allRecalls
    .filter(r => r.patientId === recall.patientId && r.treatment === recall.treatment)
    .sort((a, b) => {
      const getTimingDays = (timing: string) => {
        if (timing.includes('1주')) return 7;
        if (timing.includes('2주')) return 14;
        if (timing.includes('1개월')) return 30;
        if (timing.includes('3개월')) return 90;
        if (timing.includes('6개월')) return 180;
        if (timing.includes('1년')) return 365;
        return 0;
      };
      return getTimingDays(a.timing) - getTimingDays(b.timing);
    });

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 - 심플하게 */}
      <div className="p-5 border-b">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{recall.patientName}</h2>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                {recall.treatment}
              </span>
            </div>
            <p className="text-gray-500">{recall.patientPhone}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCall(recall.patientPhone)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Phone size={16} />
              전화하기
            </button>
            <button
              onClick={() => setShowPatientModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              환자상세
            </button>
          </div>
        </div>
      </div>

      {/* 전체 리콜 일정 */}
      <div className="flex-1 p-5 overflow-y-auto">
        <div className="bg-purple-50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-purple-900 mb-4">
            {recall.treatment} 전체 리콜 일정
            <span className="ml-2 text-xs text-purple-600">({relatedRecalls.length}회)</span>
          </h3>
          <div className="space-y-2">
            {relatedRecalls.map((r, idx) => {
              const isCurrent = r.id === recall.id;
              const isBooked = r.status === 'booked';
              const isSent = r.sentAt && r.status !== 'booked';
              const isPending = r.status === 'pending' && !r.sentAt;
              const isCallNeeded = r.status === 'call-needed' || r.status === 'no-response';

              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isCurrent
                      ? 'bg-purple-200 border-2 border-purple-400'
                      : 'bg-white'
                  }`}
                >
                  {/* 상태 아이콘 */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isBooked ? 'bg-emerald-500 text-white' :
                    isSent ? 'bg-blue-500 text-white' :
                    isCallNeeded ? 'bg-red-500 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {isBooked ? <Check size={14} /> :
                     isSent ? <Check size={14} /> :
                     isCallNeeded ? <Phone size={12} /> :
                     <span className="text-xs font-bold">{idx + 1}</span>}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isCurrent ? 'text-purple-900' : 'text-gray-900'}`}>
                        {r.timing}
                      </span>
                      <span className="text-xs text-gray-500">
                        {r.sentAt ? `${formatDate(r.sentAt)} 발송` :
                         r.scheduledAt ? `${formatDate(r.scheduledAt)} 예정` : ''}
                      </span>
                    </div>
                  </div>

                  {/* 상태 배지 */}
                  <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                    isBooked ? 'bg-emerald-100 text-emerald-700' :
                    isSent ? 'bg-blue-100 text-blue-700' :
                    isCallNeeded ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {isBooked ? '예약완료' :
                     isSent ? '발송완료' :
                     isCallNeeded ? '전화필요' : '대기'}
                  </span>

                  {/* 액션 버튼 - 대기 또는 전화필요 상태만 */}
                  {(isPending || isCallNeeded) && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isPending && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSend(r.id); }}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
                        >
                          발송
                        </button>
                      )}
                      {isCallNeeded && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onComplete(r.id); }}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                        >
                          완료
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onCancel(r.id); }}
                        className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-300 transition-colors"
                      >
                        제거
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 하단 정보 - 심플하게 */}
        <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
          <span>마지막 방문: <strong className="text-gray-900">{formatDate(recall.lastVisit)}</strong></span>
          {recall.daysPassed && (
            <span>경과: <strong className="text-red-600">{recall.daysPassed}일</strong></span>
          )}
        </div>
      </div>

      {/* 환자 정보 모달 */}
      {showPatientModal && (
        <PatientInfoModal
          patientId={recall.patientId}
          onClose={() => setShowPatientModal(false)}
        />
      )}
    </div>
  );
}

// 간소화된 환자 정보 모달
function PatientInfoModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [patient, setPatient] = useState<{
    name: string;
    phone: string;
    temperature: Temperature;
    interest: string;
    status: string;
    memo?: string;
    consultations?: Array<{ date: string; content: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const res = await fetch(`/api/v2/patients/${patientId}`);
        const data = await res.json();
        if (data.success || data.patient) {
          const p = data.patient || data;
          setPatient({
            name: p.name,
            phone: p.phone,
            temperature: p.temperature || 'cold',
            interest: p.interest || '-',
            status: p.status || '신규',
            memo: p.memo,
            consultations: p.consultations?.slice(0, 3) || [],
          });
        }
      } catch (error) {
        console.error('Failed to fetch patient:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPatient();
  }, [patientId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">환자 정보</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4">
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : patient ? (
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl font-bold text-gray-900">{patient.name}</span>
                    <TemperatureIcon temperature={patient.temperature} size={18} />
                  </div>
                  <p className="text-gray-500">{patient.phone}</p>
                </div>
              </div>

              {/* 상태 정보 */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                  {patient.status}
                </span>
                <span className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                  {patient.interest}
                </span>
              </div>

              {/* 메모 */}
              {patient.memo && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <div className="text-xs text-amber-600 mb-1">메모</div>
                  <p className="text-sm text-gray-900">{patient.memo}</p>
                </div>
              )}

              {/* 최근 상담 이력 */}
              {patient.consultations && patient.consultations.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-2">최근 상담 이력</div>
                  <div className="space-y-2">
                    {patient.consultations.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-gray-400 flex-shrink-0">{c.date?.slice(5, 10)}</span>
                        <span className="text-gray-700 line-clamp-1">{c.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">환자 정보를 불러올 수 없습니다</div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t">
          <button
            onClick={() => router.push(`/v2/patients/${patientId}`)}
            className="w-full py-2.5 text-center text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
          >
            전체 상세 페이지로 이동 →
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= Modals =============

// 일정 추가 모달
function AddCallbackModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [patientId, setPatientId] = useState('');
  const [type, setType] = useState<CallbackType>('callback');
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');
  const [patients, setPatients] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const searchPatients = async () => {
      if (searchQuery.length < 2) {
        setPatients([]);
        return;
      }
      try {
        // period=all로 전체 환자 검색 (기간 제한 없이)
        const response = await fetch(`/api/v2/patients?search=${searchQuery}&limit=10&period=all`);
        const result = await response.json();
        // API는 { patients: [...], pagination: {...} } 형식으로 반환
        if (result.patients && result.patients.length > 0) {
          setPatients(result.patients.map((p: { id: string; name: string; phone: string }) => ({
            id: p.id, name: p.name, phone: p.phone,
          })));
        } else {
          setPatients([]);
        }
      } catch (error) {
        console.error('Failed to search patients:', error);
        setPatients([]);
      }
    };
    const debounce = setTimeout(searchPatients, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !scheduledAt) {
      alert('환자와 예정 시간을 선택해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/v2/callbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, type, scheduledAt: new Date(scheduledAt).toISOString(), note }),
      });
      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || '일정 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create callback:', error);
      alert('일정 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const TYPE_LABELS: Record<'callback' | 'recall', string> = { callback: '콜백', recall: '리콜' };
  const TYPE_COLORS: Record<'callback' | 'recall', string> = {
    callback: 'bg-blue-100 text-blue-700',
    recall: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">일정 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">환자 선택</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 전화번호로 검색"
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
            {patients.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => { setPatientId(patient.id); setSearchQuery(`${patient.name} (${patient.phone})`); setPatients([]); }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                  >
                    {patient.name} · {patient.phone}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">일정 타입</label>
            <div className="flex gap-2">
              {(['callback', 'recall'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    type === t ? TYPE_COLORS[t] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">예정 일시</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              placeholder="메모를 입력하세요"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              취소
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
              {submitting ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 치료 추가 모달
function AddTreatmentModal({ onClose, onAdd }: { onClose: () => void; onAdd: (treatment: string) => void }) {
  const [treatment, setTreatment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatment.trim()) {
      alert('치료명을 입력해주세요.');
      return;
    }
    onAdd(treatment.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">치료 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">치료명</label>
            <input
              type="text"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              placeholder="예: 스케일링, 임플란트, 교정"
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
              취소
            </button>
            <button type="submit" className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 발송 시점 편집 모달
function EditScheduleModal({
  settingId,
  schedule,
  onClose,
  onSave,
}: {
  settingId: string;
  schedule?: RecallSchedule;
  onClose: () => void;
  onSave: (settingId: string, schedule: RecallSchedule, isNew: boolean) => void;
}) {
  const [timing, setTiming] = useState(schedule?.timing || '');
  const [timingDays, setTimingDays] = useState(schedule?.timingDays || 0);
  const [message, setMessage] = useState(schedule?.message || '');
  const isNew = !schedule;

  const handleTimingChange = (value: string) => {
    setTiming(value);
    const option = TIMING_OPTIONS.find(o => o.label === value);
    if (option) {
      setTimingDays(option.days);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timing || !message.trim()) {
      alert('발송 시점과 메시지를 입력해주세요.');
      return;
    }
    onSave(settingId, {
      id: schedule?.id || '',
      timing,
      timingDays,
      message: message.trim(),
      enabled: schedule?.enabled ?? true,
    }, isNew);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{isNew ? '발송 시점 추가' : '발송 시점 수정'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발송 시점</label>
            <select
              value={timing}
              onChange={(e) => handleTimingChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="">선택하세요</option>
              {TIMING_OPTIONS.map(option => (
                <option key={option.label} value={option.label}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">알림톡 메시지</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              placeholder="발송할 메시지를 입력하세요"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
              취소
            </button>
            <button type="submit" className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              {isNew ? '추가' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Suspense 경계로 감싸서 export
export default function SchedulesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">로딩 중...</div>}>
      <SchedulesContent />
    </Suspense>
  );
}
