// src/app/api/call-analysis/test/route.ts
// 테스트용 - transcript 직접 입력 및 AI 분석 트리거

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// POST - 테스트용 transcript 입력 및 분석 트리거
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysisId, transcript, callLogId } = body;

    console.log('='.repeat(60));
    console.log('[Test API] 테스트 분석 요청');
    console.log(`  분석ID: ${analysisId}`);
    console.log('='.repeat(60));

    if (!analysisId || !transcript) {
      return NextResponse.json(
        { success: false, error: 'analysisId and transcript are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const analysisCollection = db.collection('callAnalysis');

    // 분석 레코드 존재 확인
    const existing = await analysisCollection.findOne({
      _id: new ObjectId(analysisId)
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Analysis record not found' },
        { status: 404 }
      );
    }

    // transcript 직접 업데이트
    const now = new Date().toISOString();
    const updateFields: Record<string, unknown> = {
      status: 'stt_complete',
      transcript: {
        raw: transcript,
        segments: [],
      },
      transcriptFormatted: transcript,
      sttCompletedAt: now,
      updatedAt: now
    };

    // callLogId가 있으면 연결
    if (callLogId) {
      updateFields.callLogId = callLogId;

      // 통화기록에도 analysisId 연결
      await db.collection('callLogs').updateOne(
        { _id: new ObjectId(callLogId) },
        {
          $set: {
            analysisId: analysisId,
            updatedAt: now
          }
        }
      );
      console.log(`[Test API] 통화기록 ${callLogId}에 분석 연결`);
    }

    await analysisCollection.updateOne(
      { _id: new ObjectId(analysisId) },
      { $set: updateFields }
    );

    console.log('[Test API] Transcript 저장 완료, AI 분석 트리거...');

    // AI 분석 트리거 - request URL에서 origin 추출
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

    console.log('[Test API] AI 분석 URL:', `${baseUrl}/api/call-analysis/analyze`);

    const analyzeResponse = await fetch(`${baseUrl}/api/call-analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ analysisId }),
    });

    const analyzeResult = await analyzeResponse.json();
    console.log('[Test API] 분석 결과:', JSON.stringify(analyzeResult, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Test analysis triggered',
      data: {
        analysisId,
        transcriptSaved: true,
        analyzeResult
      }
    });

  } catch (error) {
    console.error('[Test API] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
