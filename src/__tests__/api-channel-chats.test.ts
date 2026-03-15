// src/__tests__/api-channel-chats.test.ts
// 채널챗 & 리콜메시지 & 설정 API Zod 스키마 테스트

import { z } from 'zod';

// ── 채널챗 스키마 ──
const channelChatCreateSchema = z.object({
  channel: z.enum(['naver', 'kakao', 'instagram', 'website']),
  userId: z.string().min(1),
  userName: z.string().optional(),
  message: z.string().min(1),
});

// ── 리콜메시지 스키마 ──
const recallMessageCreateSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  type: z.enum(['sms', 'kakao']).default('sms'),
  message: z.string().min(1, 'message is required').max(1000),
  scheduledAt: z.string().optional(),
});

const recallMessagePatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'sent', 'failed', 'cancelled']),
});

// ── 설정 스키마 ──
const settingsPatchSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

// ═══════════════════════════════════════
// 테스트
// ═══════════════════════════════════════

describe('채널챗 API - Zod 스키마 검증', () => {
  describe('channelChatCreateSchema', () => {
    test('정상 데이터 통과', () => {
      const result = channelChatCreateSchema.safeParse({
        channel: 'naver',
        userId: 'user123',
        message: '안녕하세요',
      });
      expect(result.success).toBe(true);
    });

    test('4개 채널 모두 통과', () => {
      for (const channel of ['naver', 'kakao', 'instagram', 'website']) {
        const result = channelChatCreateSchema.safeParse({
          channel,
          userId: 'user123',
          message: '테스트 메시지',
        });
        expect(result.success).toBe(true);
      }
    });

    test('유효하지 않은 채널 에러', () => {
      const result = channelChatCreateSchema.safeParse({
        channel: 'facebook',
        userId: 'user123',
        message: '테스트',
      });
      expect(result.success).toBe(false);
    });

    test('userId 빈 문자열 에러', () => {
      const result = channelChatCreateSchema.safeParse({
        channel: 'naver',
        userId: '',
        message: '테스트',
      });
      expect(result.success).toBe(false);
    });

    test('message 빈 문자열 에러', () => {
      const result = channelChatCreateSchema.safeParse({
        channel: 'kakao',
        userId: 'user123',
        message: '',
      });
      expect(result.success).toBe(false);
    });

    test('userName 선택 필드', () => {
      const without = channelChatCreateSchema.safeParse({
        channel: 'naver',
        userId: 'user123',
        message: '테스트',
      });
      expect(without.success).toBe(true);

      const with_ = channelChatCreateSchema.safeParse({
        channel: 'naver',
        userId: 'user123',
        userName: '김고객',
        message: '테스트',
      });
      expect(with_.success).toBe(true);
    });
  });
});

describe('리콜메시지 API - Zod 스키마 검증', () => {
  describe('recallMessageCreateSchema', () => {
    test('최소 필드 통과 (type 기본값 sms)', () => {
      const result = recallMessageCreateSchema.safeParse({
        patientId: 'abc123',
        message: '리콜 안내 메시지',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('sms');
      }
    });

    test('모든 필드 통과', () => {
      const result = recallMessageCreateSchema.safeParse({
        patientId: 'abc123',
        type: 'kakao',
        message: '리콜 안내',
        scheduledAt: '2026-03-20T09:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    test('patientId 누락 에러', () => {
      const result = recallMessageCreateSchema.safeParse({
        message: '리콜 안내',
      });
      expect(result.success).toBe(false);
    });

    test('message 누락 에러', () => {
      const result = recallMessageCreateSchema.safeParse({
        patientId: 'abc123',
      });
      expect(result.success).toBe(false);
    });

    test('message 1000자 초과 에러', () => {
      const result = recallMessageCreateSchema.safeParse({
        patientId: 'abc123',
        message: 'A'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    test('type 유효하지 않은 값 에러', () => {
      const result = recallMessageCreateSchema.safeParse({
        patientId: 'abc123',
        type: 'email',
        message: '테스트',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('recallMessagePatchSchema', () => {
    test('정상 데이터 통과', () => {
      for (const status of ['pending', 'sent', 'failed', 'cancelled']) {
        const result = recallMessagePatchSchema.safeParse({
          id: 'abc123',
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    test('id 누락 에러', () => {
      const result = recallMessagePatchSchema.safeParse({
        status: 'sent',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('설정 API - Zod 스키마 검증', () => {
  describe('settingsPatchSchema', () => {
    test('문자열 value 통과', () => {
      const result = settingsPatchSchema.safeParse({
        key: 'clinicName',
        value: '디케어 치과',
      });
      expect(result.success).toBe(true);
    });

    test('숫자 value 통과', () => {
      const result = settingsPatchSchema.safeParse({
        key: 'maxCallbacksPerDay',
        value: 50,
      });
      expect(result.success).toBe(true);
    });

    test('객체 value 통과', () => {
      const result = settingsPatchSchema.safeParse({
        key: 'smsConfig',
        value: { apiKey: 'xxx', senderId: '031-123-4567' },
      });
      expect(result.success).toBe(true);
    });

    test('key 빈 문자열 에러', () => {
      const result = settingsPatchSchema.safeParse({
        key: '',
        value: 'test',
      });
      expect(result.success).toBe(false);
    });

    test('key 누락 에러', () => {
      const result = settingsPatchSchema.safeParse({
        value: 'test',
      });
      expect(result.success).toBe(false);
    });
  });
});
