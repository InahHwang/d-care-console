// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// 환경 변수 타입 단언으로 TypeScript 오류 해결
const JWT_SECRET = process.env.JWT_SECRET as string;

// 테스트용 임시 사용자 (실제 운영시에는 제거)
const TEST_USERS = [
  {
    _id: 'master_001',
    id: 'master_001',
    username: 'dsbrdental',
    email: 'dsbrdental@naver.com',
    password: 'ektksqkfms1!',
    name: '마스터관리자',
    role: 'master',
    isActive: true
  },
];

// 활동 로그 기록 함수
async function logActivity(userId: string, userName: string, userRole: string, ipAddress: string, userAgent: string) {
  try {
    const { db } = await connectToDatabase();
    const logsCollection = db.collection('activityLogs');
    
    await logsCollection.insertOne({
      userId,
      userName,
      userRole,
      action: 'login',
      target: 'system',
      targetId: 'system',
      targetName: '시스템 로그인',
      details: {
        loginMethod: 'password',
        timestamp: new Date().toISOString()
      },
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.warn('로그인 활동 로그 기록 실패:', error);
    // 로그 기록 실패는 로그인에 영향주지 않음
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json(); // email 필드명 유지 (실제로는 username으로 사용)
    
    // 입력 유효성 검사
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: '아이디와 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    let user = null;

    // 1. 먼저 테스트 사용자 확인 (개발/테스트용)
    const testUser = TEST_USERS.find(u => 
      (u.username === email || u.email === email) && u.password === password && u.isActive
    );
    
    if (testUser) {
      user = testUser;
    } else {
      // 2. 실제 데이터베이스에서 사용자 찾기
      try {
        const { db } = await connectToDatabase();
        const dbUser = await db.collection('users').findOne({ 
          $or: [
            { username: email },
            { email: email }
          ],
          isActive: true // 활성 사용자만
        });
        
        if (dbUser && bcrypt.compareSync(password, dbUser.password)) {
          user = {
            ...dbUser,
            id: dbUser._id.toString()
          };
        }
      } catch (dbError) {
        console.log('Database connection failed, using test users only');
      }
    }
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }
    
    // JWT_SECRET이 없는 경우 오류 처리
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
    }
    
    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        id: user.id || user._id, 
        username: user.username,
        email: user.email,
        name: user.name || user.username,
        role: user.role || 'staff'
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // 사용자 정보 (비밀번호 제외)
    const userResponse = {
      id: user.id || user._id,
      username: user.username,
      email: user.email,
      name: user.name || user.username,
      role: user.role || 'staff',
      isActive: user.isActive
    };

    // 클라이언트 정보 추출 (활동 로그용)
    const userAgent = request.headers.get('user-agent') || '';
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = xForwardedFor 
      ? xForwardedFor.split(',')[0].trim() 
      : request.headers.get('x-real-ip') || 'unknown';

    // 로그인 활동 로그 기록
    await logActivity(
      userResponse.id, 
      userResponse.name, 
      userResponse.role,
      ipAddress,
      userAgent
    );

    // 마지막 로그인 시간 업데이트 (데이터베이스 사용자인 경우)
    if (!testUser) {
      try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { lastLogin: new Date().toISOString() } }
        );
      } catch (error) {
        console.warn('마지막 로그인 시간 업데이트 실패:', error);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      token,
      user: userResponse,
      message: '로그인 성공'
    });
    
  } catch (error: unknown) {
    // 오류 타입 처리 개선
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

// 로그아웃 처리 (토큰 무효화)
export async function DELETE(request: NextRequest) {
  try {
    // 로그아웃 활동 로그 기록
    try {
      const authorization = request.headers.get('authorization');
      if (authorization && authorization.startsWith('Bearer ')) {
        const token = authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        const userAgent = request.headers.get('user-agent') || '';
        const xForwardedFor = request.headers.get('x-forwarded-for');
        const ipAddress = xForwardedFor 
          ? xForwardedFor.split(',')[0].trim() 
          : request.headers.get('x-real-ip') || 'unknown';

        const { db } = await connectToDatabase();
        const logsCollection = db.collection('activityLogs');
        
        await logsCollection.insertOne({
          userId: decoded.id,
          userName: decoded.name,
          userRole: decoded.role,
          action: 'logout',
          target: 'system',
          targetId: 'system',
          targetName: '시스템 로그아웃',
          details: {
            logoutMethod: 'manual',
            timestamp: new Date().toISOString()
          },
          ipAddress,
          userAgent,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.warn('로그아웃 활동 로그 기록 실패:', error);
    }

    return NextResponse.json({
      success: true,
      message: '로그아웃 성공'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}