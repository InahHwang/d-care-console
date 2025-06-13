// src/app/api/activity-logs/route.ts

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

// 활동 로그 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await verifyToken(request);
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const target = searchParams.get('target');
    const targetId = searchParams.get('targetId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const searchTerm = searchParams.get('searchTerm');

    const { db } = await connectToDatabase();
    const logsCollection = db.collection('activityLogs');

    // 필터 구성
    const filter: any = {};

    // 일반 사용자는 본인의 로그만 조회 가능
    if (currentUser.role !== 'master') {
      filter.userId = currentUser.id;
    } else if (userId) {
      filter.userId = userId;
    }

    if (action) filter.action = action;
    if (target) filter.target = target;
    if (targetId) filter.targetId = targetId;

    // 날짜 범위 필터
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate).toISOString();
      if (endDate) filter.timestamp.$lte = new Date(endDate).toISOString();
    }

    // 검색어 필터
    if (searchTerm) {
      filter.$or = [
        { userName: { $regex: searchTerm, $options: 'i' } },
        { action: { $regex: searchTerm, $options: 'i' } },
        { target: { $regex: searchTerm, $options: 'i' } },
        { 'details.patientName': { $regex: searchTerm, $options: 'i' } },
        { 'details.notes': { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // 총 로그 수 조회
    const total = await logsCollection.countDocuments(filter);

    // 페이지네이션을 적용한 로그 목록 조회
    const logs = await logsCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // id 필드 추가
    const formattedLogs = logs.map((log: { _id: { toString: () => any; }; }) => ({
      ...log,
      _id: log._id.toString()
    }));

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      total,
      page,
      limit,
      hasNext: page * limit < total,
      hasPrevious: page > 1
    });

  } catch (error) {
    console.error('활동 로그 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '활동 로그 조회에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}

// 활동 로그 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await verifyToken(request);
    
    const { action, target, targetId, targetName, details } = await request.json();

    // 입력 유효성 검사
    if (!action || !target || !targetId) {
      return NextResponse.json(
        { success: false, message: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const logsCollection = db.collection('activityLogs');

    // 클라이언트 정보 추출
    const userAgent = request.headers.get('user-agent') || '';
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = xForwardedFor 
      ? xForwardedFor.split(',')[0].trim() 
      : request.headers.get('x-real-ip') || 'unknown';

    // 새 활동 로그 생성
    const newLog = {
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      target,
      targetId,
      targetName: targetName || '',
      details: details || {},
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString()
    };

    const result = await logsCollection.insertOne(newLog);

    const logResponse = {
      _id: result.insertedId.toString(),
      ...newLog
    };

    return NextResponse.json({
      success: true,
      message: '활동 로그가 기록되었습니다.',
      log: logResponse
    });

  } catch (error) {
    console.error('활동 로그 생성 오류:', error);
    
    // 로그 생성 실패는 조용히 처리 (다른 기능에 영향 없도록)
    return NextResponse.json(
      { success: false, message: '활동 로그 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}