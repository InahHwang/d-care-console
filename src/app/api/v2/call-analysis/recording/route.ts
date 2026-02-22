// src/app/api/v2/call-analysis/recording/route.ts
// 통화 녹취 완료 이벤트 처리 및 AI 분석 파이프라인 트리거

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import type { AIAnalysis, Temperature, AIClassification, FollowUpType } from '@/types/v2';
import { createRouteLogger } from '@/lib/logger';
import { withRetry } from '@/lib/pipeline';

const CLINIC_ID = process.env.DEFAULT_CLINIC_ID || 'default';

function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  return phone;
}

// AI 분석 파이프라인 트리거 (retry 적용)
async function triggerAnalysisPipeline(callLogId: string) {
  const log = createRouteLogger('/api/v2/call-analysis/recording', 'pipeline');
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // 1. STT 변환 (재시도 포함)
    log.info('STT 시작', { callLogId });
    await withRetry(
      async () => {
        const sttResponse = await fetch(`${baseUrl}/api/v2/call-analysis/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callLogId }),
        });
        if (!sttResponse.ok) {
          throw new Error(`STT 실패: ${sttResponse.status}`);
        }
        const sttResult = await sttResponse.json();
        if (!sttResult.success) {
          throw new Error(sttResult.error || 'STT 실패');
        }
        return sttResult;
      },
      { name: 'STT', callLogId },
    );

    // 2. AI 분석 (재시도 포함)
    log.info('AI 분석 시작', { callLogId });
    await withRetry(
      async () => {
        const analyzeResponse = await fetch(`${baseUrl}/api/v2/call-analysis/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callLogId }),
        });
        if (!analyzeResponse.ok) {
          throw new Error(`AI 분석 실패: ${analyzeResponse.status}`);
        }
        return analyzeResponse.json();
      },
      { name: 'AI-Analysis', callLogId },
    );

    log.info('파이프라인 완료', { callLogId });
  } catch (error) {
    log.error('파이프라인 최종 실패', error, { callLogId });

    // 실패 상태로 업데이트 (retryCount 포함)
    try {
      const { db } = await connectToDatabase();
      await db.collection('callLogs_v2').updateOne(
        { _id: new ObjectId(callLogId) },
        {
          $set: {
            aiStatus: 'failed',
            retryCount: 3,
            failedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }
      );
    } catch (dbError) {
      log.error('DB 업데이트 오류', dbError, { callLogId });
    }
  }
}

export async function POST(request: NextRequest) {
  const log = createRouteLogger('/api/v2/call-analysis/recording', 'POST');
  try {
    const body = await request.json();
    const {
      callerNumber,
      calledNumber,
      recordingFileName,
      recordingBase64,
      duration,
      timestamp,
    } = body;

    log.info('녹취 수신', { callerNumber, duration });

    if (!callerNumber || !recordingFileName) {
      return NextResponse.json(
        { success: false, error: 'callerNumber and recordingFileName required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    const formattedPhone = formatPhone(callerNumber);

    // 최근 통화 기록 찾기
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const callLog = await db.collection('callLogs_v2').findOne(
      {
        clinicId: CLINIC_ID,
        phone: formattedPhone,
        createdAt: { $gte: tenMinutesAgo },
      },
      { sort: { createdAt: -1 } }
    );

    if (!callLog) {
      log.info('매칭 통화기록 없음, 새로 생성', { phone: formattedPhone });
      // 통화기록이 없으면 생성
      const newCallLog = {
        clinicId: CLINIC_ID,
        phone: formattedPhone,
        direction: 'inbound' as const,
        status: 'connected' as const,
        duration: duration || 0,
        recordingUrl: recordingFileName,
        startedAt: timestamp || now,
        endedAt: now,
        aiStatus: 'pending' as const,
        createdAt: now,
      };

      const result = await db.collection('callLogs_v2').insertOne(newCallLog);

      // base64 저장
      if (recordingBase64) {
        await db.collection('callRecordings_v2').insertOne({
          clinicId: CLINIC_ID,
          callLogId: result.insertedId.toString(),
          recordingBase64,
          createdAt: now,
        });
      }

      // 분석 파이프라인 트리거
      waitUntil(triggerAnalysisPipeline(result.insertedId.toString()));

      return NextResponse.json({
        success: true,
        callLogId: result.insertedId.toString(),
        message: 'Recording received, analysis queued',
      });
    }

    // 기존 통화기록 업데이트
    await db.collection('callLogs_v2').updateOne(
      { _id: callLog._id },
      {
        $set: {
          recordingUrl: recordingFileName,
          duration: duration || callLog.duration,
          aiStatus: 'pending',
          updatedAt: now,
        },
      }
    );

    // base64 저장
    if (recordingBase64) {
      await db.collection('callRecordings_v2').insertOne({
        clinicId: CLINIC_ID,
        callLogId: callLog._id.toString(),
        recordingBase64,
        createdAt: now,
      });
    }

    // 분석 파이프라인 트리거
    waitUntil(triggerAnalysisPipeline(callLog._id.toString()));

    return NextResponse.json({
      success: true,
      callLogId: callLog._id.toString(),
      message: 'Recording received, analysis queued',
    });
  } catch (error) {
    log.error('recording 오류', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - 분석 상태 조회
export async function GET(request: NextRequest) {
  const log = createRouteLogger('/api/v2/call-analysis/recording', 'GET');
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
      { _id: new ObjectId(callLogId), clinicId: CLINIC_ID },
      {
        projection: {
          aiStatus: 1,
          aiAnalysis: 1,
          aiCompletedAt: 1,
        },
      }
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
    log.error('GET 오류', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
