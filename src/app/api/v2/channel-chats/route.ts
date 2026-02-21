// src/app/api/v2/channel-chats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ChannelType, ChatStatus } from '@/types/v2';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { createChannelChatSchema } from '@/lib/validations/schemas';

export const dynamic = 'force-dynamic';

interface ChatQuery {
  channel?: ChannelType;
  status?: ChatStatus | { $ne: string };
  $or?: Array<{ patientName?: { $regex: string; $options: string }; phone?: { $regex: string } }>;
}

// GET: 대화방 목록 조회
export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get('channel') as ChannelType | 'all' | null;
    const status = searchParams.get('status') as ChatStatus | 'all' | null;
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { db } = await connectToDatabase();

    // 쿼리 빌드
    const query: ChatQuery & { clinicId?: string } = { clinicId };

    if (channel && channel !== 'all') {
      query.channel = channel;
    }

    if (status === 'closed') {
      // 종료된 채팅만
      query.status = 'closed';
    } else if (status === 'all') {
      // 모든 채팅 (필터 없음)
    } else {
      // 기본('active'): 종료되지 않은 채팅만
      query.status = { $ne: 'closed' };
    }

    if (search) {
      query.$or = [
        { patientName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search.replace(/-/g, '') } },
      ];
    }

    // 페이지네이션
    const skip = (page - 1) * limit;

    const [chats, total] = await Promise.all([
      db
        .collection('channelChats_v2')
        .find(query)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('channelChats_v2').countDocuments(query),
    ]);

    // 읽지 않은 총 메시지 수
    const unreadTotal = await db.collection('channelChats_v2').aggregate([
      { $match: { clinicId, status: { $ne: 'closed' } } },
      { $group: { _id: null, total: { $sum: '$unreadCount' } } },
    ]).toArray();

    return NextResponse.json({
      success: true,
      data: chats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadTotal: unreadTotal[0]?.total || 0,
    });
  } catch (error) {
    console.error('채널 채팅 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '채팅 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 대화방 생성 (주로 웹훅에서 사용)
export async function POST(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const body = await request.json();
    const validation = validateBody(createChannelChatSchema, body);
    if (!validation.success) return validation.response;
    const { channel, channelRoomId, channelUserKey, phone, patientName } = validation.data;

    const { db } = await connectToDatabase();

    // 이미 존재하는 대화방인지 확인
    const existing = await db.collection('channelChats_v2').findOne({ clinicId, channelRoomId });
    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        message: '이미 존재하는 대화방입니다.',
      });
    }

    // 전화번호로 환자 자동 매칭 시도
    let patientId: string | undefined;
    let matchedPatientName: string | undefined;

    if (phone) {
      const normalizedPhone = phone.replace(/-/g, '');
      const patient = await db.collection('patients_v2').findOne({
        clinicId,
        $or: [
          { phone: normalizedPhone },
          { phone: { $regex: normalizedPhone.slice(-8) + '$' } },
        ],
      });

      if (patient) {
        patientId = patient._id.toString();
        matchedPatientName = patient.name;
      }
    }

    const now = new Date();
    const newChat = {
      clinicId,
      channel,
      channelRoomId,
      channelUserKey,
      phone: phone?.replace(/-/g, ''),
      patientId,
      patientName: matchedPatientName || patientName,
      status: 'active' as ChatStatus,
      unreadCount: 0,
      lastMessageAt: now,
      lastMessagePreview: '',
      lastMessageBy: 'customer' as const,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('channelChats_v2').insertOne(newChat);

    return NextResponse.json({
      success: true,
      data: { ...newChat, _id: result.insertedId },
    });
  } catch (error) {
    console.error('채널 대화방 생성 오류:', error);
    return NextResponse.json(
      { success: false, error: '대화방 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
