// 임시 디버그 API - 녹취/AI분석 누락 원인 조사
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const date = searchParams.get('date'); // YYYY-MM-DD

    const { db } = await connectToDatabase();
    const clinicId = 'default';

    // 1. 환자 찾기
    const query: Record<string, unknown> = { clinicId, deletedAt: { $exists: false } };
    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }

    const patients = await db.collection('patients_v2')
      .find(query, { projection: { name: 1, phone: 1 } })
      .limit(10)
      .toArray();

    if (patients.length === 0) {
      return NextResponse.json({ success: false, error: 'Patient not found', query });
    }

    // 2. 해당 환자의 통화기록 조회
    const results = [];
    for (const patient of patients) {
      const callLogQuery: Record<string, unknown> = {
        clinicId,
        $or: [
          { phone: patient.phone },
          { patientId: patient._id.toString() },
        ],
      };

      // 날짜 필터
      if (date) {
        const startOfDay = new Date(`${date}T00:00:00+09:00`);
        const endOfDay = new Date(`${date}T23:59:59+09:00`);
        callLogQuery.$or = [
          { phone: patient.phone, startedAt: { $gte: startOfDay, $lte: endOfDay } },
          { phone: patient.phone, createdAt: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
          { patientId: patient._id.toString(), startedAt: { $gte: startOfDay, $lte: endOfDay } },
          { patientId: patient._id.toString(), createdAt: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
        ];
      }

      const callLogs = await db.collection('callLogs_v2')
        .find(callLogQuery)
        .sort({ startedAt: -1 })
        .limit(10)
        .toArray();

      const callLogsWithRecordings = [];
      for (const log of callLogs) {
        // 녹음 데이터 확인
        const recording = await db.collection('callRecordings_v2').findOne({
          callLogId: log._id.toString(),
        });

        callLogsWithRecordings.push({
          _id: log._id.toString(),
          phone: log.phone,
          direction: log.direction,
          status: log.status,
          duration: log.duration,
          startedAt: log.startedAt,
          endedAt: log.endedAt,
          createdAt: log.createdAt,
          // 녹취 관련
          recordingUrl: log.recordingUrl || null,
          recordingFileName: log.recordingFileName || null,
          // AI 분석 관련
          aiStatus: log.aiStatus || null,
          aiError: log.aiAnalysis?.error || null,
          aiSkipReason: log.aiAnalysis?.skipReason || null,
          hasTranscript: !!log.aiAnalysis?.transcript,
          transcriptPreview: log.aiAnalysis?.transcript?.substring(0, 150) || null,
          hasSummary: !!log.aiAnalysis?.summary,
          summary: log.aiAnalysis?.summary || null,
          classification: log.aiAnalysis?.classification || null,
          // 녹음 base64 데이터
          hasBase64Recording: !!recording?.recordingBase64,
          base64Length: recording?.recordingBase64?.length || 0,
          recordingCreatedAt: recording?.createdAt || null,
        });
      }

      results.push({
        patient: {
          _id: patient._id.toString(),
          name: patient.name,
          phone: patient.phone,
        },
        callLogs: callLogsWithRecordings,
        callLogCount: callLogsWithRecordings.length,
      });
    }

    return NextResponse.json({
      success: true,
      searchParams: { name, date },
      results,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Debug Recording] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
