// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { validateBody } from '@/lib/validations/validate';
import { loginSchema } from '@/lib/validations/schemas';

// 환경 변수 타입 단언으로 TypeScript 오류 해결
const JWT_SECRET = process.env.JWT_SECRET as string;

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
    const body = await request.json();
    const validation = validateBody(loginSchema, body);
    if (!validation.success) return validation.response;
    const { email, password } = validation.data; // email 필드명 유지 (실제로는 username으로 사용)

    let user = null;

    // 데이터베이스에서 사용자 찾기
    const { db } = await connectToDatabase();
    const dbUser = await db.collection('users').findOne({
      $or: [
        { username: email },
        { email: email }
      ],
      isActive: true
    });

    if (dbUser && bcrypt.compareSync(password, dbUser.password)) {
      user = {
        ...dbUser,
        id: dbUser._id.toString()
      };
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
        username: (user as any).username,
        email: (user as any).email,
        name: (user as any).name || (user as any).username,
        role: (user as any).role || 'staff'
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // 사용자 정보 (비밀번호 제외)
    const userResponse = {
      id: (user as any).id || (user as any)._id,
      username: (user as any).username,
      email: (user as any).email,
      name: (user as any).name || (user as any).username,
      role: (user as any).role || 'staff',
      isActive: (user as any).isActive
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

    // 마지막 로그인 시간 업데이트
    try {
      const updateId = user._id instanceof ObjectId ? user._id : new ObjectId(user._id);
      await db.collection('users').updateOne(
        { _id: updateId },
        { $set: { lastLogin: new Date().toISOString() } }
      );
    } catch (error) {
      console.warn('마지막 로그인 시간 업데이트 실패:', error);
    }
    
    return NextResponse.json({ 
      success: true, 
      token,
      user: userResponse,
      message: '로그인 성공'
    });
    
  } catch (error: unknown) {
    // 오류 타입 처리 개선
    console.error('[Auth Login] Error:', error);
    return NextResponse.json(
      { success: false, message: '로그인 처리 중 오류가 발생했습니다.' },
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