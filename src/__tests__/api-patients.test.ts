// src/__tests__/api-patients.test.ts
// 환자 API (/api/v2/patients) 테스트

import { ObjectId } from 'mongodb';
import { z } from 'zod';

// ── Zod 스키마 (route.ts에서 추출 — SSoT를 위해 향후 별도 파일로 분리 가능) ──
const createPatientSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다').max(50),
  phone: z.string().min(1, '전화번호는 필수입니다').max(20),
  consultationType: z.string().max(100).optional(),
  interest: z.string().min(1, '관심 시술은 필수입니다').max(200),
  source: z.string().max(100).optional(),
  temperature: z.enum(['hot', 'warm', 'cold']).optional().default('warm'),
  nextAction: z.string().max(500).optional(),
  age: z.number().int().min(1).max(150).optional(),
  region: z.object({
    province: z.string().min(1),
    city: z.string().optional(),
  }).optional(),
  firstConsultDate: z.string().optional(),
  changedBy: z.string().max(50).optional(),
});

// ── 헬퍼 함수 (route.ts에서 추출) ──
type PatientStatus = 'consulting' | 'reserved' | 'visited' | 'treatmentBooked' | 'treatment' | 'completed' | 'followup' | 'closed';
type UrgencyType = 'noshow' | 'today' | 'overdue' | 'normal';

const DAYS_THRESHOLD: Record<PatientStatus, number> = {
  consulting: 7, reserved: 0, visited: 7, treatmentBooked: 0,
  treatment: 30, completed: 999, followup: 90, closed: 999,
};

function getUrgency(
  status: PatientStatus,
  nextActionDate: string | Date | null | undefined,
  daysInStatus: number,
  referenceDate?: Date
): UrgencyType {
  const now = referenceDate ? new Date(referenceDate) : new Date();
  now.setHours(0, 0, 0, 0);

  if (nextActionDate) {
    const actionDate = new Date(nextActionDate);
    actionDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((actionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'noshow';
    if (diffDays === 0) return 'today';
  } else {
    const threshold = DAYS_THRESHOLD[status];
    if (threshold > 0 && daysInStatus >= threshold) return 'overdue';
  }
  return 'normal';
}

function getPeriodStartDate(period: string | null): Date | null {
  if (!period || period === 'all') return null;
  const now = new Date();
  if (period === 'thisMonth') return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  let monthsBack = 3;
  switch (period) {
    case '1month': monthsBack = 1; break;
    case '3months': monthsBack = 3; break;
    case '6months': monthsBack = 6; break;
    case '1year': monthsBack = 12; break;
    default: return null;
  }
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - monthsBack);
  startDate.setHours(0, 0, 0, 0);
  return startDate;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ═══════════════════════════════════════
// 테스트
// ═══════════════════════════════════════

describe('환자 API - Zod 스키마 검증', () => {
  describe('createPatientSchema', () => {
    test('정상 데이터 통과', () => {
      const result = createPatientSchema.safeParse({
        name: '김환자',
        phone: '010-1234-5678',
        interest: '임플란트',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.temperature).toBe('warm'); // 기본값
      }
    });

    test('이름 누락 시 에러', () => {
      const result = createPatientSchema.safeParse({
        phone: '010-1234-5678',
        interest: '임플란트',
      });
      expect(result.success).toBe(false);
    });

    test('이름 빈 문자열 시 커스텀 에러', () => {
      const result = createPatientSchema.safeParse({
        name: '',
        phone: '010-1234-5678',
        interest: '임플란트',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('이름은 필수입니다');
      }
    });

    test('전화번호 누락 시 에러', () => {
      const result = createPatientSchema.safeParse({
        name: '김환자',
        interest: '임플란트',
      });
      expect(result.success).toBe(false);
    });

    test('전화번호 빈 문자열 시 커스텀 에러', () => {
      const result = createPatientSchema.safeParse({
        name: '김환자',
        phone: '',
        interest: '임플란트',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('전화번호는 필수입니다');
      }
    });

    test('관심 시술 누락 시 에러', () => {
      const result = createPatientSchema.safeParse({
        name: '김환자',
        phone: '010-1234-5678',
      });
      expect(result.success).toBe(false);
    });

    test('관심 시술 빈 문자열 시 커스텀 에러', () => {
      const result = createPatientSchema.safeParse({
        name: '김환자',
        phone: '010-1234-5678',
        interest: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('관심 시술은 필수입니다');
      }
    });

    test('이름 50자 초과 시 에러', () => {
      const result = createPatientSchema.safeParse({
        name: 'A'.repeat(51),
        phone: '010-1234-5678',
        interest: '임플란트',
      });
      expect(result.success).toBe(false);
    });

    test('temperature 유효하지 않은 값 에러', () => {
      const result = createPatientSchema.safeParse({
        name: '김환자',
        phone: '010-1234-5678',
        interest: '교정',
        temperature: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    test('temperature hot/warm/cold 통과', () => {
      for (const temp of ['hot', 'warm', 'cold']) {
        const result = createPatientSchema.safeParse({
          name: '김환자',
          phone: '010-1234-5678',
          interest: '교정',
          temperature: temp,
        });
        expect(result.success).toBe(true);
      }
    });

    test('선택 필드 포함 정상 통과', () => {
      const result = createPatientSchema.safeParse({
        name: '이환자',
        phone: '010-9876-5432',
        interest: '라미네이트',
        consultationType: '아웃바운드',
        source: '네이버',
        temperature: 'hot',
        nextAction: '콜백 예정',
        age: 35,
        region: { province: '서울', city: '강남구' },
        firstConsultDate: '2026-03-15',
        changedBy: '상담사A',
      });
      expect(result.success).toBe(true);
    });

    test('age 범위 밖 에러 (0, 151)', () => {
      const zero = createPatientSchema.safeParse({
        name: '김환자', phone: '010-1234-5678', interest: '임플란트', age: 0,
      });
      expect(zero.success).toBe(false);

      const over = createPatientSchema.safeParse({
        name: '김환자', phone: '010-1234-5678', interest: '임플란트', age: 151,
      });
      expect(over.success).toBe(false);
    });

    test('region.province 빈 문자열 에러', () => {
      const result = createPatientSchema.safeParse({
        name: '김환자', phone: '010-1234-5678', interest: '임플란트',
        region: { province: '' },
      });
      expect(result.success).toBe(false);
    });

    test('빈 body 에러', () => {
      const result = createPatientSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

describe('환자 API - 헬퍼 함수', () => {
  describe('getUrgency', () => {
    const today = new Date('2026-03-15');

    test('nextActionDate가 과거면 noshow', () => {
      expect(getUrgency('consulting', '2026-03-10', 5, today)).toBe('noshow');
    });

    test('nextActionDate가 오늘이면 today', () => {
      expect(getUrgency('consulting', '2026-03-15', 0, today)).toBe('today');
    });

    test('nextActionDate가 미래면 normal', () => {
      expect(getUrgency('consulting', '2026-03-20', 0, today)).toBe('normal');
    });

    test('nextActionDate 없고 체류일 임계값 초과 시 overdue', () => {
      // consulting 임계값 = 7일
      expect(getUrgency('consulting', null, 7, today)).toBe('overdue');
      expect(getUrgency('consulting', null, 10, today)).toBe('overdue');
    });

    test('nextActionDate 없고 체류일 임계값 미만 시 normal', () => {
      expect(getUrgency('consulting', null, 3, today)).toBe('normal');
    });

    test('completed/closed 상태는 임계값 999이므로 보통 normal', () => {
      expect(getUrgency('completed', null, 100, today)).toBe('normal');
      expect(getUrgency('closed', null, 500, today)).toBe('normal');
    });

    test('treatment 상태 30일 이상 체류 시 overdue', () => {
      expect(getUrgency('treatment', null, 30, today)).toBe('overdue');
      expect(getUrgency('treatment', null, 29, today)).toBe('normal');
    });

    test('reserved/treatmentBooked는 임계값 0이므로 nextActionDate 없으면 항상 normal', () => {
      expect(getUrgency('reserved', null, 100, today)).toBe('normal');
      expect(getUrgency('treatmentBooked', null, 100, today)).toBe('normal');
    });
  });

  describe('getPeriodStartDate', () => {
    test('null/all이면 null 반환', () => {
      expect(getPeriodStartDate(null)).toBeNull();
      expect(getPeriodStartDate('all')).toBeNull();
    });

    test('thisMonth이면 이번 달 1일 반환', () => {
      const result = getPeriodStartDate('thisMonth');
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(1);
    });

    test('1month/3months/6months/1year 유효한 날짜 반환', () => {
      for (const period of ['1month', '3months', '6months', '1year']) {
        const result = getPeriodStartDate(period);
        expect(result).not.toBeNull();
        expect(result!.getTime()).toBeLessThan(Date.now());
      }
    });

    test('알 수 없는 값이면 null', () => {
      expect(getPeriodStartDate('unknown')).toBeNull();
    });
  });

  describe('escapeRegex', () => {
    test('특수문자 이스케이프', () => {
      expect(escapeRegex('hello.world')).toBe('hello\\.world');
      expect(escapeRegex('test(1)')).toBe('test\\(1\\)');
      expect(escapeRegex('a+b*c?')).toBe('a\\+b\\*c\\?');
    });

    test('일반 문자열은 그대로', () => {
      expect(escapeRegex('김환자')).toBe('김환자');
      expect(escapeRegex('010-1234-5678')).toBe('010-1234-5678'); // 대시는 정규식 특수문자 아님
    });
  });
});
