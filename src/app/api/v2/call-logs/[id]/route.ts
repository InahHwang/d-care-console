// src/app/api/v2/call-logs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
