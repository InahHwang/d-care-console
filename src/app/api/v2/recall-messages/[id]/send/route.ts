// src/app/api/v2/recall-messages/[id]/send/route.ts
// 리콜 메시지 즉시 발송 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

// POST - 즉시 발송
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date();

    // 메시지 조회
    const message = await db.collection('recall_messages').findOne({
      _id: new ObjectId(id),
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // 환자 정보 조회
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(message.patientId),
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Mock 알림톡 발송
    console.log(`[알림톡 Mock] 발송: ${patient.phone} - ${message.message}`);

    // 발송 로그 기록
    await db.collection('alimtalk_logs').insertOne({
      type: 'recall',
      recallMessageId: id,
      patientId: message.patientId,
      patientPhone: patient.phone,
      message: message.message,
      status: 'sent',
      sentAt: now,
      createdAt: now.toISOString(),
    });

    // 메시지 상태 업데이트
    await db.collection('recall_messages').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'sent',
          sentAt: now,
          updatedAt: now.toISOString(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: '알림톡이 발송되었습니다 (Mock)',
      data: {
        id,
        patientPhone: patient.phone,
        sentAt: now,
      },
    });
  } catch (error) {
    console.error('[Recall Send API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
