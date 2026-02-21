// src/app/api/v2/call-logs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

export const dynamic = 'force-dynamic';

// V2 AI 분석 파이프라인 트리거
async function triggerV2AnalysisPipeline(callLogId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://d-care-console.vercel.app';
    console.log(`[V2 Analysis] 파이프라인 시작: ${callLogId}`);

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

    // 2. AI 분석
    const analyzeResponse = await fetch(`${baseUrl}/api/v2/call-analysis/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callLogId }),
    });

    if (!analyzeResponse.ok) {
      const analyzeText = await analyzeResponse.text();
      throw new Error(`AI 분석 실패: ${analyzeResponse.status} - ${analyzeText}`);
    }

    console.log(`[V2 Analysis] 파이프라인 완료: ${callLogId}`);
  } catch (error) {
    console.error(`[V2 Analysis] 파이프라인 오류:`, error);

    // 실패 상태로 업데이트
    try {
      const { db } = await connectToDatabase();
      await db.collection('callLogs_v2').updateOne(
        { _id: new ObjectId(callLogId) },
        { $set: { aiStatus: 'failed', updatedAt: new Date() } }
      );
    } catch (dbError) {
      console.error('[V2 Analysis] DB 업데이트 오류:', dbError);
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid call log ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const callLog = await db.collection('callLogs_v2').findOne({
      _id: new ObjectId(id),
    });

    if (!callLog) {
      return NextResponse.json({ error: 'Call log not found' }, { status: 404 });
    }

    // 환자 정보도 함께 조회 (있으면)
    let patientName = null;
    if (callLog.patientId && ObjectId.isValid(callLog.patientId)) {
      const patient = await db.collection('patients_v2').findOne(
        { _id: new ObjectId(callLog.patientId) },
        { projection: { name: 1 } }
      );
      patientName = patient?.name || null;
    }

    return NextResponse.json({
      id: callLog._id.toString(),
      phone: callLog.phone,
      patientId: callLog.patientId || null,
      patientName,
      direction: callLog.direction,
      status: callLog.status,
      duration: callLog.duration,
      recordingUrl: callLog.recordingUrl || null,
      startedAt: callLog.startedAt,
      endedAt: callLog.endedAt,
      aiStatus: callLog.aiStatus,
      aiAnalysis: callLog.aiAnalysis ? {
        classification: callLog.aiAnalysis.classification,
        patientName: callLog.aiAnalysis.patientName,
        interest: callLog.aiAnalysis.interest,
        interestDetail: callLog.aiAnalysis.interestDetail,
        temperature: callLog.aiAnalysis.temperature,
        summary: callLog.aiAnalysis.summary,
        followUp: callLog.aiAnalysis.followUp,
        concerns: callLog.aiAnalysis.concerns || [],
        preferredTime: callLog.aiAnalysis.preferredTime,
        confidence: callLog.aiAnalysis.confidence,
        transcript: callLog.aiAnalysis.transcript || null, // 전사 텍스트 전문
      } : null,
      createdAt: callLog.createdAt,
    });
  } catch (error) {
    console.error('Error fetching call log detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call log detail' },
      { status: 500 }
    );
  }
}

// PATCH - 통화 기록 수정 및 AI 분석 재시도
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid call log ID' }, { status: 400 });
    }

    const body = await request.json();
    const { recordingUrl, duration, status, triggerAnalysis } = body;

    const { db } = await connectToDatabase();
    const now = new Date();

    // 업데이트할 필드 준비
    const updateFields: Record<string, unknown> = { updatedAt: now };

    if (recordingUrl !== undefined) {
      updateFields.recordingUrl = recordingUrl;
    }
    if (duration !== undefined) {
      updateFields.duration = duration;
    }
    if (status !== undefined) {
      updateFields.status = status;
    }

    // AI 분석 트리거 요청 시 상태 초기화
    if (triggerAnalysis) {
      updateFields.aiStatus = 'pending';
    }

    const result = await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Call log not found' }, { status: 404 });
    }

    console.log(`[CallLog PATCH] 업데이트 완료: ${id}`, updateFields);

    // AI 분석 트리거 (백그라운드)
    if (triggerAnalysis && updateFields.recordingUrl) {
      console.log(`[CallLog PATCH] AI 분석 트리거: ${id}`);
      waitUntil(
        triggerV2AnalysisPipeline(id)
          .then(() => console.log(`[CallLog PATCH] AI 분석 완료: ${id}`))
          .catch(err => console.error(`[CallLog PATCH] AI 분석 실패: ${id}`, err))
      );
    }

    return NextResponse.json({
      success: true,
      message: triggerAnalysis ? 'Updated and analysis triggered' : 'Updated',
      id,
    });
  } catch (error) {
    console.error('Error updating call log:', error);
    return NextResponse.json(
      { error: 'Failed to update call log' },
      { status: 500 }
    );
  }
}
