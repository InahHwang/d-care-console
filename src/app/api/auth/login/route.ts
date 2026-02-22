// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { validateBody } from '@/lib/validations/validate';
import { loginSchema } from '@/lib/validations/schemas';
import { generateAccessToken, generateRefreshToken, revokeRefreshToken, TokenPayload } from '@/lib/auth/tokens';
import { createRouteLogger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';
import { checkLoginAllowed, recordLoginAttempt } from '@/lib/loginProtection';

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
    const log = createRouteLogger('/api/auth/login', 'POST');
    log.warn('로그인 활동 로그 기록 실패', { error: String(error) });
    // 로그 기록 실패는 로그인에 영향주지 않음
  }
}

export async function POST(request: NextRequest) {
  const log = createRouteLogger('/api/auth/login', 'POST');
  try {
    // --- Rate Limiting ---
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = xForwardedFor
      ? xForwardedFor.split(',')[0].trim()
      : request.headers.get('x-real-ip') || 'unknown';

    // 1) IP 기반 in-memory rate limit
    const rateResult = checkRateLimit(`login:${clientIp}`, RATE_LIMIT_PRESETS.login);
    if (!rateResult.allowed) {
      log.warn('Rate limit 초과', { ip: clientIp, retryAfterMs: rateResult.retryAfterMs });
      return NextResponse.json(
        { success: false, message: '너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rateResult.retryAfterMs / 1000)) },
        },
      );
    }

    const body = await request.json();
    const validation = validateBody(loginSchema, body);
    if (!validation.success) return validation.response;
    const { email, password } = validation.data; // email 필드명 유지 (실제로는 username으로 사용)

    // 2) DB 기반 로그인 잠금 확인
    const lockCheck = await checkLoginAllowed(email);
    if (!lockCheck.allowed) {
      log.warn('계정 잠금 상태', { identifier: email, failureCount: lockCheck.failureCount });
      return NextResponse.json(
        { success: false, message: '로그인 시도가 너무 많습니다. 30분 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(lockCheck.retryAfterMs / 1000)) },
        },
      );
    }

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
      // 실패 기록
      await recordLoginAttempt(email, false, clientIp);
      return NextResponse.json(
        { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 로그인 성공 → 실패 기록 초기화
    await recordLoginAttempt(email, true, clientIp);
    
    // JWT_SECRET이 없는 경우 오류 처리
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
    }
    
    // JWT Access Token 생성 (15분 만료)
    const tokenPayload: TokenPayload = {
      id: (user.id || user._id).toString(),
      username: (user as any).username,
      email: (user as any).email,
      name: (user as any).name || (user as any).username,
      role: (user as any).role || 'staff',
      clinicId: (user as any).clinicId || 'default',
    };
    const token = generateAccessToken(tokenPayload);

    // Refresh Token 생성 (7일 만료, DB 저장)
    const refreshToken = await generateRefreshToken(
      tokenPayload.id,
      tokenPayload.clinicId
    );
    
    // 사용자 정보 (비밀번호 제외)
    const userResponse = {
      id: (user as any).id || (user as any)._id,
      username: (user as any).username,
      email: (user as any).email,
      name: (user as any).name || (user as any).username,
      role: (user as any).role || 'staff',
      isActive: (user as any).isActive,
      clinicId: (user as any).clinicId || 'default',
    };

    // 클라이언트 정보 추출 (활동 로그용)
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = clientIp;

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
      log.warn('마지막 로그인 시간 업데이트 실패', { error: String(error) });
    }
    
    return NextResponse.json({
      success: true,
      token,
      refreshToken,
      user: userResponse,
      message: '로그인 성공'
    });
    
  } catch (error: unknown) {
    log.error('로그인 처리 중 오류 발생', error);
    return NextResponse.json(
      { success: false, message: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 로그아웃 처리 (토큰 무효화)
export async function DELETE(request: NextRequest) {
  const log = createRouteLogger('/api/auth/login', 'DELETE');
  try {
    // Refresh Token 폐기
    try {
      const body = await request.json().catch(() => ({}));
      if (body.refreshToken) {
        await revokeRefreshToken(body.refreshToken);
      }
    } catch {
      // refreshToken 폐기 실패해도 로그아웃 진행
    }

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
      log.warn('로그아웃 활동 로그 기록 실패', { error: String(error) });
    }

    return NextResponse.json({
      success: true,
      message: '로그아웃 성공'
    });
  } catch (error) {
    log.error('로그아웃 처리 중 오류 발생', error);
    return NextResponse.json(
      { message: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}