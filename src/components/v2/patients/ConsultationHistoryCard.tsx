'use client';

import React, { useState, useEffect } from 'react';
import { Phone, MessageCircle, Clock, ChevronDown, Sparkles, X, Loader2, Plus, Building, Edit3, ClipboardCheck, ClipboardList, CheckCircle, XCircle, AlertCircle, PhoneMissed, Ban } from 'lucide-react';
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
}

type FilterType = 'all' | 'call' | 'chat' | 'manual' | 'result';

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
        fetch(`/api/v2/channel-chats/${chatId}`),
        fetch(`/api/v2/channel-chats/${chatId}/messages?limit=100`),
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
      const res = await fetch('/api/v2/channel-chats/analyze', {
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
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p className={`text-xs mt-1 ${
                        msg.senderType === 'agent' ? 'text-blue-200' : 'text-gray-400'
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

export function ConsultationHistoryCard({ patientId, patientName = '', className = '', onSelectCall, onAddResult }: ConsultationHistoryCardProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [consultations, setConsultations] = useState<ConsultationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // 채팅 상세 모달
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatModalOpen, setChatModalOpen] = useState(false);

  // 수동 입력 모달
  const [manualModalOpen, setManualModalOpen] = useState(false);

  // 인라인 AI 분석 상태
  const [analyzingChatId, setAnalyzingChatId] = useState<string | null>(null);
  // 자동 분석 중인 채팅 ID 목록
  const [autoAnalyzingIds, setAutoAnalyzingIds] = useState<Set<string>>(new Set());

  // 채팅 AI 분석 (목록에서 바로 실행)
  const handleAnalyzeChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 상세보기 클릭 방지
    if (analyzingChatId) return;

    setAnalyzingChatId(chatId);
    try {
      const res = await fetch('/api/v2/channel-chats/analyze', {
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

  // 상담 이력 조회 함수
  const fetchConsultations = async () => {
    setIsLoading(true);
    try {
      // 통화/채팅/수동 이력 조회 (result 필터가 아닐 때만)
      let callChatItems: ConsultationItem[] = [];
      if (filter !== 'result') {
        const res = await fetch(`/api/v2/patients/${patientId}/consultations?type=${filter === 'all' ? 'all' : filter}&limit=20`);
        const data = await res.json();
        if (data.success) {
          callChatItems = data.data;
        }
      }

      // 상담 결과 조회 (consultations_v2) - 항상 조회
      const resultsRes = await fetch(`/api/v2/consultations?patientId=${patientId}&limit=50`);
      const resultsData = await resultsRes.json();
      let resultItems: ConsultationItem[] = [];
      if (resultsData.success && resultsData.data?.consultations) {
        // 상담 결과를 ConsultationItem 형태로 변환
        // 내원상담(visit)은 manualConsultations_v2에서 표시하므로 제외 (중복 방지)
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

      // 활동 항목에 linkedResult 연결
      const enrichedItems = callChatItems.map((item) => {
        const linkedResult = linkedResultMap.get(item.id);
        if (linkedResult) {
          return { ...item, linkedResult };
        }
        return item;
      });

      // 필터에 따라 목록 구성
      let mergedItems: ConsultationItem[] = [];
      if (filter === 'result') {
        mergedItems = resultItems;
      } else if (filter === 'all') {
        // 연결된 결과는 활동 밑에 표시하므로 unlinkedResults만 독립 표시
        mergedItems = [...enrichedItems, ...unlinkedResults].sort(
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
            const analyzeRes = await fetch('/api/v2/channel-chats/analyze', {
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
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus size={14} />
            수동 입력
          </button>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-1 mt-3 flex-wrap">
          {[
            { value: 'all' as FilterType, label: '전체' },
            { value: 'result' as FilterType, label: '📋 상담결과' },
            { value: 'call' as FilterType, label: '📞 전화' },
            { value: 'chat' as FilterType, label: '💬 채팅' },
            { value: 'manual' as FilterType, label: '✏️ 수동' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === tab.value
                  ? 'bg-blue-100 text-blue-700'
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
              className={`w-full p-4 text-left ${item.type !== 'manual' && item.type !== 'result' ? 'hover:bg-gray-50 cursor-pointer' : ''} transition-colors`}
            >
              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.type === 'call' ? 'bg-blue-100'
                    : item.type === 'manual' ? 'bg-amber-100'
                    : item.type === 'result' ? (
                      item.resultStatus === 'agreed' ? 'bg-emerald-100'
                      : item.resultStatus === 'disagreed' ? 'bg-rose-100'
                      : item.resultStatus === 'no_answer' ? 'bg-slate-100'
                      : item.resultStatus === 'closed' ? 'bg-gray-100'
                      : 'bg-amber-100'
                    )
                    : 'bg-green-100'
                  }`}
                >
                  {item.type === 'call' ? (
                    <Phone size={14} className="text-blue-600" />
                  ) : item.type === 'manual' ? (
                    item.manualType === 'phone' ? (
                      <Phone size={14} className="text-amber-600" />
                    ) : item.manualType === 'visit' ? (
                      <Building size={14} className="text-amber-600" />
                    ) : (
                      <Edit3 size={14} className="text-amber-600" />
                    )
                  ) : item.type === 'result' ? (
                    item.resultStatus === 'agreed' ? (
                      <CheckCircle size={14} className="text-emerald-600" />
                    ) : item.resultStatus === 'disagreed' ? (
                      <XCircle size={14} className="text-rose-600" />
                    ) : item.resultStatus === 'no_answer' ? (
                      <PhoneMissed size={14} className="text-slate-600" />
                    ) : item.resultStatus === 'closed' ? (
                      <Ban size={14} className="text-gray-600" />
                    ) : (
                      <AlertCircle size={14} className="text-amber-600" />
                    )
                  ) : (
                    <span className="text-sm">
                      {CHANNEL_CONFIG[item.channel as ChannelType]?.icon || '💬'}
                    </span>
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    {/* 타입 뱃지 */}
                    {item.type === 'call' ? (
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          item.direction === 'inbound'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {item.direction === 'inbound' ? '수신' : '발신'}
                      </span>
                    ) : item.type === 'manual' ? (
                      <>
                        {/* 내원상담 결과에서 자동 생성된 경우 */}
                        {item.manualType === 'visit' && item.source === 'consultation_result' ? (
                          <>
                            <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                              내원상담
                            </span>
                            {item.status && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.status === 'agreed' ? 'bg-emerald-100 text-emerald-700'
                                : item.status === 'disagreed' ? 'bg-rose-100 text-rose-700'
                                : item.status === 'closed' ? 'bg-gray-200 text-gray-700'
                                : 'bg-amber-100 text-amber-700'
                              }`}>
                                {item.status === 'agreed' ? '동의'
                                 : item.status === 'disagreed' ? '미동의'
                                 : item.status === 'closed' ? '종결'
                                 : '보류'}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                              수동
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                              {item.manualType === 'phone' ? '전화' : item.manualType === 'visit' ? '내원' : '기타'}
                            </span>
                          </>
                        )}
                      </>
                    ) : item.type === 'result' ? (
                      <>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          item.resultType === 'phone' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {item.resultType === 'phone' ? '전화상담' : '내원상담'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.resultStatus === 'agreed' ? 'bg-emerald-100 text-emerald-700'
                          : item.resultStatus === 'disagreed' ? 'bg-rose-100 text-rose-700'
                          : item.resultStatus === 'no_answer' ? 'bg-slate-100 text-slate-700'
                          : item.resultStatus === 'closed' ? 'bg-gray-200 text-gray-700'
                          : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.resultStatus === 'agreed' ? '동의'
                           : item.resultStatus === 'disagreed' ? '미동의'
                           : item.resultStatus === 'no_answer' ? '부재중'
                           : item.resultStatus === 'closed' ? '종결'
                           : '보류'}
                        </span>
                      </>
                    ) : (
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          CHANNEL_CONFIG[item.channel as ChannelType]?.bgColor || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {CHANNEL_CONFIG[item.channel as ChannelType]?.label || '채팅'}
                      </span>
                    )}

                    {/* 날짜/시간 */}
                    <span className="text-gray-500">
                      {format(new Date(item.date), 'M/d HH:mm', { locale: ko })}
                    </span>

                    {/* 통화 시간 */}
                    {item.type === 'call' && item.duration !== undefined && (
                      <span className="text-gray-400">({formatTime(item.duration)})</span>
                    )}

                    {/* 통화 상태 */}
                    {item.type === 'call' && item.status === 'missed' && (
                      <span className="text-xs text-red-500">부재중</span>
                    )}

                    {/* 상담 결과 담당자 */}
                    {item.type === 'result' && item.consultantName && (
                      <span className="text-gray-400 text-xs">({item.consultantName})</span>
                    )}
                  </div>

                  {/* 요약 - 수동 입력은 원문 그대로, 상담결과는 상세 정보, 나머지는 bullet point */}
                  {item.type === 'manual' && item.content ? (
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                      {item.content}
                    </p>
                  ) : item.type === 'result' ? (
                    <div className="mt-1 space-y-1 text-sm text-gray-700">
                      {/* 치료/관심항목 */}
                      {item.treatment && (
                        <p><span className="text-gray-500">치료:</span> {item.treatment}</p>
                      )}
                      {/* 금액 정보 (동의 시) */}
                      {item.resultStatus === 'agreed' && item.finalAmount !== undefined && item.finalAmount > 0 && (
                        <p><span className="text-gray-500">금액:</span> {item.finalAmount.toLocaleString()}원</p>
                      )}
                      {/* 미동의 사유 */}
                      {item.resultStatus === 'disagreed' && item.disagreeReasons && item.disagreeReasons.length > 0 && (
                        <p><span className="text-gray-500">사유:</span> {item.disagreeReasons.join(', ')}</p>
                      )}
                      {/* 종결 사유 */}
                      {item.resultStatus === 'closed' && item.closedReason && (
                        <p><span className="text-gray-500">종결 사유:</span> {item.closedReason === '기타' && item.closedReasonCustom ? item.closedReasonCustom : item.closedReason}</p>
                      )}
                      {/* 예약일 (동의 시) */}
                      {item.resultStatus === 'agreed' && item.appointmentDate && (
                        <p><span className="text-gray-500">예약일:</span> {format(new Date(item.appointmentDate), 'M/d (EEE) HH:mm', { locale: ko })}</p>
                      )}
                      {/* 콜백 예정일 (미동의/보류/부재중 시) */}
                      {(item.resultStatus === 'disagreed' || item.resultStatus === 'pending' || item.resultStatus === 'no_answer') && item.callbackDate && (
                        <p><span className="text-gray-500">콜백:</span> {format(new Date(item.callbackDate), 'M/d (EEE)', { locale: ko })}</p>
                      )}
                      {/* 메모 */}
                      {item.memo && (
                        <p className="text-gray-500 text-xs">{item.memo}</p>
                      )}
                    </div>
                  ) : item.summary && (
                    <ul className="mt-1 space-y-0.5">
                      {formatSummaryWithBullets(item.summary).slice(0, 3).map((text, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-1.5">
                          <span className="text-purple-400 mt-0.5">•</span>
                          <span className="line-clamp-1">{text}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* AI 분석 - 실제 분석 내용이 있을 때만 표시 */}
                  {item.aiAnalysis && (item.aiAnalysis.interest || item.aiAnalysis.followUp || item.aiAnalysis.summary) ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Sparkles size={12} className="text-purple-500" />
                      <span className="text-xs text-purple-600">
                        {item.aiAnalysis.interest && `관심: ${item.aiAnalysis.interest}`}
                        {item.aiAnalysis.followUp && ` · ${item.aiAnalysis.followUp}`}
                      </span>
                    </div>
                  ) : item.type === 'chat' ? (
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
                </div>

                {/* 상세보기 안내 (수동, 상담결과 제외) */}
                {item.type !== 'manual' && item.type !== 'result' && (
                  <div className="text-xs text-blue-500 flex-shrink-0 self-center">
                    상세보기
                  </div>
                )}
                {/* 수동 입력 상담자 표시 */}
                {item.type === 'manual' && item.consultantName && (
                  <div className="text-xs text-gray-400 flex-shrink-0 self-center">
                    {item.consultantName}
                  </div>
                )}
              </div>

              {/* 연결된 상담 결과 (중첩 표시) */}
              {item.linkedResult && (
                <div className="ml-11 mt-1 mb-2 pl-3 border-l-2 border-gray-200">
                  <div className="flex items-center gap-2 text-sm py-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.linkedResult.resultStatus === 'agreed' ? 'bg-emerald-100 text-emerald-700'
                      : item.linkedResult.resultStatus === 'disagreed' ? 'bg-rose-100 text-rose-700'
                      : item.linkedResult.resultStatus === 'no_answer' ? 'bg-slate-100 text-slate-700'
                      : item.linkedResult.resultStatus === 'closed' ? 'bg-gray-200 text-gray-700'
                      : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.linkedResult.resultStatus === 'agreed' ? '동의'
                       : item.linkedResult.resultStatus === 'disagreed' ? '미동의'
                       : item.linkedResult.resultStatus === 'no_answer' ? '부재중'
                       : item.linkedResult.resultStatus === 'closed' ? '종결'
                       : '보류'}
                    </span>
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
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
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
          className="w-full p-3 text-sm text-blue-600 hover:bg-gray-50 flex items-center justify-center gap-1 border-t"
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

      {/* 수동 상담 입력 모달 */}
      <ManualConsultationModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        patientId={patientId}
        patientName={patientName}
        onSuccess={() => {
          fetchConsultations();
        }}
      />
    </div>
  );
}

export default ConsultationHistoryCard;
