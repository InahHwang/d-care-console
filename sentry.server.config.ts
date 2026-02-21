// sentry.server.config.ts
// 서버(API 라우트) 에러 캡처 설정

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,

  // 트랜잭션 샘플링 (10%)
  tracesSampleRate: 0.1,

  environment: process.env.NODE_ENV,

  debug: false,
});
