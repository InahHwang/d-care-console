// src/app/api/v2/call-analysis/transcribe/route.ts
// OpenAI Whisper API를 사용한 STT 변환

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// Vercel Function 타임아웃 설정 (STT는 오래 걸릴 수 있음)
export const maxDuration = 120;

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

// 지연 함수
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 통화 방향에 따른 화자분리 프롬프트 생성
function buildDiarizePrompt(direction: string): string {
  const directionHint = direction === 'outbound'
    ? `이 통화는 **발신(아웃바운드)** 통화입니다.
- 첫 번째 발화자는 반드시 "상담사"입니다 (전화를 건 쪽).
- 상담사가 먼저 "여보세요" 또는 병원 소개를 합니다.`
    : `이 통화는 **수신(인바운드)** 통화입니다.
- 첫 번째 발화자는 반드시 "상담사"입니다 (전화를 받는 쪽).
- 상담사가 먼저 "감사합니다, OO치과입니다" 등의 인사를 합니다.`;

  return `당신은 치과 콜센터 통화 녹취록의 화자분리 전문가입니다.
아래 녹취 텍스트를 "상담사"와 "환자" 두 화자로 분리하세요.

## 통화 정보
${directionHint}

## 화자 구분 핵심 패턴

### 상담사 (병원 직원)의 특징:
- 병원 이름을 말함 ("OO치과", "저희 병원")
- 치료 설명/안내 ("임플란트는~", "치료 과정이~")
- 가격/비용 안내 ("이벤트 가격이~", "한 대당~")
- 예약/방문 유도 ("한번 오셔서~", "상담 받아보시겠어요?")
- 환자 정보 확인 ("성함이~", "거주하시는 곳이~", "OO님 맞으세요?")
- 맞장구/경청 ("아 그러셨구나", "네 맞습니다", "아 그러세요")

### 환자의 특징:
- 본인 증상/상황 설명 ("이빨이~", "임플란트 박아놓고~", "틀니 쓰고 있는데~")
- 비용 질문/반응 ("얼마예요?", "비용이 부담되서~")
- 개인 정보 대답 ("방학동이요", "75세요", "의료급여~")
- 치료 경험 언급 ("다른 병원에서~", "몇 년 전에~")

## 규칙
1. 각 발화를 "상담사: " 또는 "환자: "로 시작
2. 각 발화는 줄바꿈으로 구분
3. 원문 내용을 절대 수정/생략하지 말 것 — 화자 라벨만 추가
4. 한 화자가 연속으로 긴 말을 할 수 있음 (무리하게 턴을 나누지 말 것)
5. "네", "아" 같은 짧은 맞장구는 맥락상 누구의 것인지 판단
6. 확신이 없으면 앞뒤 맥락(누가 질문했고 누가 대답하는지)으로 판단
7. 화자분리된 결과만 출력하고, 설명이나 주석은 붙이지 말 것`;
}

// GPT를 사용한 화자분리 후처리
async function diarizeWithGPT(plainText: string, direction: string = 'unknown'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return plainText; // API 키 없으면 원본 반환

  try {
    const systemPrompt = buildDiarizePrompt(direction);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'developer', content: systemPrompt },
          { role: 'user', content: plainText },
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      console.log(`[STT v2] 화자분리 GPT 오류: ${response.status}, 원본 반환`);
      return plainText;
    }

    const data = await response.json();
    const diarized = data.choices[0]?.message?.content?.trim();

    if (!diarized || diarized.length < plainText.length * 0.3) {
      console.log('[STT v2] 화자분리 결과 너무 짧음, 원본 반환');
      return plainText;
    }

    console.log(`[STT v2] 화자분리 완료: ${plainText.length}자 → ${diarized.length}자`);
    return diarized;
  } catch (error) {
    console.error('[STT v2] 화자분리 오류, 원본 반환:', error);
    return plainText;
  }
}

// OpenAI Whisper API 호출 (429 에러 시 재시도 로직 포함)
async function transcribeWithWhisper(audioBuffer: Buffer): Promise<{ text: string; duration?: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const maxRetries = 5;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

    if (response.ok) {
      const result = await response.json();
      if (attempt > 1) {
        console.log(`[STT v2] Whisper API 성공 (시도 ${attempt}/${maxRetries})`);
      }
      return {
        text: result.text,
        duration: result.duration,
      };
    }

    // 429 Rate Limit 에러인 경우 재시도
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000);

      console.log(`[STT v2] Rate Limit 초과 (429), ${waitTime/1000}초 후 재시도... (시도 ${attempt}/${maxRetries})`);

      if (attempt < maxRetries) {
        await sleep(waitTime);
        continue;
      }
    }

    // 다른 에러 또는 최대 재시도 횟수 초과
    const errorText = await response.text();
    lastError = new Error(`Whisper API 오류: ${response.status} - ${errorText}`);

    // 429 외의 에러는 재시도하지 않음
    if (response.status !== 429) {
      throw lastError;
    }
  }

  // 최대 재시도 횟수 초과
  throw lastError || new Error('Whisper API 최대 재시도 횟수 초과');
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

    // ★ 환각 방지 필터: 짧은 녹취/무음 파일은 STT 건너뛰기
    const MIN_AUDIO_BYTES = 50000;  // 50KB 미만이면 의미있는 음성 없음
    const MIN_DURATION_SEC = 5;     // 5초 미만 통화는 건너뛰기
    const callDuration = callLog.duration || 0;

    if (audioBuffer.length < MIN_AUDIO_BYTES || callDuration < MIN_DURATION_SEC) {
      const skipReason = audioBuffer.length < MIN_AUDIO_BYTES
        ? `녹취 파일 너무 작음 (${audioBuffer.length} bytes < ${MIN_AUDIO_BYTES})`
        : `통화시간 너무 짧음 (${callDuration}초 < ${MIN_DURATION_SEC}초)`;
      console.log(`[STT v2] ⏭️ STT 건너뛰기: ${skipReason}`);

      await db.collection('callLogs_v2').updateOne(
        { _id: new ObjectId(callLogId) },
        {
          $set: {
            aiStatus: 'skipped',
            'aiAnalysis.skipReason': skipReason,
            updatedAt: now,
          },
        }
      );
      return NextResponse.json({
        success: true,
        callLogId,
        skipped: true,
        reason: skipReason,
      });
    }

    // Whisper API 호출
    console.log('[STT v2] Whisper API 호출 중...');
    const transcription = await transcribeWithWhisper(audioBuffer);
    console.log(`[STT v2] Whisper 변환 완료: ${transcription.text.length} chars`);
    console.log(`[STT v2] 변환 텍스트 일부: ${transcription.text.substring(0, 100)}...`);

    // 화자분리 후처리 (30자 이상일 때만 - 너무 짧으면 분리 불가)
    let finalTranscript = transcription.text;
    if (transcription.text.length >= 30) {
      const direction = callLog.direction || callLog.callType || 'unknown';
      console.log(`[STT v2] 화자분리 처리 중... (${direction})`);
      finalTranscript = await diarizeWithGPT(transcription.text, direction);
    }

    // DB 업데이트 (aiAnalysis가 null이어도 처리 가능하도록)
    await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      [
        {
          $set: {
            aiAnalysis: {
              $mergeObjects: [
                { $ifNull: ['$aiAnalysis', {}] },
                {
                  transcript: finalTranscript,
                  rawTranscript: transcription.text,
                }
              ]
            },
            updatedAt: new Date().toISOString(),
          },
        }
      ]
    );
    console.log('[STT v2] transcript 저장 완료 (화자분리 적용)');

    return NextResponse.json({
      success: true,
      callLogId,
      transcript: finalTranscript,
      rawTranscript: transcription.text,
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
        error: '음성 변환 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
