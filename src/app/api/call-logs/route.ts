// src/app/api/call-logs/route.ts
// 통화기록 저장 및 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { getCallLogsCollection, connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// 통화 상태 타입
export type CallStatus = 'ringing' | 'answered' | 'missed' | 'ended';

// 통화기록 인터페이스
export interface CallLog {
  _id?: ObjectId;
  callId: string;           // 통화 고유 ID
  callerNumber: string;     // 발신번호
  calledNumber: string;     // 수신번호 (병원번호)
  callStatus: CallStatus;   // 통화 상태
  callStartTime?: string;   // 통화 시작 시간 (수화기 들었을 때)
  callEndTime?: string;     // 통화 종료 시간
  ringTime: string;         // 착신 시간 (전화 왔을 때)
  duration?: number;        // 통화 시간 (초)
  isMissed: boolean;        // 부재중 여부
  patientId?: string;       // 환자 ID (매칭된 경우)
  patientName?: string;     // 환자 이름
  createdAt: string;
  updatedAt: string;
}

// 전화번호 정규화
function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

// 🔥 제외할 전화번호 목록 (통화기록에 저장하지 않음)
const EXCLUDED_PHONE_NUMBERS = [
  '07047414471',  // 070-4741-4471
];

// 전화번호 포맷팅 (010-1234-5678 형식)
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
    console.error('[CallLog] 환자 검색 오류:', error);
    return null;
  }
}

// GET - 통화기록 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // all, answered, missed
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search'); // 전화번호 또는 환자이름 검색

    const callLogsCollection = await getCallLogsCollection();

    // 필터 조건 구성
    const filter: any = {
      // 🔥 제외 번호들은 조회에서 제외
      callerNumber: { $nin: EXCLUDED_PHONE_NUMBERS.map(n => formatPhone(n)).concat(EXCLUDED_PHONE_NUMBERS) }
    };

    if (status === 'missed') {
      filter.isMissed = true;
    } else if (status === 'answered') {
      filter.isMissed = false;
      filter.callStatus = 'ended';
    }

    if (startDate || endDate) {
      filter.ringTime = {};
      if (startDate) filter.ringTime.$gte = startDate;
      if (endDate) filter.ringTime.$lte = endDate + 'T23:59:59.999Z';
    }

    if (search) {
      const searchNormalized = normalizePhone(search);
      filter.$or = [
        { callerNumber: { $regex: searchNormalized, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
      ];
    }

    // 총 개수 조회
    const total = await callLogsCollection.countDocuments(filter);

    // 페이징 적용 + callAnalysis 조인하여 조회
    const callLogs = await callLogsCollection.aggregate([
      { $match: filter },
      { $sort: { ringTime: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      // callAnalysis 컬렉션과 조인 (analysisId 기준)
      // 🔥 $toObjectId 오류 방지: analysisId가 유효한 경우만 변환
      {
        $lookup: {
          from: 'callAnalysis',
          let: { analysisId: '$analysisId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$analysisId', null] },
                    { $ne: ['$$analysisId', ''] },
                    // $convert를 사용해 안전하게 ObjectId 변환 (유효하지 않은 값이면 null 반환)
                    {
                      $eq: [
                        '$_id',
                        {
                          $convert: {
                            input: '$$analysisId',
                            to: 'objectId',
                            onError: null,
                            onNull: null
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            },
            {
              $project: {
                status: 1,
                analysis: 1,
                transcriptFormatted: 1
              }
            }
          ],
          as: 'analysisInfo'
        }
      },
      // 배열을 단일 객체로 변환
      {
        $addFields: {
          analysisStatus: { $arrayElemAt: ['$analysisInfo.status', 0] },
          analysisResult: { $arrayElemAt: ['$analysisInfo.analysis', 0] }
        }
      },
      // 조인 임시 필드 제거
      {
        $project: {
          analysisInfo: 0
        }
      }
    ]).toArray();

    // 통계 계산
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayStats = await callLogsCollection.aggregate([
      {
        $match: {
          ringTime: { $gte: todayStart.toISOString() },
          // 🔥 제외 번호들은 통계에서도 제외
          callerNumber: { $nin: EXCLUDED_PHONE_NUMBERS.map(n => formatPhone(n)).concat(EXCLUDED_PHONE_NUMBERS) }
        }
      },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          missedCalls: { $sum: { $cond: ['$isMissed', 1, 0] } },
          answeredCalls: { $sum: { $cond: [{ $eq: ['$callStatus', 'ended'] }, 1, 0] } },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } }
        }
      }
    ]).toArray();

    const stats = todayStats[0] || {
      totalCalls: 0,
      missedCalls: 0,
      answeredCalls: 0,
      totalDuration: 0
    };

    return NextResponse.json({
      success: true,
      data: callLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      todayStats: stats
    });
  } catch (error) {
    console.error('[CallLog API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 통화기록 생성/업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventType,  // 'ring' | 'start' | 'end' | 'missed'
      callerNumber,
      calledNumber,
      timestamp,
      callId       // 통화 ID (같은 통화 추적용)
    } = body;

    console.log('='.repeat(50));
    console.log(`[CallLog API] ${eventType} 이벤트 수신`);
    console.log(`  발신번호: ${callerNumber}`);
    console.log(`  수신번호: ${calledNumber}`);
    console.log(`  시각: ${timestamp}`);
    console.log(`  callId: ${callId}`);
    console.log('='.repeat(50));

    if (!callerNumber) {
      return NextResponse.json(
        { success: false, error: 'callerNumber is required' },
        { status: 400 }
      );
    }

    // 🔥 제외 번호 체크 - 해당 번호는 통화기록에 저장하지 않음
    const normalizedCaller = normalizePhone(callerNumber);
    if (EXCLUDED_PHONE_NUMBERS.includes(normalizedCaller)) {
      console.log(`[CallLog] 제외 번호로 무시됨: ${callerNumber}`);
      return NextResponse.json({
        success: true,
        message: 'Excluded phone number, ignored',
        excluded: true
      });
    }

    const callLogsCollection = await getCallLogsCollection();
    const now = new Date().toISOString();

    // 환자 정보 조회
    const patient = await findPatientByPhone(callerNumber);

    if (eventType === 'ring') {
      // 착신 - 새 통화기록 생성
      const newCallId = callId || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newCallLog: CallLog = {
        callId: newCallId,
        callerNumber: formatPhone(callerNumber),
        calledNumber: formatPhone(calledNumber || ''),
        callStatus: 'ringing',
        ringTime: timestamp || now,
        isMissed: false,
        patientId: patient?._id?.toString(),
        patientName: patient?.name,
        createdAt: now,
        updatedAt: now
      };

      await callLogsCollection.insertOne(newCallLog);
      console.log(`[CallLog] 새 통화기록 생성: ${newCallId}`);

      return NextResponse.json({
        success: true,
        message: 'Call log created',
        callId: newCallId,
        callLog: newCallLog
      });

    } else if (eventType === 'start') {
      // 통화 시작 (수화기 들었을 때)
      // 최근 해당 번호의 ringing 상태 통화 찾기 (최근 5분 이내)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const formattedCaller = formatPhone(callerNumber);

      // 🔥 전화번호 매칭 개선: 포맷된 형식과 정규화된 형식 둘 다 검색
      const existingCall = await callLogsCollection.findOne(
        {
          $or: [
            { callerNumber: formattedCaller },
            { callerNumber: normalizedCaller },
            { callerNumber: callerNumber }
          ],
          callStatus: 'ringing',
          ringTime: { $gte: fiveMinutesAgo }
        },
        { sort: { ringTime: -1 } }
      );

      if (existingCall) {
        await callLogsCollection.updateOne(
          { _id: existingCall._id },
          {
            $set: {
              callStatus: 'answered',
              callStartTime: timestamp || now,
              updatedAt: now
            }
          }
        );
        console.log(`[CallLog] 통화 시작 업데이트: ${existingCall.callId}`);

        return NextResponse.json({
          success: true,
          message: 'Call started',
          callId: existingCall.callId
        });
      }

      // 🔥 기존 기록이 없으면 새로 생성하지 않음 (ring 이벤트가 먼저 와야 함)
      console.log(`[CallLog] start 이벤트: 매칭되는 ringing 기록 없음 (무시)`);
      return NextResponse.json({
        success: true,
        message: 'No matching ringing call found, ignored'
      });

    } else if (eventType === 'end') {
      // 통화 종료
      const formattedCaller = formatPhone(callerNumber);

      // 🔥 전화번호 매칭 개선: 포맷된 형식과 정규화된 형식 둘 다 검색
      const existingCall = await callLogsCollection.findOne(
        {
          $or: [
            { callerNumber: formattedCaller },
            { callerNumber: normalizedCaller },
            { callerNumber: callerNumber }
          ],
          callStatus: { $in: ['ringing', 'answered'] }
        },
        { sort: { ringTime: -1 } }
      );

      if (existingCall) {
        const endTime = timestamp || now;
        let duration = 0;

        if (existingCall.callStartTime) {
          duration = Math.round(
            (new Date(endTime).getTime() - new Date(existingCall.callStartTime).getTime()) / 1000
          );
        }

        await callLogsCollection.updateOne(
          { _id: existingCall._id },
          {
            $set: {
              callStatus: 'ended',
              callEndTime: endTime,
              duration: duration,
              isMissed: existingCall.callStatus === 'ringing', // ringing에서 바로 end면 부재중
              updatedAt: now
            }
          }
        );
        console.log(`[CallLog] 통화 종료 업데이트: ${existingCall.callId}, 통화시간: ${duration}초`);

        return NextResponse.json({
          success: true,
          message: 'Call ended',
          callId: existingCall.callId,
          duration
        });
      }

      return NextResponse.json({
        success: false,
        message: 'No matching call found'
      });

    } else if (eventType === 'missed') {
      // 부재중 (명시적 부재중 이벤트)
      // 최근 해당 번호의 ringing 상태 통화 찾기 (최근 5분 이내)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const formattedCaller = formatPhone(callerNumber);

      // 🔥 전화번호 매칭 개선: 포맷된 형식과 정규화된 형식 둘 다 검색
      const existingCall = await callLogsCollection.findOne(
        {
          $or: [
            { callerNumber: formattedCaller },
            { callerNumber: normalizedCaller },
            { callerNumber: callerNumber }
          ],
          callStatus: 'ringing',
          ringTime: { $gte: fiveMinutesAgo }
        },
        { sort: { ringTime: -1 } }
      );

      if (existingCall) {
        await callLogsCollection.updateOne(
          { _id: existingCall._id },
          {
            $set: {
              callStatus: 'missed',
              isMissed: true,
              updatedAt: now
            }
          }
        );
        console.log(`[CallLog] 부재중 업데이트: ${existingCall.callId}`);

        return NextResponse.json({
          success: true,
          message: 'Call marked as missed',
          callId: existingCall.callId
        });
      }

      // 🔥 기존 기록이 없으면 새로 생성하지 않음 (ring 이벤트가 먼저 와야 함)
      console.log(`[CallLog] missed 이벤트: 매칭되는 ringing 기록 없음 (무시)`);
      return NextResponse.json({
        success: true,
        message: 'No matching ringing call found, ignored'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid eventType' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[CallLog API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - 통화기록 수정
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isMissed, duration, callStatus } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const callLogsCollection = await getCallLogsCollection();
    const now = new Date().toISOString();

    const updateFields: Record<string, unknown> = { updatedAt: now };

    if (typeof isMissed === 'boolean') {
      updateFields.isMissed = isMissed;
    }
    if (typeof duration === 'number') {
      updateFields.duration = duration;
    }
    if (callStatus) {
      updateFields.callStatus = callStatus;
    }

    const result = await callLogsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Call log not found' },
        { status: 404 }
      );
    }

    console.log(`[CallLog] 통화기록 수정: ${id}`, updateFields);

    return NextResponse.json({
      success: true,
      message: 'Call log updated',
      updated: updateFields
    });

  } catch (error) {
    console.error('[CallLog API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
