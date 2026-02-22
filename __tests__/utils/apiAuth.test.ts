// __tests__/utils/apiAuth.test.ts
// API 인증 미들웨어 테스트

import jwt from 'jsonwebtoken';
import { verifyApiToken, unauthorizedResponse, forbiddenResponse, isAdmin, AuthUser } from '@/utils/apiAuth';

// JWT_SECRET은 jest.setup.ts에서 설정됨
const TEST_SECRET = process.env.JWT_SECRET!;

// NextRequest mock
function createMockRequest(authHeader?: string) {
  return {
    headers: {
      get: (name: string) => {
        if (name === 'authorization') return authHeader || null;
        return null;
      },
    },
  } as any;
}

describe('verifyApiToken', () => {
  const testPayload: AuthUser = {
    id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    role: 'staff',
    clinicId: 'clinic1',
  };

  it('유효한 JWT 토큰이면 AuthUser를 반환한다', () => {
    const token = jwt.sign(testPayload, TEST_SECRET, { expiresIn: '1h' });
    const request = createMockRequest(`Bearer ${token}`);

    const result = verifyApiToken(request);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('user123');
    expect(result!.username).toBe('testuser');
    expect(result!.role).toBe('staff');
    expect(result!.clinicId).toBe('clinic1');
  });

  it('Authorization 헤더가 없으면 null을 반환한다', () => {
    const request = createMockRequest();
    expect(verifyApiToken(request)).toBeNull();
  });

  it('Bearer 접두사가 없으면 null을 반환한다', () => {
    const token = jwt.sign(testPayload, TEST_SECRET);
    const request = createMockRequest(`Token ${token}`);
    expect(verifyApiToken(request)).toBeNull();
  });

  it('잘못된 토큰이면 null을 반환한다', () => {
    const request = createMockRequest('Bearer invalid-token');
    expect(verifyApiToken(request)).toBeNull();
  });

  it('만료된 토큰이면 null을 반환한다', () => {
    const token = jwt.sign(testPayload, TEST_SECRET, { expiresIn: '-1s' });
    const request = createMockRequest(`Bearer ${token}`);
    expect(verifyApiToken(request)).toBeNull();
  });

  it('다른 시크릿으로 서명된 토큰이면 null을 반환한다', () => {
    const token = jwt.sign(testPayload, 'wrong-secret');
    const request = createMockRequest(`Bearer ${token}`);
    expect(verifyApiToken(request)).toBeNull();
  });
});

describe('unauthorizedResponse', () => {
  it('401 상태 코드와 기본 메시지를 반환한다', () => {
    const response = unauthorizedResponse();
    expect(response.status).toBe(401);
  });

  it('커스텀 메시지를 설정할 수 있다', () => {
    const response = unauthorizedResponse('토큰이 만료되었습니다.');
    expect(response.status).toBe(401);
  });
});

describe('forbiddenResponse', () => {
  it('403 상태 코드를 반환한다', () => {
    const response = forbiddenResponse();
    expect(response.status).toBe(403);
  });
});

describe('isAdmin', () => {
  it('admin 역할이면 true를 반환한다', () => {
    const user: AuthUser = { id: '1', username: 'a', email: 'a@b.com', name: 'A', role: 'admin', clinicId: 'c1' };
    expect(isAdmin(user)).toBe(true);
  });

  it('master 역할이면 true를 반환한다', () => {
    const user: AuthUser = { id: '1', username: 'a', email: 'a@b.com', name: 'A', role: 'master', clinicId: 'c1' };
    expect(isAdmin(user)).toBe(true);
  });

  it('staff 역할이면 false를 반환한다', () => {
    const user: AuthUser = { id: '1', username: 'a', email: 'a@b.com', name: 'A', role: 'staff', clinicId: 'c1' };
    expect(isAdmin(user)).toBe(false);
  });

  it('manager 역할이면 false를 반환한다', () => {
    const user: AuthUser = { id: '1', username: 'a', email: 'a@b.com', name: 'A', role: 'manager', clinicId: 'c1' };
    expect(isAdmin(user)).toBe(false);
  });
});
