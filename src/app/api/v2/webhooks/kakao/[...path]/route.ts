// 비즈고 웹훅 디버그용 catch-all 핸들러
// 비즈고가 예상과 다른 경로로 웹훅을 보낼 경우 로그를 남김
// 정상 연동 확인 후 제거할 것

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const fullPath = `/api/v2/webhooks/kakao/${path.join('/')}`;

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = '[JSON 파싱 실패]';
  }

  const logEntry = {
    type: 'bizgo_webhook_debug',
    path: fullPath,
    method: 'POST',
    headers: {
      contentType: request.headers.get('content-type'),
      accept: request.headers.get('accept'),
      userAgent: request.headers.get('user-agent'),
    },
    body,
    receivedAt: new Date(),
  };

  console.log('[비즈고 웹훅 디버그] 예상 외 경로 수신:', JSON.stringify(logEntry, null, 2));

  // DB에도 로그 저장 (Vercel 로그가 휘발성이므로)
  try {
    const { db } = await connectToDatabase();
    await db.collection('webhook_debug_logs').insertOne(logEntry);
  } catch (err) {
    console.error('[비즈고 웹훅 디버그] DB 저장 실패:', err);
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return NextResponse.json({
    status: 'ok',
    debug: true,
    path: `/api/v2/webhooks/kakao/${path.join('/')}`,
    timestamp: new Date().toISOString(),
  });
}
