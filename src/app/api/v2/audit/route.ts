// src/app/api/v2/audit/route.ts
// 감사 로그 조회 API — 관리자 전용

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { extractUserFromRequest } from '@/utils/auditLog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 권한 확인 (master만 접근 가능)
    const user = extractUserFromRequest(request);
    if (!user || user.userRole !== 'master') {
      return NextResponse.json(
        { success: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    const action = searchParams.get('action');
    const collection = searchParams.get('collection');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const { db } = await connectToDatabase();

    // 필터 구성
    const filter: Record<string, unknown> = {};

    if (userId) filter.userId = userId;
    if (userName) filter.userName = userName;
    if (action) filter.action = { $regex: action };
    if (collection) filter.collection = collection;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) (filter.timestamp as Record<string, unknown>).$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (filter.timestamp as Record<string, unknown>).$lte = end;
      }
    }

    // 병렬 쿼리: 로그 + 카운트 + 사용자별 요약
    const [logs, totalCount, userSummary] = await Promise.all([
      db.collection('auditLogs_v2')
        .find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),

      db.collection('auditLogs_v2').countDocuments(filter),

      // 사용자별 활동 요약 (최근 7일)
      db.collection('auditLogs_v2').aggregate([
        {
          $match: {
            timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { userId: '$userId', userName: '$userName' },
            totalActions: { $sum: 1 },
            deletes: {
              $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /\.delete$/ } }, 1, 0] },
            },
            statusChanges: {
              $sum: { $cond: [{ $eq: ['$action', 'patient.status_change'] }, 1, 0] },
            },
            lastActivity: { $max: '$timestamp' },
          },
        },
        { $sort: { totalActions: -1 } },
      ]).toArray(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log._id.toString(),
          userId: log.userId,
          userName: log.userName,
          userRole: log.userRole,
          action: log.action,
          collection: log.collection,
          documentId: log.documentId,
          documentName: log.documentName,
          changes: log.changes,
          reason: log.reason,
          ipAddress: log.ipAddress,
          timestamp: log.timestamp,
        })),
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        userSummary: userSummary.map((s) => ({
          userId: s._id.userId,
          userName: s._id.userName,
          totalActions: s.totalActions,
          deletes: s.deletes,
          statusChanges: s.statusChanges,
          lastActivity: s.lastActivity,
        })),
      },
    });
  } catch (error) {
    console.error('[Audit API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
