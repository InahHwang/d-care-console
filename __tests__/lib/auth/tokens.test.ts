// __tests__/lib/auth/tokens.test.ts
// Access Token 생성 테스트 (DB 의존 함수는 제외)

// MongoDB 모듈 mock (tokens.ts가 import하는 connectToDatabase 차단)
jest.mock('@/utils/mongodb', () => ({
  connectToDatabase: jest.fn(),
}));

import jwt from 'jsonwebtoken';
import { generateAccessToken, TokenPayload } from '@/lib/auth/tokens';

const TEST_SECRET = process.env.JWT_SECRET!;

describe('generateAccessToken', () => {
  const payload: TokenPayload = {
    id: 'user456',
    username: 'doctor',
    email: 'doctor@clinic.com',
    name: 'Dr. Kim',
    role: 'master',
    clinicId: 'clinic-abc',
  };

  it('유효한 JWT 토큰을 생성한다', () => {
    const token = generateAccessToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT는 3개의 세그먼트
  });

  it('토큰에 올바른 페이로드가 포함된다', () => {
    const token = generateAccessToken(payload);
    const decoded = jwt.verify(token, TEST_SECRET) as any;

    expect(decoded.id).toBe('user456');
    expect(decoded.username).toBe('doctor');
    expect(decoded.email).toBe('doctor@clinic.com');
    expect(decoded.name).toBe('Dr. Kim');
    expect(decoded.role).toBe('master');
    expect(decoded.clinicId).toBe('clinic-abc');
  });

  it('토큰에 만료 시간이 설정된다', () => {
    const token = generateAccessToken(payload);
    const decoded = jwt.verify(token, TEST_SECRET) as any;

    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    // 만료 시간이 현재보다 미래인지 확인
    expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    // 15분(900초) 이내인지 확인
    const diffSeconds = decoded.exp - decoded.iat;
    expect(diffSeconds).toBe(900);
  });

  it('TEST_SECRET이 아닌 다른 시크릿으로는 검증 실패한다', () => {
    const token = generateAccessToken(payload);
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  it('다른 역할(role)도 정상 생성된다', () => {
    const staffPayload: TokenPayload = { ...payload, role: 'staff' };
    const token = generateAccessToken(staffPayload);
    const decoded = jwt.verify(token, TEST_SECRET) as any;

    expect(decoded.role).toBe('staff');
  });
});

describe('TokenPayload interface', () => {
  it('필수 필드가 모두 포함된 객체를 허용한다', () => {
    const payload: TokenPayload = {
      id: '1',
      username: 'user',
      email: 'user@test.com',
      name: 'User',
      role: 'staff',
      clinicId: 'default',
    };

    // TypeScript 컴파일 자체가 테스트 (런타임 검증)
    expect(payload.id).toBe('1');
    expect(payload.clinicId).toBe('default');
  });
});
