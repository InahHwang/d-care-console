// src/instrumentation.ts
// Next.js Instrumentation Hook — Sentry 서버 초기화

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.server.config');
  }
}
