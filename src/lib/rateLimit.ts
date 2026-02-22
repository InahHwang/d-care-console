// src/lib/rateLimit.ts
// In-memory 버스트 방어 Rate Limiter (Vercel 서버리스 인스턴스별)

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp (ms)
}

interface RateLimitConfig {
  windowMs: number;   // 윈도우 크기 (ms)
  maxRequests: number; // 윈도우 내 최대 요청 수
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

// 프리셋
export const RATE_LIMIT_PRESETS = {
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },     // IP당 15분 5회
  api: { windowMs: 60 * 1000, maxRequests: 100 },           // 유저당 1분 100회
} as const;

const store = new Map<string, RateLimitEntry>();

// 60초마다 만료 엔트리 정리
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];
    store.forEach((entry, key) => {
      if (entry.resetAt <= now) keysToDelete.push(key);
    });
    keysToDelete.forEach((k) => store.delete(k));
    // 맵이 비면 타이머 해제 (메모리 누수 방지)
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, 60_000);
}

/**
 * Rate limit 체크.
 * @param key - 고유 식별자 (예: `login:${ip}`, `api:${userId}`)
 * @param config - 윈도우/최대 요청 설정
 * @returns { allowed, remaining, retryAfterMs }
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const entry = store.get(key);

  // 엔트리 없거나 윈도우 만료 → 새 윈도우 시작
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, retryAfterMs: 0 };
  }

  // 윈도우 내 요청 증가
  entry.count++;

  if (entry.count <= config.maxRequests) {
    return { allowed: true, remaining: config.maxRequests - entry.count, retryAfterMs: 0 };
  }

  // 초과
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: entry.resetAt - now,
  };
}

/** 테스트용: 스토어 초기화 */
export function _resetStore() {
  store.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
