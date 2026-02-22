// src/app/api/auth/me/route.ts
// 현재 사용자 조회 + 쿠키 기반 자동 토큰 갱신

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import {
  validateRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  revokeRefreshToken,
  TokenPayload,
} from '@/lib/auth/tokens';
import {
  getAccessTokenFromCookies,
  getRefreshTokenFromCookies,
  setAuthCookies,
  clearAuthCookies,
} from '@/lib/auth/cookies';
import { createRouteLogger } from '@/lib/logger';

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function GET(request: NextRequest) {
  const log = createRouteLogger('/api/auth/me', 'GET');

  try {
    // 1) access_token 쿠키 확인
    const accessToken = getAccessTokenFromCookies(request);
    if (accessToken) {
      try {
        const user = jwt.verify(accessToken, JWT_SECRET) as TokenPayload;
        return NextResponse.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            role: user.role,
            clinicId: user.clinicId,
          },
        });
      } catch {
        // access_token 만료 → refresh 시도
      }
    }

    // 2) refresh_token 쿠키로 자동 갱신
    const refreshToken = getRefreshTokenFromCookies(request);
    if (!refreshToken) {
      const res = NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 },
      );
      return clearAuthCookies(res);
    }

    const tokenData = await validateRefreshToken(refreshToken);
    if (!tokenData) {
      const res = NextResponse.json(
        { success: false, error: '세션이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 },
      );
      return clearAuthCookies(res);
    }

    // 사용자 DB 확인
    const { db } = await connectToDatabase();
    const dbUser = await db.collection('users').findOne({
      _id: new ObjectId(tokenData.userId),
      isActive: true,
    });

    if (!dbUser) {
      await revokeRefreshToken(refreshToken);
      const res = NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 401 },
      );
      return clearAuthCookies(res);
    }

    // 토큰 로테이션
    await revokeRefreshToken(refreshToken);

    const payload: TokenPayload = {
      id: dbUser._id.toString(),
      username: dbUser.username,
      email: dbUser.email,
      name: dbUser.name || dbUser.username,
      role: dbUser.role || 'staff',
      clinicId: dbUser.clinicId || 'default',
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = await generateRefreshToken(
      dbUser._id.toString(),
      dbUser.clinicId || 'default',
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: payload.id,
        username: payload.username,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        clinicId: payload.clinicId,
      },
    });

    return setAuthCookies(response, newAccessToken, newRefreshToken);
  } catch (error) {
    log.error('/api/auth/me 처리 중 오류', error);
    const res = NextResponse.json(
      { success: false, error: '인증 확인 중 오류가 발생했습니다.' },
      { status: 500 },
    );
    return clearAuthCookies(res);
  }
}
