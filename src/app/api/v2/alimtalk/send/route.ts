// src/app/api/v2/alimtalk/send/route.ts
// 알림톡 발송 Mock API
// TODO: 실제 알림톡 서비스 연동 시 이 파일 수정

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export interface AlimtalkRequest {
  phone: string;
  message: string;
  templateCode?: string;
  variables?: Record<string, string>;
}

export interface AlimtalkResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// POST - 알림톡 발송 (Mock)
export async function POST(request: NextRequest) {
  try {
    const body: AlimtalkRequest = await request.json();
    const { phone, message, templateCode } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'phone and message are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date();
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Mock 발송 로그
    console.log('[알림톡 Mock API]', {
      phone,
      message: message.substring(0, 50) + '...',
      templateCode,
      messageId,
    });

    // 발송 로그 저장
    await db.collection('alimtalk_logs').insertOne({
      messageId,
      phone,
      message,
      templateCode,
      status: 'sent', // Mock이므로 항상 성공
      provider: 'mock',
      sentAt: now,
      createdAt: now.toISOString(),
    });

    // Mock 응답 (실제 서비스 연동 시 여기를 수정)
    return NextResponse.json({
      success: true,
      data: {
        messageId,
        phone,
        status: 'sent',
        sentAt: now.toISOString(),
        // Mock 메시지: 실제 발송되지 않음
        mock: true,
        mockMessage: '이 메시지는 실제로 발송되지 않았습니다 (Mock 모드)',
      },
    });
  } catch (error) {
    console.error('[Alimtalk API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - 발송 내역 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = {};
    if (phone) {
      filter.phone = phone;
    }

    const logs = await db.collection('alimtalk_logs')
      .find(filter)
      .sort({ sentAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      data: logs.map(log => ({
        id: log._id?.toString(),
        messageId: log.messageId,
        phone: log.phone,
        message: log.message,
        status: log.status,
        sentAt: log.sentAt,
      })),
    });
  } catch (error) {
    console.error('[Alimtalk API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
