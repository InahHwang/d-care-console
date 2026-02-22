// __tests__/api/auth/login.test.ts
// 로그인 API 통합 테스트

jest.mock('@/utils/mongodb', () => ({
  connectToDatabase: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  createRouteLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/loginProtection', () => ({
  checkLoginAllowed: jest.fn().mockResolvedValue({ allowed: true, failureCount: 0, retryAfterMs: 0 }),
  recordLoginAttempt: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/auth/tokens', () => ({
  generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  generateRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
  revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
}));

import bcrypt from 'bcryptjs';
import { POST, DELETE } from '@/app/api/auth/login/route';
import { createMockNextRequest } from '../../helpers/mockRequest';
import { createMockDb, createMockCollection, setupMockMongodb } from '../../helpers/mockDb';
import { _resetStore } from '@/lib/rateLimit';
import { checkLoginAllowed, recordLoginAttempt } from '@/lib/loginProtection';

const HASHED_PASSWORD = bcrypt.hashSync('correct-password', 10);

describe('/api/auth/login', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetStore(); // rate limit 스토어 초기화

    const usersCol = createMockCollection([
      {
        _id: 'user-001',
        username: 'testuser',
        email: 'test@clinic.com',
        name: '테스트 직원',
        password: HASHED_PASSWORD,
        role: 'staff',
        isActive: true,
        clinicId: 'clinic-001',
      },
    ]);

    mockDb = createMockDb({
      users: usersCol,
      activityLogs: createMockCollection([]),
    });
    setupMockMongodb(mockDb);
  });

  // ===== 입력값 검증 =====

  describe('POST - 입력값 검증', () => {
    it('email이 빈 문자열이면 400을 반환한다', async () => {
      const req = createMockNextRequest('POST', '/api/auth/login', {
        body: { email: '', password: 'test' },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('password가 빈 문자열이면 400을 반환한다', async () => {
      const req = createMockNextRequest('POST', '/api/auth/login', {
        body: { email: 'testuser', password: '' },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ===== 로그인 실패 =====

  describe('POST - 로그인 실패', () => {
    it('잘못된 비밀번호로 로그인하면 401을 반환한다', async () => {
      const usersCol = mockDb.collection('users');
      usersCol.findOne.mockResolvedValue({
        _id: 'user-001',
        username: 'testuser',
        email: 'test@clinic.com',
        password: HASHED_PASSWORD,
        role: 'staff',
        isActive: true,
        clinicId: 'clinic-001',
      });

      const req = createMockNextRequest('POST', '/api/auth/login', {
        body: { email: 'testuser', password: 'wrong-password' },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(recordLoginAttempt).toHaveBeenCalledWith('testuser', false, expect.any(String));
    });

    it('존재하지 않는 사용자로 로그인하면 401을 반환한다', async () => {
      const usersCol = mockDb.collection('users');
      usersCol.findOne.mockResolvedValue(null); // 사용자 없음

      const req = createMockNextRequest('POST', '/api/auth/login', {
        body: { email: 'nonexistent', password: 'any' },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  // ===== 로그인 성공 =====

  describe('POST - 로그인 성공', () => {
    it('올바른 자격증명으로 토큰과 사용자 정보를 반환한다', async () => {
      const usersCol = mockDb.collection('users');
      usersCol.findOne.mockResolvedValue({
        _id: 'user-001',
        username: 'testuser',
        email: 'test@clinic.com',
        name: '테스트 직원',
        password: HASHED_PASSWORD,
        role: 'staff',
        isActive: true,
        clinicId: 'clinic-001',
      });

      const req = createMockNextRequest('POST', '/api/auth/login', {
        body: { email: 'testuser', password: 'correct-password' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.token).toBe('mock-access-token');
      expect(body.refreshToken).toBe('mock-refresh-token');
      expect(body.user.username).toBe('testuser');
      expect(body.user.clinicId).toBe('clinic-001');
      // 성공 시 실패 기록 초기화
      expect(recordLoginAttempt).toHaveBeenCalledWith('testuser', true, expect.any(String));
    });
  });

  // ===== Rate Limiting =====

  describe('POST - Rate Limiting', () => {
    it('IP당 15분 동안 5회 초과 시 429를 반환한다', async () => {
      const usersCol = mockDb.collection('users');
      usersCol.findOne.mockResolvedValue(null); // 매번 실패

      // 5회 시도 (모두 통과)
      for (let i = 0; i < 5; i++) {
        const req = createMockNextRequest('POST', '/api/auth/login', {
          body: { email: 'test', password: 'test' },
          headers: { 'x-forwarded-for': '1.2.3.4' },
        });
        const res = await POST(req);
        expect(res.status).not.toBe(429);
      }

      // 6번째: 429
      const req = createMockNextRequest('POST', '/api/auth/login', {
        body: { email: 'test', password: 'test' },
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });
      const res = await POST(req);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBeTruthy();
    });
  });

  // ===== 계정 잠금 =====

  describe('POST - 계정 잠금', () => {
    it('DB 기반 잠금 시 429를 반환한다', async () => {
      (checkLoginAllowed as jest.Mock).mockResolvedValueOnce({
        allowed: false,
        failureCount: 10,
        retryAfterMs: 1800000,
      });

      const req = createMockNextRequest('POST', '/api/auth/login', {
        body: { email: 'locked-user', password: 'test' },
        headers: { 'x-forwarded-for': '9.9.9.9' }, // 다른 IP로 rate limit 회피
      });
      const res = await POST(req);
      expect(res.status).toBe(429);
    });
  });

  // ===== 로그아웃 =====

  describe('DELETE - 로그아웃', () => {
    it('로그아웃 요청은 항상 성공한다', async () => {
      const req = createMockNextRequest('DELETE', '/api/auth/login', {
        body: { refreshToken: 'some-token' },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});
