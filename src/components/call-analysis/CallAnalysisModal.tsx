'use client';

import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Bot,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Headphones,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react';
import type { CallAnalysis, AnalysisStatus } from '@/types/callAnalysis';

interface CallAnalysisModalProps {
  analysisId: string;
  onClose: () => void;
}

// 상태별 색상 및 라벨
const statusConfig: Record<AnalysisStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '대기중', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  stt_processing: { label: 'STT 처리중', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  stt_complete: { label: 'STT 완료', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  analyzing: { label: 'AI 분석중', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  complete: { label: '분석 완료', color: 'text-green-600', bgColor: 'bg-green-100' },
  failed: { label: '실패', color: 'text-red-600', bgColor: 'bg-red-100' },
};

// 상담 결과별 색상
const resultConfig: Record<string, { color: string; bgColor: string }> = {
  '예약완료': { color: 'text-green-700', bgColor: 'bg-green-100' },
  '예약예정': { color: 'text-blue-700', bgColor: 'bg-blue-100' },
  '보류': { color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  '거절': { color: 'text-red-700', bgColor: 'bg-red-100' },
  '단순문의': { color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export default function CallAnalysisModal({ analysisId, onClose }: CallAnalysisModalProps) {
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // 분석 데이터 조회
  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/call-analysis/recording?analysisId=${analysisId}`);
      const data = await response.json();

      if (data.success) {
        setAnalysis(data.data);
      } else {
        setError(data.error || '분석 데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [analysisId]);

  // 재분석 요청
  const handleRetry = async () => {
    if (!analysis) return;
    setRetrying(true);

    try {
      // STT가 완료되지 않은 경우 STT부터 재시도
      if (analysis.status === 'pending' || analysis.status === 'failed') {
        await fetch('/api/call-analysis/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysisId,
            recordingUrl: analysis.recordingUrl,
          }),
        });
      } else if (analysis.status === 'stt_complete') {
        // STT 완료 상태면 AI 분석만 재시도
        await fetch('/api/call-analysis/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisId }),
        });
      }

      // 잠시 후 다시 조회
      setTimeout(fetchAnalysis, 2000);
    } catch {
      setError('재분석 요청에 실패했습니다.');
    } finally {
      setRetrying(false);
    }
  };

  // 금액 포맷팅
  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  // 통화 시간 포맷팅
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-700">분석 데이터 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-md">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-6 h-6" />
            <span className="font-medium">오류 발생</span>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  const status = statusConfig[analysis.status] || statusConfig.pending;
  const resultStyle = analysis.analysis?.result
    ? resultConfig[analysis.analysis.result] || resultConfig['단순문의']
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI 통화 분석</h2>
              <p className="text-sm text-gray-500">{analysis.callerNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 상태 및 기본 정보 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}>
                {status.label}
              </span>
              {analysis.patientName && (
                <span className="flex items-center gap-1 text-gray-600">
                  <User className="w-4 h-4" />
                  {analysis.patientName}
                </span>
              )}
              <span className="flex items-center gap-1 text-gray-500 text-sm">
                <Clock className="w-4 h-4" />
                {formatDuration(analysis.duration)}
              </span>
            </div>

            {(analysis.status === 'failed' || analysis.status === 'pending' || analysis.status === 'stt_complete') && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                재분석
              </button>
            )}
          </div>

          {/* 분석 완료된 경우 */}
          {analysis.status === 'complete' && analysis.analysis && (
            <>
              {/* 요약 카드 */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">통화 요약</h3>
                    <p className="text-gray-700">{analysis.analysis.summary}</p>
                  </div>
                </div>
              </div>

              {/* 핵심 지표 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">진료과목</p>
                  <p className="text-lg font-bold text-gray-900">{analysis.analysis.category}</p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">상담결과</p>
                  {resultStyle && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${resultStyle.bgColor} ${resultStyle.color}`}>
                      {analysis.analysis.result}
                    </span>
                  )}
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">예상매출</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(analysis.analysis.expectedRevenue)}
                  </p>
                </div>
              </div>

              {/* 환자 우려사항 */}
              {analysis.analysis.patientConcerns && analysis.analysis.patientConcerns.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <h3 className="flex items-center gap-2 font-medium text-yellow-800 mb-3">
                    <AlertCircle className="w-4 h-4" />
                    환자 우려사항
                  </h3>
                  <ul className="space-y-1">
                    {analysis.analysis.patientConcerns.map((concern, idx) => (
                      <li key={idx} className="text-yellow-700 text-sm flex items-start gap-2">
                        <span className="text-yellow-500 mt-1">•</span>
                        {concern}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 상담 코칭 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 잘한 점 */}
                {analysis.analysis.consultantStrengths && analysis.analysis.consultantStrengths.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h3 className="flex items-center gap-2 font-medium text-green-800 mb-3">
                      <CheckCircle className="w-4 h-4" />
                      잘한 점
                    </h3>
                    <ul className="space-y-1">
                      {analysis.analysis.consultantStrengths.map((strength, idx) => (
                        <li key={idx} className="text-green-700 text-sm flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 개선 포인트 */}
                {analysis.analysis.improvementPoints && analysis.analysis.improvementPoints.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <h3 className="flex items-center gap-2 font-medium text-orange-800 mb-3">
                      <TrendingUp className="w-4 h-4" />
                      개선 포인트
                    </h3>
                    <ul className="space-y-1">
                      {analysis.analysis.improvementPoints.map((point, idx) => (
                        <li key={idx} className="text-orange-700 text-sm flex items-start gap-2">
                          <span className="text-orange-500 mt-1">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 처리 중인 경우 */}
          {(analysis.status === 'stt_processing' || analysis.status === 'analyzing') && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-600 font-medium">
                {analysis.status === 'stt_processing' ? '음성을 텍스트로 변환 중...' : 'AI가 통화 내용을 분석 중...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요.</p>
            </div>
          )}

          {/* 대화 내용 (접기/펼치기) */}
          {analysis.transcriptFormatted && (
            <div className="border rounded-xl overflow-hidden">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="flex items-center gap-2 font-medium text-gray-700">
                  <Headphones className="w-4 h-4" />
                  대화 내용 보기
                </span>
                {showTranscript ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {showTranscript && (
                <div className="p-4 max-h-80 overflow-y-auto bg-white">
                  <div className="space-y-3">
                    {analysis.transcriptFormatted.split('\n').map((line, idx) => {
                      const isConsultant = line.startsWith('상담사:');
                      const isPatient = line.startsWith('환자:');
                      const text = line.replace(/^(상담사|환자):/, '').trim();

                      if (!text) return null;

                      return (
                        <div
                          key={idx}
                          className={`flex ${isConsultant ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                              isConsultant
                                ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                                : isPatient
                                ? 'bg-blue-500 text-white rounded-tr-sm'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            <p className="text-xs mb-1 opacity-70">
                              {isConsultant ? '상담사' : isPatient ? '환자' : ''}
                            </p>
                            <p className="text-sm">{text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 녹음 파일 재생 (URL이 있는 경우) */}
          {analysis.recordingUrl && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <Play className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">녹음 파일</span>
              <audio controls className="flex-1 h-8">
                <source src={analysis.recordingUrl} type="audio/wav" />
                브라우저가 오디오 재생을 지원하지 않습니다.
              </audio>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
