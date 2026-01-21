// src/components/v2/patients/CallDetailModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, Clock, FileText, Play, Pause, Volume2, AlertCircle, Loader2, Square } from 'lucide-react';

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
  } | null;
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
  const [callDetail, setCallDetail] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();

    // Cleanup audio on close
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setAudioLoading(false);
      setAudioError(null);
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

              {/* 녹취 재생 */}
              {callDetail.recordingUrl && (
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

                  {/* 전사 텍스트 */}
                  {callDetail.aiAnalysis.transcript && (
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
