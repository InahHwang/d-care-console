// src/lib/socketServer.ts
import { Server } from 'socket.io';

declare global {
  // eslint-disable-next-line no-var
  var _io: Server | undefined;
  var _ioPort: number | undefined;
}

export function getIO(): Server {
  if (!global._io) {
    const port = Number(process.env.SOCKET_IO_PORT || 3002);

    const io = new Server(port, {
      cors: {
        origin: [
          process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000',
          'http://localhost:3001',
        ],
        methods: ['GET', 'POST'],
      },
      transports: ['websocket'],
    });

    io.on('connection', (socket) => {
      console.log('✅ Socket.IO 연결:', socket.id);

      socket.on('join-cti-session', (data: { userId: string; role?: string }) => {
        const { userId, role = 'operator' } = data || { userId: 'unknown' };
        const roomName = `cti-${userId}`;
        socket.join(roomName);
        socket.emit('cti-session-joined', { success: true, userId, roomName, ts: Date.now() });
        console.log(`👥 세션 참가: ${userId}(${role}) → ${roomName}`);
      });

      socket.on('send-cti-command', (payload) => {
        // 필요시 백엔드 연동. 일단 브로드캐스트만 유지
        io.emit('cti-command-sent', payload);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Socket 해제:', socket.id, reason);
      });
    });

    global._io = io;
    global._ioPort = port;
    console.log(`[Socket.IO] started on :${port}`);
  }
  return global._io!;
}
