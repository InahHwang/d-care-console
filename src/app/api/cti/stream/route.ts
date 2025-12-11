// src/app/api/cti/stream/route.ts
// SSE(Server-Sent Events) 엔드포인트 - 브라우저에서 실시간 CTI 이벤트 수신

import { NextRequest } from 'next/server';
import { getCTIEventStore } from '@/lib/ctiEventStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[CTI SSE] 새 클라이언트 연결 시도: ${clientId}`);

  const stream = new ReadableStream({
    start(controller) {
      const store = getCTIEventStore();
      const encoder = new TextEncoder();

      // 클라이언트 등록
      store.addClient(clientId, controller);

      // 연결 확인 메시지 전송
      const connectMessage = `data: ${JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
        message: 'SSE 연결 성공',
      })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // 최근 이벤트 전송 (새 연결 시 최근 이벤트 제공)
      const recentEvents = store.getRecentEvents(5);
      if (recentEvents.length > 0) {
        const historyMessage = `data: ${JSON.stringify({
          type: 'history',
          events: recentEvents,
        })}\n\n`;
        controller.enqueue(encoder.encode(historyMessage));
      }

      // Heartbeat (30초마다)
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          })}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // 연결 종료 시 클린업
      request.signal.addEventListener('abort', () => {
        console.log(`[CTI SSE] 클라이언트 연결 종료: ${clientId}`);
        clearInterval(heartbeatInterval);
        store.removeClient(clientId);
        try {
          controller.close();
        } catch {
          // 이미 닫힌 경우 무시
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
