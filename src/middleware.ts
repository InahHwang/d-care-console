// middleware.ts 또는 src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 허용된 IP 주소 목록
const ALLOWED_IPS = ['58.234.9.25', '1.240.2.4']; // 여기에 실제 허용할 IP 주소 입력

export function middleware(request: NextRequest) {
  // 클라이언트 IP 가져오기
  const clientIp = request.ip || request.headers.get('x-real-ip');
  
  // x-forwarded-for 헤더에서 IP 추출 (프록시 환경에서 사용)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0].trim() : null;
  
  // IP 주소 결정 (우선순위: x-real-ip > x-forwarded-for 첫 번째 IP)
  const ip = clientIp || forwardedIp;
  
  console.log(`접속 IP: ${ip}`);
  
  // IP가 허용 목록에 있는지 확인
  if (!ip || !ALLOWED_IPS.includes(ip)) {
    // 접근 거부 페이지로 리다이렉트 또는 403 Forbidden 응답 반환
    return new NextResponse('Access Denied', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
  
  // 접근 허용
  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};