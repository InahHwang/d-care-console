// src/lib/cache.ts
// In-memory TTL 캐시 (Vercel 서버리스 인스턴스별)

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix timestamp (ms)
}

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 100;

export const cache = {
  get<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.data;
  },

  set<T>(key: string, data: T, ttlMs: number): void {
    // 최대 엔트리 수 초과 시 만료된 항목 정리
    if (store.size >= MAX_ENTRIES) {
      const now = Date.now();
      const keysToDelete: string[] = [];
      store.forEach((v, k) => {
        if (v.expiresAt <= now) keysToDelete.push(k);
      });
      keysToDelete.forEach((k) => store.delete(k));
      // 그래도 넘치면 가장 오래된 항목 삭제
      if (store.size >= MAX_ENTRIES) {
        const firstKey = store.keys().next().value;
        if (firstKey) store.delete(firstKey);
      }
    }
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  },

  invalidate(key: string): void {
    store.delete(key);
  },

  /** 패턴으로 무효화 (예: 'settings:*') */
  invalidatePrefix(prefix: string): void {
    const keysToDelete: string[] = [];
    store.forEach((_v, key) => {
      if (key.startsWith(prefix)) keysToDelete.push(key);
    });
    keysToDelete.forEach((k) => store.delete(k));
  },
};

/**
 * 캐시 래퍼: 캐시에 있으면 반환, 없으면 fetchFn 실행 후 캐시에 저장.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;

  const data = await fetchFn();
  cache.set(key, data, ttlMs);
  return data;
}
