// src/app/api/v2/recall-messages/[id]/send/route.ts
// 리콜 메시지 즉시 발송 API (CoolSMS 실제 발송)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

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
  console.error('[Recall Send] CoolSMS SDK 임포트 실패:', error.message);
}

const COOLSMS_CONFIG = {
  API_KEY: process.env.COOLSMS_API_KEY || '',
  API_SECRET: process.env.COOLSMS_API_SECRET || '',
  SENDER_NUMBER: process.env.COOLSMS_SENDER_NUMBER || '',
};

// 메시지 바이트 길이 계산 (한글 2바이트, 영문 1바이트)
function getByteLength(str: string): number {
  let byteLength = 0;
  for (let i = 0; i < str.length; i++) {
    byteLength += str.charCodeAt(i) > 127 ? 2 : 1;
  }
  return byteLength;
}

// POST - 즉시 발송
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    if (!patient.phone) {
      return NextResponse.json(
        { success: false, error: '환자 전화번호가 없습니다' },
        { status: 400 }
      );
    }

    // CoolSMS 발송
    if (!coolsmsService || !COOLSMS_CONFIG.API_KEY || !COOLSMS_CONFIG.API_SECRET || !COOLSMS_CONFIG.SENDER_NUMBER) {
      return NextResponse.json(
        { success: false, error: 'SMS 발송 설정이 올바르지 않습니다' },
        { status: 500 }
      );
    }

    const messageService = new coolsmsService(COOLSMS_CONFIG.API_KEY, COOLSMS_CONFIG.API_SECRET);
    const messageText = message.message;
    const messageType = getByteLength(messageText) > 90 ? 'LMS' : 'SMS';

    const sendResult = await messageService.sendOne({
      to: patient.phone.replace(/-/g, ''),
      from: COOLSMS_CONFIG.SENDER_NUMBER,
      text: messageText,
      type: messageType,
    });

    console.log(`[Recall Send] 발송 성공: ${patient.name}(${patient.phone}) - ${messageType}`);

    // 발송 로그 기록
    await db.collection('alimtalk_logs').insertOne({
      type: 'recall',
      recallMessageId: id,
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
      message: `문자가 발송되었습니다`,
      data: {
        id,
        patientName: patient.name,
        patientPhone: patient.phone,
        messageType,
        sentAt: now,
      },
    });
  } catch (error: any) {
    console.error('[Recall Send API] 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
