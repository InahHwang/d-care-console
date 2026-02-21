import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 허용된 Origin 목록 (환경변수에서 로드)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

function getCorsOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  // Origin이 없는 경우 (서버-서버 호출) 또는 허용되지 않은 경우
  return ALLOWED_ORIGINS[0];
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // CORS가 필요한 경로들
  const corsRoutes = [
    '/widget/',
    '/api/v2/webhooks/',
    '/api/v2/channel-chats/',
  ];

  const needsCors = corsRoutes.some(route => pathname.startsWith(route));
  const corsOrigin = getCorsOrigin(request);

  // OPTIONS 요청 처리 (Preflight)
  if (request.method === 'OPTIONS' && needsCors) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 일반 요청에 CORS 헤더 추가
  const response = NextResponse.next();

  if (needsCors) {
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}

export const config = {
  matcher: [
    '/widget/:path*',
    '/api/v2/webhooks/:path*',
    '/api/v2/channel-chats/:path*',
  ],
};
