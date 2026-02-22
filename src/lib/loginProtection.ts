// src/lib/loginProtection.ts
// MongoDB 기반 영구적 로그인 실패 추적 (콜드 스타트에도 유지)

import { connectToDatabase } from '@/utils/mongodb';
import { logger } from '@/lib/logger';

const MAX_FAILURES = 10;        // 잠금까지 최대 실패 횟수
const LOCKOUT_WINDOW_MS = 30 * 60 * 1000; // 30분 윈도우
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30분 잠금

interface LoginAttemptDoc {
  identifier: string;      // username 또는 email
  ip: string;
  success: boolean;
  createdAt: Date;
  lockedUntil?: Date;
}

/**
 * 로그인 허용 여부 확인.
 * 30분 내 10회 이상 실패하면 잠금.
 */
export async function checkLoginAllowed(identifier: string): Promise<{
  allowed: boolean;
  failureCount: number;
  lockedUntil?: Date;
  retryAfterMs: number;
}> {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection<LoginAttemptDoc>('loginAttempts');

    // 1. 활성 잠금 확인
    const lockRecord = await col.findOne({
      identifier,
      lockedUntil: { $gt: new Date() },
    });

    if (lockRecord && lockRecord.lockedUntil) {
      const retryAfterMs = lockRecord.lockedUntil.getTime() - Date.now();
      return { allowed: false, failureCount: MAX_FAILURES, lockedUntil: lockRecord.lockedUntil, retryAfterMs };
    }

    // 2. 30분 내 실패 횟수 조회
    const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);
    const failureCount = await col.countDocuments({
      identifier,
      success: false,
      createdAt: { $gte: windowStart },
    });

    if (failureCount >= MAX_FAILURES) {
      // 잠금 레코드 생성
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      await col.insertOne({
        identifier,
        ip: 'system',
        success: false,
        createdAt: new Date(),
        lockedUntil,
      });
      return { allowed: false, failureCount, lockedUntil, retryAfterMs: LOCKOUT_DURATION_MS };
    }

    return { allowed: true, failureCount, retryAfterMs: 0 };
  } catch (error) {
    // DB 오류 시 로그인 차단하지 않음 (가용성 우선)
    logger.error('로그인 보호 확인 실패', error, { route: '/api/auth/login' });
    return { allowed: true, failureCount: 0, retryAfterMs: 0 };
  }
}

/**
 * 로그인 시도 기록.
 * 성공 시 해당 identifier의 실패 기록 초기화.
 */
export async function recordLoginAttempt(
  identifier: string,
  success: boolean,
  ip: string,
): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection<LoginAttemptDoc>('loginAttempts');

    if (success) {
      // 성공 시 해당 identifier의 실패 기록 + 잠금 삭제
      await col.deleteMany({ identifier });
    } else {
      // 실패 기록 추가
      await col.insertOne({
        identifier,
        ip,
        success: false,
        createdAt: new Date(),
      });
    }
  } catch (error) {
    logger.error('로그인 시도 기록 실패', error, { route: '/api/auth/login' });
  }
}
