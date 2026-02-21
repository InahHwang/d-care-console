// src/app/api/v2/call-analysis/recording/route.ts
// V2 전용 녹취 수신 + AI 분석 파이프라인 트리거
// CTIBridge에서 직접 호출 (V1 경유 없음)

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// Vercel Function 타임아웃 설정
export const maxDuration = 60;

function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  } else if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return phone;
}

// callLogId 직접 매칭 → 전화번호 fallback 검색
async function findCallLogV2(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  directCallLogId: string | null,
  callerNumber: string,
  calledNumber: string
) {
  // 1순위: directCallLogId로 직접 매칭 (CTIBridge에서 전달)
  if (directCallLogId && ObjectId.isValid(directCallLogId)) {
    const callLog = await db.collection('callLogs_v2').findOne({
      _id: new ObjectId(directCallLogId),
    });
    if (callLog) {
      console.log(`[Recording V2] callLogId로 직접 매칭: ${directCallLogId}`);
      return callLog;
    }
    console.log(`[Recording V2] callLogId 매칭 실패, 전화번호 검색으로 fallback`);
  }

  // 2순위: 전화번호로 검색 (60분 이내)
  const formattedCaller = formatPhone(callerNumber);
  const formattedCalled = formatPhone(calledNumber);
  const normalizedCaller = normalizePhone(callerNumber);
  const normalizedCalled = normalizePhone(calledNumber);
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

  const callLog = await db.collection('callLogs_v2').findOne(
    {
      $or: [
        { phone: formattedCaller },
        { phone: formattedCalled },
        { phone: normalizedCaller },
        { phone: normalizedCalled },
      ],
      startedAt: { $gte: sixtyMinutesAgo },
    },
    { sort: { startedAt: -1 } }
  );

  if (callLog) {
    console.log(`[Recording V2] 전화번호로 매칭: ${callLog._id} (phone: ${callLog.phone})`);
  } else {
    console.log(`[Recording V2] 매칭 통화기록 없음`);
  }

  return callLog;
}

// AI 분석 파이프라인 (STT → AI 분석)
async function triggerAnalysisPipeline(callLogId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://d-care-console.vercel.app';
    console.log(`[Recording V2] 파이프라인 시작: ${callLogId}`);

    // 1. STT 변환
    const sttResponse = await fetch(`${baseUrl}/api/v2/call-analysis/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callLogId }),
    });

    if (!sttResponse.ok) {
      const sttText = await sttResponse.text();
      throw new Error(`STT 실패: ${sttResponse.status} - ${sttText}`);
    }

    const sttResult = await sttResponse.json();
    if (!sttResult.success) {
      throw new Error(sttResult.error || 'STT 실패');
    }

    // STT가 skipped인 경우 (짧은 통화/무음) → AI 분석도 건너뜀
    if (sttResult.skipped) {
      console.log(`[Recording V2] STT skipped: ${sttResult.reason}`);
      return;
    }

    // 2. AI 분석
    console.log(`[Recording V2] AI 분석 시작: ${callLogId}`);
    const analyzeResponse = await fetch(`${baseUrl}/api/v2/call-analysis/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callLogId }),
    });

    if (!analyzeResponse.ok) {
      const analyzeText = await analyzeResponse.text();
      throw new Error(`AI 분석 실패: ${analyzeResponse.status} - ${analyzeText}`);
    }

    console.log(`[Recording V2] 파이프라인 완료: ${callLogId}`);
  } catch (error) {
    console.error(`[Recording V2] 파이프라인 오류:`, error);

    try {
      const { db } = await connectToDatabase();
      await db.collection('callLogs_v2').updateOne(
        { _id: new ObjectId(callLogId) },
        {
          $set: {
            aiStatus: 'failed',
            'aiAnalysis.error': error instanceof Error ? error.message : 'Pipeline error',
            updatedAt: new Date().toISOString(),
          },
        }
      );
    } catch (dbError) {
      console.error('[Recording V2] 실패 상태 DB 업데이트 오류:', dbError);
    }
  }
}

// POST - CTIBridge에서 녹취 완료 이벤트 수신
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      callerNumber,
      calledNumber,
      recordingFileName,
      recordingUrl,
      recordingBase64,
      duration,
      timestamp,
      callLogId: directCallLogId, // CTIBridge에서 전달한 V2 callLogId
    } = body;

    console.log('='.repeat(50));
    console.log('[Recording V2] 녹취 수신');
    console.log(`  caller: ${callerNumber}, called: ${calledNumber}`);
    console.log(`  file: ${recordingFileName}, duration: ${duration}초`);
    console.log(`  base64: ${recordingBase64 ? `${recordingBase64.length} chars` : '없음'}`);
    console.log(`  callLogId: ${directCallLogId || '없음'}`);
    console.log('='.repeat(50));

    if (!callerNumber || !recordingFileName) {
      return NextResponse.json(
        { success: false, error: 'callerNumber and recordingFileName required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 통화기록 찾기 (callLogId 우선 → 전화번호 fallback)
    const callLog = await findCallLogV2(
      db,
      directCallLogId || null,
      callerNumber,
      calledNumber || ''
    );

    let callLogId: string;

    if (!callLog) {
      // 통화기록이 없으면 새로 생성
      console.log('[Recording V2] 매칭 통화기록 없음, 새로 생성');
      const newCallLog = {
        phone: formatPhone(callerNumber),
        direction: 'inbound' as const,
        status: 'connected' as const,
        duration: duration || 0,
        recordingFileName,
        recordingUrl: recordingUrl || recordingFileName,
        startedAt: new Date(timestamp || now),
        endedAt: new Date(now),
        aiStatus: 'pending' as const,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };

      const result = await db.collection('callLogs_v2').insertOne(newCallLog);
      callLogId = result.insertedId.toString();
      console.log(`[Recording V2] 새 통화기록 생성: ${callLogId}`);
    } else {
      // 기존 통화기록 업데이트 (녹취가 있으면 connected로 변경)
      callLogId = callLog._id.toString();
      const prevStatus = callLog.status;

      await db.collection('callLogs_v2').updateOne(
        { _id: callLog._id },
        {
          $set: {
            recordingFileName,
            recordingUrl: recordingUrl || recordingFileName,
            duration: duration || callLog.duration || 0,
            status: 'connected', // 녹취가 있으면 반드시 connected
            aiStatus: 'pending',
            updatedAt: new Date(now),
          },
        }
      );

      if (prevStatus !== 'connected') {
        console.log(`[Recording V2] 상태 변경: ${prevStatus} → connected (callLogId: ${callLogId})`);
      } else {
        console.log(`[Recording V2] 기존 기록 업데이트: ${callLogId}`);
      }
    }

    // base64 녹음 데이터 저장
    let hasRecording = false;
    if (recordingBase64 && recordingBase64.length > 0) {
      await db.collection('callRecordings_v2').insertOne({
        callLogId,
        recordingBase64,
        createdAt: new Date(now),
      });
      hasRecording = true;
      console.log(`[Recording V2] base64 저장 완료: ${recordingBase64.length} chars`);
    }

    // 분석 파이프라인 트리거 (base64 또는 URL이 있으면)
    const canAnalyze = hasRecording || !!recordingUrl;
    if (canAnalyze) {
      console.log(`[Recording V2] 파이프라인 트리거 (base64: ${hasRecording}, url: ${!!recordingUrl})`);
      waitUntil(
        triggerAnalysisPipeline(callLogId)
          .then(() => console.log(`[Recording V2] 파이프라인 백그라운드 완료: ${callLogId}`))
          .catch(err => console.error(`[Recording V2] 파이프라인 백그라운드 오류:`, err))
      );
    } else {
      console.log('[Recording V2] 녹음 데이터 없어서 파이프라인 건너뜀');
    }

    return NextResponse.json({
      success: true,
      callLogId,
      message: 'Recording received, analysis queued',
    });
  } catch (error) {
    console.error('[Recording V2] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - 분석 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callLogId = searchParams.get('callLogId');

    if (!callLogId) {
      return NextResponse.json(
        { success: false, error: 'callLogId required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const callLog = await db.collection('callLogs_v2').findOne(
      { _id: new ObjectId(callLogId) },
      { projection: { aiStatus: 1, aiAnalysis: 1, aiCompletedAt: 1 } }
    );

    if (!callLog) {
      return NextResponse.json(
        { success: false, error: 'Call log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        status: callLog.aiStatus,
        analysis: callLog.aiAnalysis,
        completedAt: callLog.aiCompletedAt,
      },
    });
  } catch (error) {
    console.error('[Recording V2] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
