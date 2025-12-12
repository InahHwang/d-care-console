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
    const filter: any = {};

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

    // 페이징 적용하여 조회
    const callLogs = await callLogsCollection
      .find(filter)
      .sort({ ringTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // 통계 계산
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayStats = await callLogsCollection.aggregate([
      {
        $match: {
          ringTime: { $gte: todayStart.toISOString() }
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

    const callLogsCollection = await getCallLogsCollection();
    const now = new Date().toISOString();
    const normalizedCaller = normalizePhone(callerNumber);

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
      // 최근 해당 번호의 ringing 상태 통화 찾기
      const existingCall = await callLogsCollection.findOne(
        {
          callerNumber: { $regex: normalizedCaller.slice(-8) + '$' },
          callStatus: 'ringing'
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

      // 기존 기록이 없으면 새로 생성
      const newCallId = callId || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newCallLog: CallLog = {
        callId: newCallId,
        callerNumber: formatPhone(callerNumber),
        calledNumber: formatPhone(calledNumber || ''),
        callStatus: 'answered',
        callStartTime: timestamp || now,
        ringTime: timestamp || now,
        isMissed: false,
        patientId: patient?._id?.toString(),
        patientName: patient?.name,
        createdAt: now,
        updatedAt: now
      };

      await callLogsCollection.insertOne(newCallLog);
      return NextResponse.json({
        success: true,
        message: 'Call log created with start',
        callId: newCallId
      });

    } else if (eventType === 'end') {
      // 통화 종료
      const existingCall = await callLogsCollection.findOne(
        {
          callerNumber: { $regex: normalizedCaller.slice(-8) + '$' },
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
      // 최근 해당 번호의 ringing 상태 통화 찾기
      const existingCall = await callLogsCollection.findOne(
        {
          callerNumber: { $regex: normalizedCaller.slice(-8) + '$' },
          callStatus: 'ringing'
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

      // 기존 기록이 없으면 새로 생성
      const newCallId = callId || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const missedCallLog: CallLog = {
        callId: newCallId,
        callerNumber: formatPhone(callerNumber),
        calledNumber: formatPhone(calledNumber || ''),
        callStatus: 'missed',
        ringTime: timestamp || now,
        isMissed: true,
        patientId: patient?._id?.toString(),
        patientName: patient?.name,
        createdAt: now,
        updatedAt: now
      };

      await callLogsCollection.insertOne(missedCallLog);
      console.log(`[CallLog] 부재중 통화기록 생성: ${newCallId}`);

      return NextResponse.json({
        success: true,
        message: 'Missed call log created',
        callId: newCallId
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
