// src/lib/auth/cookies.ts
// httpOnly 쿠키 기반 토큰 관리 유틸리티

import { NextRequest, NextResponse } from 'next/server';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const ACCESS_TOKEN_MAX_AGE = 900; // 15분
const REFRESH_TOKEN_MAX_AGE = 604800; // 7일

/**
 * 응답에 access_token + refresh_token httpOnly 쿠키 설정
 */
export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): NextResponse {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  return response;
}

/**
 * 응답에서 인증 쿠키 삭제 (로그아웃)
 */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 0,
  });

  return response;
}

/**
 * 요청에서 access_token 쿠키 읽기
 */
export function getAccessTokenFromCookies(request: NextRequest): string | null {
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value || null;
}

/**
 * 요청에서 refresh_token 쿠키 읽기
 */
export function getRefreshTokenFromCookies(request: NextRequest): string | null {
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value || null;
}
