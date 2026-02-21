// src/app/api/auth/refresh/route.ts
// Refresh Token으로 새 Access Token + Refresh Token 발급 (토큰 로테이션)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import {
  validateRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  revokeRefreshToken,
  TokenPayload,
} from '@/lib/auth/tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    // Refresh Token 검증
    const tokenData = await validateRefreshToken(refreshToken);
    if (!tokenData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    // 사용자 DB 확인 (활성 상태인지)
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(tokenData.userId),
      isActive: true,
    });

    if (!user) {
      await revokeRefreshToken(refreshToken);
      return NextResponse.json(
        { success: false, error: 'User not found or deactivated' },
        { status: 401 }
      );
    }

    // 토큰 로테이션: 기존 refresh token 폐기 → 새 토큰 쌍 발급
    await revokeRefreshToken(refreshToken);

    const payload: TokenPayload = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      name: user.name || user.username,
      role: user.role || 'staff',
      clinicId: user.clinicId || 'default',
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = await generateRefreshToken(
      user._id.toString(),
      user.clinicId || 'default'
    );

    return NextResponse.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name || user.username,
        role: user.role || 'staff',
        clinicId: user.clinicId || 'default',
      },
    });
  } catch (error) {
    console.error('[Auth Refresh] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}
