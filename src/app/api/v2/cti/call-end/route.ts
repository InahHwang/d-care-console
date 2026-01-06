// src/app/api/v2/cti/call-end/route.ts
// CTI Bridge로부터 통화 종료 이벤트 수신

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  return phone;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      callerNumber,
      calledNumber,
      duration,
      callStatus, // 'connected' | 'missed' | 'busy'
      timestamp,
    } = body;

    console.log(`[CTI v2] 통화 종료: ${callerNumber}, ${duration}초`);

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    const formattedPhone = formatPhone(callerNumber);

    // 최근 통화 기록 찾기 (5분 이내)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // 부재중인 경우 aiAnalysis에 분류 자동 설정
    const isMissed = !duration || duration === 0;

    let callLog;

    if (isMissed) {
      // 부재중: aiAnalysis에 분류 설정
      callLog = await db.collection('callLogs_v2').findOneAndUpdate(
        {
          phone: formattedPhone,
          direction: 'inbound',
          createdAt: { $gte: fiveMinutesAgo },
          duration: 0,
        },
        [
          {
            $set: {
              duration: 0,
              status: 'missed',
              endedAt: timestamp || now,
              updatedAt: now,
              aiStatus: 'completed',
              aiAnalysis: {
                $mergeObjects: [
                  { $ifNull: ['$aiAnalysis', {}] },
                  { classification: '부재중', summary: '부재중 통화' }
                ]
              }
            },
          }
        ],
        {
          sort: { createdAt: -1 },
          returnDocument: 'after',
        }
      );
    } else {
      // 연결됨: 일반 업데이트
      callLog = await db.collection('callLogs_v2').findOneAndUpdate(
        {
          phone: formattedPhone,
          direction: 'inbound',
          createdAt: { $gte: fiveMinutesAgo },
          duration: 0,
        },
        {
          $set: {
            duration: duration || 0,
            status: 'connected',
            endedAt: timestamp || now,
            updatedAt: now,
          },
        },
        {
          sort: { createdAt: -1 },
          returnDocument: 'after',
        }
      );
    }

    if (!callLog) {
      console.log('[CTI v2] 매칭되는 통화 기록 없음');
      return NextResponse.json({
        success: true,
        message: 'No matching call log found',
      });
    }

    // Pusher로 통화 종료 이벤트 전송
    try {
      await pusher.trigger('cti-v2', 'call-ended', {
        callLogId: callLog._id?.toString(),
        phone: formattedPhone,
        duration,
        status: duration > 0 ? 'connected' : 'missed',
        patientId: callLog.patientId,
      });
    } catch (pusherError) {
      console.error('[CTI v2] Pusher 오류:', pusherError);
    }

    return NextResponse.json({
      success: true,
      callLogId: callLog._id?.toString(),
      duration,
    });
  } catch (error) {
    console.error('[CTI v2] call-end 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
