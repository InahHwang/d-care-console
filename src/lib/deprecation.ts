// src/lib/deprecation.ts
// V1 API 폐기(Deprecation) 래퍼 — 응답 헤더로 V2 전환 안내

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface DeprecationOptions {
  v1Route: string;   // 예: '/api/patients'
  v2Route: string;   // 예: '/api/v2/patients'
  sunsetDate?: string; // ISO date (예: '2026-06-01') — 선택
}

type RouteHandler = (
  request: NextRequest,
  context?: any,
) => Promise<NextResponse> | NextResponse;

/**
 * V1 라우트 핸들러를 감싸서 Deprecation 헤더를 추가합니다.
 * - `Deprecation: true`
 * - `X-Deprecated-Use: /api/v2/...`
 * - `Sunset: <date>` (sunsetDate 지정 시)
 * - 호출마다 logger.warn으로 기록
 *
 * 기존 로직은 일절 변경하지 않습니다.
 */
export function withDeprecation(
  handler: RouteHandler,
  opts: DeprecationOptions,
): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    logger.warn('DEPRECATED V1 endpoint accessed', {
      route: opts.v1Route,
      method: request.method,
      v2Alternative: opts.v2Route,
    });

    const response = await handler(request, context);

    // NextResponse 헤더에 deprecation 정보 추가
    response.headers.set('Deprecation', 'true');
    response.headers.set('X-Deprecated-Use', opts.v2Route);
    if (opts.sunsetDate) {
      response.headers.set('Sunset', opts.sunsetDate);
    }

    return response;
  };
}
