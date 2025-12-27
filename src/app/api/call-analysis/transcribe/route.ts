// src/app/api/call-analysis/transcribe/route.ts
// GPT-4o Transcribe API를 사용한 STT 변환 (화자분리 포함)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// 화자분리된 세그먼트 타입
interface TranscriptSegment {
  speaker: string;      // "speaker_0", "speaker_1" 등
  text: string;
  start?: number;       // 시작 시간 (초)
  end?: number;         // 종료 시간 (초)
}

// STT 결과 타입
interface TranscribeResult {
  raw: string;                    // 전체 텍스트
  segments: TranscriptSegment[];  // 화자분리된 세그먼트
  duration?: number;              // 오디오 길이
  language?: string;              // 감지된 언어
}

// OpenAI API 응답 타입
interface OpenAITranscriptionWord {
  word: string;
  start: number;
  end: number;
  speaker?: string;
}

interface OpenAITranscriptionResponse {
  text: string;
  words?: OpenAITranscriptionWord[];
  duration?: number;
  language?: string;
}

// 화자 라벨 변환 (speaker_0 → 상담사, speaker_1 → 환자)
function mapSpeakerLabel(speaker: string): string {
  // 일반적으로 첫 번째 화자(speaker_0)가 전화를 받은 상담사
  if (speaker === 'speaker_0' || speaker === '0') return 'consultant';
  if (speaker === 'speaker_1' || speaker === '1') return 'patient';
  return speaker;
}

// 화자별로 연속된 텍스트를 그룹화
function groupByConsecutiveSpeaker(words: OpenAITranscriptionWord[]): TranscriptSegment[] {
  if (!words || words.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let currentSegment: TranscriptSegment | null = null;

  for (const word of words) {
    const speaker = word.speaker || 'unknown';

    if (!currentSegment || currentSegment.speaker !== speaker) {
      // 새 세그먼트 시작
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        speaker: mapSpeakerLabel(speaker),
        text: word.word,
        start: word.start,
        end: word.end
      };
    } else {
      // 같은 화자 - 텍스트 이어붙이기
      currentSegment.text += ' ' + word.word;
      currentSegment.end = word.end;
    }
  }

  // 마지막 세그먼트 추가
  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

// 포맷된 대화 텍스트 생성
function formatTranscript(segments: TranscriptSegment[]): string {
  return segments.map(seg => {
    const label = seg.speaker === 'consultant' ? '상담사' :
                  seg.speaker === 'patient' ? '환자' : seg.speaker;
    return `${label}: ${seg.text}`;
  }).join('\n');
}

// URL에서 녹음 파일 다운로드
async function downloadRecording(url: string): Promise<Buffer> {
  console.log(`[Transcribe] 녹음파일 다운로드: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`녹음파일 다운로드 실패: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// MongoDB에서 base64 녹음 데이터 가져오기
async function getRecordingBase64(db: Awaited<ReturnType<typeof connectToDatabase>>['db'], analysisId: string): Promise<string | null> {
  try {
    const recording = await db.collection('callRecordings').findOne({
      analysisId: analysisId
    });
    if (recording?.recordingBase64) {
      console.log(`[Transcribe] base64 녹음 데이터 로드 완료: ${recording.recordingBase64.length} chars`);
      return recording.recordingBase64;
    }
    return null;
  } catch (error) {
    console.error('[Transcribe] base64 데이터 로드 오류:', error);
    return null;
  }
}

// OpenAI Transcription API 호출
async function transcribeWithOpenAI(audioBuffer: Buffer, fileName: string): Promise<OpenAITranscriptionResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  // FormData 생성
  const formData = new FormData();

  // Buffer를 Blob으로 변환
  const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
  formData.append('file', audioBlob, fileName || 'recording.wav');
  formData.append('model', 'whisper-1');
  formData.append('language', 'ko');
  formData.append('response_format', 'verbose_json');
  // 타임스탬프 포함
  formData.append('timestamp_granularities[]', 'word');

  console.log('[Transcribe] OpenAI API 호출 중...');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Transcribe] OpenAI API 오류:', errorText);
    throw new Error(`OpenAI API 오류: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('[Transcribe] OpenAI API 응답 성공');

  return result;
}

// POST - STT 변환 요청
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysisId, recordingUrl } = body;

    console.log('='.repeat(60));
    console.log('[Transcribe API] STT 변환 요청');
    console.log(`  분석ID: ${analysisId}`);
    console.log(`  녹음URL: ${recordingUrl}`);
    console.log('='.repeat(60));

    if (!analysisId) {
      return NextResponse.json(
        { success: false, error: 'analysisId is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const analysisCollection = db.collection('callAnalysis');

    // 분석 레코드 조회
    const analysis = await analysisCollection.findOne({
      _id: new ObjectId(analysisId)
    });

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis record not found' },
        { status: 404 }
      );
    }

    // 상태 업데이트: STT 처리 중
    await analysisCollection.updateOne(
      { _id: new ObjectId(analysisId) },
      {
        $set: {
          status: 'stt_processing',
          updatedAt: new Date().toISOString()
        }
      }
    );

    // 녹음 데이터 가져오기 (base64 우선, 없으면 URL 다운로드)
    let audioBuffer: Buffer | null = null;

    // 1. MongoDB에서 base64 데이터 확인
    const base64Data = await getRecordingBase64(db, analysisId);
    if (base64Data) {
      console.log('[Transcribe] base64 데이터 사용');
      audioBuffer = Buffer.from(base64Data, 'base64');
      console.log(`[Transcribe] base64 디코딩 완료: ${audioBuffer.length} bytes`);
    }

    // 2. base64가 없으면 URL 다운로드 시도
    if (!audioBuffer) {
      const audioUrl = recordingUrl || analysis.recordingUrl;
      if (audioUrl) {
        console.log('[Transcribe] URL에서 다운로드 시도');
        try {
          audioBuffer = await downloadRecording(audioUrl);
          console.log(`[Transcribe] 다운로드 완료: ${audioBuffer.length} bytes`);
        } catch (dlError) {
          console.error('[Transcribe] URL 다운로드 실패:', dlError);
        }
      }
    }

    // 3. 녹음 데이터가 없으면 실패
    if (!audioBuffer) {
      await analysisCollection.updateOne(
        { _id: new ObjectId(analysisId) },
        {
          $set: {
            status: 'failed',
            errorMessage: '녹음 파일을 찾을 수 없습니다 (base64/URL 모두 없음).',
            updatedAt: new Date().toISOString()
          }
        }
      );
      return NextResponse.json(
        { success: false, error: 'Recording data not found' },
        { status: 400 }
      );
    }

    try {
      console.log(`[Transcribe] 오디오 파일 크기: ${audioBuffer.length} bytes`);

      // 2. OpenAI API로 STT 변환
      const transcription = await transcribeWithOpenAI(
        audioBuffer,
        analysis.recordingFileName || 'recording.wav'
      );

      // 3. 화자분리 처리
      let segments: TranscriptSegment[] = [];
      let formattedText = transcription.text;

      if (transcription.words && transcription.words.length > 0) {
        // 화자분리된 데이터가 있는 경우
        segments = groupByConsecutiveSpeaker(transcription.words);
        formattedText = formatTranscript(segments);
        console.log(`[Transcribe] 화자분리 완료: ${segments.length}개 세그먼트`);
      } else {
        // 화자분리가 안 된 경우 전체 텍스트를 하나의 세그먼트로
        segments = [{
          speaker: 'unknown',
          text: transcription.text
        }];
        console.log('[Transcribe] 화자분리 없음, 단일 세그먼트로 처리');
      }

      const transcribeResult: TranscribeResult = {
        raw: transcription.text,
        segments: segments,
        duration: transcription.duration,
        language: transcription.language
      };

      // 4. DB 업데이트
      const now = new Date().toISOString();
      await analysisCollection.updateOne(
        { _id: new ObjectId(analysisId) },
        {
          $set: {
            status: 'stt_complete',
            transcript: transcribeResult,
            transcriptFormatted: formattedText,
            sttCompletedAt: now,
            updatedAt: now
          }
        }
      );

      console.log('[Transcribe] STT 변환 완료');
      console.log('--- 변환 결과 미리보기 ---');
      console.log(formattedText.slice(0, 500) + (formattedText.length > 500 ? '...' : ''));
      console.log('--- 끝 ---');

      return NextResponse.json({
        success: true,
        message: 'Transcription completed',
        data: {
          analysisId,
          transcript: transcribeResult,
          formatted: formattedText
        }
      });

    } catch (transcribeError) {
      console.error('[Transcribe] 변환 오류:', transcribeError);

      // 실패 상태로 업데이트
      await analysisCollection.updateOne(
        { _id: new ObjectId(analysisId) },
        {
          $set: {
            status: 'failed',
            errorMessage: transcribeError instanceof Error ? transcribeError.message : '알 수 없는 오류',
            updatedAt: new Date().toISOString()
          }
        }
      );

      throw transcribeError;
    }

  } catch (error) {
    console.error('[Transcribe API] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// GET - 특정 분석의 STT 결과 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysisId');

    if (!analysisId) {
      return NextResponse.json(
        { success: false, error: 'analysisId is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const analysis = await db.collection('callAnalysis').findOne(
      { _id: new ObjectId(analysisId) },
      { projection: { transcript: 1, transcriptFormatted: 1, status: 1, sttCompletedAt: 1 } }
    );

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        analysisId,
        transcript: analysis.transcript,
        formatted: analysis.transcriptFormatted,
        status: analysis.status,
        completedAt: analysis.sttCompletedAt
      }
    });

  } catch (error) {
    console.error('[Transcribe API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
