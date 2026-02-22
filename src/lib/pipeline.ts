// src/lib/pipeline.ts
// 지수 백오프 재시도 유틸리티 (AI 분석 파이프라인용)

import { logger } from '@/lib/logger';

interface RetryConfig {
  maxAttempts: number;  // 최대 시도 횟수
  baseDelayMs: number;  // 기본 대기 시간 (ms)
}

interface RetryContext {
  name: string;        // 작업 이름 (예: 'STT', 'AI-Analysis')
  callLogId: string;   // 관련 callLog ID
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 2000, // 2s → 4s → 8s
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 지수 백오프 재시도.
 * 실패 시 logger.error → Sentry 자동 전송.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: RetryContext,
  config: RetryConfig = DEFAULT_CONFIG,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxAttempts) {
        const delayMs = config.baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`${context.name} 재시도 ${attempt}/${config.maxAttempts}`, {
          route: '/api/v2/call-analysis/recording',
          callLogId: context.callLogId,
          attempt,
          nextDelayMs: delayMs,
        });
        await sleep(delayMs);
      }
    }
  }

  // 모든 시도 실패
  logger.error(
    `${context.name} 최종 실패 (${config.maxAttempts}회 시도)`,
    lastError,
    { route: '/api/v2/call-analysis/recording', callLogId: context.callLogId },
  );

  throw lastError;
}
