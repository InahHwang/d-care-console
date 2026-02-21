// src/app/api/v2/recall-messages/route.ts
// 리콜 발송 내역 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { createRecallMessageSchema, updateRecallMessageSchema } from '@/lib/validations/schemas';

export type RecallMessageStatus = 'pending' | 'sent' | 'booked' | 'no-response' | 'call-needed' | 'completed';

export interface RecallMessage {
  _id?: ObjectId;
  patientId: string;
  treatment: string;
  timing: string;
  message: string;
  status: RecallMessageStatus;
  scheduledAt: Date;
  sentAt?: Date;
  bookedAt?: Date;
  completedAt?: Date;
  lastVisit: Date;
  createdAt: string;
}

// GET - 리콜 메시지 목록 조회
export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RecallMessageStatus | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { db } = await connectToDatabase();

    // 필터 조건
    const filter: Record<string, unknown> = {};
    if (status) {
      filter.status = status;
    }

    // 통계 조회
    const stats = await db.collection('recall_messages').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const statsMap: Record<string, number> = {};
    stats.forEach(s => {
      statsMap[s._id] = s.count;
    });

    // 목록 조회 with 환자 정보 조인
    const messages = await db.collection<RecallMessage>('recall_messages')
      .aggregate([
        { $match: filter },
        { $sort: { scheduledAt: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
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

    const totalCount = await db.collection('recall_messages').countDocuments(filter);

    return NextResponse.json({
      success: true,
      data: {
        messages: messages.map(m => ({
          id: m._id?.toString(),
          patientId: m.patientId,
          patientName: (m as any).patient?.name || '알 수 없음',
          patientPhone: (m as any).patient?.phone || '',
          treatment: m.treatment,
          timing: m.timing,
          message: m.message,
          status: m.status,
          scheduledAt: m.scheduledAt,
          sentAt: m.sentAt,
          bookedAt: m.bookedAt,
          completedAt: m.completedAt,
          lastVisit: m.lastVisit,
          daysPassed: m.sentAt ? Math.floor((Date.now() - new Date(m.sentAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
        })),
        stats: {
          pending: statsMap['pending'] || 0,
          sent: statsMap['sent'] || 0,
          booked: statsMap['booked'] || 0,
          noResponse: statsMap['no-response'] || 0,
          callNeeded: statsMap['call-needed'] || 0,
        },
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Recall Messages API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 리콜 메시지 생성 (환자 치료 완료 시 자동 호출)
export async function POST(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const body = await request.json();
    const validation = validateBody(createRecallMessageSchema, body);
    if (!validation.success) return validation.response;
    const { patientId, treatment, timing, timingDays, message, lastVisit } = validation.data;

    const { db } = await connectToDatabase();
    const now = new Date();

    // 발송 예정일 계산
    const scheduledAt = new Date(lastVisit);
    scheduledAt.setDate(scheduledAt.getDate() + timingDays);
    scheduledAt.setHours(10, 0, 0, 0); // 오전 10시로 설정

    const newMessage: RecallMessage = {
      patientId,
      treatment,
      timing,
      message,
      status: 'pending',
      scheduledAt,
      lastVisit: new Date(lastVisit),
      createdAt: now.toISOString(),
    };

    const result = await db.collection('recall_messages').insertOne(newMessage);

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...newMessage,
      },
    });
  } catch (error) {
    console.error('[Recall Messages API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - 상태 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const body = await request.json();
    const validation = validateBody(updateRecallMessageSchema, body);
    if (!validation.success) return validation.response;
    const { id, status, bookedAt } = validation.data;

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (status === 'completed') {
      updateData.completedAt = now;
    }

    if (bookedAt) {
      updateData.bookedAt = new Date(bookedAt);
    }

    const result = await db.collection('recall_messages').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Recall Messages API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
