// src/types/callAnalysis.ts
// 통화 분석 관련 타입 정의

import { ObjectId } from 'mongodb';

// 통화 분석 상태
export type AnalysisStatus =
  | 'pending'        // 대기 중
  | 'stt_processing' // STT 처리 중
  | 'stt_complete'   // STT 완료
  | 'analyzing'      // AI 분석 중
  | 'complete'       // 완료
  | 'failed';        // 실패

// 화자분리된 세그먼트
export interface TranscriptSegment {
  speaker: 'consultant' | 'patient' | 'unknown' | string;
  text: string;
  start?: number;  // 시작 시간 (초)
  end?: number;    // 종료 시간 (초)
}

// STT 결과
export interface TranscriptResult {
  raw: string;                    // 전체 텍스트
  segments: TranscriptSegment[];  // 화자분리된 세그먼트
  duration?: number;              // 오디오 길이
  language?: string;              // 감지된 언어
}

// AI 분석 결과
export interface AIAnalysisResult {
  summary: string;              // 통화 요약 (2-3문장)
  category: string;             // 진료과목: 임플란트|교정|충치|스케일링|검진|기타
  result: string;               // 상담 결과: 예약완료|예약예정|보류|거절|단순문의
  expectedRevenue?: number;     // 예상 매출
  patientConcerns?: string[];   // 환자 우려사항
  consultantStrengths?: string[];   // 상담사 강점
  improvementPoints?: string[];     // 개선 포인트
  sentiment?: string;           // 전체 분위기: 긍정|중립|부정
  urgency?: string;             // 긴급도: 높음|보통|낮음
}

// 통화 분석 전체 레코드
export interface CallAnalysis {
  _id?: ObjectId | string;
  callLogId?: string;           // 연결된 통화기록 ID
  callerNumber: string;         // 발신번호
  calledNumber: string;         // 수신번호
  recordingFileName: string;    // 녹취 파일명
  recordingUrl?: string;        // 녹취 파일 URL
  duration: number;             // 통화 시간 (초)

  // STT 결과
  transcript?: TranscriptResult;
  transcriptFormatted?: string; // 포맷된 대화 텍스트
  sttCompletedAt?: string;

  // AI 분석 결과
  analysis?: AIAnalysisResult;
  analysisCompletedAt?: string;

  // 메타데이터
  status: AnalysisStatus;
  errorMessage?: string;
  patientId?: string;
  patientName?: string;
  createdAt: string;
  updatedAt: string;
}

// 분석 결과 카드용 요약 데이터
export interface AnalysisSummary {
  _id: string;
  callerNumber: string;
  patientName?: string;
  duration: number;
  status: AnalysisStatus;
  category?: string;
  result?: string;
  summary?: string;
  createdAt: string;
}

// 카테고리 라벨 매핑
export const CATEGORY_LABELS: Record<string, string> = {
  '임플란트': '임플란트',
  '교정': '교정',
  '충치': '충치치료',
  '스케일링': '스케일링',
  '검진': '검진',
  '기타': '기타'
};

// 상담 결과 라벨 매핑
export const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  '예약완료': { label: '예약완료', color: 'green' },
  '예약예정': { label: '예약예정', color: 'blue' },
  '보류': { label: '보류', color: 'yellow' },
  '거절': { label: '거절', color: 'red' },
  '단순문의': { label: '단순문의', color: 'gray' }
};

// 상태 라벨 매핑
export const STATUS_LABELS: Record<AnalysisStatus, { label: string; color: string }> = {
  'pending': { label: '대기중', color: 'gray' },
  'stt_processing': { label: 'STT 처리중', color: 'blue' },
  'stt_complete': { label: 'STT 완료', color: 'cyan' },
  'analyzing': { label: '분석중', color: 'purple' },
  'complete': { label: '완료', color: 'green' },
  'failed': { label: '실패', color: 'red' }
};
