// src/app/api/v2/call-logs/[id]/recording/route.ts
// 녹취 파일 제공 API - base64 우선, 없으면 recordingUrl에서 직접 다운로드

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

    // 1순위: callRecordings_v2에서 base64 데이터 조회
    const recording = await db.collection('callRecordings_v2').findOne({
      callLogId: id,
    });

    let audioBuffer: Buffer | null = null;

    if (recording?.recordingBase64) {
      audioBuffer = Buffer.from(recording.recordingBase64, 'base64');
    } else {
      // 2순위: callLogs_v2의 recordingUrl에서 직접 다운로드 (3MB 초과로 base64 미저장된 경우)
      const callLog = await db.collection('callLogs_v2').findOne(
        { _id: new ObjectId(id) },
        { projection: { recordingUrl: 1 } }
      );

      if (callLog?.recordingUrl && callLog.recordingUrl.startsWith('http')) {
        try {
          const response = await fetch(callLog.recordingUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = Buffer.from(arrayBuffer);
          }
        } catch (dlError) {
          console.error(`[Recording] URL 다운로드 실패: ${callLog.recordingUrl}`, dlError);
        }
      }
    }

    if (!audioBuffer) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // 오디오 파일로 응답 (wav 형식)
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length.toString(),
        'Content-Disposition': `inline; filename="recording-${id}.wav"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error fetching recording:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recording' },
      { status: 500 }
    );
  }
}
