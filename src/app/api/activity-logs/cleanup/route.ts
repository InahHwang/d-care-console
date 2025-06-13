// src/app/api/activity-logs/cleanup/route.ts (수정된 버전)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

// JWT 토큰 검증 및 사용자 정보 추출
async function verifyToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new Error('인증 토큰이 필요합니다.');
  }

  const token = authorization.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    throw new Error('유효하지 않은 토큰입니다.');
  }
}

// 마스터 권한 확인
function requireMasterRole(user: any) {
  if (user.role !== 'master') {
    throw new Error('마스터 관리자 권한이 필요합니다.');
  }
}

// 활동 로그 일괄 정리 (DELETE) - 🔥 로깅 제외 버전
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await verifyToken(request);
    requireMasterRole(currentUser);

    const { searchParams } = new URL(request.url);
    const cleanupType = searchParams.get('type'); // 'older-than' | 'by-user' | 'by-action' | 'all'
    const days = parseInt(searchParams.get('days') || '30');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const actions = searchParams.get('actions'); // 콤마로 구분된 액션들

    const { db } = await connectToDatabase();
    const activityLogsCollection = db.collection('activityLogs');

    let deleteFilter: any = {};
    let deletedCount = 0;
    let description = '';

    switch (cleanupType) {
      case 'older-than':
        // N일 이전 로그 삭제
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        deleteFilter = { timestamp: { $lt: cutoffDate.toISOString() } };
        
        // 특정 액션 타입만 삭제하는 경우
        if (actions) {
          const actionList = actions.split(',').map(a => a.trim());
          deleteFilter.action = { $in: actionList };
          description = `${days}일 이전의 ${actionList.join(', ')} 로그`;
        } else {
          description = `${days}일 이전의 모든 로그`;
        }
        break;

      case 'by-user':
        // 특정 사용자의 로그 삭제
        if (!userId) {
          return NextResponse.json(
            { success: false, message: '사용자 ID가 필요합니다.' },
            { status: 400 }
          );
        }
        deleteFilter = { userId };
        description = `사용자 ${userId}의 모든 로그`;
        break;

      case 'by-action':
        // 특정 액션 타입 로그 삭제
        if (!action && !actions) {
          return NextResponse.json(
            { success: false, message: '액션 타입이 필요합니다.' },
            { status: 400 }
          );
        }
        
        if (actions) {
          const actionList = actions.split(',').map(a => a.trim());
          deleteFilter = { action: { $in: actionList } };
          description = `${actionList.join(', ')} 액션의 모든 로그`;
        } else {
          deleteFilter = { action };
          description = `${action} 액션의 모든 로그`;
        }
        break;

      case 'all':
        // 모든 로그 삭제 (매우 주의!)
        deleteFilter = {};
        description = '모든 활동 로그';
        break;

      default:
        return NextResponse.json(
          { success: false, message: '유효하지 않은 정리 타입입니다.' },
          { status: 400 }
        );
    }

    // 삭제할 로그 수 미리 확인
    const countToDelete = await activityLogsCollection.countDocuments(deleteFilter);
    
    if (countToDelete === 0) {
      return NextResponse.json({
        success: true,
        message: '삭제할 로그가 없습니다.',
        deletedCount: 0,
        remainingCount: await activityLogsCollection.countDocuments() // 🔥 전체 개수 반환
      });
    }

    // 안전장치: 전체 로그를 삭제하려는 경우 추가 확인
    if (cleanupType === 'all' || countToDelete > 10000) {
      const confirmParam = searchParams.get('confirm');
      if (confirmParam !== 'true') {
        return NextResponse.json({
          success: false,
          message: `${countToDelete}개의 로그가 삭제됩니다. 정말 진행하려면 confirm=true 파라미터를 추가하세요.`,
          countToDelete
        }, { status: 400 });
      }
    }

    // 🔥 삭제 실행 (정리 작업 자체는 로깅하지 않음)
    const result = await activityLogsCollection.deleteMany(deleteFilter);
    deletedCount = result.deletedCount;

    // 🔥 실제 남은 로그 개수 계산
    const remainingCount = await activityLogsCollection.countDocuments();

    return NextResponse.json({
      success: true,
      message: `${deletedCount}개의 활동 로그가 삭제되었습니다.`,
      deletedCount,
      remainingCount, // 🔥 실시간 동기화를 위한 남은 개수
      description
    });

  } catch (error) {
    console.error('활동 로그 정리 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '활동 로그 정리에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}

// 정리 가능한 로그 통계 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await verifyToken(request);
    requireMasterRole(currentUser);

    const { db } = await connectToDatabase();
    const activityLogsCollection = db.collection('activityLogs');

    // 전체 로그 수
    const totalLogs = await activityLogsCollection.countDocuments();

    // 날짜별 통계
    const now = new Date();
    const dates = [7, 30, 60, 90, 180, 365];
    const dateStats: Record<string, number> = {};

    for (const days of dates) {
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const count = await activityLogsCollection.countDocuments({
        timestamp: { $lt: cutoffDate.toISOString() }
      });
      dateStats[`${days}days`] = count;
    }

    // 액션별 통계 (상위 10개)
    const actionStats = await activityLogsCollection.aggregate([
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    // 사용자별 통계 (상위 10개)
    const userStats = await activityLogsCollection.aggregate([
      {
        $group: {
          _id: '$userId',
          userName: { $first: '$userName' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    return NextResponse.json({
      success: true,
      stats: {
        totalLogs,
        dateStats,
        actionStats,
        userStats
      }
    });

  } catch (error) {
    console.error('활동 로그 통계 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '통계 조회에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}