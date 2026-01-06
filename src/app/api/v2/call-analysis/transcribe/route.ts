// src/app/api/v2/call-analysis/transcribe/route.ts
// OpenAI Whisper API를 사용한 STT 변환

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

interface TranscriptSegment {
  speaker: string;
  text: string;
  start?: number;
  end?: number;
}

// MongoDB에서 base64 녹음 데이터 가져오기
async function getRecordingBase64(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  callLogId: string
): Promise<string | null> {
  const recording = await db.collection('callRecordings_v2').findOne({
    callLogId: callLogId,
  });
  return recording?.recordingBase64 || null;
}

// URL에서 녹음 파일 다운로드 (V1과 동일한 fallback)
async function downloadRecording(url: string): Promise<Buffer> {
  console.log(`[STT v2] 녹음파일 다운로드: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`녹음파일 다운로드 실패: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// OpenAI Whisper API 호출
async function transcribeWithWhisper(audioBuffer: Buffer): Promise<{ text: string; duration?: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
  formData.append('file', audioBlob, 'recording.wav');
  formData.append('model', 'whisper-1');
  formData.append('language', 'ko');
  formData.append('response_format', 'verbose_json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API 오류: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return {
    text: result.text,
    duration: result.duration,
  };
}

export async function POST(request: NextRequest) {
  let callLogIdForError: string | null = null;

  try {
    const body = await request.json();
    const { callLogId } = body;
    callLogIdForError = callLogId;

    console.log('='.repeat(50));
    console.log(`[STT v2] 변환 시작: ${callLogId}`);
    console.log('='.repeat(50));

    if (!callLogId) {
      console.log('[STT v2] 오류: callLogId가 없음');
      return NextResponse.json(
        { success: false, error: 'callLogId required' },
        { status: 400 }
      );
    }

    // ObjectId 유효성 검사
    if (!ObjectId.isValid(callLogId)) {
      console.log(`[STT v2] 오류: 유효하지 않은 callLogId 형식: ${callLogId}`);
      return NextResponse.json(
        { success: false, error: 'Invalid callLogId format' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    console.log('[STT v2] DB 연결 성공');

    // 상태 업데이트: STT 처리 중
    await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      {
        $set: {
          aiStatus: 'processing',
          updatedAt: now,
        },
      }
    );
    console.log('[STT v2] 상태 업데이트: processing');

    // 통화기록에서 recordingUrl 확인
    const callLog = await db.collection('callLogs_v2').findOne({
      _id: new ObjectId(callLogId),
    });

    if (!callLog) {
      console.log('[STT v2] 통화기록을 찾을 수 없음');
      return NextResponse.json(
        { success: false, error: 'Call log not found' },
        { status: 404 }
      );
    }

    // 녹음 데이터 가져오기 (V1과 동일한 방식: base64 우선, URL fallback)
    let audioBuffer: Buffer | null = null;

    // 1. MongoDB에서 base64 데이터 확인
    console.log(`[STT v2] 녹음 데이터 조회 중: callLogId=${callLogId}`);
    const base64Data = await getRecordingBase64(db, callLogId);

    if (base64Data) {
      console.log(`[STT v2] base64 데이터 사용: ${base64Data.length} chars`);
      audioBuffer = Buffer.from(base64Data, 'base64');
      console.log(`[STT v2] base64 디코딩 완료: ${audioBuffer.length} bytes`);
    }

    // 2. base64가 없으면 URL에서 다운로드 시도 (V1과 동일한 fallback)
    if (!audioBuffer && callLog.recordingUrl) {
      console.log(`[STT v2] base64 없음, URL에서 다운로드 시도: ${callLog.recordingUrl}`);
      try {
        audioBuffer = await downloadRecording(callLog.recordingUrl);
        console.log(`[STT v2] URL 다운로드 완료: ${audioBuffer.length} bytes`);
      } catch (dlError) {
        console.error('[STT v2] URL 다운로드 실패:', dlError);
      }
    }

    // 3. 녹음 데이터가 없으면 실패
    if (!audioBuffer) {
      console.log('[STT v2] 녹음 데이터 없음! base64도 없고 URL도 없거나 다운로드 실패');

      // 디버깅: callRecordings_v2 컬렉션에서 모든 레코드 확인
      const allRecordings = await db.collection('callRecordings_v2')
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      console.log(`[STT v2] 최근 녹음 레코드 ${allRecordings.length}개:`,
        allRecordings.map(r => ({ callLogId: r.callLogId, hasData: !!r.recordingBase64 }))
      );

      await db.collection('callLogs_v2').updateOne(
        { _id: new ObjectId(callLogId) },
        {
          $set: {
            aiStatus: 'failed',
            'aiAnalysis.error': 'Recording data not found (base64/URL 모두 없음)',
            updatedAt: now,
          },
        }
      );
      return NextResponse.json(
        { success: false, error: 'Recording data not found' },
        { status: 400 }
      );
    }

    console.log(`[STT v2] 오디오 버퍼 크기: ${audioBuffer.length} bytes`);

    // Whisper API 호출
    console.log('[STT v2] Whisper API 호출 중...');
    const transcription = await transcribeWithWhisper(audioBuffer);
    console.log(`[STT v2] Whisper 변환 완료: ${transcription.text.length} chars`);
    console.log(`[STT v2] 변환 텍스트 일부: ${transcription.text.substring(0, 100)}...`);

    // DB 업데이트 (aiAnalysis가 null이어도 처리 가능하도록)
    await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      [
        {
          $set: {
            aiAnalysis: {
              $mergeObjects: [
                { $ifNull: ['$aiAnalysis', {}] },
                { transcript: transcription.text }
              ]
            },
            updatedAt: new Date().toISOString(),
          },
        }
      ]
    );
    console.log('[STT v2] transcript 저장 완료');

    return NextResponse.json({
      success: true,
      callLogId,
      transcript: transcription.text,
      duration: transcription.duration,
    });
  } catch (error) {
    console.error('[STT v2] 오류 발생:', error);
    console.error('[STT v2] 오류 스택:', error instanceof Error ? error.stack : 'N/A');

    // 실패 상태 업데이트 (aiAnalysis가 null이어도 처리 가능하도록)
    if (callLogIdForError && ObjectId.isValid(callLogIdForError)) {
      try {
        const { db } = await connectToDatabase();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await db.collection('callLogs_v2').updateOne(
          { _id: new ObjectId(callLogIdForError) },
          [
            {
              $set: {
                aiStatus: 'failed',
                aiAnalysis: {
                  $mergeObjects: [
                    { $ifNull: ['$aiAnalysis', {}] },
                    { error: errorMessage }
                  ]
                },
                updatedAt: new Date().toISOString(),
              },
            }
          ]
        );
      } catch (dbError) {
        console.error('[STT v2] 실패 상태 업데이트 오류:', dbError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
