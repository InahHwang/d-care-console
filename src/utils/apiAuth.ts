// src/utils/apiAuth.ts
// V2 API 공통 인증 유틸리티
// 모든 인증 필요 API route에서 import하여 사용

import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAccessTokenFromCookies } from '@/lib/auth/cookies';

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'staff' | 'master';
  clinicId: string;
}

/**
 * JWT 토큰 검증 → 성공 시 사용자 정보 반환, 실패 시 null
 *
 * 인증 순서:
 * 1. Authorization: Bearer 헤더 (CTIBridge C# 앱 호환)
 * 2. access_token httpOnly 쿠키 (브라우저)
 */
export function verifyApiToken(request: NextRequest): AuthUser | null {
  // 1) Authorization 헤더 우선
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    try {
      const token = authorization.split(' ')[1];
      return jwt.verify(token, JWT_SECRET) as AuthUser;
    } catch {
      // 헤더 토큰 실패 → 쿠키로 폴백
    }
  }

  // 2) httpOnly 쿠키 폴백
  const cookieToken = getAccessTokenFromCookies(request);
  if (cookieToken) {
    try {
      return jwt.verify(cookieToken, JWT_SECRET) as AuthUser;
    } catch {
      return null;
    }
  }

  return null;
}

/** 인증 실패 시 401 응답 */
export function unauthorizedResponse(message = '인증이 필요합니다.') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

/** 권한 부족 시 403 응답 */
export function forbiddenResponse(message = '권한이 부족합니다.') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

/** 관리자(admin/master) 권한 확인 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin' || user.role === 'master';
}
