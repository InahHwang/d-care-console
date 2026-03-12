// src/app/api/cron/send-recall-messages/route.ts
// 리콜 SMS 자동 발송 Cron Job (CoolSMS 실제 발송)
// Vercel Cron: 매일 오전 10시 실행

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

// CoolSMS SDK 임포트
let coolsmsService: any = null;
try {
  if (isVercel) {
    const coolsmsModule = require('coolsms-node-sdk');
    coolsmsService = coolsmsModule.default || coolsmsModule;
  } else {
    coolsmsService = require('coolsms-node-sdk').default;
  }
} catch (error: any) {
  console.error('[Recall Cron] CoolSMS SDK 임포트 실패:', error.message);
}

const COOLSMS_CONFIG = {
  API_KEY: process.env.COOLSMS_API_KEY || '',
  API_SECRET: process.env.COOLSMS_API_SECRET || '',
  SENDER_NUMBER: process.env.COOLSMS_SENDER_NUMBER || '',
};

function getByteLength(str: string): number {
  let byteLength = 0;
  for (let i = 0; i < str.length; i++) {
    byteLength += str.charCodeAt(i) > 127 ? 2 : 1;
  }
  return byteLength;
}

export async function GET(request: NextRequest) {
  try {
    // Cron 보안: Vercel Cron 헤더 확인
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // CoolSMS 설정 확인
    if (!coolsmsService || !COOLSMS_CONFIG.API_KEY || !COOLSMS_CONFIG.API_SECRET || !COOLSMS_CONFIG.SENDER_NUMBER) {
      console.error('[Recall Cron] CoolSMS 설정 누락');
      return NextResponse.json(
        { success: false, error: 'SMS 발송 설정이 올바르지 않습니다' },
        { status: 500 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // 오늘까지 발송 예정인 pending 메시지 조회
    const pendingMessages = await db.collection('recall_messages')
      .aggregate([
        {
          $match: {
            status: 'pending',
            scheduledAt: { $lte: endOfToday },
          }
        },
        {
          $lookup: {
            from: 'patients_v2',
            let: { patientId: { $toObjectId: '$patientId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$patientId'] } } },
              { $project: { name: 1, phone: 1 } }
            ],
            as: 'patient'
          }
        },
        { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } }
      ])
      .toArray();

    console.log(`[Recall Cron] 발송 대기 메시지: ${pendingMessages.length}건`);

    if (pendingMessages.length === 0) {
      return NextResponse.json({
        success: true,
        data: { totalPending: 0, sent: 0, failed: 0, executedAt: now.toISOString(), results: [] },
      });
    }

    const messageService = new coolsmsService(COOLSMS_CONFIG.API_KEY, COOLSMS_CONFIG.API_SECRET);

    let sentCount = 0;
    let failedCount = 0;
    const results: { id: string; status: string; phone?: string; error?: string }[] = [];

    for (const message of pendingMessages) {
      try {
        const patient = (message as any).patient;
        if (!patient?.phone) {
          console.log(`[Recall Cron] 환자 정보/전화번호 없음: ${message._id}`);
          failedCount++;
          results.push({ id: message._id.toString(), status: 'no_patient' });
          continue;
        }

        const messageText = message.message;
        const messageType = getByteLength(messageText) > 90 ? 'LMS' : 'SMS';

        // CoolSMS 실제 발송
        const sendResult = await messageService.sendOne({
          to: patient.phone.replace(/-/g, ''),
          from: COOLSMS_CONFIG.SENDER_NUMBER,
          text: messageText,
          type: messageType,
        });

        console.log(`[Recall Cron] 발송 성공: ${patient.name}(${patient.phone}) - ${messageType}`);

        // 발송 로그 기록
        await db.collection('alimtalk_logs').insertOne({
          type: 'recall',
          recallMessageId: message._id.toString(),
          patientId: message.patientId,
          patientPhone: patient.phone,
          message: messageText,
          messageType,
          status: 'sent',
          coolsmsResult: sendResult,
          sentAt: now,
          createdAt: now.toISOString(),
        });

        // 메시지 상태 업데이트
        await db.collection('recall_messages').updateOne(
          { _id: message._id },
          {
            $set: {
              status: 'sent',
              sentAt: now,
              updatedAt: now.toISOString(),
            },
          }
        );

        sentCount++;
        results.push({ id: message._id.toString(), status: 'sent', phone: patient.phone });
      } catch (error: any) {
        console.error(`[Recall Cron] 발송 실패: ${message._id}`, error.message);
        failedCount++;
        results.push({ id: message._id.toString(), status: 'error', error: error.message });
      }
    }

    console.log(`[Recall Cron] 발송 완료: 성공 ${sentCount}건, 실패 ${failedCount}건`);

    return NextResponse.json({
      success: true,
      data: {
        totalPending: pendingMessages.length,
        sent: sentCount,
        failed: failedCount,
        executedAt: now.toISOString(),
        results,
      },
    });
  } catch (error) {
    console.error('[Recall Cron] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
