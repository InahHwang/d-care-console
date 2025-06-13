// src/app/api/activity-logs/target/[targetId]/route.ts

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

// 특정 대상의 활동 로그 조회 (GET)
export async function GET(
  request: NextRequest,
  { params }: { params: { targetId: string } }
) {
  try {
    const currentUser = await verifyToken(request);
    
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target') || 'patient'; // 기본값: patient
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');

    const { db } = await connectToDatabase();
    const logsCollection = db.collection('activityLogs');

    // 🔥 필터 구성 - 더 포괄적으로 수정
    const filter: any = {
      targetId: params.targetId
      // target 조건 제거하여 모든 타겟 타입의 로그 포함
    };

    // 🔥 일반 사용자도 환자 관련 모든 로그 조회 가능하도록 수정
    // (마스터가 아닌 경우에도 환자 관련 로그는 모두 볼 수 있어야 함)
    
    console.log('🔍 활동 로그 조회 필터:', {
      targetId: params.targetId,
      filter,
      user: currentUser.name,
      userRole: currentUser.role
    });

    // 대상별 활동 로그 조회 (최신순, 제한된 개수)
    const logs = await logsCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    console.log('🔍 조회된 로그 수:', logs.length);
    console.log('🔍 조회된 로그 액션들:', logs.map((log: { action: any; target: any; timestamp: any; userName: any; }) => ({ 
      action: log.action, 
      target: log.target,
      timestamp: log.timestamp,
      userName: log.userName
    })));

    // 🔥 다음 페이지 여부 확인
    const hasNext = logs.length === limit;

    // id 필드 추가 및 source 필드 설정
    const formattedLogs = logs.map((log: any) => ({
      ...log,
      _id: log._id.toString(),
      source: log.source || 'backend_api' // 기본값 설정
    }));

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      targetId: params.targetId,
      target: target,
      total: logs.length,
      hasNext: hasNext,
      skip: skip,
      limit: limit
    });

  } catch (error) {
    console.error('대상별 활동 로그 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '대상별 활동 로그 조회에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}