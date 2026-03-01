// src/components/v2/patients/CallDetailModal.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Phone, Clock, FileText, Play, Pause, Volume2, AlertCircle, Loader2, Square, Sparkles, ChevronDown, ChevronUp, Target, Lightbulb, RefreshCw } from 'lucide-react';
import { useAppSelector } from '@/hooks/reduxHooks';
import type { AICoachingResult } from '@/types/v2';

// AI 요약 텍스트를 bullet point로 포맷팅하는 함수
function formatSummaryWithBullets(summary: string): string[] {
  if (!summary) return [];

  // 1. 이미 bullet point가 있으면 그대로 분리
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
      .filter(s => s.length > 3);
    if (parts.length > 1) return parts;
  }

  return sentences;
}

interface CallDetail {
  id: string;
  phone: string;
  patientId: string | null;
  patientName: string | null;
  direction: 'inbound' | 'outbound';
  status: string;
  duration: number;
  recordingUrl: string | null;
  startedAt: string;
  endedAt: string;
  aiStatus: string;
  aiAnalysis: {
    classification: string;
    patientName?: string;
    interest?: string;
    interestDetail?: string;
    temperature: string;
    summary: string;
    followUp: string;
    concerns: string[];
    preferredTime?: string;
    confidence: number;
    transcript?: string;
    consultationResult?: {
      status?: string;
      disagreeReasons?: string[];
    };
  } | null;
  aiCoaching?: AICoachingResult;
  createdAt: string;
}

interface CallDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  callLogId: string;
  isMaster?: boolean; // 더 이상 사용하지 않음 (하위 호환성 유지)
}

export function CallDetailModal({
  isOpen,
  onClose,
  callLogId,
}: CallDetailModalProps) {
  const { user } = useAppSelector((state) => state.auth);

  // 관리자 권한 체크 (admin 또는 master만 녹취 재생 가능)
  const isAdmin = user?.role === 'admin' || user?.role === 'master';

  const [callDetail, setCallDetail] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // AI 코칭 상태
  const [coaching, setCoaching] = useState<AICoachingResult | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const [strengthsExpanded, setStrengthsExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen || !callLogId) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v2/call-logs/${callLogId}`);
        if (!response.ok) {
          throw new Error('통화 상세 정보를 불러올 수 없습니다');
        }
        const data = await response.json();
        setCallDetail(data);
        // 캐시된 코칭 결과가 있으면 로드
        if (data.aiCoaching) {
          setCoaching(data.aiCoaching);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();

    // Cleanup on close
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setAudioLoading(false);
      setAudioError(null);
      setCoaching(null);
      setCoachingError(null);
      setStrengthsExpanded(false);
    };
  }, [isOpen, callLogId]);

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const handlePlayRecording = async () => {
    if (!callLogId) return;

    // 이미 재생 중이면 일시정지
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // 이미 로드된 오디오가 있으면 재생
    if (audioRef.current && !isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    // 새로 로드
    setAudioLoading(true);
    setAudioError(null);

    try {
      // 우리 API에서 녹취 파일 가져오기
      const recordingUrl = `/api/v2/call-logs/${callLogId}/recording`;
      const response = await fetch(recordingUrl);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('녹취 파일을 찾을 수 없습니다');
        }
        throw new Error('녹취 파일 로드 실패');
      }

      // Blob으로 변환하여 URL 생성
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const audio = new Audio(blobUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setAudioError('녹취 파일 재생 실패');
        setIsPlaying(false);
      };

      await audio.play();
      audioRef.current = audio;
      setIsPlaying(true);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : '녹취 파일 로드 실패');
    } finally {
      setAudioLoading(false);
    }
  };

  const handleStopRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // AI 코칭 요청
  const handleRequestCoaching = useCallback(async (force = false) => {
    if (!callLogId) return;
    setCoachingLoading(true);
    setCoachingError(null);
    try {
      const response = await fetch('/api/v2/call-analysis/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId, force }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '코칭 분석에 실패했습니다');
      }
      const data = await response.json();
      setCoaching(data.coaching);
    } catch (err) {
      setCoachingError(err instanceof Error ? err.message : '코칭 분석 오류');
    } finally {
      setCoachingLoading(false);
    }
  }, [callLogId]);

  // 코칭 표시 조건: transcript 존재 + 관리자
  const canShowCoaching = isAdmin
    && callDetail?.aiAnalysis?.transcript
    && callDetail.duration >= 10;

  // 점수 색상
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              callDetail?.direction === 'inbound' ? 'bg-blue-100' : 'bg-emerald-100'
            }`}>
              <Phone size={20} className={
                callDetail?.direction === 'inbound' ? 'text-blue-600' : 'text-emerald-600'
              } />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">통화 상세</h3>
              {callDetail && (
                <p className="text-sm text-gray-500">
                  {callDetail.direction === 'inbound' ? '수신' : '발신'} • {callDetail.phone}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-500">
              <AlertCircle size={20} className="mr-2" />
              {error}
            </div>
          ) : callDetail ? (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">통화 시간</p>
                  <p className="font-medium text-gray-900 flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" />
                    {formatDuration(callDetail.duration)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">통화 일시</p>
                  <p className="font-medium text-gray-900">
                    {formatDateTime(callDetail.startedAt)}
                  </p>
                </div>
              </div>

              {/* 녹취 재생 - 관리자만 표시 */}
              {isAdmin && callDetail.recordingUrl && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Volume2 size={20} className="text-purple-500" />
                      <span className="font-medium text-gray-900">녹취 파일</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePlayRecording}
                        disabled={audioLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          audioLoading
                            ? 'bg-gray-400 text-white cursor-wait'
                            : isPlaying
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                      >
                        {audioLoading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            로딩중...
                          </>
                        ) : isPlaying ? (
                          <>
                            <Pause size={16} />
                            일시정지
                          </>
                        ) : (
                          <>
                            <Play size={16} />
                            재생
                          </>
                        )}
                      </button>
                      {isPlaying && (
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <Square size={14} />
                          정지
                        </button>
                      )}
                    </div>
                  </div>
                  {/* 에러 메시지 */}
                  {audioError && (
                    <div className="mt-3 p-2 bg-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                      <AlertCircle size={16} />
                      {audioError}
                    </div>
                  )}
                </div>
              )}

              {/* AI 분석 결과 */}
              {callDetail.aiAnalysis && (
                <>
                  {/* 분류 및 요약 */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      <FileText size={18} className="text-blue-500" />
                      AI 분석 결과
                    </h4>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-blue-600 mb-1">분류</p>
                        <p className="font-bold text-blue-700">{callDetail.aiAnalysis.classification}</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-amber-600 mb-1">관심도</p>
                        <p className="font-bold text-amber-700">
                          {callDetail.aiAnalysis.temperature === 'hot' ? '🔥 높음' :
                           callDetail.aiAnalysis.temperature === 'warm' ? '🌤️ 보통' : '❄️ 낮음'}
                        </p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-emerald-600 mb-1">후속 조치</p>
                        <p className="font-bold text-emerald-700">{callDetail.aiAnalysis.followUp}</p>
                      </div>
                    </div>

                    {callDetail.aiAnalysis.interest && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">관심 분야</p>
                        <p className="font-medium text-gray-900">{callDetail.aiAnalysis.interest}</p>
                        {callDetail.aiAnalysis.interestDetail && (
                          <p className="text-sm text-gray-600 mt-1">{callDetail.aiAnalysis.interestDetail}</p>
                        )}
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-2">통화 요약</p>
                      <ul className="space-y-1.5">
                        {formatSummaryWithBullets(callDetail.aiAnalysis.summary).map((item, idx) => (
                          <li key={idx} className="text-gray-700 flex items-start gap-2">
                            <span className="text-purple-400 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {callDetail.aiAnalysis.concerns && callDetail.aiAnalysis.concerns.length > 0 && (
                      <div className="bg-orange-50 rounded-lg p-4">
                        <p className="text-xs text-orange-600 mb-2">고객 우려사항</p>
                        <ul className="space-y-1">
                          {callDetail.aiAnalysis.concerns.map((concern, idx) => (
                            <li key={idx} className="text-sm text-orange-700 flex items-start gap-2">
                              <span className="text-orange-400">•</span>
                              {concern}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* AI 상담 코칭 */}
                  {canShowCoaching && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <Sparkles size={18} className="text-violet-500" />
                          AI 상담 코칭
                        </h4>
                        {coaching && (
                          <button
                            onClick={() => handleRequestCoaching(true)}
                            disabled={coachingLoading}
                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                          >
                            <RefreshCw size={12} className={coachingLoading ? 'animate-spin' : ''} />
                            다시 분석
                          </button>
                        )}
                      </div>

                      {/* 코칭 결과가 없으면 요청 버튼 */}
                      {!coaching && !coachingLoading && !coachingError && (
                        <button
                          onClick={() => handleRequestCoaching()}
                          className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:from-violet-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Sparkles size={16} />
                          상담 코칭 분석 요청
                        </button>
                      )}

                      {/* 로딩 */}
                      {coachingLoading && (
                        <div className="flex items-center justify-center py-6 bg-violet-50 rounded-xl">
                          <Loader2 size={20} className="animate-spin text-violet-500 mr-2" />
                          <span className="text-violet-600 text-sm">AI가 상담을 분석하고 있습니다...</span>
                        </div>
                      )}

                      {/* 에러 */}
                      {coachingError && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                          <AlertCircle size={16} />
                          {coachingError}
                          <button
                            onClick={() => handleRequestCoaching()}
                            className="ml-auto text-red-500 hover:text-red-700 underline text-xs"
                          >
                            재시도
                          </button>
                        </div>
                      )}

                      {/* 코칭 결과 표시 */}
                      {coaching && !coachingLoading && (
                        <div className="space-y-3">
                          {/* 종합 점수 + 평가 */}
                          <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${getScoreColor(coaching.overallScore)}`}>
                                {coaching.overallScore}
                                <span className="text-sm font-normal">/100</span>
                              </div>
                              <span className="text-xs text-gray-400">종합 점수</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{coaching.overallComment}</p>
                          </div>

                          {/* 잘한 점 (접을 수 있음) */}
                          {coaching.strengths.length > 0 && (
                            <div className="bg-emerald-50 rounded-xl overflow-hidden">
                              <button
                                onClick={() => setStrengthsExpanded(!strengthsExpanded)}
                                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-emerald-100 transition-colors"
                              >
                                <span className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                                  <Target size={14} />
                                  잘한 점 ({coaching.strengths.length})
                                </span>
                                {strengthsExpanded ? <ChevronUp size={16} className="text-emerald-600" /> : <ChevronDown size={16} className="text-emerald-600" />}
                              </button>
                              {strengthsExpanded && (
                                <div className="px-4 pb-3 space-y-2">
                                  {coaching.strengths.map((s, idx) => (
                                    <div key={idx} className="bg-white rounded-lg p-3">
                                      <p className="text-sm font-medium text-emerald-800">{s.point}</p>
                                      {s.quote && (
                                        <p className="text-xs text-emerald-600 mt-1 italic">&ldquo;{s.quote}&rdquo;</p>
                                      )}
                                      <p className="text-xs text-gray-600 mt-1">{s.explanation}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 개선 필요 (기본 펼침) */}
                          {coaching.improvements.length > 0 && (
                            <div className="bg-amber-50 rounded-xl p-4 space-y-3">
                              <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                                <Lightbulb size={14} />
                                개선 포인트 ({coaching.improvements.length})
                              </p>
                              {coaching.improvements.map((imp, idx) => (
                                <div key={idx} className="bg-white rounded-lg p-3 space-y-2">
                                  <p className="text-sm font-medium text-amber-900">{imp.point}</p>
                                  {imp.quote && (
                                    <p className="text-xs text-gray-500 italic">&ldquo;{imp.quote}&rdquo;</p>
                                  )}
                                  <div className="text-xs space-y-1">
                                    <div className="flex items-start gap-2">
                                      <span className="text-rose-500 font-medium shrink-0">현재:</span>
                                      <span className="text-gray-600">{imp.currentApproach}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-emerald-600 font-medium shrink-0">제안:</span>
                                      <span className="text-gray-800 font-medium">{imp.suggestedApproach}</span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-500">{imp.reason}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 놓친 기회 */}
                          {coaching.missedOpportunities.length > 0 && (
                            <div className="bg-blue-50 rounded-xl p-4">
                              <p className="text-sm font-semibold text-blue-800 mb-2">놓친 기회</p>
                              <ul className="space-y-1">
                                {coaching.missedOpportunities.map((m, idx) => (
                                  <li key={idx} className="text-xs text-blue-700 flex items-start gap-2">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 다음 콜백 전략 */}
                          {coaching.nextCallStrategy && (
                            <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
                              <p className="text-sm font-semibold text-violet-800 mb-1 flex items-center gap-2">
                                <Phone size={14} />
                                다음 콜백 전략
                              </p>
                              <p className="text-sm text-violet-700 leading-relaxed">{coaching.nextCallStrategy}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 전사 텍스트 - 관리자(admin, master)만 표시 */}
                  {isAdmin && callDetail.aiAnalysis.transcript && (
                    <div className="border-t pt-4">
                      <h4 className="font-bold text-gray-900 mb-3">통화 전문</h4>
                      <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {callDetail.aiAnalysis.transcript}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* AI 분석 없는 경우 */}
              {!callDetail.aiAnalysis && (
                <div className="text-center py-8 text-gray-400">
                  <FileText size={32} className="mx-auto mb-2 opacity-50" />
                  <p>AI 분석 결과가 없습니다</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default CallDetailModal;
