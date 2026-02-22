// src/app/api/v2/call-analysis/status/route.ts
// 분석 상태 폴링용 API - 대시보드 실시간 업데이트 + 디버그

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { waitUntil } from '@vercel/functions';
import { createRouteLogger } from '@/lib/logger';

const CLINIC_ID = process.env.DEFAULT_CLINIC_ID || 'default';

export async function GET(request: NextRequest) {
  const log = createRouteLogger('/api/v2/call-analysis/status', 'GET');
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since'); // ISO timestamp
    const callLogIds = searchParams.get('ids')?.split(',').filter(Boolean);

    const { db } = await connectToDatabase();

    // 특정 ID들의 상태 조회
    if (callLogIds && callLogIds.length > 0) {
      const objectIds = callLogIds.map((id) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      }).filter(Boolean) as ObjectId[];

      const callLogs = await db.collection('callLogs_v2').find(
        { _id: { $in: objectIds }, clinicId: CLINIC_ID },
        {
          projection: {
            _id: 1,
            aiStatus: 1,
            aiAnalysis: 1,
            aiCompletedAt: 1,
          },
        }
      ).toArray();

      return NextResponse.json({
        success: true,
        data: callLogs.map((log) => ({
          id: log._id.toString(),
          status: log.aiStatus,
          analysis: log.aiAnalysis,
          completedAt: log.aiCompletedAt,
        })),
      });
    }

    // 최근 업데이트된 분석 조회 (since 이후)
    const sinceTime = since || new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const recentUpdates = await db.collection('callLogs_v2').find(
      {
        clinicId: CLINIC_ID,
        aiStatus: { $in: ['processing', 'completed'] },
        updatedAt: { $gte: sinceTime },
      },
      {
        projection: {
          _id: 1,
          phone: 1,
          patientId: 1,
          aiStatus: 1,
          aiAnalysis: 1,
          aiCompletedAt: 1,
          updatedAt: 1,
        },
      }
    )
      .sort({ updatedAt: -1 })
      .limit(20)
      .toArray();

    // 현재 분석 중인 항목들
    const analyzing = await db.collection('callLogs_v2').find(
      { clinicId: CLINIC_ID, aiStatus: 'processing' },
      {
        projection: {
          _id: 1,
          phone: 1,
          createdAt: 1,
        },
      }
    )
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        recentUpdates: recentUpdates.map((log) => ({
          id: log._id.toString(),
          phone: log.phone,
          patientId: log.patientId,
          status: log.aiStatus,
          analysis: log.aiAnalysis ? {
            classification: log.aiAnalysis.classification,
            temperature: log.aiAnalysis.temperature,
            summary: log.aiAnalysis.summary,
          } : null,
          completedAt: log.aiCompletedAt,
          updatedAt: log.updatedAt,
        })),
        analyzing: analyzing.map((log) => ({
          id: log._id.toString(),
          phone: log.phone,
          createdAt: log.createdAt,
        })),
        serverTime: new Date().toISOString(),
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

// POST - 디버그: 수동으로 분석 파이프라인 트리거
export async function POST(request: NextRequest) {
  const log = createRouteLogger('/api/v2/call-analysis/status', 'POST');
  try {
    const body = await request.json();
    const { action, callLogId } = body;

    log.info('디버그 요청', { action, callLogId });

    const { db } = await connectToDatabase();

    // 시스템 상태 확인
    if (action === 'debug') {
      // 최근 통화기록 확인
      const recentCallLogs = await db.collection('callLogs_v2')
        .find({ clinicId: CLINIC_ID })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      // 최근 녹음 데이터 확인
      const recentRecordings = await db.collection('callRecordings_v2')
        .find({ clinicId: CLINIC_ID })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      return NextResponse.json({
        success: true,
        debug: {
          recentCallLogs: recentCallLogs.map(log => ({
            id: log._id.toString(),
            phone: log.phone,
            direction: log.direction,
            aiStatus: log.aiStatus,
            hasTranscript: !!log.aiAnalysis?.transcript,
            hasRecordingUrl: !!log.recordingUrl,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt,
          })),
          recentRecordings: recentRecordings.map(rec => ({
            callLogId: rec.callLogId,
            hasBase64: !!rec.recordingBase64,
            base64Length: rec.recordingBase64?.length || 0,
            createdAt: rec.createdAt,
          })),
          serverTime: new Date().toISOString(),
        },
      });
    }

    // 특정 통화기록의 녹음 데이터 확인
    if (action === 'check-recording' && callLogId) {
      const callLog = await db.collection('callLogs_v2').findOne({
        _id: new ObjectId(callLogId),
        clinicId: CLINIC_ID,
      });

      const recording = await db.collection('callRecordings_v2').findOne({
        callLogId: callLogId,
        clinicId: CLINIC_ID,
      });

      return NextResponse.json({
        success: true,
        callLog: callLog ? {
          id: callLog._id.toString(),
          phone: callLog.phone,
          direction: callLog.direction,
          aiStatus: callLog.aiStatus,
          recordingUrl: callLog.recordingUrl,
          hasTranscript: !!callLog.aiAnalysis?.transcript,
          transcript: callLog.aiAnalysis?.transcript?.substring(0, 100),
          hasAnalysis: !!callLog.aiAnalysis?.classification,
          analysis: callLog.aiAnalysis ? {
            classification: callLog.aiAnalysis.classification,
            temperature: callLog.aiAnalysis.temperature,
            summary: callLog.aiAnalysis.summary,
          } : null,
          error: callLog.aiAnalysis?.error,
        } : null,
        recording: recording ? {
          callLogId: recording.callLogId,
          hasBase64: !!recording.recordingBase64,
          base64Length: recording.recordingBase64?.length || 0,
          createdAt: recording.createdAt,
        } : null,
      });
    }

    // 수동으로 분석 파이프라인 트리거
    if (action === 'trigger-analysis' && callLogId) {
      log.info('수동 분석 트리거', { callLogId });

      // 통화기록 확인
      const callLog = await db.collection('callLogs_v2').findOne({
        _id: new ObjectId(callLogId),
        clinicId: CLINIC_ID,
      });

      if (!callLog) {
        return NextResponse.json(
          { success: false, error: 'Call log not found' },
          { status: 404 }
        );
      }

      // 녹음 데이터 확인
      const recording = await db.collection('callRecordings_v2').findOne({
        callLogId: callLogId,
        clinicId: CLINIC_ID,
      });

      if (!recording?.recordingBase64) {
        return NextResponse.json(
          { success: false, error: 'Recording data not found' },
          { status: 400 }
        );
      }

      // 상태 리셋
      await db.collection('callLogs_v2').updateOne(
        { _id: new ObjectId(callLogId) },
        {
          $set: {
            aiStatus: 'pending',
            updatedAt: new Date().toISOString(),
          },
          $unset: {
            'aiAnalysis.error': '',
          },
        }
      );

      // 분석 파이프라인 트리거
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://d-care-console.vercel.app';

      waitUntil(
        (async () => {
          try {
            log.info('STT 시작', { callLogId });
            const sttResponse = await fetch(`${baseUrl}/api/v2/call-analysis/transcribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callLogId }),
            });

            const sttResult = await sttResponse.json();
            log.debug('STT 결과', { callLogId, success: sttResult.success });

            if (!sttResult.success) {
              throw new Error(sttResult.error || 'STT failed');
            }

            log.info('AI 분석 시작', { callLogId });
            const analyzeResponse = await fetch(`${baseUrl}/api/v2/call-analysis/analyze`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callLogId }),
            });

            const analyzeResult = await analyzeResponse.json();
            log.debug('AI 분석 결과', { callLogId, success: analyzeResult.success });

            log.info('수동 분석 완료', { callLogId });
          } catch (error) {
            log.error('수동 분석 실패', error, { callLogId });
          }
        })()
      );

      return NextResponse.json({
        success: true,
        message: 'Analysis pipeline triggered',
        callLogId,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    log.error('POST 오류', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
