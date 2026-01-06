// src/app/api/cron/check-no-response/route.ts
// 미응답 체크 Cron Job
// Vercel Cron: 매일 오후 6시 실행
// 발송 후 3일 경과한 메시지를 call-needed로 변경

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// Vercel Cron 설정을 위한 config
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NO_RESPONSE_DAYS = 3; // 3일 경과 시 미응답으로 처리

export async function GET(request: NextRequest) {
  try {
    // Cron 보안
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

    const { db } = await connectToDatabase();
    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setDate(thresholdDate.getDate() - NO_RESPONSE_DAYS);

    // 발송 후 3일 이상 경과한 sent 상태 메시지 조회
    const sentMessages = await db.collection('recall_messages')
      .find({
        status: 'sent',
        sentAt: { $lte: thresholdDate },
      })
      .toArray();

    console.log(`[Cron] ${NO_RESPONSE_DAYS}일 경과 메시지: ${sentMessages.length}건`);

    let noResponseCount = 0;
    let bookedCount = 0;
    const results: { id: string; status: string; patientId: string }[] = [];

    for (const message of sentMessages) {
      try {
        // 해당 환자가 예약을 잡았는지 확인 (callbacks_v2에서 확인)
        const hasBooking = await db.collection('callbacks_v2').findOne({
          patientId: message.patientId,
          type: 'recall',
          status: 'completed',
          createdAt: { $gte: new Date(message.sentAt).toISOString() },
        });

        // patients_v2의 nextVisit 필드도 확인
        const patient = await db.collection('patients_v2').findOne({
          _id: new ObjectId(message.patientId),
        });

        const hasVisitScheduled = patient?.nextVisit && new Date(patient.nextVisit) > now;

        if (hasBooking || hasVisitScheduled) {
          // 예약 완료로 상태 변경
          await db.collection('recall_messages').updateOne(
            { _id: message._id },
            {
              $set: {
                status: 'booked',
                bookedAt: hasBooking?.completedAt || patient?.nextVisit,
                updatedAt: now.toISOString(),
              },
            }
          );
          bookedCount++;
          results.push({ id: message._id.toString(), status: 'booked', patientId: message.patientId });
        } else {
          // 미응답 → 전화 필요로 변경
          await db.collection('recall_messages').updateOne(
            { _id: message._id },
            {
              $set: {
                status: 'call-needed',
                updatedAt: now.toISOString(),
              },
            }
          );
          noResponseCount++;
          results.push({ id: message._id.toString(), status: 'call-needed', patientId: message.patientId });
        }
      } catch (error) {
        console.error(`[Cron] 처리 실패: ${message._id}`, error);
        results.push({ id: message._id.toString(), status: 'error', patientId: message.patientId });
      }
    }

    console.log(`[Cron] 처리 완료: 예약완료 ${bookedCount}건, 전화필요 ${noResponseCount}건`);

    return NextResponse.json({
      success: true,
      data: {
        totalChecked: sentMessages.length,
        booked: bookedCount,
        noResponse: noResponseCount,
        executedAt: now.toISOString(),
        results,
      },
    });
  } catch (error) {
    console.error('[Cron] check-no-response 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
