// src/app/api/socket/route.ts (수정된 버전)
import { NextRequest, NextResponse } from 'next/server';
import { Server as ServerIO } from 'socket.io';
import { createServer } from 'http';

export async function GET(req: NextRequest) {
  console.log('Socket.IO 초기화 요청 받음');

  // 이미 실행 중인지 확인
  if ((global as any).io) {
    console.log('Socket.IO 서버가 이미 실행 중입니다.');
    return NextResponse.json({ 
      message: 'Socket.IO server already running', 
      status: 'active',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // 별도의 HTTP 서버 생성 (Next.js와 독립적으로)
    const httpServer = createServer();
    const port = 3002; // Socket.IO 전용 포트

    // Socket.IO 서버 초기화
    const io = new ServerIO(httpServer, {
      cors: {
        origin: "http://localhost:3001",
        methods: ["GET", "POST"]
      }
    });

    // 전역에 저장
    (global as any).io = io;
    (global as any).httpServer = httpServer;

    // 클라이언트 연결 처리
    io.on('connection', (socket) => {
      console.log('═══════════════════════════════════════');
      console.log(`[Socket.IO] 클라이언트 연결됨: ${socket.id}`);
      console.log(`[Socket.IO] 현재 연결된 클라이언트 수: ${io.sockets.sockets.size}`);
      console.log('═══════════════════════════════════════');

      // CTI 세션 참가
      socket.on('join-cti-session', (data: { userId: string; role?: string }) => {
        const { userId, role = 'operator' } = data;
        const roomName = `cti-${userId}`;
        
        socket.join(roomName);
        console.log(`[Socket.IO] 사용자 ${userId}(${role})가 CTI 세션에 참가했습니다.`);
        console.log(`[Socket.IO] Room: ${roomName}`);
        
        socket.emit('cti-session-joined', {
          success: true,
          userId,
          roomName,
          timestamp: new Date().toISOString()
        });
      });

      // cti-event 수신 확인 (서버에서 브로드캐스트할 때 로그)
      socket.onAny((eventName, ...args) => {
        if (eventName === 'cti-event') {
          console.log(`[Socket.IO] 클라이언트 ${socket.id}에게 cti-event 전송됨`);
          console.log(`[Socket.IO] 이벤트 데이터:`, JSON.stringify(args[0], null, 2));
        }
      });

      // CTI 명령 처리
      socket.on('send-cti-command', async (data: {
        command: string;
        userId: string;
        params?: any;
      }) => {
        const { command, userId, params } = data;
        
        try {
          const response = await fetch('http://localhost:3001/api/cti/commands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, userId, params, timestamp: new Date().toISOString() })
          });

          if (response.ok) {
            const result = await response.json();
            socket.emit('cti-command-sent', {
              success: true,
              command,
              result,
              timestamp: new Date().toISOString()
            });
          } else {
            throw new Error(`명령 전송 실패: ${response.statusText}`);
          }
        } catch (error) {
          console.error('CTI 명령 전송 오류:', error);
          socket.emit('cti-command-error', {
            success: false,
            command,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
            timestamp: new Date().toISOString()
          });
        }
      });

      // 연결 상태 확인
      socket.on('ping', () => {
        socket.emit('pong', {
          timestamp: new Date().toISOString(),
          socketId: socket.id
        });
      });

      socket.on('disconnect', (reason) => {
        console.log('═══════════════════════════════════════');
        console.log(`[Socket.IO] 클라이언트 연결 해제: ${socket.id}`);
        console.log(`[Socket.IO] 이유: ${reason}`);
        console.log(`[Socket.IO] 현재 연결된 클라이언트 수: ${io.sockets.sockets.size}`);
        console.log('═══════════════════════════════════════');
      });
    });

    // 서버에서 브로드캐스트할 때 호출되는 함수 (global.io.emit 호출 시)
    // 이 부분은 직접 호출되지 않고, incoming-call API에서 global.io.emit을 호출할 때 실행됩니다

    // HTTP 서버 시작
    httpServer.listen(port, () => {
      console.log('═══════════════════════════════════════');
      console.log(`[Socket.IO] 서버가 포트 ${port}에서 시작되었습니다.`);
      console.log(`[Socket.IO] Socket.IO 서버 URL: http://localhost:${port}`);
      console.log(`[Socket.IO] CORS 설정: http://localhost:3001`);
      console.log('═══════════════════════════════════════');
    });

    return NextResponse.json({ 
      message: 'Socket.IO server started successfully', 
      status: 'started',
      port: port,
      socketUrl: `http://localhost:${port}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Socket.IO 서버 시작 오류:', error);
    return NextResponse.json({ 
      error: 'Failed to start Socket.IO server',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 서버 종료 처리
export async function DELETE() {
  try {
    const httpServer = (global as any).httpServer;
    const io = (global as any).io;

    if (io) {
      io.close();
      delete (global as any).io;
    }

    if (httpServer) {
      httpServer.close();
      delete (global as any).httpServer;
    }

    return NextResponse.json({ 
      message: 'Socket.IO server stopped successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Socket.IO 서버 종료 오류:', error);
    return NextResponse.json({ 
      error: 'Failed to stop Socket.IO server',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}