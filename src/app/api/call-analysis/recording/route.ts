// src/app/api/call-analysis/recording/route.ts
// 통화 녹취 완료 이벤트 처리 및 분석 파이프라인 트리거
// V1 + V2 동시 저장 지원

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { connectToDatabase, getCallLogsCollection } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { withDeprecation } from '@/lib/deprecation';

// 통화 녹취 분석 상태
export type AnalysisStatus = 'pending' | 'stt_processing' | 'stt_complete' | 'analyzing' | 'complete' | 'failed';

// 통화 분석 결과 인터페이스
export interface CallAnalysis {
  _id?: ObjectId;
  callLogId?: string;           // 연결된 통화기록 ID
  callerNumber: string;         // 발신번호
  calledNumber: string;         // 수신번호
  recordingFileName: string;    // 녹취 파일명
  recordingUrl?: string;        // 녹취 파일 URL (SKB 서버 또는 로컬)
  duration: number;             // 통화 시간 (초)

  // STT 결과
  transcript?: string;          // STT 변환 텍스트
  sttCompletedAt?: string;      // STT 완료 시간

  // AI 분석 결과
  analysis?: {
    summary: string;            // 통화 요약 (2-3문장)
    category: string;           // 진료과목 (임플란트/교정/충치/스케일링/검진/기타)
    result: string;             // 상담 결과 (동의/보류/거절)
    expectedRevenue?: number;   // 예상 매출
    patientConcerns?: string[]; // 환자 우려사항
    consultantStrengths?: string[];  // 상담사 강점
    improvementPoints?: string[];    // 개선 포인트
  };
  analysisCompletedAt?: string; // 분석 완료 시간

  // 메타데이터
  status: AnalysisStatus;       // 처리 상태
  patientId?: string;           // 연결된 환자 ID
  patientName?: string;         // 환자 이름
  createdAt: string;
  updatedAt: string;
}

// 전화번호 정규화
function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

// 전화번호 포맷팅
function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  } else if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return phone;
}

// 환자 검색
async function findPatientByPhone(phoneNumber: string) {
  try {
    const { db } = await connectToDatabase();
    const normalized = normalizePhone(phoneNumber);

    const patient = await db.collection('patients').findOne({
      $or: [
        { phoneNumber: formatPhone(phoneNumber) },
        { phoneNumber: normalized },
        { phoneNumber: phoneNumber },
        { phoneNumber: { $regex: normalized.slice(-8) + '$' } },
      ],
    });

    return patient;
  } catch (error) {
    console.error('[CallAnalysis] 환자 검색 오류:', error);
    return null;
  }
}

// STT 파이프라인 트리거
async function triggerSTTProcessing(analysisId: string, recordingUrl: string) {
  try {
    console.log(`[CallAnalysis] STT 처리 시작: ${analysisId}`);

    // 내부 API 호출로 STT 처리 트리거
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/call-analysis/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysisId,
        recordingUrl
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`STT API 호출 실패: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[CallAnalysis] STT 처리 완료: ${analysisId}`);

    // STT 완료 후 AI 분석 트리거 (Phase 3)
    if (result.success) {
      triggerAIAnalysis(analysisId)
        .catch(err => console.error('[CallAnalysis] AI 분석 트리거 실패:', err));
    }

    return result;
  } catch (error) {
    console.error('[CallAnalysis] STT 처리 오류:', error);
    throw error;
  }
}

// AI 분석 트리거
async function triggerAIAnalysis(analysisId: string) {
  try {
    console.log(`[CallAnalysis] AI 분석 시작: ${analysisId}`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/call-analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ analysisId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI 분석 API 호출 실패: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[CallAnalysis] AI 분석 완료: ${analysisId}`);
    return result;
  } catch (error) {
    console.error('[CallAnalysis] AI 분석 오류:', error);
    throw error;
  }
}

// 통화기록 찾기
async function findCallLog(callerNumber: string, duration: number) {
  try {
    const callLogsCollection = await getCallLogsCollection();
    const formattedCaller = formatPhone(callerNumber);
    const normalizedCaller = normalizePhone(callerNumber);

    // 최근 10분 이내 종료된 통화 중 해당 번호의 통화 찾기
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const callLog = await callLogsCollection.findOne(
      {
        $or: [
          { callerNumber: formattedCaller },
          { callerNumber: normalizedCaller },
          { callerNumber: callerNumber }
        ],
        callStatus: 'ended',
        callEndTime: { $gte: tenMinutesAgo }
      },
      { sort: { callEndTime: -1 } }
    );

    return callLog;
  } catch (error) {
    console.error('[CallAnalysis] 통화기록 검색 오류:', error);
    return null;
  }
}

// ===== V2 관련 함수들 =====

// V2 통화기록 찾기 (수신/발신 모두 지원)
// 녹취 매칭 시간을 60분으로 확장 (통화가 길 수 있음)
async function findCallLogV2(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  callerNumber: string,
  calledNumber: string
) {
  try {
    const formattedCaller = formatPhone(callerNumber);
    const formattedCalled = formatPhone(calledNumber);
    const normalizedCaller = normalizePhone(callerNumber);
    const normalizedCalled = normalizePhone(calledNumber);
    // 60분으로 확장 (10분 → 60분): 통화가 길거나 녹취 처리가 지연될 수 있음
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

    console.log(`[CallAnalysis V2] 통화기록 검색: caller=${formattedCaller}, called=${formattedCalled}`);

    // 수신 통화: callerNumber가 환자 번호
    // 발신 통화: calledNumber가 환자 번호
    // 다양한 전화번호 형식 시도
    // 우선순위: 1) 녹취 없는 통화 먼저 (아직 녹취 연결 안 된 것)
    //          2) ringing 상태 우선 (부재중으로 표시된 것을 connected로 변경해야 함)
    const callLog = await db.collection('callLogs_v2').findOne(
      {
        $and: [
          // 전화번호 매칭
          {
            $or: [
              { phone: formattedCaller },
              { phone: formattedCalled },
              { phone: normalizedCaller },
              { phone: normalizedCalled },
              { phone: { $regex: normalizedCaller.slice(-8) + '$' } },
              { phone: { $regex: normalizedCalled.slice(-8) + '$' } },
            ],
          },
          // 시간 조건
          { startedAt: { $gte: sixtyMinutesAgo } },
          // 녹취 URL이 없는 통화 우선 (이미 녹취 연결된 것 제외)
          {
            $or: [
              { recordingUrl: { $exists: false } },
              { recordingUrl: null },
              { recordingUrl: '' },
            ],
          },
        ],
      },
      {
        sort: {
          // ringing 상태 우선 (부재중으로 남아있는 통화)
          status: 1,  // 'ringing'이 'connected'보다 먼저
          startedAt: -1
        }
      }
    );

    // 못 찾으면 녹취 있는 것도 포함해서 재검색 (fallback)
    if (!callLog) {
      const fallbackLog = await db.collection('callLogs_v2').findOne(
        {
          $or: [
            { phone: formattedCaller },
            { phone: formattedCalled },
            { phone: normalizedCaller },
            { phone: normalizedCalled },
            { phone: { $regex: normalizedCaller.slice(-8) + '$' } },
            { phone: { $regex: normalizedCalled.slice(-8) + '$' } },
          ],
          startedAt: { $gte: sixtyMinutesAgo },
        },
        { sort: { startedAt: -1 } }
      );

      if (fallbackLog) {
        console.log(`[CallAnalysis V2] 통화기록 찾음 (fallback): ${fallbackLog._id}, status=${fallbackLog.status}`);
        return fallbackLog;
      }
    }

    if (callLog) {
      console.log(`[CallAnalysis V2] 통화기록 찾음: ${callLog._id}, status=${callLog.status}`);
    } else {
      console.log('[CallAnalysis V2] 매칭되는 통화기록 없음');
    }

    return callLog;
  } catch (error) {
    console.error('[CallAnalysis V2] 통화기록 검색 오류:', error);
    return null;
  }
}

// V2 AI 분석 파이프라인 트리거
async function triggerV2AnalysisPipeline(callLogId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://d-care-console.vercel.app';
    console.log(`[V2 Analysis] 파이프라인 시작: ${callLogId}, baseUrl: ${baseUrl}`);

    // 1. STT 변환
    console.log(`[V2 Analysis] STT 시작: ${callLogId}`);
    const sttResponse = await fetch(`${baseUrl}/api/v2/call-analysis/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callLogId }),
    });

    const sttText = await sttResponse.text();
    console.log(`[V2 Analysis] STT 응답: ${sttResponse.status} - ${sttText.substring(0, 200)}`);

    if (!sttResponse.ok) {
      throw new Error(`STT 실패: ${sttResponse.status} - ${sttText}`);
    }

    const sttResult = JSON.parse(sttText);
    if (!sttResult.success) {
      throw new Error(sttResult.error || 'STT 실패');
    }

    console.log(`[V2 Analysis] STT 완료, transcript 길이: ${sttResult.transcript?.length || 0}`);

    // 2. AI 분석
    console.log(`[V2 Analysis] AI 분석 시작: ${callLogId}`);
    const analyzeResponse = await fetch(`${baseUrl}/api/v2/call-analysis/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callLogId }),
    });

    const analyzeText = await analyzeResponse.text();
    console.log(`[V2 Analysis] AI 분석 응답: ${analyzeResponse.status} - ${analyzeText.substring(0, 200)}`);

    if (!analyzeResponse.ok) {
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
        {
          $set: {
            aiStatus: 'failed',
            updatedAt: new Date().toISOString(),
          },
        }
      );
    } catch (dbError) {
      console.error('[V2 Analysis] DB 업데이트 오류:', dbError);
    }
  }
}

// V2 녹취 저장 및 분석 트리거
async function saveRecordingToV2(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  callerNumber: string,
  calledNumber: string,
  recordingFileName: string,
  recordingUrl: string | null,  // 녹취 파일 전체 URL 추가
  recordingBase64: string | null,
  duration: number
): Promise<{ callLogId: string | null; hasRecording: boolean }> {
  try {
    console.log('='.repeat(50));
    console.log('[CallAnalysis V2] saveRecordingToV2 시작');
    console.log(`  callerNumber: ${callerNumber}`);
    console.log(`  calledNumber: ${calledNumber}`);
    console.log(`  recordingFileName: ${recordingFileName}`);
    console.log(`  recordingUrl: ${recordingUrl}`);
    console.log(`  recordingBase64 있음: ${!!recordingBase64}`);
    console.log(`  recordingBase64 길이: ${recordingBase64?.length || 0}`);
    console.log(`  duration: ${duration}`);
    console.log('='.repeat(50));

    const now = new Date();
    const formattedCaller = formatPhone(callerNumber);
    const formattedCalled = formatPhone(calledNumber);

    // V2 통화기록 찾기
    const callLog = await findCallLogV2(db, callerNumber, calledNumber);

    let callLogId: string;

    if (!callLog) {
      // 통화기록이 없으면 새로 생성
      console.log('[CallAnalysis V2] 매칭 통화기록 없음, 새로 생성');
      const newCallLog = {
        phone: formattedCaller,
        direction: 'inbound' as const,
        status: 'connected' as const,
        duration: duration || 0,
        recordingFileName: recordingFileName,
        recordingUrl: recordingUrl || recordingFileName,  // 전체 URL 저장 (없으면 파일명)
        startedAt: now,
        endedAt: now,
        aiStatus: 'pending' as const,
        createdAt: now,
      };

      const result = await db.collection('callLogs_v2').insertOne(newCallLog);
      callLogId = result.insertedId.toString();
      console.log(`[CallAnalysis V2] 새 통화기록 생성됨: ${callLogId}`);
    } else {
      // 기존 통화기록 업데이트
      callLogId = callLog._id.toString();
      const prevStatus = callLog.status;

      await db.collection('callLogs_v2').updateOne(
        { _id: callLog._id },
        {
          $set: {
            recordingFileName: recordingFileName,
            recordingUrl: recordingUrl || recordingFileName,  // 전체 URL 저장 (없으면 파일명)
            duration: duration || callLog.duration,
            status: 'connected',
            aiStatus: 'pending',
            updatedAt: now,
          },
        }
      );

      // 상태 변경 로그 (부재중 → 수신완료 변경 시 중요)
      if (prevStatus === 'ringing') {
        console.log(`[CallAnalysis V2] ✅ 부재중(ringing) → 수신완료(connected) 변경: ${callLogId}`);
        console.log(`  - 전화번호: ${callLog.phone}`);
        console.log(`  - 녹취파일: ${recordingFileName}`);
        console.log(`  - 통화시간: ${duration}초`);
      } else {
        console.log(`[CallAnalysis V2] 기존 통화기록 업데이트: ${callLogId} (${prevStatus} → connected)`);
      }
    }

    // base64 녹음 데이터 저장
    let hasRecording = false;
    if (recordingBase64 && recordingBase64.length > 0) {
      try {
        const insertResult = await db.collection('callRecordings_v2').insertOne({
          callLogId: callLogId,
          recordingBase64: recordingBase64,
          createdAt: now,
        });
        hasRecording = true;
        console.log(`[CallAnalysis V2] 녹음 데이터 저장 완료: ${callLogId}`);
        console.log(`  - 녹음 레코드 ID: ${insertResult.insertedId}`);
        console.log(`  - 데이터 크기: ${recordingBase64.length} chars`);
      } catch (saveError) {
        console.error('[CallAnalysis V2] 녹음 데이터 저장 실패:', saveError);
      }
    } else {
      console.log('[CallAnalysis V2] recordingBase64가 비어있어서 녹음 저장 건너뜀');
    }

    return { callLogId, hasRecording };
  } catch (error) {
    console.error('[CallAnalysis V2] 저장 오류:', error);
    return { callLogId: null, hasRecording: false };
  }
}

// GET - 녹취 분석 목록 조회 또는 단일 조회
async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysisId');
    const callLogId = searchParams.get('callLogId');

    const { db } = await connectToDatabase();
    const analysisCollection = db.collection<CallAnalysis>('callAnalysis');

    // 단일 분석 조회 (analysisId로)
    if (analysisId) {
      const analysis = await analysisCollection.findOne({
        _id: new ObjectId(analysisId)
      });

      if (!analysis) {
        return NextResponse.json(
          { success: false, error: 'Analysis not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: analysis
      });
    }

    // 통화기록 ID로 분석 조회
    if (callLogId) {
      const analysis = await analysisCollection.findOne({
        callLogId: callLogId
      });

      return NextResponse.json({
        success: true,
        data: analysis || null
      });
    }

    // 목록 조회
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // pending, complete, failed
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 필터 조건 구성
    const filter: Record<string, unknown> = {};

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) (filter.createdAt as Record<string, string>).$gte = startDate;
      if (endDate) (filter.createdAt as Record<string, string>).$lte = endDate + 'T23:59:59.999Z';
    }

    // 총 개수 조회
    const total = await analysisCollection.countDocuments(filter);

    // 페이징 적용하여 조회
    const analyses = await analysisCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      data: analyses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[CallAnalysis API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 녹취 완료 이벤트 수신 (CTI Bridge에서 호출)
async function _POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      callerNumber,
      calledNumber,
      recordingFileName,
      recordingBase64,  // CTI Bridge에서 보내는 base64 인코딩된 오디오
      duration,
      timestamp
    } = body;

    console.log('='.repeat(60));
    console.log('[CallAnalysis API] 녹취 완료 이벤트 수신');
    console.log(`  발신번호: ${callerNumber}`);
    console.log(`  수신번호: ${calledNumber}`);
    console.log(`  녹취파일: ${recordingFileName}`);
    console.log(`  통화시간: ${duration}초`);
    console.log(`  시각: ${timestamp}`);
    console.log(`  base64 데이터: ${recordingBase64 ? `있음 (${recordingBase64.length} chars)` : '없음'}`);
    console.log('='.repeat(60));

    if (!callerNumber || !recordingFileName) {
      return NextResponse.json(
        { success: false, error: 'callerNumber and recordingFileName are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const analysisCollection = db.collection<CallAnalysis>('callAnalysis');
    const now = new Date().toISOString();

    // 환자 정보 조회
    const patient = await findPatientByPhone(callerNumber);

    // 통화기록 찾기
    const callLog = await findCallLog(callerNumber, duration);

    // 새 분석 레코드 생성 (base64는 너무 크므로 별도 저장)
    const newAnalysis: CallAnalysis = {
      callLogId: callLog?._id?.toString(),
      callerNumber: formatPhone(callerNumber),
      calledNumber: formatPhone(calledNumber || ''),
      recordingFileName: recordingFileName,
      duration: duration || 0,
      status: 'pending',
      patientId: patient?._id?.toString(),
      patientName: patient?.name,
      createdAt: timestamp || now,
      updatedAt: now
    };

    // base64 데이터가 있으면 별도 컬렉션에 저장 (분석 레코드에는 너무 큼)
    let hasRecordingData = false;
    if (recordingBase64) {
      try {
        await db.collection('callRecordings').insertOne({
          analysisId: null, // 나중에 업데이트
          recordingBase64: recordingBase64,
          createdAt: now
        });
        hasRecordingData = true;
        console.log('[CallAnalysis] base64 녹음 데이터 임시 저장 완료');
      } catch (saveErr) {
        console.error('[CallAnalysis] base64 저장 오류:', saveErr);
      }
    }

    const result = await analysisCollection.insertOne(newAnalysis);
    const analysisId = result.insertedId.toString();
    console.log(`[CallAnalysis] 새 분석 레코드 생성: ${analysisId}`);

    // base64 녹음 데이터에 analysisId 연결
    if (hasRecordingData) {
      await db.collection('callRecordings').updateOne(
        { analysisId: null, createdAt: now },
        { $set: { analysisId: analysisId } }
      );
      console.log('[CallAnalysis] 녹음 데이터에 analysisId 연결 완료');
    }

    // 통화기록에 분석 ID 연결
    if (callLog) {
      const callLogsCollection = await getCallLogsCollection();
      await callLogsCollection.updateOne(
        { _id: callLog._id },
        {
          $set: {
            analysisId: result.insertedId.toString(),
            recordingFileName: recordingFileName,
            updatedAt: now
          }
        }
      );
      console.log(`[CallAnalysis] 통화기록에 분석 ID 연결: ${callLog._id}`);
    }

    // Phase 2: STT 파이프라인 트리거 (waitUntil로 백그라운드 실행 보장)
    // base64 데이터가 있거나 recordingUrl이 있으면 STT 시작
    if (hasRecordingData || body.recordingUrl) {
      console.log('[CallAnalysis] waitUntil로 STT 파이프라인 시작');
      console.log(`  - base64 데이터: ${hasRecordingData ? '있음' : '없음'}`);
      console.log(`  - recordingUrl: ${body.recordingUrl ? '있음' : '없음'}`);

      waitUntil(
        triggerSTTProcessing(analysisId, body.recordingUrl)
          .then(() => console.log('[CallAnalysis] STT 파이프라인 완료'))
          .catch(err => console.error('[CallAnalysis] STT 트리거 실패:', err))
      );
    } else {
      console.log('[CallAnalysis] 녹음 데이터가 없어 STT 처리 보류');
    }

    // ===== V2 동시 저장 =====
    let v2CallLogId: string | null = null;
    let v2HasRecording = false;
    try {
      console.log('[CallAnalysis V2] V2 저장 시작');
      const v2Result = await saveRecordingToV2(
        db,
        callerNumber,
        calledNumber || '',
        recordingFileName,
        body.recordingUrl || null,  // 전체 URL 전달
        recordingBase64 || null,
        duration || 0
      );

      v2CallLogId = v2Result.callLogId;
      v2HasRecording = v2Result.hasRecording;

      console.log(`[CallAnalysis V2] 저장 결과: callLogId=${v2CallLogId}, hasRecording=${v2HasRecording}`);

      // V2는 URL fallback을 지원하므로 base64가 없어도 URL이 있으면 분석 가능
      const hasRecordingUrl = !!(body.recordingUrl);
      const canAnalyze = v2HasRecording || hasRecordingUrl;

      if (v2CallLogId && canAnalyze) {
        // V2 분석 파이프라인 트리거 (백그라운드)
        console.log(`[CallAnalysis V2] 분석 파이프라인 트리거 시작: ${v2CallLogId}`);
        console.log(`  - base64: ${v2HasRecording ? '있음' : '없음'}`);
        console.log(`  - URL: ${hasRecordingUrl ? body.recordingUrl : '없음'}`);
        waitUntil(
          triggerV2AnalysisPipeline(v2CallLogId)
            .then(() => console.log('[CallAnalysis V2] 분석 파이프라인 완료'))
            .catch(err => console.error('[CallAnalysis V2] 분석 트리거 실패:', err))
        );
      } else if (v2CallLogId && !canAnalyze) {
        console.log('[CallAnalysis V2] 녹음 데이터(base64/URL)가 없어서 분석 파이프라인 건너뜀');
      } else {
        console.log('[CallAnalysis V2] callLogId가 없어서 분석 파이프라인 건너뜀');
      }
    } catch (v2Error) {
      // V2 저장 실패해도 V1은 정상 진행
      console.error('[CallAnalysis V2] 저장 실패 (V1은 정상 진행):', v2Error);
    }

    return NextResponse.json({
      success: true,
      message: 'Recording received, analysis queued',
      analysisId: analysisId,
      v2CallLogId: v2CallLogId,
      data: {
        ...newAnalysis,
        _id: result.insertedId
      }
    });

  } catch (error) {
    console.error('[CallAnalysis API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - pending 상태 레코드를 failed로 업데이트
async function _PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { updatePendingToFailed, errorMessage } = body;

    if (!updatePendingToFailed) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const analysisCollection = db.collection('callAnalysis');
    const now = new Date().toISOString();

    // pending 상태인 레코드 중 오래된 것들을 failed로 변경
    // (10분 이상 pending 상태인 것들)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const result = await analysisCollection.updateMany(
      {
        status: 'pending',
        updatedAt: { $lt: tenMinutesAgo }
      },
      {
        $set: {
          status: 'failed',
          errorMessage: errorMessage || '처리 시간 초과 또는 데이터 누락으로 복구 불가',
          updatedAt: now
        }
      }
    );

    console.log(`[CallAnalysis] ${result.modifiedCount}개 레코드를 pending → failed로 변경`);

    return NextResponse.json({
      success: true,
      message: `${result.modifiedCount} records updated to failed`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('[CallAnalysis API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const deprecationOpts = { v1Route: '/api/call-analysis/recording', v2Route: '/api/v2/call-analysis/recording' };
export const GET = withDeprecation(_GET, deprecationOpts);
export const POST = withDeprecation(_POST, deprecationOpts);
export const PATCH = withDeprecation(_PATCH, deprecationOpts);
