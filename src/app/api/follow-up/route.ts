// src/app/api/follow-up/route.ts
// 사후관리 API - 환자 사후관리 발송 및 조회

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// 사후관리 상태 타입
export type FollowUpStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
export type FollowUpType = 'day1' | 'day3' | 'week1' | 'week2' | 'month1' | 'month3' | 'custom';

// 사후관리 인터페이스
export interface FollowUpRecord {
  _id?: ObjectId;
  patientId: string;
  patientName: string;
  phoneNumber: string;
  visitDate: string;           // 내원일
  treatmentType?: string;      // 진료 유형
  followUpType: FollowUpType;  // 사후관리 타입
  scheduledDate: string;       // 발송 예정일
  sentDate?: string;           // 실제 발송일
  status: FollowUpStatus;
  messageTemplate?: string;    // 발송 메시지 템플릿
  messageContent?: string;     // 실제 발송 메시지
  notes?: string;              // 메모
  createdBy?: string;          // 생성자
  createdAt: string;
  updatedAt: string;
}

// 사후관리 발송 이력
export interface FollowUpHistory {
  _id?: ObjectId;
  followUpId: string;
  patientId: string;
  patientName: string;
  phoneNumber: string;
  followUpType: FollowUpType;
  messageContent: string;
  sentAt: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

// GET - 사후관리 목록/통계 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'list' | 'stats' | 'history' | 'patients'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // pending, sent, failed
    const followUpType = searchParams.get('followUpType'); // day1, day3, week1, etc.
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const { db } = await connectToDatabase();

    // 통계 조회
    if (type === 'stats') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      // 오늘 발송 예정
      const todayPending = await db.collection('followUps').countDocuments({
        scheduledDate: { $regex: `^${todayStr}` },
        status: 'pending'
      });

      // 이번주 발송 예정
      const weekPending = await db.collection('followUps').countDocuments({
        scheduledDate: { $gte: weekStartStr, $lte: weekEndStr + 'T23:59:59' },
        status: 'pending'
      });

      // 이번달 발송 완료
      const monthSent = await db.collection('followUps').countDocuments({
        sentDate: { $gte: monthStartStr },
        status: 'sent'
      });

      // 발송 실패
      const totalFailed = await db.collection('followUps').countDocuments({
        status: 'failed'
      });

      // 타입별 통계
      const typeStats = await db.collection('followUps').aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: '$followUpType', count: { $sum: 1 } } }
      ]).toArray();

      return NextResponse.json({
        success: true,
        data: {
          todayPending,
          weekPending,
          monthSent,
          totalFailed,
          typeStats: typeStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>)
        }
      });
    }

    // 발송 이력 조회
    if (type === 'history') {
      const filter: any = {};

      if (startDate || endDate) {
        filter.sentAt = {};
        if (startDate) filter.sentAt.$gte = startDate;
        if (endDate) filter.sentAt.$lte = endDate + 'T23:59:59.999Z';
      }

      if (search) {
        filter.$or = [
          { patientName: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search.replace(/\D/g, ''), $options: 'i' } }
        ];
      }

      const total = await db.collection('followUpHistory').countDocuments(filter);
      const history = await db.collection('followUpHistory')
        .find(filter)
        .sort({ sentAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      return NextResponse.json({
        success: true,
        data: history,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    // 사후관리 대상 환자 목록 (내원완료 환자 중 사후관리 미등록)
    if (type === 'patients') {
      const filter: any = {
        visitConfirmed: true,
        postVisitStatus: { $in: ['내원완료', '진료완료', '수납완료'] }
      };

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search.replace(/\D/g, ''), $options: 'i' } }
        ];
      }

      const total = await db.collection('patients').countDocuments(filter);
      const patients = await db.collection('patients')
        .find(filter)
        .sort({ visitDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      // 각 환자의 사후관리 등록 여부 확인
      const patientIds = patients.map(p => p._id.toString());
      const existingFollowUps = await db.collection('followUps')
        .find({ patientId: { $in: patientIds } })
        .toArray();

      const followUpMap = existingFollowUps.reduce((acc, fu) => {
        if (!acc[fu.patientId]) acc[fu.patientId] = [];
        acc[fu.patientId].push(fu);
        return acc;
      }, {} as Record<string, any[]>);

      const patientsWithFollowUp = patients.map(p => ({
        ...p,
        followUps: followUpMap[p._id.toString()] || []
      }));

      return NextResponse.json({
        success: true,
        data: patientsWithFollowUp,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    // 기본: 사후관리 목록 조회
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (followUpType) {
      filter.followUpType = followUpType;
    }

    if (startDate || endDate) {
      filter.scheduledDate = {};
      if (startDate) filter.scheduledDate.$gte = startDate;
      if (endDate) filter.scheduledDate.$lte = endDate + 'T23:59:59.999Z';
    }

    if (search) {
      filter.$or = [
        { patientName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search.replace(/\D/g, ''), $options: 'i' } }
      ];
    }

    const total = await db.collection('followUps').countDocuments(filter);
    const followUps = await db.collection('followUps')
      .find(filter)
      .sort({ scheduledDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      data: followUps,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });

  } catch (error) {
    console.error('[FollowUp API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 사후관리 등록/발송
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body; // 'create' | 'send' | 'bulk-create'

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 사후관리 등록
    if (action === 'create') {
      const {
        patientId,
        patientName,
        phoneNumber,
        visitDate,
        treatmentType,
        followUpType,
        scheduledDate,
        messageTemplate,
        notes,
        createdBy
      } = body;

      if (!patientId || !patientName || !phoneNumber || !followUpType || !scheduledDate) {
        return NextResponse.json(
          { success: false, error: 'Required fields missing' },
          { status: 400 }
        );
      }

      const newFollowUp: FollowUpRecord = {
        patientId,
        patientName,
        phoneNumber,
        visitDate: visitDate || now,
        treatmentType,
        followUpType,
        scheduledDate,
        status: 'pending',
        messageTemplate,
        notes,
        createdBy,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('followUps').insertOne(newFollowUp);

      return NextResponse.json({
        success: true,
        message: 'Follow-up created',
        data: { ...newFollowUp, _id: result.insertedId }
      });
    }

    // 일괄 등록 (여러 타입의 사후관리 한번에 등록)
    if (action === 'bulk-create') {
      const {
        patientId,
        patientName,
        phoneNumber,
        visitDate,
        treatmentType,
        followUpTypes, // ['day1', 'day3', 'week1'] 등
        createdBy
      } = body;

      if (!patientId || !followUpTypes || !Array.isArray(followUpTypes)) {
        return NextResponse.json(
          { success: false, error: 'Required fields missing' },
          { status: 400 }
        );
      }

      const visit = new Date(visitDate || now);
      const followUps: FollowUpRecord[] = [];

      // 타입별 발송 예정일 계산
      const typeToDate: Record<FollowUpType, number> = {
        'day1': 1,
        'day3': 3,
        'week1': 7,
        'week2': 14,
        'month1': 30,
        'month3': 90,
        'custom': 0
      };

      for (const type of followUpTypes as FollowUpType[]) {
        const daysToAdd = typeToDate[type] || 0;
        const scheduledDate = new Date(visit);
        scheduledDate.setDate(scheduledDate.getDate() + daysToAdd);

        followUps.push({
          patientId,
          patientName,
          phoneNumber,
          visitDate: visitDate || now,
          treatmentType,
          followUpType: type,
          scheduledDate: scheduledDate.toISOString(),
          status: 'pending',
          createdBy,
          createdAt: now,
          updatedAt: now
        });
      }

      if (followUps.length > 0) {
        await db.collection('followUps').insertMany(followUps);
      }

      return NextResponse.json({
        success: true,
        message: `${followUps.length} follow-ups created`,
        data: followUps
      });
    }

    // 발송 처리
    if (action === 'send') {
      const { followUpId, messageContent } = body;

      if (!followUpId) {
        return NextResponse.json(
          { success: false, error: 'followUpId required' },
          { status: 400 }
        );
      }

      const followUp = await db.collection('followUps').findOne({
        _id: new ObjectId(followUpId)
      });

      if (!followUp) {
        return NextResponse.json(
          { success: false, error: 'Follow-up not found' },
          { status: 404 }
        );
      }

      // TODO: 실제 문자 발송 로직 (알리고 API 등)
      // 여기서는 발송 성공으로 처리
      const sentAt = now;

      await db.collection('followUps').updateOne(
        { _id: new ObjectId(followUpId) },
        {
          $set: {
            status: 'sent',
            sentDate: sentAt,
            messageContent: messageContent || followUp.messageTemplate,
            updatedAt: now
          }
        }
      );

      // 발송 이력 저장
      const history: FollowUpHistory = {
        followUpId,
        patientId: followUp.patientId,
        patientName: followUp.patientName,
        phoneNumber: followUp.phoneNumber,
        followUpType: followUp.followUpType,
        messageContent: messageContent || followUp.messageTemplate || '',
        sentAt,
        status: 'success',
        createdAt: now
      };

      await db.collection('followUpHistory').insertOne(history);

      return NextResponse.json({
        success: true,
        message: 'Follow-up sent',
        data: { followUpId, sentAt }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[FollowUp API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - 사후관리 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const result = await db.collection('followUps').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updateData,
          updatedAt: now
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Follow-up not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Follow-up updated'
    });

  } catch (error) {
    console.error('[FollowUp API] PUT 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 사후관리 삭제/취소
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action'); // 'delete' | 'cancel'

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    if (action === 'cancel') {
      // 취소 처리 (상태만 변경)
      const result = await db.collection('followUps').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'cancelled',
            updatedAt: new Date().toISOString()
          }
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json(
          { success: false, error: 'Follow-up not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Follow-up cancelled'
      });
    }

    // 완전 삭제
    const result = await db.collection('followUps').deleteOne({
      _id: new ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Follow-up not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Follow-up deleted'
    });

  } catch (error) {
    console.error('[FollowUp API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
