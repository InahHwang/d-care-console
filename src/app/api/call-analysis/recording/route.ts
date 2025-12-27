// src/app/api/call-analysis/recording/route.ts
// 통화 녹취 완료 이벤트 처리 및 분석 파이프라인 트리거

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { connectToDatabase, getCallLogsCollection } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

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

// GET - 녹취 분석 목록 조회 또는 단일 조회
export async function GET(request: NextRequest) {
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      callerNumber,
      calledNumber,
      recordingFileName,
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

    // 새 분석 레코드 생성
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

    const result = await analysisCollection.insertOne(newAnalysis);
    console.log(`[CallAnalysis] 새 분석 레코드 생성: ${result.insertedId}`);

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
    if (body.recordingUrl) {
      console.log('[CallAnalysis] waitUntil로 STT 파이프라인 시작');
      waitUntil(
        triggerSTTProcessing(result.insertedId.toString(), body.recordingUrl)
          .then(() => console.log('[CallAnalysis] STT 파이프라인 완료'))
          .catch(err => console.error('[CallAnalysis] STT 트리거 실패:', err))
      );
    } else {
      console.log('[CallAnalysis] recordingUrl이 없어 STT 처리 보류');
    }

    return NextResponse.json({
      success: true,
      message: 'Recording received, analysis queued',
      analysisId: result.insertedId.toString(),
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
