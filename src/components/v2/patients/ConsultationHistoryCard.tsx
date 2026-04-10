'use client';

import { authFetch } from '@/utils/authFetch';
import React, { useState, useEffect } from 'react';
import { Phone, MessageCircle, Clock, ChevronDown, Sparkles, X, Loader2, Plus, Building, Edit3, ClipboardCheck, ClipboardList, CheckCircle, XCircle, AlertCircle, PhoneMissed, Ban, Pencil, Trash2, StickyNote, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CHANNEL_CONFIG, ChannelType } from '@/types/v2';
import { ManualConsultationModal } from './ManualConsultationModal';

// ============================================
// 통합 상담 이력 카드 (전화 + 채팅)
// ============================================

// AI 요약 텍스트를 bullet point로 포맷팅하는 함수
function formatSummaryWithBullets(summary: string): string[] {
  if (!summary) return [];

  // 문장 구분: 마침표, 쉼표+공백, 줄바꿈 등으로 분리
  // 1. 먼저 이미 bullet point가 있으면 그대로 분리
  if (summary.includes('•') || summary.includes('-')) {
    return summary
      .split(/[•\-]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // 2. 문장 단위로 분리 (마침표, 느낌표, 물음표 기준)
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // 3. 문장이 1개면 쉼표로 분리 시도
  if (sentences.length === 1 && summary.includes(',')) {
    const parts = summary
      .split(/,\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 3); // 너무 짧은 건 제외
    if (parts.length > 1) return parts;
  }

  return sentences;
}

interface ConsultationItem {
  id: string;
  type: 'call' | 'chat' | 'manual' | 'result';
  channel?: string;
  direction?: string;
  date: string;
  summary?: string;
  content?: string;
  consultantName?: string;
  manualType?: 'phone' | 'visit' | 'other';
  source?: 'ai' | 'manual' | 'system' | 'consultation_result';
  aiAnalysis?: {
    interest?: string;
    temperature?: string;
    summary?: string;
    followUp?: string;
  };
  duration?: number;
  status?: string;
  hasCoaching?: boolean;  // AI 코칭 완료 여부
  // 상담 결과 전용 필드
  resultType?: 'phone' | 'visit';
  resultStatus?: 'agreed' | 'disagreed' | 'pending' | 'no_answer' | 'closed';
  treatment?: string;
  originalAmount?: number;
  finalAmount?: number;
  disagreeReasons?: string[];
  appointmentDate?: string;
  callbackDate?: string;
  memo?: string;
  closedReason?: string;
  closedReasonCustom?: string;
  // 연결된 상담 결과 (중첩 표시용)
  linkedResult?: ConsultationItem;
  // 연결 ID (결과가 어떤 활동에 속하는지)
  linkedCallLogId?: string;
  linkedManualId?: string;
  // 내원상담 수동항목 → 상담결과 연결 (수정/삭제 버튼용)
  consultationResultId?: string;
  consultationResultData?: ConsultationItem;
}

// 상담 결과 (consultations_v2에서 가져오는 데이터)
interface ConsultationResult {
  id: string;
  callLogId?: string;
  manualConsultationId?: string;
  type: 'phone' | 'visit';
  status: 'agreed' | 'disagreed' | 'pending' | 'no_answer' | 'closed';
  treatment?: string;
  originalAmount?: number;
  discountRate?: number;
  finalAmount?: number;
  disagreeReasons?: string[];
  appointmentDate?: string;
  callbackDate?: string;
  consultantName?: string;
  memo?: string;
  closedReason?: string;
  closedReasonCustom?: string;
  createdAt: string;
}

interface ConsultationHistoryCardProps {
  patientId: string;
  patientName?: string;
  className?: string;
  onSelectCall?: (callId: string) => void;
  onAddResult?: (activityId: string, activityType: 'call' | 'manual') => void;
  onEditResult?: (resultId: string, resultData: ConsultationItem) => void;
  onDeleteResult?: (resultId: string) => void;
}

type FilterType = 'all' | 'call' | 'chat' | 'manual';

// 상담결과 상태 뱃지
function getResultStatusBadge(status?: string): { label: string; className: string } {
  switch (status) {
    case 'agreed': return { label: '동의', className: 'bg-emerald-100 text-emerald-700' };
    case 'disagreed': return { label: '미동의', className: 'bg-rose-100 text-rose-700' };
    case 'no_answer': return { label: '부재중', className: 'bg-slate-100 text-slate-700' };
    case 'closed': return { label: '종결', className: 'bg-gray-200 text-gray-700' };
    default: return { label: '보류', className: 'bg-amber-100 text-amber-700' };
  }
}

// 항목별 아이콘/라벨 통일
function getItemDisplay(item: ConsultationItem): {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  labelColor: string;
} {
  // 통화
  if (item.type === 'call') {
    const isInbound = item.direction === 'inbound';
    return {
      icon: <Phone size={14} className={isInbound ? 'text-blue-600' : 'text-violet-600'} />,
      iconBg: isInbound ? 'bg-blue-100' : 'bg-violet-100',
      label: isInbound ? '수신' : '발신',
      labelColor: isInbound ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700',
    };
  }
  // 내원상담 (수동 visit)
  if (item.type === 'manual' && (item.manualType === 'visit' || item.source === 'consultation_result')) {
    return {
      icon: <Building size={14} className="text-emerald-600" />,
      iconBg: 'bg-emerald-100',
      label: '내원상담',
      labelColor: 'bg-emerald-100 text-emerald-700',
    };
  }
  // 수동 전화 (direction 있으면 수신/발신 표시)
  if (item.type === 'manual' && item.manualType === 'phone') {
    if (item.direction === 'inbound') {
      return {
        icon: <Phone size={14} className="text-blue-600" />,
        iconBg: 'bg-blue-100',
        label: '수신',
        labelColor: 'bg-blue-100 text-blue-700',
      };
    }
    if (item.direction === 'outbound') {
      return {
        icon: <Phone size={14} className="text-violet-600" />,
        iconBg: 'bg-violet-100',
        label: '발신',
        labelColor: 'bg-violet-100 text-violet-700',
      };
    }
    // direction 없는 과거 데이터
    return {
      icon: <Phone size={14} className="text-amber-600" />,
      iconBg: 'bg-amber-100',
      label: '전화',
      labelColor: 'bg-amber-100 text-amber-700',
    };
  }
  // 수동 (기타)
  if (item.type === 'manual') {
    return {
      icon: <Edit3 size={14} className="text-amber-600" />,
      iconBg: 'bg-amber-100',
      label: '수동',
      labelColor: 'bg-amber-100 text-amber-700',
    };
  }
  // 채팅
  return {
    icon: <span className="text-sm">{CHANNEL_CONFIG[item.channel as ChannelType]?.icon || '💬'}</span>,
    iconBg: 'bg-green-100',
    label: CHANNEL_CONFIG[item.channel as ChannelType]?.label || '채팅',
    labelColor: CHANNEL_CONFIG[item.channel as ChannelType]?.bgColor || 'bg-gray-100 text-gray-700',
  };
}

// 채팅 상세 모달 컴포넌트
interface ChatDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
}

function ChatDetailModal({ isOpen, onClose, chatId }: ChatDetailModalProps) {
  const [chat, setChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (isOpen && chatId) {
      fetchChatDetail();
    }
  }, [isOpen, chatId]);

  const fetchChatDetail = async () => {
    setIsLoading(true);
    try {
      const [chatRes, messagesRes] = await Promise.all([
        authFetch(`/api/v2/channel-chats/${chatId}`),
        authFetch(`/api/v2/channel-chats/${chatId}/messages?limit=100`),
      ]);

      const chatData = await chatRes.json();
      const messagesData = await messagesRes.json();

      if (chatData.success) {
        setChat(chatData.data);
      }
      if (messagesData.success) {
        setMessages(messagesData.data);
      }
    } catch (error) {
      console.error('채팅 상세 조회 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // AI 분석 요청
  const handleAnalyze = async () => {
    if (!chatId || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const res = await authFetch('/api/v2/channel-chats/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });

      const data = await res.json();
      if (data.success) {
        // 분석 결과로 chat 업데이트
        setChat((prev: any) => prev ? { ...prev, aiAnalysis: data.data } : prev);
      } else {
        alert(data.error || 'AI 분석에 실패했습니다.');
      }
    } catch (error) {
      console.error('AI 분석 오류:', error);
      alert('AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle size={20} className="text-green-500" />
            <h2 className="text-lg font-bold text-gray-900">채팅 상담 상세</h2>
            {chat?.channel && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                CHANNEL_CONFIG[chat.channel as ChannelType]?.bgColor || 'bg-gray-100 text-gray-700'
              }`}>
                {CHANNEL_CONFIG[chat.channel as ChannelType]?.label || chat.channel}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* AI 분석 결과 */}
            <div className="p-4 border-b bg-purple-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-500" />
                  <span className="font-medium text-purple-900">AI 분석</span>
                </div>
                {!chat?.aiAnalysis && (
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        분석 중...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        AI 분석하기
                      </>
                    )}
                  </button>
                )}
              </div>
              {chat?.aiAnalysis ? (
                <div className="space-y-2 text-sm">
                  {chat.aiAnalysis.summary && (
                    <div>
                      <span className="text-purple-600 font-medium">요약</span>
                      <ul className="mt-1 space-y-1">
                        {formatSummaryWithBullets(chat.aiAnalysis.summary).map((item, idx) => (
                          <li key={idx} className="text-gray-700 flex items-start gap-2">
                            <span className="text-purple-400 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {chat.aiAnalysis.interest && (
                    <div>
                      <span className="text-purple-600 font-medium">관심사: </span>
                      <span className="text-gray-700">{chat.aiAnalysis.interest}</span>
                    </div>
                  )}
                  {chat.aiAnalysis.temperature && (
                    <div>
                      <span className="text-purple-600 font-medium">온도: </span>
                      <span className="text-gray-700">{chat.aiAnalysis.temperature}</span>
                    </div>
                  )}
                  {chat.aiAnalysis.followUp && (
                    <div>
                      <span className="text-purple-600 font-medium">후속조치: </span>
                      <span className="text-gray-700">{chat.aiAnalysis.followUp}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-purple-600">AI 분석을 실행하면 상담 내용을 자동으로 요약합니다.</p>
              )}
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-gray-400 py-8">메시지가 없습니다</p>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={msg._id || idx}
                    className={`flex ${msg.senderType === 'agent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                        msg.senderType === 'agent'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p className={`text-xs mt-1 ${
                        msg.senderType === 'agent' ? 'text-orange-200' : 'text-gray-400'
                      }`}>
                        {format(new Date(msg.createdAt), 'M/d HH:mm', { locale: ko })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 정보 푸터 */}
            <div className="p-4 border-t bg-gray-50 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>
                  시작: {chat?.createdAt && format(new Date(chat.createdAt), 'yyyy.M.d HH:mm', { locale: ko })}
                </span>
                <span>총 {messages.length}개 메시지</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ConsultationHistoryCard({ patientId, patientName = '', className = '', onSelectCall, onAddResult, onEditResult, onDeleteResult }: ConsultationHistoryCardProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [consultations, setConsultations] = useState<ConsultationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // 채팅 상세 모달
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatModalOpen, setChatModalOpen] = useState(false);

  // 수동 입력/수정 모달
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingManual, setEditingManual] = useState<{ id: string; type: 'phone' | 'visit' | 'other'; date: string; content: string; consultantName?: string } | null>(null);

  // 인라인 AI 분석 상태
  const [analyzingChatId, setAnalyzingChatId] = useState<string | null>(null);
  // 자동 분석 중인 채팅 ID 목록
  const [autoAnalyzingIds, setAutoAnalyzingIds] = useState<Set<string>>(new Set());

  // 메모 편집 상태
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [memoText, setMemoText] = useState('');
  const [savingMemo, setSavingMemo] = useState(false);

  // 메모 저장
  const handleSaveMemo = async (callLogId: string) => {
    setSavingMemo(true);
    try {
      const res = await authFetch(`/api/v2/call-logs/${callLogId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: memoText.trim() }),
      });
      if (res.ok) {
        // 로컬 state 업데이트 (재조회 없이 즉시 반영)
        setConsultations(prev => prev.map(item =>
          item.id === callLogId ? { ...item, memo: memoText.trim() || undefined } : item
        ));
        setEditingMemoId(null);
      } else {
        alert('메모 저장에 실패했습니다.');
      }
    } catch {
      alert('메모 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingMemo(false);
    }
  };

  // 채팅 AI 분석 (목록에서 바로 실행)
  const handleAnalyzeChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 상세보기 클릭 방지
    if (analyzingChatId) return;

    setAnalyzingChatId(chatId);
    try {
      const res = await authFetch('/api/v2/channel-chats/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });

      const data = await res.json();
      if (data.success) {
        // 분석 결과로 목록 업데이트
        setConsultations((prev) =>
          prev.map((item) =>
            item.id === chatId
              ? {
                  ...item,
                  summary: data.data.summary,
                  aiAnalysis: data.data,
                }
              : item
          )
        );
      } else {
        alert(data.error || 'AI 분석에 실패했습니다.');
      }
    } catch (error) {
      console.error('AI 분석 오류:', error);
      alert('AI 분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzingChatId(null);
    }
  };

  // 수동 상담 수정 버튼 클릭
  const handleEditManual = (item: ConsultationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingManual({
      id: item.id,
      type: (item.manualType || 'other') as 'phone' | 'visit' | 'other',
      date: item.date,
      content: item.content || item.summary || '',
      consultantName: item.consultantName,
    });
    setManualModalOpen(true);
  };

  // 수동 상담 삭제
  const handleDeleteManual = async (item: ConsultationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 상담 이력을 삭제하시겠습니까?')) return;

    try {
      const res = await authFetch(
        `/api/v2/patients/${patientId}/manual-consultations?consultationId=${item.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        fetchConsultations();
      } else {
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('수동 상담 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 상담 이력 조회 함수
  const fetchConsultations = async () => {
    setIsLoading(true);
    try {
      // 통화/채팅/수동 이력 조회
      let callChatItems: ConsultationItem[] = [];
      const res = await authFetch(`/api/v2/patients/${patientId}/consultations?type=${filter === 'all' ? 'all' : filter}&limit=20`);
      const resData = await res.json();
      if (resData.success) {
        callChatItems = resData.data;
      }

      // 상담 결과 조회 (consultations_v2) - 항상 조회
      const resultsRes = await authFetch(`/api/v2/consultations?patientId=${patientId}&limit=50`);
      const resultsData = await resultsRes.json();
      let resultItems: ConsultationItem[] = [];
      if (resultsData.success && resultsData.data?.consultations) {
        // 상담 결과를 ConsultationItem 형태로 변환
        // 내원상담(visit)은 manualConsultations_v2에서 표시하므로 제외 (중복 방지)
        // → 대신 수동상담 항목에 consultationResultId를 붙여서 수정/삭제 버튼 표시
        resultItems = resultsData.data.consultations
          .filter((r: ConsultationResult) => r.type !== 'visit')
          .map((r: ConsultationResult) => ({
            id: `result_${r.id}`,
            type: 'result' as const,
            date: r.createdAt,
            consultantName: r.consultantName,
            resultType: r.type,
            resultStatus: r.status,
            treatment: r.treatment,
            originalAmount: r.originalAmount,
            finalAmount: r.finalAmount,
            disagreeReasons: r.disagreeReasons,
            appointmentDate: r.appointmentDate,
            callbackDate: r.callbackDate,
            memo: r.memo,
            closedReason: r.closedReason,
            closedReasonCustom: r.closedReasonCustom,
            linkedCallLogId: r.callLogId,
            linkedManualId: r.manualConsultationId,
          }));
      }

      // 결과를 활동에 연결 (callLogId / manualConsultationId 매칭)
      const linkedResultMap = new Map<string, ConsultationItem>();
      const unlinkedResults: ConsultationItem[] = [];

      for (const result of resultItems) {
        if (result.linkedCallLogId) {
          linkedResultMap.set(result.linkedCallLogId, result);
        } else if (result.linkedManualId) {
          linkedResultMap.set(result.linkedManualId, result);
        } else {
          unlinkedResults.push(result);
        }
      }

      // 내원상담 결과 → 수동상담 ID 매핑 (수정/삭제 버튼용)
      // visit 결과는 resultItems에서 제외했지만, 수동상담 항목에 consultationResultId를 붙여야 함
      const visitResultMap = new Map<string, { id: string; data: ConsultationItem }>();
      if (resultsData.success && resultsData.data?.consultations) {
        for (const r of resultsData.data.consultations) {
          if (r.type === 'visit') {
            // manualConsultationId로 매핑 (신규 데이터)
            if (r.manualConsultationId) {
              visitResultMap.set(r.manualConsultationId, {
                id: r.id,
                data: {
                  id: `result_${r.id}`, type: 'result', date: r.createdAt,
                  consultantName: r.consultantName, resultType: r.type,
                  resultStatus: r.status, treatment: r.treatment,
                  originalAmount: r.originalAmount, finalAmount: r.finalAmount,
                  disagreeReasons: r.disagreeReasons, appointmentDate: r.appointmentDate,
                  callbackDate: r.callbackDate, memo: r.memo,
                  closedReason: r.closedReason, closedReasonCustom: r.closedReasonCustom,
                },
              });
            }
          }
        }
      }

      // 기존 데이터 호환: manualConsultationId 없는 visit 결과 → 날짜 매칭
      const unmatchedManualIds = callChatItems
        .filter((item) => item.type === 'manual' && item.source === 'consultation_result' && !visitResultMap.has(item.id))
        .map((item) => ({ id: item.id, date: new Date(item.date).getTime() }));
      if (unmatchedManualIds.length > 0 && resultsData.success && resultsData.data?.consultations) {
        for (const r of resultsData.data.consultations) {
          if (r.type === 'visit' && !r.manualConsultationId) {
            const resultTime = new Date(r.createdAt).getTime();
            const matchIdx = unmatchedManualIds.findIndex((m) => Math.abs(m.date - resultTime) < 5 * 60 * 1000);
            if (matchIdx >= 0) {
              visitResultMap.set(unmatchedManualIds[matchIdx].id, {
                id: r.id,
                data: {
                  id: `result_${r.id}`, type: 'result', date: r.createdAt,
                  consultantName: r.consultantName, resultType: r.type,
                  resultStatus: r.status, treatment: r.treatment,
                  originalAmount: r.originalAmount, finalAmount: r.finalAmount,
                  disagreeReasons: r.disagreeReasons, appointmentDate: r.appointmentDate,
                  callbackDate: r.callbackDate, memo: r.memo,
                  closedReason: r.closedReason, closedReasonCustom: r.closedReasonCustom,
                },
              });
              unmatchedManualIds.splice(matchIdx, 1);
            }
          }
        }
      }

      // callLogId 없는 phone 결과 → 가장 가까운 통화 기록에 날짜 매칭 (레거시 데이터 호환)
      if (unlinkedResults.length > 0) {
        const callItems = callChatItems.filter((item) => item.type === 'call' && !linkedResultMap.has(item.id));
        for (const result of [...unlinkedResults]) {
          if (result.resultType !== 'phone') continue;
          const resultTime = new Date(result.date).getTime();
          // 같은 날(24시간 이내) 가장 가까운 통화 찾기
          let bestMatch: { id: string; diff: number } | null = null;
          for (const call of callItems) {
            const diff = Math.abs(new Date(call.date).getTime() - resultTime);
            if (diff < 24 * 60 * 60 * 1000 && (!bestMatch || diff < bestMatch.diff)) {
              bestMatch = { id: call.id, diff };
            }
          }
          if (bestMatch && !linkedResultMap.has(bestMatch.id)) {
            linkedResultMap.set(bestMatch.id, result);
            const idx = unlinkedResults.indexOf(result);
            if (idx >= 0) unlinkedResults.splice(idx, 1);
          }
        }
      }

      // 활동 항목에 linkedResult 연결 + 내원상담 수동항목에 consultationResultId 추가
      const enrichedItems = callChatItems.map((item) => {
        const linkedResult = linkedResultMap.get(item.id);
        if (linkedResult) {
          return { ...item, linkedResult };
        }
        // source='consultation_result' 수동상담 → consultationResultId 붙이기
        const visitResult = visitResultMap.get(item.id);
        if (visitResult) {
          return { ...item, consultationResultId: visitResult.id, consultationResultData: visitResult.data };
        }
        return item;
      });

      // 필터에 따라 목록 구성 (독립 result 항목은 표시하지 않음 — 반드시 활동에 연결)
      let mergedItems: ConsultationItem[] = [];
      if (filter === 'all') {
        mergedItems = enrichedItems.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      } else {
        mergedItems = enrichedItems;
      }

      setConsultations(mergedItems);

      // AI 분석 안 된 채팅 자동 분석 (백그라운드)
      const unanalyzedChats = callChatItems.filter(
        (item: ConsultationItem) => item.type === 'chat' && !item.aiAnalysis
      );

      if (unanalyzedChats.length > 0) {
        setAutoAnalyzingIds(new Set(unanalyzedChats.map((c: ConsultationItem) => c.id)));

        for (const chat of unanalyzedChats) {
          try {
            const analyzeRes = await authFetch('/api/v2/channel-chats/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId: chat.id }),
            });

            const analyzeData = await analyzeRes.json();
            if (analyzeData.success) {
              setConsultations((prev) =>
                prev.map((item) =>
                  item.id === chat.id
                    ? {
                        ...item,
                        summary: analyzeData.data.summary,
                        aiAnalysis: analyzeData.data,
                      }
                    : item
                )
              );
            }
          } catch (analyzeError) {
            console.error('채팅 자동 분석 오류:', analyzeError);
          } finally {
            setAutoAnalyzingIds((prev) => {
              const next = new Set(prev);
              next.delete(chat.id);
              return next;
            });
          }
        }
      }
    } catch (error) {
      console.error('상담 이력 조회 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 상담 이력 조회
  useEffect(() => {
    if (patientId) {
      fetchConsultations();
    }
  }, [patientId, filter]);

  // 시간 포맷
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  // 표시할 항목 (확장 여부에 따라)
  const displayItems = isExpanded ? consultations : consultations.slice(0, 5);

  return (
    <div className={`bg-white rounded-xl border ${className}`}>
      {/* 헤더 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Clock size={18} className="text-gray-400" />
            상담 이력
            <span className="text-sm font-normal text-gray-500">({consultations.length}건)</span>
          </h3>
          <button
            onClick={() => setManualModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <Plus size={14} />
            수동 입력
          </button>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-1 mt-3 flex-wrap">
          {[
            { value: 'all' as FilterType, label: '전체' },
            { value: 'call' as FilterType, label: '📞 전화' },
            { value: 'chat' as FilterType, label: '💬 채팅' },
            { value: 'manual' as FilterType, label: '✏️ 수동' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === tab.value
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="divide-y">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">로딩 중...</div>
        ) : displayItems.length === 0 ? (
          <div className="p-8 text-center text-gray-400">상담 이력이 없습니다</div>
        ) : (
          displayItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.type === 'call' && onSelectCall) {
                  onSelectCall(item.id);
                } else if (item.type === 'chat') {
                  setSelectedChatId(item.id);
                  setChatModalOpen(true);
                }
                // manual 타입은 클릭 동작 없음
              }}
              className={`w-full p-4 text-left ${item.type !== 'manual' ? 'hover:bg-gray-50 cursor-pointer' : ''} transition-colors`}
            >
              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                {(() => {
                  const display = getItemDisplay(item);
                  return (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${display.iconBg}`}>
                      {display.icon}
                    </div>
                  );
                })()}

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    {/* 타입 라벨 (통일) */}
                    {(() => {
                      const display = getItemDisplay(item);
                      return (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${display.labelColor}`}>
                          {display.label}
                        </span>
                      );
                    })()}

                    {/* 내원상담 결과 상태 뱃지 */}
                    {item.type === 'manual' && item.source === 'consultation_result' && item.status && (() => {
                      const badge = getResultStatusBadge(item.status);
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      );
                    })()}

                    {/* 날짜/시간 */}
                    <span className="text-gray-500">
                      {format(new Date(item.date), 'M/d HH:mm', { locale: ko })}
                    </span>

                    {/* 통화 시간 */}
                    {item.type === 'call' && item.duration !== undefined && (
                      <span className="text-gray-400">({formatTime(item.duration)})</span>
                    )}

                    {/* 자동/수동 구분 */}
                    {(item.type === 'call' || item.type === 'manual') && (
                      <span className="px-1 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">
                        {item.type === 'manual' ? '수동' : '자동'}
                      </span>
                    )}

                    {/* 통화 상태 */}
                    {item.status === 'missed' && (
                      <span className="text-xs text-red-500">부재중</span>
                    )}

                    {/* AI 코칭 완료 뱃지 */}
                    {item.type === 'call' && item.hasCoaching && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-violet-100 text-violet-600 font-medium">
                        ✨ AI 코칭
                      </span>
                    )}
                  </div>

                  {/* 통화 AI 요약 미리보기 */}
                  {item.type === 'call' && item.summary && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {item.summary}
                    </p>
                  )}

                  {/* 수동 입력은 원문 표시 */}
                  {item.type === 'manual' && item.content && (
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                      {item.content}
                    </p>
                  )}

                  {/* AI 분석 - 채팅만 버튼/로딩 표시 */}
                  {item.type === 'chat' && !(item.aiAnalysis && (item.aiAnalysis.interest || item.aiAnalysis.followUp || item.aiAnalysis.summary)) ? (
                    // 채팅인데 AI 분석이 없는 경우
                    autoAnalyzingIds.has(item.id) || analyzingChatId === item.id ? (
                      // 자동 분석 중이면 로딩 표시
                      <div className="flex items-center gap-1 mt-2 text-purple-500 text-xs">
                        <Loader2 size={12} className="animate-spin" />
                        AI 분석 중...
                      </div>
                    ) : (
                      // 분석 버튼 표시 (자동 분석 실패 시 수동 실행 가능)
                      <button
                        onClick={(e) => handleAnalyzeChat(item.id, e)}
                        className="flex items-center gap-1 mt-2 px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-lg hover:bg-purple-200 transition-colors"
                      >
                        <Sparkles size={12} />
                        AI 요약
                      </button>
                    )
                  ) : null}

                  {/* 메모 (통화/채팅 항목에만 표시) */}
                  {(item.type === 'call' || item.type === 'chat') && (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      {editingMemoId === item.id ? (
                        // 편집 모드
                        <div className="flex flex-col gap-1.5">
                          <textarea
                            value={memoText}
                            onChange={(e) => setMemoText(e.target.value)}
                            placeholder="메모를 입력하세요..."
                            className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-orange-300 focus:border-orange-300"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleSaveMemo(item.id)}
                              disabled={savingMemo}
                              className="flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 disabled:opacity-50"
                            >
                              {savingMemo ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                              저장
                            </button>
                            <button
                              onClick={() => setEditingMemoId(null)}
                              className="px-2 py-0.5 text-gray-500 text-xs rounded hover:bg-gray-100"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : item.memo ? (
                        // 메모 표시
                        <div
                          className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-amber-100 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setEditingMemoId(item.id); setMemoText(item.memo || ''); }}
                        >
                          <StickyNote size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-700 whitespace-pre-wrap">{item.memo}</span>
                        </div>
                      ) : (
                        // 메모 추가 버튼
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingMemoId(item.id); setMemoText(''); }}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
                        >
                          <StickyNote size={11} />
                          <span>+ 메모</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 우측: 상담사명 + 액션 버튼 */}
                <div className="flex items-center gap-1 flex-shrink-0 self-center">
                  {/* 상담사명 (한번만 표시) */}
                  {item.consultantName && (
                    <span className="text-xs text-gray-400 mr-1">{item.consultantName}</span>
                  )}
                  {/* 상세보기 (통화/채팅) */}
                  {item.type !== 'manual' && (
                    <span className="text-xs text-orange-500">상세보기</span>
                  )}
                  {/* 수동 입력: 수정/삭제 */}
                  {item.type === 'manual' && item.source !== 'consultation_result' && (
                    <>
                      <button
                        onClick={(e) => handleEditManual(item, e)}
                        className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                        title="수정"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteManual(item, e)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  {/* 내원상담 결과에서 생성된 항목: 수정/삭제 */}
                  {item.type === 'manual' && item.source === 'consultation_result' && item.consultationResultId && (
                    <>
                      {onEditResult && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditResult(item.consultationResultId!, item.consultationResultData!); }}
                          className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                          title="수정"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {onDeleteResult && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('이 상담 결과를 삭제하시겠습니까?')) {
                              onDeleteResult(item.consultationResultId!);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 연결된 상담 결과 (활동 하단에 중첩 표시) */}
              {item.linkedResult && (
                <div className="ml-11 mt-1 mb-2 pl-3 border-l-2 border-gray-200">
                  <div className="flex items-center gap-2 text-sm py-1.5 flex-wrap">
                    {(() => {
                      const badge = getResultStatusBadge(item.linkedResult!.resultStatus);
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                    {item.linkedResult.treatment && (
                      <span className="text-gray-600">{item.linkedResult.treatment}</span>
                    )}
                    {item.linkedResult.resultStatus === 'agreed' && item.linkedResult.finalAmount !== undefined && item.linkedResult.finalAmount > 0 && (
                      <span className="text-emerald-600 text-xs">{item.linkedResult.finalAmount.toLocaleString()}원</span>
                    )}
                    {item.linkedResult.resultStatus === 'disagreed' && item.linkedResult.disagreeReasons && item.linkedResult.disagreeReasons.length > 0 && (
                      <span className="text-rose-500 text-xs">{item.linkedResult.disagreeReasons.join(', ')}</span>
                    )}
                    {item.linkedResult.resultStatus === 'agreed' && item.linkedResult.appointmentDate && (
                      <span className="text-emerald-500 text-xs">예약 {format(new Date(item.linkedResult.appointmentDate), 'M/d', { locale: ko })}</span>
                    )}
                    {(item.linkedResult.resultStatus === 'disagreed' || item.linkedResult.resultStatus === 'pending' || item.linkedResult.resultStatus === 'no_answer') && item.linkedResult.callbackDate && (
                      <span className="text-amber-500 text-xs">콜백 {format(new Date(item.linkedResult.callbackDate), 'M/d', { locale: ko })}</span>
                    )}
                    {item.linkedResult.consultantName && (
                      <span className="text-gray-400 text-xs">({item.linkedResult.consultantName})</span>
                    )}
                    {/* 연결된 결과 수정/삭제 버튼 */}
                    {(onEditResult || onDeleteResult) && (
                      <div className="flex items-center gap-0.5 ml-auto">
                        {onEditResult && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEditResult(item.linkedResult!.id.replace('result_', ''), item.linkedResult!); }}
                            className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="수정"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {onDeleteResult && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('이 상담 결과를 삭제하시겠습니까?')) {
                                onDeleteResult(item.linkedResult!.id.replace('result_', ''));
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {item.linkedResult.memo && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.linkedResult.memo}</p>
                  )}
                </div>
              )}

              {/* 결과 미입력 표시 + 입력 버튼 (통화/수동입력에만, 결과가 없을 때, 부재중 제외) */}
              {(item.type === 'call' || (item.type === 'manual' && item.source !== 'consultation_result')) && !item.linkedResult && onAddResult && item.status !== 'missed' && (
                <div className="ml-11 mt-1 mb-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddResult(item.id, item.type as 'call' | 'manual');
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    <ClipboardList size={12} />
                    결과 입력
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 더보기 */}
      {consultations.length > 5 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 text-sm text-orange-600 hover:bg-gray-50 flex items-center justify-center gap-1 border-t"
        >
          <span>{isExpanded ? '접기' : `더보기 (${consultations.length - 5}건)`}</span>
          <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* 채팅 상세 모달 */}
      {selectedChatId && (
        <ChatDetailModal
          isOpen={chatModalOpen}
          onClose={() => {
            setChatModalOpen(false);
            setSelectedChatId(null);
          }}
          chatId={selectedChatId}
        />
      )}

      {/* 수동 상담 입력/수정 모달 */}
      <ManualConsultationModal
        isOpen={manualModalOpen}
        onClose={() => { setManualModalOpen(false); setEditingManual(null); }}
        patientId={patientId}
        patientName={patientName}
        onSuccess={() => {
          fetchConsultations();
          setEditingManual(null);
        }}
        editData={editingManual}
      />
    </div>
  );
}

export default ConsultationHistoryCard;
