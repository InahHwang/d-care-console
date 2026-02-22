// src/lib/logger.ts
// 구조화된 로깅 유틸리티 — Vercel Logs + Sentry 연동

import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  route?: string;
  method?: string;
  clinicId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: { name: string; message: string; stack?: string };
}

function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error,
): StructuredLog {
  const log: StructuredLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (context && Object.keys(context).length > 0) log.context = context;
  if (error) {
    log.error = { name: error.name, message: error.message, stack: error.stack };
  }
  return log;
}

const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  debug(message: string, context?: LogContext) {
    if (!isProduction) {
      console.log(JSON.stringify(formatLog('debug', message, context)));
    }
  },

  info(message: string, context?: LogContext) {
    console.log(JSON.stringify(formatLog('info', message, context)));
  },

  warn(message: string, context?: LogContext) {
    console.warn(JSON.stringify(formatLog('warn', message, context)));
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(JSON.stringify(formatLog('error', message, context, err)));

    // Sentry 전송
    Sentry.withScope((scope) => {
      if (context?.route) scope.setTag('route', context.route);
      if (context?.clinicId) scope.setTag('clinicId', context.clinicId);
      if (context?.userId) scope.setTag('userId', context.userId);
      if (context) scope.setContext('request', context);
      Sentry.captureException(err);
    });
  },
};

/** 라우트 스코프 로거 생성 */
export function createRouteLogger(route: string, method: string) {
  return {
    info(message: string, extra?: Record<string, unknown>) {
      logger.info(message, { route, method, ...extra });
    },
    warn(message: string, extra?: Record<string, unknown>) {
      logger.warn(message, { route, method, ...extra });
    },
    error(message: string, error?: Error | unknown, extra?: Record<string, unknown>) {
      logger.error(message, error, { route, method, ...extra });
    },
    debug(message: string, extra?: Record<string, unknown>) {
      logger.debug(message, { route, method, ...extra });
    },
  };
}
