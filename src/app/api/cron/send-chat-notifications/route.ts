// src/app/api/cron/send-chat-notifications/route.ts
// 홈페이지 채팅: 상담사 답변 후 10분 미응답 시 SMS 알림 발송

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { sendMessage as sensSendMessage, isSensConfigured } from '@/utils/naverSens';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  console.log('[채팅알림 Cron] 시작:', new Date().toISOString());

  // Cron 인증 (Vercel Cron 또는 직접 호출)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[채팅알림 Cron] 인증 실패');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // SENS 설정 확인
  if (!isSensConfigured()) {
    console.log('[채팅알림 Cron] SENS 설정 없음, 건너뜀');
    return NextResponse.json({
      success: true,
      message: 'SENS not configured',
      sent: 0,
    });
  }

  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // 조건에 맞는 채팅 찾기:
    // 1. 홈페이지 채널
    // 2. 전화번호 있음
    // 3. 마지막 메시지가 상담사(agent)
    // 4. 마지막 메시지가 10분 이상 전
    // 5. SMS 아직 안 보냄
    // 6. 채팅 상태가 active
    const chatsToNotify = await db.collection('channelChats_v2').find({
      channel: 'website',
      phone: { $exists: true, $nin: [null, ''] },
      lastMessageBy: 'agent',
      lastMessageAt: { $lte: tenMinutesAgo },
      smsNotificationSent: { $ne: true },
      status: 'active',
    }).toArray();

    console.log(`[채팅알림 Cron] 알림 대상: ${chatsToNotify.length}건`);

    if (chatsToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No chats to notify',
        sent: 0,
      });
    }

    // 병원 이름 가져오기
    const settings = await db.collection('settings').findOne({});
    const clinicName = settings?.clinicName || '병원';

    // SMS 발송 (SENS)
    let sentCount = 0;
    let failCount = 0;

    for (const chat of chatsToNotify) {
      const phone = chat.phone?.replace(/-/g, '');
      if (!phone) continue;

      try {
        const smsMessage = `[${clinicName}] 홈페이지 상담 답변이 도착했습니다. 확인해주세요.`;

        const result = await sensSendMessage({
          to: phone,
          text: smsMessage,
          type: 'SMS',
        });

        if (!result.success) {
          throw new Error(result.error || 'SENS 발송 실패');
        }

        // 발송 완료 표시
        await db.collection('channelChats_v2').updateOne(
          { _id: chat._id },
          {
            $set: {
              smsNotificationSent: true,
              smsNotificationSentAt: now,
            },
          }
        );

        console.log(`[채팅알림 Cron] SMS 발송 성공: ${phone}`);
        sentCount++;
      } catch (error) {
        console.error(`[채팅알림 Cron] SMS 발송 실패: ${phone}`, error);
        failCount++;
      }
    }

    console.log(`[채팅알림 Cron] 완료 - 성공: ${sentCount}, 실패: ${failCount}`);

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failCount,
      total: chatsToNotify.length,
    });
  } catch (error) {
    console.error('[채팅알림 Cron] 오류:', error);
    return NextResponse.json(
      { success: false, error: '처리 중 오류 발생' },
      { status: 500 }
    );
  }
}
