import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 위젯 및 웹훅 API에 CORS 헤더 추가
  const pathname = request.nextUrl.pathname;

  // CORS가 필요한 경로들
  const corsRoutes = [
    '/widget/',
    '/api/v2/webhooks/',
    '/api/v2/channel-chats/',
  ];

  const needsCors = corsRoutes.some(route => pathname.startsWith(route));

  // OPTIONS 요청 처리 (Preflight)
  if (request.method === 'OPTIONS' && needsCors) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 일반 요청에 CORS 헤더 추가
  const response = NextResponse.next();

  if (needsCors) {
    response.headers.set('Access-Control-Allow-Origin', '*');
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
