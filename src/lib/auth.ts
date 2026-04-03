// src/lib/auth.ts
// JWT 인증 공통 헬퍼 — Phase A (상용화 Step 5)

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

// JWT payload 타입
export interface JwtPayload {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  clinicId: string;
  iat?: number;
  exp?: number;
}

// verifyToken 결과 타입
export interface AuthResult {
  success: true;
  user: JwtPayload;
}

export interface AuthError {
  success: false;
  error: string;
  status: 401 | 403;
}

/**
 * JWT 토큰 검증 + 사용자 정보 추출
 *
 * @param request - NextRequest 객체
 * @returns AuthResult (성공) 또는 AuthError (실패)
 *
 * 사용 예시:
 * ```ts
 * const auth = verifyToken(request);
 * if (!auth.success) {
 *   return NextResponse.json({ message: auth.error }, { status: auth.status });
 * }
 * const { user } = auth; // user.id, user.clinicId, user.role 등
 * ```
 */
export function verifyToken(request: NextRequest): AuthResult | AuthError {
  const authorization = request.headers.get('authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { success: false, error: '인증 토큰이 필요합니다.', status: 401 };
  }

  const token = authorization.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // clinicId가 없는 기존 토큰 호환 (fallback: 'default')
    if (!decoded.clinicId) {
      decoded.clinicId = 'default';
    }

    return { success: true, user: decoded };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { success: false, error: '토큰이 만료되었습니다.', status: 401 };
    }
    return { success: false, error: '유효하지 않은 토큰입니다.', status: 401 };
  }
}

/**
 * 역할 권한 확인
 *
 * @param user - JWT payload
 * @param allowedRoles - 허용할 역할 배열
 * @returns AuthError | null (null이면 통과)
 */
export function requireRole(user: JwtPayload, ...allowedRoles: string[]): AuthError | null {
  // master는 항상 허용
  if (user.role === 'master') return null;
  // admin은 master와 동등
  if (user.role === 'admin' && allowedRoles.includes('master')) return null;

  if (!allowedRoles.includes(user.role)) {
    return { success: false, error: '권한이 부족합니다.', status: 403 };
  }
  return null;
}

/**
 * Request에서 clinicId 추출 (JWT 기반, fallback 'default')
 *
 * API 라우트에서 clinicId가 필요할 때 사용.
 * JWT 검증이 선행되어야 하지만, 토큰이 없어도 'default' 반환 (호환성).
 */
export function getClinicIdFromRequest(request: NextRequest): string {
  const authorization = request.headers.get('authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return 'default';
  }

  try {
    const token = authorization.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded.clinicId || 'default';
  } catch {
    return 'default';
  }
}
