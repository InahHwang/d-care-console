// src/app/api/v2/activity-logs/route.ts
// 활동 로그 조회/생성 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { extractUserFromRequest } from '@/utils/auditLog';

export const dynamic = 'force-dynamic';

const COLLECTION = 'activityLogs_v2';

// GET: 활동 로그 조회 (필터/페이지네이션)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const target = searchParams.get('target');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const searchTerm = searchParams.get('searchTerm');

    const { db } = await connectToDatabase();

    // 필터 구성
    const filter: Record<string, unknown> = {};

    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    if (target) filter.target = target;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) (filter.timestamp as Record<string, unknown>).$gte = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (filter.timestamp as Record<string, unknown>).$lte = end.toISOString();
      }
    }

    if (searchTerm) {
      filter.$or = [
        { userName: { $regex: searchTerm, $options: 'i' } },
        { targetName: { $regex: searchTerm, $options: 'i' } },
        { 'details.notes': { $regex: searchTerm, $options: 'i' } },
        { 'details.patientName': { $regex: searchTerm, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      db.collection(COLLECTION)
        .find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTION).countDocuments(filter),
    ]);

    return NextResponse.json({
      logs: logs.map(log => ({
        _id: log._id.toString(),
        userId: log.userId,
        userName: log.userName,
        userRole: log.userRole,
        action: log.action,
        target: log.target,
        targetId: log.targetId,
        targetName: log.targetName,
        details: log.details || {},
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        timestamp: log.timestamp,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('[ActivityLogs] GET 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 활동 로그 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, target, targetId, targetName, details } = body;

    if (!action || !target || !targetId) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // JWT에서 사용자 정보 추출
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();

    const logEntry = {
      userId: user.userId,
      userName: user.userName,
      userRole: user.userRole,
      action,
      target,
      targetId,
      targetName: targetName || '',
      details: details || {},
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || '',
      timestamp: new Date().toISOString(),
    };

    const result = await db.collection(COLLECTION).insertOne(logEntry);

    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...logEntry,
    }, { status: 201 });
  } catch (error) {
    console.error('[ActivityLogs] POST 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
