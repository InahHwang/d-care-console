// src/__tests__/api-consultations.test.ts
// 상담 API (/api/v2/consultations) 테스트

import { z } from 'zod';

// ── Zod 스키마 (route.ts에서 추출) ──
const consultationCreateSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  type: z.enum(['phone', 'visit'], { required_error: 'type is required' }),
  status: z.enum(['agreed', 'disagreed', 'pending', 'no_answer', 'closed'], { required_error: 'status is required' }),
  consultantName: z.string().min(1, 'consultantName is required'),
  treatment: z.string().optional(),
  originalAmount: z.number().optional(),
  discountRate: z.number().optional(),
  discountReason: z.string().optional(),
  disagreeReasons: z.array(z.string()).optional(),
  correctionPlan: z.string().optional(),
  appointmentDate: z.string().optional(),
  callbackDate: z.string().optional(),
  inquiry: z.string().optional(),
  memo: z.string().optional(),
  closedReason: z.string().optional(),
  closedReasonCustom: z.string().optional(),
  callLogId: z.string().optional(),
  manualConsultationId: z.string().optional(),
});

const consultationPatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  editedBy: z.string().nullish(),
}).passthrough();

// ── 금액 계산 로직 (route.ts에서 추출) ──
function calculateAmount(originalAmount: number, discountRate: number, status: string) {
  const discountAmount = Math.round(originalAmount * (discountRate / 100));
  const finalAmount = status === 'agreed' ? originalAmount - discountAmount : 0;
  return { discountAmount, finalAmount };
}

// ═══════════════════════════════════════
// 테스트
// ═══════════════════════════════════════

describe('상담 API - Zod 스키마 검증', () => {
  describe('consultationCreateSchema', () => {
    test('최소 필수 필드로 정상 통과', () => {
      const result = consultationCreateSchema.safeParse({
        patientId: '507f1f77bcf86cd799439011',
        type: 'phone',
        status: 'agreed',
        consultantName: '김상담',
      });
      expect(result.success).toBe(true);
    });

    test('모든 필드 포함 시 정상 통과', () => {
      const result = consultationCreateSchema.safeParse({
        patientId: '507f1f77bcf86cd799439011',
        type: 'visit',
        status: 'disagreed',
        consultantName: '이상담',
        treatment: '임플란트',
        originalAmount: 3000000,
        discountRate: 10,
        discountReason: '첫 방문 할인',
        disagreeReasons: ['비용 부담', '시간 부족'],
        correctionPlan: '할인 재안내',
        callbackDate: '2026-03-20',
        inquiry: '임플란트 관련 문의',
        memo: '내원 상담 메모',
      });
      expect(result.success).toBe(true);
    });

    test('종결 상담 정상 통과', () => {
      const result = consultationCreateSchema.safeParse({
        patientId: '507f1f77bcf86cd799439011',
        type: 'phone',
        status: 'closed',
        consultantName: '김상담',
        closedReason: '타병원 이동',
      });
      expect(result.success).toBe(true);
    });

    test('patientId 누락 시 에러', () => {
      const result = consultationCreateSchema.safeParse({
        type: 'phone',
        status: 'agreed',
        consultantName: '김상담',
      });
      expect(result.success).toBe(false);
    });

    test('patientId 빈 문자열 시 커스텀 에러', () => {
      const result = consultationCreateSchema.safeParse({
        patientId: '',
        type: 'phone',
        status: 'agreed',
        consultantName: '김상담',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('patientId is required');
      }
    });

    test('type 유효하지 않은 값 에러', () => {
      const result = consultationCreateSchema.safeParse({
        patientId: 'abc',
        type: 'chat',
        status: 'agreed',
        consultantName: '김상담',
      });
      expect(result.success).toBe(false);
    });

    test('status 유효하지 않은 값 에러', () => {
      const result = consultationCreateSchema.safeParse({
        patientId: 'abc',
        type: 'phone',
        status: 'cancelled',
        consultantName: '김상담',
      });
      expect(result.success).toBe(false);
    });

    test('consultantName 빈 문자열 에러', () => {
      const result = consultationCreateSchema.safeParse({
        patientId: 'abc',
        type: 'phone',
        status: 'agreed',
        consultantName: '',
      });
      expect(result.success).toBe(false);
    });

    test('type phone/visit 모두 통과', () => {
      for (const type of ['phone', 'visit']) {
        const result = consultationCreateSchema.safeParse({
          patientId: 'abc',
          type,
          status: 'pending',
          consultantName: '김상담',
        });
        expect(result.success).toBe(true);
      }
    });

    test('status 5가지 모두 통과', () => {
      for (const status of ['agreed', 'disagreed', 'pending', 'no_answer', 'closed']) {
        const result = consultationCreateSchema.safeParse({
          patientId: 'abc',
          type: 'phone',
          status,
          consultantName: '김상담',
        });
        expect(result.success).toBe(true);
      }
    });

    test('disagreeReasons 비문자열 배열 에러', () => {
      const result = consultationCreateSchema.safeParse({
        patientId: 'abc',
        type: 'phone',
        status: 'disagreed',
        consultantName: '김상담',
        disagreeReasons: [1, 2, 3],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('consultationPatchSchema', () => {
    test('id만으로 통과', () => {
      const result = consultationPatchSchema.safeParse({
        id: '507f1f77bcf86cd799439011',
      });
      expect(result.success).toBe(true);
    });

    test('passthrough로 추가 필드 허용', () => {
      const result = consultationPatchSchema.safeParse({
        id: '507f1f77bcf86cd799439011',
        editedBy: '김상담',
        status: 'agreed',
        originalAmount: 5000000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('agreed');
        expect(result.data.originalAmount).toBe(5000000);
      }
    });

    test('id 누락 시 에러', () => {
      const result = consultationPatchSchema.safeParse({
        editedBy: '김상담',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('상담 API - 금액 계산 로직', () => {
  test('동의 시 할인 적용', () => {
    const { discountAmount, finalAmount } = calculateAmount(1000000, 10, 'agreed');
    expect(discountAmount).toBe(100000);
    expect(finalAmount).toBe(900000);
  });

  test('미동의 시 최종금액 0', () => {
    const { discountAmount, finalAmount } = calculateAmount(1000000, 10, 'disagreed');
    expect(discountAmount).toBe(100000);
    expect(finalAmount).toBe(0);
  });

  test('할인율 0% - 정가 그대로', () => {
    const { discountAmount, finalAmount } = calculateAmount(3000000, 0, 'agreed');
    expect(discountAmount).toBe(0);
    expect(finalAmount).toBe(3000000);
  });

  test('할인율 100% - 전액 할인', () => {
    const { discountAmount, finalAmount } = calculateAmount(2000000, 100, 'agreed');
    expect(discountAmount).toBe(2000000);
    expect(finalAmount).toBe(0);
  });

  test('금액 0원', () => {
    const { discountAmount, finalAmount } = calculateAmount(0, 50, 'agreed');
    expect(discountAmount).toBe(0);
    expect(finalAmount).toBe(0);
  });

  test('반올림 처리 (소수점 금액)', () => {
    // 333333 * 33% = 109999.89 → 반올림 → 110000
    const { discountAmount } = calculateAmount(333333, 33, 'agreed');
    expect(discountAmount).toBe(Math.round(333333 * 0.33));
  });
});
