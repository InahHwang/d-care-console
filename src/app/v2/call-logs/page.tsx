// src/app/v2/call-logs/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Sparkles,
  PhoneIncoming,
  PhoneOutgoing,
  Loader2,
  CheckCircle2,
  Play,
  X,
  UserPlus,
  PhoneCall,
  Bell,
  Eye,
  Flame,
  Thermometer,
  Snowflake,
  Plus,
  Pencil,
  Unlink,
} from 'lucide-react';
import { Pagination } from '@/components/v2/ui/Pagination';
import { Temperature } from '@/types/v2';

interface CallLog {
  id: string;
  callTime: string;
  callType: 'inbound' | 'outbound';
  duration: number;
  phone: string;
  patientId: string | null;
  patientName: string;
  classification: string;
  interest: string;
  summary: string;
  temperature: Temperature;
  status: 'pending' | 'analyzing' | 'completed';
  confidence?: number;
  suggestedCallback?: string;
  isRegistered?: boolean;
  followUp?: string;
}

// 분류 옵션
const CLASSIFICATION_OPTIONS = [
  { value: '신환', label: '신환' },
  { value: '구신환', label: '구신환' },
  { value: '구환', label: '구환' },
  { value: '부재중', label: '부재중' },
  { value: '거래처', label: '거래처' },
  { value: '스팸', label: '스팸' },
  { value: '기타', label: '기타' },
];

// 관심도 옵션
const TEMPERATURE_OPTIONS = [
  { value: 'hot', label: '높음 (Hot)', icon: Flame, color: 'text-red-500' },
  { value: 'warm', label: '중간 (Warm)', icon: Thermometer, color: 'text-amber-500' },
  { value: 'cold', label: '낮음 (Cold)', icon: Snowflake, color: 'text-blue-400' },
];

// 후속조치 옵션
const FOLLOWUP_OPTIONS = [
  { value: '콜백필요', label: '콜백 필요' },
  { value: '예약확정', label: '예약 확정' },
  { value: '종결', label: '종결' },
];

interface CallLogStats {
  all: number;
  sinwhan: number;      // 신환
  gusinwhan: number;    // 구신환
  guhwan: number;       // 구환
  bujaejung: number;    // 부재중
  georaecheo: number;   // 거래처
  spam: number;         // 스팸
  etc: number;          // 기타
}

interface CallLogResponse {
  callLogs: CallLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  stats: CallLogStats;
}

type ClassificationFilter = 'all' | 'sinwhan' | 'gusinwhan' | 'guhwan' | 'bujaejung' | 'georaecheo' | 'spam' | 'etc';

const filterTabs: Array<{ id: ClassificationFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'sinwhan', label: '신환' },
  { id: 'gusinwhan', label: '구신환' },
  { id: 'guhwan', label: '구환' },
  { id: 'bujaejung', label: '부재중' },
  { id: 'georaecheo', label: '거래처' },
  { id: 'spam', label: '스팸' },
  { id: 'etc', label: '기타' },
];

function getClassificationStyle(classification: string) {
  switch (classification) {
    case '신환': return 'bg-blue-100 text-blue-700';
    case '구신환': return 'bg-purple-100 text-purple-700';
    case '구환': return 'bg-emerald-100 text-emerald-700';
    case '부재중': return 'bg-amber-100 text-amber-700';
    case '거래처': return 'bg-cyan-100 text-cyan-700';
    case '스팸': return 'bg-red-100 text-red-600';
    case '기타': return 'bg-slate-100 text-slate-600';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function getFilterStyle(filterId: ClassificationFilter, isActive: boolean) {
  if (!isActive) return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  return 'bg-blue-500 text-white';
}

function TemperatureDisplay({ temperature }: { temperature: Temperature | string | null }) {
  if (!temperature || temperature === 'unknown') return <span className="text-gray-400">-</span>;

  const config: Record<string, { icon: typeof Flame; color: string; label: string }> = {
    hot: { icon: Flame, color: 'text-red-500', label: '높음' },
    warm: { icon: Thermometer, color: 'text-amber-500', label: '중간' },
    cold: { icon: Snowflake, color: 'text-blue-400', label: '낮음' },
  };

  const { icon: Icon, color, label } = config[temperature] || { icon: Thermometer, color: 'text-gray-400', label: '-' };
  return (
    <div className="flex items-center gap-1">
      <Icon size={14} className={color} />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
}

// 환자 등록 모달
interface RegisterPatientModalProps {
  call: CallLog;
  onClose: () => void;
  onSuccess: (patientId: string) => void;
}

function RegisterPatientModal({ call, onClose, onSuccess }: RegisterPatientModalProps) {
  const [name, setName] = useState(call.patientName || '');
  const [phone] = useState(call.phone);
  const [interest, setInterest] = useState(call.interest || '');
  const [source, setSource] = useState('전화문의');
  const [temperature, setTemperature] = useState<Temperature>(call.temperature || 'warm');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('환자 이름을 입력해주세요');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // 1. 환자 등록 시도
      const patientRes = await fetch('/api/v2/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          interest,
          source,
          temperature,
        }),
      });

      let patientId: string;

      if (patientRes.status === 409) {
        // 이미 등록된 전화번호 → 기존 환자와 연결
        const data = await patientRes.json();
        patientId = data.patientId;
      } else if (!patientRes.ok) {
        const data = await patientRes.json();
        setError(data.error || '등록 중 오류가 발생했습니다');
        return;
      } else {
        const data = await patientRes.json();
        patientId = data.patientId;
      }

      // 2. 통화기록에 patientId 연결
      await fetch('/api/v2/call-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: call.id,
          patientId,
        }),
      });

      onSuccess(patientId);
      onClose();
    } catch (err) {
      setError('등록 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-blue-500" />
            <h3 className="font-bold text-gray-900">환자 등록</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 전화번호 (읽기전용) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">전화번호</label>
            <input
              type="text"
              value={phone}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          {/* 환자 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              환자 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="환자 이름 입력"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* 관심 시술 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">관심 시술</label>
            <input
              type="text"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="예: 임플란트, 교정"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 유입경로 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">유입경로</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="전화문의">전화문의</option>
              <option value="네이버">네이버</option>
              <option value="카카오">카카오</option>
              <option value="인스타그램">인스타그램</option>
              <option value="지인소개">지인소개</option>
              <option value="기타">기타</option>
            </select>
          </div>

          {/* 관심도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">관심도</label>
            <div className="flex gap-2">
              {TEMPERATURE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTemperature(opt.value as Temperature)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      temperature === opt.value
                        ? 'bg-blue-50 border-2 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={16} className={opt.color} />
                    {opt.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                등록 중...
              </>
            ) : (
              <>
                <UserPlus size={16} />
                환자 등록
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// AI 분석 수정 모달
interface EditAnalysisModalProps {
  call: CallLog;
  onClose: () => void;
  onSave: (updatedCall: CallLog) => void;
}

function EditAnalysisModal({ call, onClose, onSave }: EditAnalysisModalProps) {
  const [classification, setClassification] = useState(call.classification);
  const [patientName, setPatientName] = useState(call.patientName || '');
  const [interest, setInterest] = useState(call.interest || '');
  const [temperature, setTemperature] = useState<Temperature>(call.temperature || 'warm');
  const [summary, setSummary] = useState(call.summary || '');
  const [followUp, setFollowUp] = useState(call.followUp || '콜백필요');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/v2/call-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: call.id,
          classification,
          patientName,
          interest,
          temperature,
          summary,
          followUp,
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      onSave({
        ...call,
        classification,
        patientName,
        interest,
        temperature,
        summary,
        followUp,
      });
      onClose();
    } catch (error) {
      console.error('Error updating call log:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-blue-500" />
            <h3 className="font-bold text-gray-900">AI 분석 수정</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-4 space-y-4">
          {/* 분류 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">분류</label>
            <div className="flex flex-wrap gap-2">
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setClassification(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    classification === opt.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 환자 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">환자 이름</label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="환자 이름 입력"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 관심 시술 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">관심 시술</label>
            <input
              type="text"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="예: 임플란트, 교정, 충치치료"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 관심도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">관심도</label>
            <div className="flex gap-2">
              {TEMPERATURE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTemperature(opt.value as Temperature)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      temperature === opt.value
                        ? 'bg-blue-50 border-2 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={16} className={opt.color} />
                    {opt.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 후속 조치 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">후속 조치</label>
            <div className="flex gap-2">
              {FOLLOWUP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFollowUp(opt.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    followUp === opt.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 요약 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">요약</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="통화 내용 요약"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!seconds || seconds === 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatCallTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  const dateStr = isToday ? '오늘' : isYesterday ? '어제' : `${date.getMonth() + 1}/${date.getDate()}`;

  return { dateStr, time };
}

function CallLogsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilter = (searchParams.get('filter') as ClassificationFilter) || 'all';

  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ClassificationFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1 });
  const [stats, setStats] = useState<CallLogStats | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [editingCall, setEditingCall] = useState<CallLog | null>(null);
  const [registeringCall, setRegisteringCall] = useState<CallLog | null>(null);

  const fetchCallLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '20');

      if (filter === 'sinwhan') {
        params.set('classification', '신환');
      } else if (filter === 'gusinwhan') {
        params.set('classification', '구신환');
      } else if (filter === 'guhwan') {
        params.set('classification', '구환');
      } else if (filter === 'bujaejung') {
        params.set('classification', '부재중');
      } else if (filter === 'georaecheo') {
        params.set('classification', '거래처');
      } else if (filter === 'spam') {
        params.set('classification', '스팸');
      } else if (filter === 'etc') {
        params.set('classification', '기타');
      }

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/v2/call-logs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data: CallLogResponse = await response.json();
      setCallLogs(data.callLogs);
      setPagination({
        totalCount: data.pagination.totalCount,
        totalPages: data.pagination.totalPages,
      });
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching call logs:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filter, searchQuery]);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    if (currentPage > 1) params.set('page', currentPage.toString());

    const newUrl = params.toString() ? `?${params.toString()}` : '/v2/call-logs';
    window.history.replaceState(null, '', newUrl);
  }, [filter, currentPage]);

  const handleFilterChange = (newFilter: ClassificationFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleCallClick = (call: CallLog) => {
    setSelectedCall(call);
  };

  const handleClosePanel = () => {
    setSelectedCall(null);
  };

  const handleViewPatient = (patientId: string) => {
    router.push(`/v2/patients/${patientId}`);
  };

  const handleRegisterPatient = (call: CallLog) => {
    setRegisteringCall(call);
  };

  const handleRegisterSuccess = (patientId: string) => {
    // 목록에서 업데이트 (등록됨 상태로 변경)
    setCallLogs((prev) =>
      prev.map((log) =>
        log.id === registeringCall?.id ? { ...log, patientId } : log
      )
    );
    // 선택된 항목도 업데이트
    if (selectedCall && selectedCall.id === registeringCall?.id) {
      setSelectedCall({ ...selectedCall, patientId } as CallLog);
    }
  };

  const handleMakeCall = (phone: string) => {
    window.dispatchEvent(new CustomEvent('cti-call', { detail: { phone } }));
  };

  const handleAddPatient = () => {
    router.push('/v2/patients/new');
  };

  const handleEditAnalysis = (call: CallLog) => {
    setEditingCall(call);
  };

  const handleUnlinkPatient = async (call: CallLog) => {
    if (!confirm('이 통화기록에서 환자 연결을 해제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch('/api/v2/call-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: call.id,
          patientId: null, // null로 설정하여 연결 해제
        }),
      });

      if (!response.ok) throw new Error('Failed to unlink');

      // 목록에서 업데이트
      setCallLogs((prev) =>
        prev.map((log) =>
          log.id === call.id ? { ...log, patientId: null } : log
        )
      );

      // 선택된 항목도 업데이트
      if (selectedCall?.id === call.id) {
        setSelectedCall({ ...selectedCall, patientId: null });
      }
    } catch (error) {
      console.error('Error unlinking patient:', error);
      alert('연결 해제 중 오류가 발생했습니다.');
    }
  };

  const handleSaveEdit = (updatedCall: CallLog) => {
    // 목록에서 업데이트
    setCallLogs((prev) =>
      prev.map((log) => (log.id === updatedCall.id ? updatedCall : log))
    );
    // 선택된 항목도 업데이트
    if (selectedCall?.id === updatedCall.id) {
      setSelectedCall(updatedCall);
    }
  };

  const getStatCount = (filterId: ClassificationFilter) => {
    if (!stats) return 0;
    switch (filterId) {
      case 'all': return stats.all;
      case 'sinwhan': return stats.sinwhan;
      case 'gusinwhan': return stats.gusinwhan;
      case 'guhwan': return stats.guhwan;
      case 'bujaejung': return stats.bujaejung;
      case 'georaecheo': return stats.georaecheo;
      case 'spam': return stats.spam;
      case 'etc': return stats.etc;
      default: return 0;
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 헤더 */}
        <div className="bg-white border-b px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">통화 기록</h2>
              <p className="text-sm text-gray-500 mt-1">
                AI가 자동으로 분석하고 환자를 등록합니다
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                <Sparkles size={16} />
                <span>AI 분석 활성화</span>
              </div>
              <button
                onClick={handleAddPatient}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
              >
                <Plus size={18} />
                환자 등록
              </button>
            </div>
          </div>
        </div>

        {/* 필터 & 검색 */}
        <div className="bg-white border-b px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleFilterChange(tab.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${getFilterStyle(tab.id, filter === tab.id)}`}
                >
                  {tab.label}
                  <span className={`ml-1.5 ${filter === tab.id ? 'text-blue-100' : 'text-gray-400'}`}>
                    {getStatCount(tab.id)}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="전화번호, 이름 검색"
                value={searchQuery}
                onChange={handleSearch}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 통화 목록 */}
        <div className="flex-1 overflow-auto p-6 min-h-0">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b text-sm font-medium text-gray-500">
              <div className="col-span-1">유형</div>
              <div className="col-span-2">전화번호</div>
              <div className="col-span-1">시간</div>
              <div className="col-span-1">통화</div>
              <div className="col-span-2">AI 분류</div>
              <div className="col-span-1">관심도</div>
              <div className="col-span-3">AI 요약</div>
              <div className="col-span-1">상태</div>
            </div>

            {/* 테이블 바디 */}
            {loading ? (
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 px-5 py-4 animate-pulse">
                    <div className="col-span-1"><div className="w-8 h-8 bg-gray-200 rounded-full" /></div>
                    <div className="col-span-2"><div className="h-4 bg-gray-200 rounded w-24" /></div>
                    <div className="col-span-1"><div className="h-4 bg-gray-200 rounded w-12" /></div>
                    <div className="col-span-1"><div className="h-4 bg-gray-200 rounded w-10" /></div>
                    <div className="col-span-2"><div className="h-4 bg-gray-200 rounded w-16" /></div>
                    <div className="col-span-1"><div className="h-4 bg-gray-200 rounded w-8" /></div>
                    <div className="col-span-3"><div className="h-4 bg-gray-200 rounded w-full" /></div>
                    <div className="col-span-1"><div className="h-4 bg-gray-200 rounded w-12" /></div>
                  </div>
                ))}
              </div>
            ) : callLogs.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                통화 기록이 없습니다
              </div>
            ) : (
              <div className="divide-y">
                {callLogs.map((call) => {
                  const { dateStr, time } = formatCallTime(call.callTime);
                  const isSelected = selectedCall?.id === call.id;

                  return (
                    <div
                      key={call.id}
                      onClick={() => handleCallClick(call)}
                      className={`grid grid-cols-12 gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer items-center transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      {/* 유형 */}
                      <div className="col-span-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          call.callType === 'outbound' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {call.callType === 'outbound' ? (
                            <PhoneOutgoing size={16} className="text-blue-600" />
                          ) : (
                            <PhoneIncoming size={16} className="text-green-600" />
                          )}
                        </div>
                      </div>

                      {/* 전화번호 + 이름 */}
                      <div className="col-span-2">
                        <div className="font-medium text-gray-900">{call.phone}</div>
                        {call.patientName && (
                          <div className="text-sm text-gray-500">{call.patientName}</div>
                        )}
                      </div>

                      {/* 시간 */}
                      <div className="col-span-1 text-sm text-gray-600">
                        <div>{dateStr}</div>
                        <div className="text-gray-400">{time}</div>
                      </div>

                      {/* 통화시간 */}
                      <div className="col-span-1 text-sm text-gray-600">
                        {formatDuration(call.duration)}
                      </div>

                      {/* AI 분류 */}
                      <div className="col-span-2">
                        {call.status === 'analyzing' ? (
                          <div className="flex items-center gap-2 text-purple-600">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-sm">분석 중...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClassificationStyle(call.classification)}`}>
                              {call.classification || '-'}
                            </span>
                            {call.interest && (
                              <span className="text-xs text-gray-500">{call.interest}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 관심도 */}
                      <div className="col-span-1">
                        <TemperatureDisplay temperature={call.temperature} />
                      </div>

                      {/* AI 요약 */}
                      <div className="col-span-3">
                        {call.status === 'analyzing' ? (
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                        ) : (
                          <p className="text-sm text-gray-600 truncate">{call.summary || '-'}</p>
                        )}
                      </div>

                      {/* 등록 상태 */}
                      <div className="col-span-1">
                        {call.patientId ? (
                          <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 size={16} />
                            <span className="text-xs">등록됨</span>
                          </div>
                        ) : call.classification === '구환' || call.classification === '거래처' || call.classification === '스팸' ? (
                          <span className="text-xs text-gray-400">제외</span>
                        ) : call.status === 'analyzing' ? (
                          <span className="text-xs text-gray-400">대기</span>
                        ) : call.classification === '부재중' ? (
                          <span className="text-xs text-gray-400">재시도</span>
                        ) : (
                          <span className="text-xs text-amber-500">미등록</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-sm text-gray-500">{pagination.totalCount}건</p>
            {pagination.totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        </div>
      </div>

      {/* 우측 상세 패널 - 고정 */}
      {selectedCall && (
        <div className="w-96 bg-white border-l flex flex-col h-full overflow-hidden flex-shrink-0">
          {/* 패널 헤더 */}
          <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
            <h3 className="font-bold text-gray-900">통화 상세</h3>
            <button
              onClick={handleClosePanel}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* 패널 내용 */}
          <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
            {/* 기본 정보 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedCall.callType === 'outbound' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  {selectedCall.callType === 'outbound' ? (
                    <PhoneOutgoing size={20} className="text-blue-600" />
                  ) : (
                    <PhoneIncoming size={20} className="text-green-600" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-lg text-gray-900">{selectedCall.phone}</div>
                  <div className="text-sm text-gray-500">
                    {formatCallTime(selectedCall.callTime).dateStr} {formatCallTime(selectedCall.callTime).time} · {formatDuration(selectedCall.duration)}
                  </div>
                </div>
              </div>

              {selectedCall.duration > 0 && (
                <button className="w-full py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
                  <Play size={16} className="text-blue-500" />
                  녹취 재생
                </button>
              )}
            </div>

            {/* AI 분석 결과 */}
            {selectedCall.status === 'completed' && (
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-purple-700 font-medium mb-3">
                  <Sparkles size={18} />
                  AI 분석 결과
                  {selectedCall.confidence && (
                    <span className="ml-auto text-xs font-normal text-purple-500">
                      신뢰도 {selectedCall.confidence}%
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">분류</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClassificationStyle(selectedCall.classification)}`}>
                      {selectedCall.classification}
                    </span>
                  </div>

                  {selectedCall.patientName && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">이름</span>
                      <span className="font-medium text-gray-900">{selectedCall.patientName}</span>
                    </div>
                  )}

                  {selectedCall.interest && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">관심 시술</span>
                      <span className="font-medium text-gray-900">{selectedCall.interest}</span>
                    </div>
                  )}

                  {selectedCall.temperature && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">관심도</span>
                      <TemperatureDisplay temperature={selectedCall.temperature} />
                    </div>
                  )}

                  {selectedCall.suggestedCallback && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">추천 콜백</span>
                      <span className="font-medium text-amber-600">{selectedCall.suggestedCallback}</span>
                    </div>
                  )}
                </div>

                {selectedCall.summary && (
                  <div className="mt-3 pt-3 border-t border-purple-100">
                    <p className="text-sm text-gray-700">{selectedCall.summary}</p>
                  </div>
                )}
              </div>
            )}

            {selectedCall.status === 'analyzing' && (
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-center gap-3 text-purple-700">
                  <Loader2 size={20} className="animate-spin" />
                  <div>
                    <div className="font-medium">AI 분석 중...</div>
                    <div className="text-sm text-purple-500">약 20초 소요</div>
                  </div>
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="space-y-2">
              {selectedCall.patientId ? (
                <>
                  <button
                    onClick={() => handleViewPatient(selectedCall.patientId!)}
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    환자 상세 보기
                  </button>
                  <button
                    onClick={() => handleUnlinkPatient(selectedCall)}
                    className="w-full py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Unlink size={16} />
                    연결 해제
                  </button>
                </>
              ) : (selectedCall.classification === '신환' || selectedCall.classification === '구신환') && !selectedCall.patientId ? (
                <button
                  onClick={() => handleRegisterPatient(selectedCall)}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <UserPlus size={18} />
                  환자로 등록
                </button>
              ) : null}

              {selectedCall.classification === '부재중' && (
                <button
                  onClick={() => handleMakeCall(selectedCall.phone)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <PhoneCall size={18} />
                  다시 전화하기
                </button>
              )}

              {selectedCall.suggestedCallback && !selectedCall.patientId && (
                <button className="w-full py-3 border border-amber-500 text-amber-600 hover:bg-amber-50 rounded-xl font-medium flex items-center justify-center gap-2">
                  <Bell size={18} />
                  콜백 예약
                </button>
              )}
            </div>

            {/* AI 수정 안내 */}
            {selectedCall.status === 'completed' && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 text-center">
                  AI 분석이 틀렸나요?
                  <button
                    onClick={() => handleEditAnalysis(selectedCall)}
                    className="text-blue-500 hover:text-blue-600 hover:underline ml-1 font-medium"
                  >
                    직접 수정
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI 분석 수정 모달 */}
      {editingCall && (
        <EditAnalysisModal
          call={editingCall}
          onClose={() => setEditingCall(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* 환자 등록 모달 */}
      {registeringCall && (
        <RegisterPatientModal
          call={registeringCall}
          onClose={() => setRegisteringCall(null)}
          onSuccess={handleRegisterSuccess}
        />
      )}
    </div>
  );
}

export default function CallLogsPage() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">로딩 중...</div>}>
      <CallLogsPageContent />
    </Suspense>
  );
}
