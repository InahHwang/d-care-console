// sentry.client.config.ts
// 브라우저(클라이언트) 에러 캡처 설정

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 트랜잭션 샘플링 (10%)
  tracesSampleRate: 0.1,

  // 에러 발생 시 세션 리플레이 (100%)
  replaysOnErrorSampleRate: 1.0,
  // 일반 세션 리플레이 (비활성)
  replaysSessionSampleRate: 0,

  environment: process.env.NODE_ENV,

  // 개발환경에서는 콘솔 디버그
  debug: false,
});
