// src/app/r/[date]/route.ts
// SMS용 짧은 URL 리다이렉트: /r/{date} → /v2/reports/mobile/{date}
// SMS/LMS 줄바꿈으로 인한 URL 잘림 방지를 위해 사용

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  const { date } = params;

  // 날짜 형식 검증 (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.redirect(new URL('/v2/reports', request.url));
  }

  return NextResponse.redirect(new URL(`/v2/reports/mobile/${date}`, request.url));
}
