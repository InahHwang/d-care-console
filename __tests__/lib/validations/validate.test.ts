// __tests__/lib/validations/validate.test.ts
// Zod 입력값 검증 헬퍼 테스트

import { z } from 'zod';
import { validateBody } from '@/lib/validations/validate';

describe('validateBody', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0).max(150),
    email: z.string().email(),
  });

  it('유효한 데이터면 success: true와 파싱된 data를 반환한다', () => {
    const body = { name: 'Kim', age: 30, email: 'kim@test.com' };
    const result = validateBody(testSchema, body);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Kim');
      expect(result.data.age).toBe(30);
      expect(result.data.email).toBe('kim@test.com');
    }
  });

  it('필수 필드 누락 시 success: false를 반환한다', () => {
    const body = { name: 'Kim' }; // age, email 누락
    const result = validateBody(testSchema, body);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
    }
  });

  it('잘못된 타입이면 success: false를 반환한다', () => {
    const body = { name: 'Kim', age: 'thirty', email: 'kim@test.com' };
    const result = validateBody(testSchema, body);

    expect(result.success).toBe(false);
  });

  it('범위 초과 값이면 success: false를 반환한다', () => {
    const body = { name: 'Kim', age: 200, email: 'kim@test.com' };
    const result = validateBody(testSchema, body);

    expect(result.success).toBe(false);
  });

  it('잘못된 이메일 형식이면 success: false를 반환한다', () => {
    const body = { name: 'Kim', age: 30, email: 'not-an-email' };
    const result = validateBody(testSchema, body);

    expect(result.success).toBe(false);
  });

  it('빈 문자열은 min(1) 검증에 실패한다', () => {
    const body = { name: '', age: 30, email: 'kim@test.com' };
    const result = validateBody(testSchema, body);

    expect(result.success).toBe(false);
  });

  it('null body면 success: false를 반환한다', () => {
    const result = validateBody(testSchema, null);
    expect(result.success).toBe(false);
  });

  it('undefined body면 success: false를 반환한다', () => {
    const result = validateBody(testSchema, undefined);
    expect(result.success).toBe(false);
  });

  it('추가 필드는 strip된다 (기본 동작)', () => {
    const body = { name: 'Kim', age: 30, email: 'kim@test.com', extra: 'ignored' };
    const result = validateBody(testSchema, body);

    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).extra).toBeUndefined();
    }
  });
});

describe('validateBody with optional fields', () => {
  const optionalSchema = z.object({
    name: z.string(),
    phone: z.string().optional(),
  });

  it('optional 필드 생략 시 성공한다', () => {
    const result = validateBody(optionalSchema, { name: 'Lee' });
    expect(result.success).toBe(true);
  });

  it('optional 필드 포함 시에도 성공한다', () => {
    const result = validateBody(optionalSchema, { name: 'Lee', phone: '010-1234-5678' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('010-1234-5678');
    }
  });
});
