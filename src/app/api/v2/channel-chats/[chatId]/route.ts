// src/app/api/v2/channel-chats/[chatId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import Pusher from 'pusher';

export const dynamic = 'force-dynamic';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

interface RouteParams {
  params: Promise<{ chatId: string }>;
}

// GET: 대화방 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = verifyToken(request);
    if (authResult instanceof NextResponse) return authResult;

    const { chatId } = await params;

    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채팅 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    const chat = await db.collection('channelChats_v2').findOne({
      _id: new ObjectId(chatId),
      clinicId,
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: '대화방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 환자 정보 조회 (연결된 경우)
    let patient = null;
    if (chat.patientId && ObjectId.isValid(chat.patientId)) {
      patient = await db.collection('patients_v2').findOne({
        _id: new ObjectId(chat.patientId),
        clinicId,
      });
    }

    return NextResponse.json({
      success: true,
      data: { ...chat, patient },
    });
  } catch (error) {
    console.error('채팅 상세 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '채팅 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 대화방 영구 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = verifyToken(request);
    if (authResult instanceof NextResponse) return authResult;

    const { chatId } = await params;

    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채팅 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    // 대화방 삭제
    const result = await db.collection('channelChats_v2').deleteOne({
      _id: new ObjectId(chatId),
      clinicId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: '대화방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 관련 메시지도 삭제
    await db.collection('channelMessages_v2').deleteMany({
      chatId: new ObjectId(chatId),
    });

    return NextResponse.json({
      success: true,
      message: '대화방이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('채팅 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '채팅 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH: 대화방 업데이트 (환자 매칭, 상태 변경 등)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = verifyToken(request);
    if (authResult instanceof NextResponse) return authResult;

    const { chatId } = await params;
    const body = await request.json();

    if (!ObjectId.isValid(chatId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채팅 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    const allowedFields = [
      'patientId',
      'patientName',
      'phone',
      'status',
      'assignedTo',
      'tags',
      'unreadCount',
    ];

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 환자 매칭 시 환자 정보도 함께 가져오기
    if (body.patientId && ObjectId.isValid(body.patientId)) {
      const patient = await db.collection('patients_v2').findOne({
        _id: new ObjectId(body.patientId),
        clinicId,
      });
      if (patient) {
        updateData.patientName = patient.name;
        updateData.phone = patient.phone;
      }
    }

    const result = await db.collection('channelChats_v2').findOneAndUpdate(
      { _id: new ObjectId(chatId), clinicId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '대화방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사이드바 unread 뱃지 갱신을 위한 Pusher 이벤트 발송
    try {
      if (body.unreadCount === 0) {
        // 읽음 처리 → 뱃지 카운트 갱신
        await pusher.trigger('channel-chat-v2', 'messages-read', { chatId });
      } else if (body.status === 'closed') {
        // 상담 종료 → 종료된 대화방은 unread 집계에서 제외되므로 뱃지 갱신 필요
        await pusher.trigger('channel-chat-v2', 'chat-closed', { chatId });
      } else if (body.patientId !== undefined) {
        // 환자 매칭 변경
        await pusher.trigger('channel-chat-v2', 'patient-matched', {
          chatId,
          patientId: body.patientId,
          patientName: result.patientName,
        });
      }
    } catch (pusherError) {
      console.error('[채팅 PATCH] Pusher 이벤트 발송 실패:', pusherError);
      // Pusher 실패해도 PATCH 자체는 성공으로 응답
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('채팅 업데이트 오류:', error);
    return NextResponse.json(
      { success: false, error: '채팅 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
