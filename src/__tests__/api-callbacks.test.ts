// src/__tests__/api-callbacks.test.ts
// 콜백 API (/api/v2/callbacks) 테스트

import { z } from 'zod';

// ── Zod 스키마 (route.ts에서 추출) ──
const callbackCreateSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  type: z.enum(['callback', 'recall', 'thanks'], { required_error: 'type is required' }),
  scheduledAt: z.string().min(1, 'scheduledAt is required'),
  note: z.string().nullish(),
});

const callbackPatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  status: z.enum(['pending', 'completed', 'missed'], { required_error: 'status is required' }),
  note: z.string().nullish(),
  source: z.string().nullish(),
});

// ═══════════════════════════════════════
// 테스트
// ═══════════════════════════════════════

describe('콜백 API - Zod 스키마 검증', () => {
  describe('callbackCreateSchema', () => {
    test('정상 데이터 통과', () => {
      const result = callbackCreateSchema.safeParse({
        patientId: '507f1f77bcf86cd799439011',
        type: 'callback',
        scheduledAt: '2026-03-20T09:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    test('note 포함 시 정상 통과', () => {
      const result = callbackCreateSchema.safeParse({
        patientId: '507f1f77bcf86cd799439011',
        type: 'recall',
        scheduledAt: '2026-03-20T09:00:00.000Z',
        note: '임플란트 상담 후 다시 연락',
      });
      expect(result.success).toBe(true);
    });

    test('note가 null이면 통과 (nullish)', () => {
      const result = callbackCreateSchema.safeParse({
        patientId: '507f1f77bcf86cd799439011',
        type: 'thanks',
        scheduledAt: '2026-03-20',
        note: null,
      });
      expect(result.success).toBe(true);
    });

    test('patientId 누락 시 에러', () => {
      const result = callbackCreateSchema.safeParse({
        type: 'callback',
        scheduledAt: '2026-03-20',
      });
      expect(result.success).toBe(false);
    });

    test('patientId 빈 문자열 에러', () => {
      const result = callbackCreateSchema.safeParse({
        patientId: '',
        type: 'callback',
        scheduledAt: '2026-03-20',
      });
      expect(result.success).toBe(false);
    });

    test('type 유효하지 않은 값 에러', () => {
      const result = callbackCreateSchema.safeParse({
        patientId: '507f1f77bcf86cd799439011',
        type: 'invalid',
        scheduledAt: '2026-03-20',
      });
      expect(result.success).toBe(false);
    });

    test('scheduledAt 누락 시 에러', () => {
      const result = callbackCreateSchema.safeParse({
        patientId: '507f1f77bcf86cd799439011',
        type: 'callback',
      });
      expect(result.success).toBe(false);
    });

    test('scheduledAt 빈 문자열 에러', () => {
      const result = callbackCreateSchema.safeParse({
        patientId: '507f1f77bcf86cd799439011',
        type: 'callback',
        scheduledAt: '',
      });
      expect(result.success).toBe(false);
    });

    test('type callback/recall/thanks 모두 통과', () => {
      for (const type of ['callback', 'recall', 'thanks']) {
        const result = callbackCreateSchema.safeParse({
          patientId: 'abc123',
          type,
          scheduledAt: '2026-03-20',
        });
        expect(result.success).toBe(true);
      }
    });

    test('빈 body 에러', () => {
      const result = callbackCreateSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('callbackPatchSchema', () => {
    test('정상 데이터 통과', () => {
      const result = callbackPatchSchema.safeParse({
        id: '507f1f77bcf86cd799439011',
        status: 'completed',
      });
      expect(result.success).toBe(true);
    });

    test('note/source 포함 시 정상 통과', () => {
      const result = callbackPatchSchema.safeParse({
        id: '507f1f77bcf86cd799439011',
        status: 'missed',
        note: '부재중',
        source: 'patient',
      });
      expect(result.success).toBe(true);
    });

    test('id 누락 시 에러', () => {
      const result = callbackPatchSchema.safeParse({
        status: 'completed',
      });
      expect(result.success).toBe(false);
    });

    test('status 유효하지 않은 값 에러', () => {
      const result = callbackPatchSchema.safeParse({
        id: '507f1f77bcf86cd799439011',
        status: 'cancelled',
      });
      expect(result.success).toBe(false);
    });

    test('status pending/completed/missed 모두 통과', () => {
      for (const status of ['pending', 'completed', 'missed']) {
        const result = callbackPatchSchema.safeParse({
          id: 'abc123',
          status,
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
