// 임시 디버그 API - 녹취/AI분석 누락 원인 조사
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function formatPhone(phone: string): string {
  const n = normalizePhone(phone);
  if (n.length === 11) return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  return phone;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const date = searchParams.get('date'); // YYYY-MM-DD

    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone parameter required' });
    }

    const { db } = await connectToDatabase();
    const clinicId = 'default';
    const formatted = formatPhone(phone);
    const normalized = normalizePhone(phone);

    // 통화기록 직접 검색
    const callLogQuery: Record<string, unknown> = {
      clinicId,
      $or: [
        { phone: formatted },
        { phone: normalized },
        { phone: phone },
      ],
    };

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00+09:00`);
      const endOfDay = new Date(`${date}T23:59:59+09:00`);
      callLogQuery.startedAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const callLogs = await db.collection('callLogs_v2')
      .find(callLogQuery)
      .sort({ startedAt: -1 })
      .limit(10)
      .toArray();

    // 환자 정보도 함께 조회
    const patient = await db.collection('patients_v2').findOne({
      clinicId,
      phone: formatted,
      deletedAt: { $exists: false },
    }, { projection: { name: 1, phone: 1 } });

    const callLogsWithRecordings = [];
    for (const log of callLogs) {
      const rec = await db.collection('callRecordings_v2').findOne({
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
        recordingUrl: log.recordingUrl || null,
        recordingFileName: log.recordingFileName || null,
        aiStatus: log.aiStatus || null,
        aiError: log.aiAnalysis?.error || null,
        aiSkipReason: log.aiAnalysis?.skipReason || null,
        hasTranscript: !!log.aiAnalysis?.transcript,
        transcriptPreview: log.aiAnalysis?.transcript?.substring(0, 150) || null,
        hasSummary: !!log.aiAnalysis?.summary,
        summary: log.aiAnalysis?.summary || null,
        classification: log.aiAnalysis?.classification || null,
        hasBase64Recording: !!rec?.recordingBase64,
        base64Length: rec?.recordingBase64?.length || 0,
        recordingCreatedAt: rec?.createdAt || null,
      });
    }

    return NextResponse.json({
      success: true,
      searchParams: { phone, date, formatted },
      patient: patient ? { name: patient.name, phone: patient.phone } : null,
      callLogCount: callLogsWithRecordings.length,
      callLogs: callLogsWithRecordings,
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
