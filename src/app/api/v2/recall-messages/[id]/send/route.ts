// src/app/api/v2/recall-messages/[id]/send/route.ts
// 리콜 메시지 즉시 발송 API (네이버 클라우드 SENS)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { sendMessage as sensSendMessage, isSensConfigured } from '@/utils/naverSens';

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
    const clinicId = getClinicId();
    const now = new Date();

    // 메시지 조회
    const message = await db.collection('recall_messages').findOne({
      _id: new ObjectId(id),
      clinicId,
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
      clinicId,
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

    // SENS 발송
    if (!isSensConfigured()) {
      return NextResponse.json(
        { success: false, error: 'SMS 발송 설정이 올바르지 않습니다' },
        { status: 500 }
      );
    }

    const messageText = message.message;
    const messageType = getByteLength(messageText) > 90 ? 'LMS' : 'SMS';

    const sendResult = await sensSendMessage({
      to: patient.phone.replace(/-/g, ''),
      text: messageText,
      type: messageType,
    });

    if (!sendResult.success) {
      throw new Error(sendResult.error || 'SENS 발송 실패');
    }

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
      sensResult: sendResult,
      sentAt: now,
      createdAt: now.toISOString(),
    });

    // 메시지 상태 업데이트
    await db.collection('recall_messages').updateOne(
      { _id: new ObjectId(id), clinicId },
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
      { success: false, error: '리콜 메시지 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
