// src/app/api/v2/auth/refresh/route.ts
// 토큰 갱신 API — Phase A (상용화 Step 5)
// 만료 전 토큰을 새 토큰으로 교체. 기존 payload 유지 + 만료시간 갱신.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authorization.split(' ')[1];

    // 만료된 토큰도 디코딩 가능하게 (ignoreExpiration)
    // 단, 만료 후 7일 이상 지난 토큰은 거부
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        // 만료된 토큰 디코딩 시도
        decoded = jwt.decode(token) as any;
        if (!decoded) {
          return NextResponse.json(
            { success: false, message: '유효하지 않은 토큰입니다.' },
            { status: 401 }
          );
        }

        // 만료 후 7일 이상 지났으면 재로그인 필요
        const expiredAt = (decoded.exp || 0) * 1000;
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - expiredAt > sevenDaysMs) {
          return NextResponse.json(
            { success: false, message: '토큰이 너무 오래 전에 만료되었습니다. 다시 로그인해주세요.' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, message: '유효하지 않은 토큰입니다.' },
          { status: 401 }
        );
      }
    }

    // 새 토큰 발급 (기존 payload 유지, 만료시간만 갱신)
    const newToken = jwt.sign(
      {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        clinicId: decoded.clinicId || 'default',
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return NextResponse.json({
      success: true,
      token: newToken,
      message: '토큰이 갱신되었습니다.',
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, message: '토큰 갱신 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
