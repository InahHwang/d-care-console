// src/app/api/v2/call-analysis/status/route.ts
// 분석 상태 폴링용 API - 대시보드 실시간 업데이트 + 디버그

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { waitUntil } from '@vercel/functions';

export async function GET(request: NextRequest) {
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
        { _id: { $in: objectIds } },
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
      { aiStatus: 'processing' },
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
    console.error('[Status v2] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 디버그: 수동으로 분석 파이프라인 트리거
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, callLogId } = body;

    console.log('='.repeat(50));
    console.log('[Status v2 POST] 디버그 요청:', action, callLogId);
    console.log('='.repeat(50));

    const { db } = await connectToDatabase();

    // 시스템 상태 확인
    if (action === 'debug') {
      // 최근 통화기록 확인
      const recentCallLogs = await db.collection('callLogs_v2')
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      // 최근 녹음 데이터 확인
      const recentRecordings = await db.collection('callRecordings_v2')
        .find({})
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
      });

      const recording = await db.collection('callRecordings_v2').findOne({
        callLogId: callLogId,
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
      console.log(`[Status v2] 수동 분석 트리거: ${callLogId}`);

      // 통화기록 확인
      const callLog = await db.collection('callLogs_v2').findOne({
        _id: new ObjectId(callLogId),
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
            console.log(`[Status v2] STT 시작: ${callLogId}`);
            const sttResponse = await fetch(`${baseUrl}/api/v2/call-analysis/transcribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callLogId }),
            });

            const sttResult = await sttResponse.json();
            console.log(`[Status v2] STT 결과:`, sttResult);

            if (!sttResult.success) {
              throw new Error(sttResult.error || 'STT failed');
            }

            console.log(`[Status v2] AI 분석 시작: ${callLogId}`);
            const analyzeResponse = await fetch(`${baseUrl}/api/v2/call-analysis/analyze`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callLogId }),
            });

            const analyzeResult = await analyzeResponse.json();
            console.log(`[Status v2] AI 분석 결과:`, analyzeResult);

            console.log(`[Status v2] 수동 분석 완료: ${callLogId}`);
          } catch (error) {
            console.error(`[Status v2] 수동 분석 실패:`, error);
          }
        })()
      );

      return NextResponse.json({
        success: true,
        message: 'Analysis pipeline triggered',
        callLogId,
      });
    }

    // 실패한 분석 일괄 재처리
    if (action === 'retry-failed') {
      const { date } = body; // YYYY-MM-DD 형식

      if (!date) {
        return NextResponse.json(
          { success: false, error: 'date (YYYY-MM-DD) required' },
          { status: 400 }
        );
      }

      const startOfDay = new Date(`${date}T00:00:00+09:00`);
      const endOfDay = new Date(`${date}T23:59:59+09:00`);

      // 실패/pending 상태인 통화기록 조회 (녹음 데이터 있는 것만)
      const failedLogs = await db.collection('callLogs_v2').find({
        aiStatus: { $in: ['failed', 'pending'] },
        $or: [
          { startedAt: { $gte: startOfDay, $lte: endOfDay } },
          { createdAt: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
        ],
        recordingUrl: { $exists: true, $ne: null },
      }).toArray();

      if (failedLogs.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No failed logs found for this date',
          count: 0,
        });
      }

      // 녹음 데이터 존재 여부 확인
      const retryTargets: { id: string; phone: string }[] = [];
      for (const log of failedLogs) {
        const recording = await db.collection('callRecordings_v2').findOne({
          callLogId: log._id.toString(),
        });
        if (recording?.recordingBase64) {
          retryTargets.push({ id: log._id.toString(), phone: log.phone });
        }
      }

      if (retryTargets.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No failed logs with recording data found',
          count: 0,
        });
      }

      console.log(`[Status v2] 일괄 재처리 시작: ${retryTargets.length}건 (${date})`);
      retryTargets.forEach(t => console.log(`  - ${t.id} (${t.phone})`));

      // 상태 일괄 리셋
      const retryIds = retryTargets.map(t => new ObjectId(t.id));
      await db.collection('callLogs_v2').updateMany(
        { _id: { $in: retryIds } },
        {
          $set: { aiStatus: 'pending', updatedAt: new Date().toISOString() },
          $unset: { 'aiAnalysis.error': '' },
        }
      );

      // 백그라운드에서 순차 처리 (rate limit 방지를 위해 건별 5초 대기)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://d-care-console.vercel.app';

      waitUntil(
        (async () => {
          for (let i = 0; i < retryTargets.length; i++) {
            const target = retryTargets[i];
            try {
              console.log(`[Retry] (${i + 1}/${retryTargets.length}) STT 시작: ${target.id} (${target.phone})`);

              const sttRes = await fetch(`${baseUrl}/api/v2/call-analysis/transcribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callLogId: target.id }),
              });
              const sttResult = await sttRes.json();

              if (!sttResult.success) {
                console.error(`[Retry] STT 실패: ${target.id} - ${sttResult.error}`);
                continue;
              }

              console.log(`[Retry] (${i + 1}/${retryTargets.length}) AI 분석 시작: ${target.id}`);

              const analyzeRes = await fetch(`${baseUrl}/api/v2/call-analysis/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callLogId: target.id }),
              });
              const analyzeResult = await analyzeRes.json();

              if (analyzeResult.success) {
                console.log(`[Retry] ✅ 완료: ${target.id} (${target.phone})`);
              } else {
                console.error(`[Retry] AI 분석 실패: ${target.id} - ${analyzeResult.error}`);
              }

              // rate limit 방지: 다음 건 전에 5초 대기
              if (i < retryTargets.length - 1) {
                await new Promise(r => setTimeout(r, 5000));
              }
            } catch (err) {
              console.error(`[Retry] 오류: ${target.id}`, err);
            }
          }
          console.log(`[Retry] 일괄 재처리 완료: ${retryTargets.length}건`);
        })()
      );

      return NextResponse.json({
        success: true,
        message: `Retry triggered for ${retryTargets.length} failed logs`,
        count: retryTargets.length,
        targets: retryTargets,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Status v2 POST] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
