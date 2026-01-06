// src/app/api/cron/send-recall-messages/route.ts
// 리콜 알림톡 자동 발송 Cron Job
// Vercel Cron: 매일 오전 10시 실행

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// Vercel Cron 설정을 위한 config
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 최대 60초

export async function GET(request: NextRequest) {
  try {
    // Cron 보안: Vercel Cron 헤더 확인
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // 개발 환경이 아닐 때만 인증 체크
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const { db } = await connectToDatabase();
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // 오늘 발송 예정인 pending 메시지 조회
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

    console.log(`[Cron] 발송 대기 메시지: ${pendingMessages.length}건`);

    let sentCount = 0;
    let failedCount = 0;
    const results: { id: string; status: string; phone?: string }[] = [];

    for (const message of pendingMessages) {
      try {
        const patient = (message as any).patient;
        if (!patient?.phone) {
          console.log(`[Cron] 환자 정보 없음: ${message._id}`);
          failedCount++;
          results.push({ id: message._id.toString(), status: 'no_patient' });
          continue;
        }

        // Mock 알림톡 발송
        console.log(`[알림톡 Mock] 발송: ${patient.phone} - ${message.message}`);

        // 발송 로그 기록
        await db.collection('alimtalk_logs').insertOne({
          type: 'recall',
          recallMessageId: message._id.toString(),
          patientId: message.patientId,
          patientPhone: patient.phone,
          message: message.message,
          status: 'sent',
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
      } catch (error) {
        console.error(`[Cron] 발송 실패: ${message._id}`, error);
        failedCount++;
        results.push({ id: message._id.toString(), status: 'error' });
      }
    }

    console.log(`[Cron] 발송 완료: 성공 ${sentCount}건, 실패 ${failedCount}건`);

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
    console.error('[Cron] send-recall-messages 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
