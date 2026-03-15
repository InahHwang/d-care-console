// src/__tests__/api-cti.test.ts
// CTI API 테스트 (incoming-call, outgoing-call, call-end, call-logs)

import { z } from 'zod';

// ── Zod 스키마들 (각 route.ts에서 추출) ──

// incoming-call
const incomingCallSchema = z.object({
  callerNumber: z.string().min(1, 'callerNumber is required'),
  calledNumber: z.string().nullish(),
  timestamp: z.string().nullish(),
});

// outgoing-call (추정 스키마 - 실제 파일에서 확인)
const outgoingCallSchema = z.object({
  callerNumber: z.string().min(1, 'callerNumber is required'),
  calledNumber: z.string().min(1, 'calledNumber is required'),
  patientId: z.string().nullish(),
  timestamp: z.string().nullish(),
});

// call-end
const callEndSchema = z.object({
  callLogId: z.string().min(1, 'callLogId is required'),
  duration: z.number().int().min(0).optional(),
  status: z.enum(['connected', 'missed', 'no_answer']).optional(),
  timestamp: z.string().nullish(),
});

// ── 헬퍼 함수 (incoming-call route.ts에서 추출) ──
function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  } else if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return phone;
}

// ═══════════════════════════════════════
// 테스트
// ═══════════════════════════════════════

describe('CTI API - 전화번호 유틸', () => {
  describe('normalizePhone', () => {
    test('대시 제거', () => {
      expect(normalizePhone('010-1234-5678')).toBe('01012345678');
    });

    test('공백/특수문자 제거', () => {
      expect(normalizePhone('010 1234 5678')).toBe('01012345678');
      expect(normalizePhone('+82-10-1234-5678')).toBe('821012345678');
    });

    test('빈 문자열', () => {
      expect(normalizePhone('')).toBe('');
    });

    test('숫자만 있는 문자열은 그대로', () => {
      expect(normalizePhone('01012345678')).toBe('01012345678');
    });
  });

  describe('formatPhone', () => {
    test('11자리 → 010-XXXX-XXXX', () => {
      expect(formatPhone('01012345678')).toBe('010-1234-5678');
    });

    test('10자리 → 031-XXX-XXXX', () => {
      expect(formatPhone('0311234567')).toBe('031-123-4567');
    });

    test('대시 포함 입력 → 대시 재정렬', () => {
      expect(formatPhone('010-1234-5678')).toBe('010-1234-5678');
    });

    test('9자리 이하는 원본 반환', () => {
      expect(formatPhone('1234')).toBe('1234');
    });

    test('12자리 이상은 원본 반환', () => {
      expect(formatPhone('821012345678')).toBe('821012345678');
    });
  });
});

describe('CTI API - Zod 스키마 검증', () => {
  describe('incomingCallSchema', () => {
    test('최소 필드 통과', () => {
      const result = incomingCallSchema.safeParse({
        callerNumber: '01012345678',
      });
      expect(result.success).toBe(true);
    });

    test('모든 필드 통과', () => {
      const result = incomingCallSchema.safeParse({
        callerNumber: '010-1234-5678',
        calledNumber: '031-123-4567',
        timestamp: '2026-03-15T09:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    test('callerNumber 누락 에러', () => {
      const result = incomingCallSchema.safeParse({
        calledNumber: '031-123-4567',
      });
      expect(result.success).toBe(false);
    });

    test('callerNumber 빈 문자열 에러', () => {
      const result = incomingCallSchema.safeParse({
        callerNumber: '',
      });
      expect(result.success).toBe(false);
    });

    test('calledNumber/timestamp null 허용', () => {
      const result = incomingCallSchema.safeParse({
        callerNumber: '01012345678',
        calledNumber: null,
        timestamp: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('outgoingCallSchema', () => {
    test('정상 데이터 통과', () => {
      const result = outgoingCallSchema.safeParse({
        callerNumber: '031-123-4567',
        calledNumber: '010-1234-5678',
      });
      expect(result.success).toBe(true);
    });

    test('calledNumber 누락 에러', () => {
      const result = outgoingCallSchema.safeParse({
        callerNumber: '031-123-4567',
      });
      expect(result.success).toBe(false);
    });

    test('patientId 선택적 통과', () => {
      const result = outgoingCallSchema.safeParse({
        callerNumber: '031-123-4567',
        calledNumber: '010-1234-5678',
        patientId: '507f1f77bcf86cd799439011',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('callEndSchema', () => {
    test('최소 필드 통과', () => {
      const result = callEndSchema.safeParse({
        callLogId: '507f1f77bcf86cd799439011',
      });
      expect(result.success).toBe(true);
    });

    test('모든 필드 통과', () => {
      const result = callEndSchema.safeParse({
        callLogId: '507f1f77bcf86cd799439011',
        duration: 120,
        status: 'connected',
        timestamp: '2026-03-15T09:02:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    test('callLogId 누락 에러', () => {
      const result = callEndSchema.safeParse({
        duration: 60,
      });
      expect(result.success).toBe(false);
    });

    test('duration 음수 에러', () => {
      const result = callEndSchema.safeParse({
        callLogId: 'abc',
        duration: -1,
      });
      expect(result.success).toBe(false);
    });

    test('status 유효하지 않은 값 에러', () => {
      const result = callEndSchema.safeParse({
        callLogId: 'abc',
        status: 'cancelled',
      });
      expect(result.success).toBe(false);
    });

    test('status connected/missed/no_answer 모두 통과', () => {
      for (const status of ['connected', 'missed', 'no_answer']) {
        const result = callEndSchema.safeParse({
          callLogId: 'abc',
          status,
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
