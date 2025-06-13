// src/app/api/admin/stats/route.ts (개선된 버전)

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

export async function GET(request: NextRequest) {
  try {
    const currentUser = await verifyToken(request);
    requireMasterRole(currentUser);

    const { db } = await connectToDatabase();
    
    // 현재 날짜 정보
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // 🔍 1. 사용자 통계 (사용자 관리와 동일한 로직 적용)
    // 사용자 관리에서와 동일하게 isActive가 false가 아닌 사용자만 카운트
    const totalUsers = await db.collection('users').countDocuments({
      isActive: { $ne: false } // 사용자 관리 API와 동일한 필터
    });
    
    // 🔍 2. 오늘 로그인한 사용자 수 (실제 의미 있는 통계)
    const todayLoginUsers = await db.collection('activityLogs').distinct('userId', {
      action: 'login',
      timestamp: {
        $gte: todayStart.toISOString(),
        $lt: todayEnd.toISOString()
      }
    });

    // 🔍 3. 전체 환자 수
    const totalPatients = await db.collection('patients').countDocuments();

    // 🔍 4. 오늘 활동 수 (로그인/로그아웃 제외한 실제 업무 활동)
    const todayActions = await db.collection('activityLogs').countDocuments({
      timestamp: {
        $gte: todayStart.toISOString(),
        $lt: todayEnd.toISOString()
      },
      action: { 
        $nin: ['login', 'logout'] // 로그인/로그아웃 제외
      }
    });

    // 🔍 5. 전체 활동 수
    const totalActions = await db.collection('activityLogs').countDocuments();

    // 🔍 6. 실제 서버 가동시간 (Node.js process.uptime() 사용)
    const uptimeSeconds = process.uptime();
    const uptimeDays = Math.floor(uptimeSeconds / (24 * 60 * 60));
    const uptimeHours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
    const systemUptime = uptimeDays > 0 
      ? `${uptimeDays}일 ${uptimeHours}시간`
      : `${uptimeHours}시간`;

    // 🔍 7. 최근 7일간 활동 통계
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentActivities = await db.collection('activityLogs').countDocuments({
      timestamp: { $gte: weekAgo.toISOString() }
    });

    // 🔍 8. 오늘 새로 등록된 환자 수
    const todayNewPatients = await db.collection('patients').countDocuments({
      createdAt: {
        $gte: todayStart.toISOString(),
        $lt: todayEnd.toISOString()
      }
    });

    // 🔍 9. 사용자별 오늘 활동 요약 (마스터용 모니터링)
    const userActivityToday = await db.collection('activityLogs').aggregate([
      {
        $match: {
          timestamp: {
            $gte: todayStart.toISOString(),
            $lt: todayEnd.toISOString()
          },
          action: { $nin: ['login', 'logout'] }
        }
      },
      {
        $group: {
          _id: '$userId',
          userName: { $first: '$userName' },
          actionCount: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { actionCount: -1 } },
      { $limit: 10 }
    ]).toArray();

    // 🔍 10. 데이터베이스 크기 정보 (선택적)
    const dbStats = await db.stats();
    const dbSizeMB = Math.round(dbStats.dataSize / (1024 * 1024));

    const stats = {
      // 기본 통계
      totalUsers,                           // 전체 등록된 사용자 수
      todayLoginUsers: todayLoginUsers.length, // 오늘 로그인한 사용자 수
      totalPatients,                        // 전체 환자 수
      todayNewPatients,                     // 오늘 새로 등록된 환자 수
      
      // 활동 통계  
      todayActions,                         // 오늘의 업무 활동 수 (로그인/로그아웃 제외)
      totalActions,                         // 전체 활동 로그 수
      recentActivities,                     // 최근 7일간 활동 수
      
      // 시스템 정보
      systemUptime,                         // 실제 서버 가동시간
      dbSizeMB,                            // 데이터베이스 크기 (MB)
      
      // 상세 정보 (관리자용)
      userActivityToday,                    // 오늘 사용자별 활동 요약
      
      // 메타 정보
      lastUpdated: now.toISOString()
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('관리자 통계 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '통계 조회에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}