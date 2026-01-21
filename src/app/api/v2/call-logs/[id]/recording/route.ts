// src/app/api/v2/call-logs/[id]/recording/route.ts
// 녹취 파일 제공 API - callRecordings_v2에서 base64 데이터를 가져와 오디오 파일로 응답

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

    // callRecordings_v2에서 녹취 데이터 조회
    const recording = await db.collection('callRecordings_v2').findOne({
      callLogId: id,
    });

    if (!recording || !recording.recordingBase64) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // base64를 바이너리로 변환
    const audioBuffer = Buffer.from(recording.recordingBase64, 'base64');

    // 오디오 파일로 응답 (wav 형식)
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length.toString(),
        'Content-Disposition': `inline; filename="recording-${id}.wav"`,
        'Cache-Control': 'private, max-age=3600', // 1시간 캐시
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
