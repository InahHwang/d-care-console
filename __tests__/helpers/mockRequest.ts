// __tests__/helpers/mockRequest.ts
// NextRequest mock + 테스트용 JWT 생성 유틸

import jwt from 'jsonwebtoken';
import type { AuthUser } from '@/utils/apiAuth';

const TEST_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-unit-tests';

// 기본 테스트 사용자
export const DEFAULT_TEST_USER: AuthUser = {
  id: 'user-001',
  username: 'testuser',
  email: 'test@clinic.com',
  name: '테스트 직원',
  role: 'staff',
  clinicId: 'clinic-001',
};

export const ADMIN_TEST_USER: AuthUser = {
  id: 'admin-001',
  username: 'admin',
  email: 'admin@clinic.com',
  name: '관리자',
  role: 'admin',
  clinicId: 'clinic-001',
};

/**
 * 테스트용 JWT access token 생성.
 */
export function createAuthToken(user: Partial<AuthUser> = {}): string {
  const payload = { ...DEFAULT_TEST_USER, ...user };
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

/**
 * NextRequest를 흉내내는 mock 객체 생성.
 */
export function createMockNextRequest(
  method: string,
  url: string,
  opts: {
    body?: any;
    auth?: boolean | Partial<AuthUser>; // true = DEFAULT_TEST_USER
    searchParams?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
) {
  const urlObj = new URL(url, 'http://localhost:3000');

  if (opts.searchParams) {
    Object.entries(opts.searchParams).forEach(([k, v]) =>
      urlObj.searchParams.set(k, v),
    );
  }

  const headersMap = new Map<string, string>();
  headersMap.set('content-type', 'application/json');

  // 인증 헤더
  if (opts.auth) {
    const user = opts.auth === true ? {} : opts.auth;
    const token = createAuthToken(user);
    headersMap.set('authorization', `Bearer ${token}`);
  }

  // 커스텀 헤더
  if (opts.headers) {
    Object.entries(opts.headers).forEach(([k, v]) =>
      headersMap.set(k.toLowerCase(), v),
    );
  }

  // body를 json()으로 반환
  const jsonBody = opts.body ? JSON.stringify(opts.body) : undefined;

  const request = {
    method,
    url: urlObj.toString(),
    nextUrl: urlObj,
    headers: {
      get: (name: string) => headersMap.get(name.toLowerCase()) || null,
      has: (name: string) => headersMap.has(name.toLowerCase()),
      entries: () => headersMap.entries(),
      forEach: (cb: (v: string, k: string) => void) => headersMap.forEach(cb),
    },
    cookies: {
      get: () => undefined,
    },
    json: jest.fn().mockResolvedValue(opts.body ?? {}),
    text: jest.fn().mockResolvedValue(jsonBody ?? ''),
  } as any;

  return request;
}
