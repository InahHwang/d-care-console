// src/app/api/cti/commands/route.ts (수정된 버전)
import { NextRequest, NextResponse } from 'next/server';

interface CTICommand {
  action?: string;  // 기존 형식
  command?: string; // Socket.IO 형식
  phoneNumber?: string;
  recordEnabled?: boolean;
  parameters?: any;
  userId?: string;
  params?: any;
  timestamp?: string;
}

// 간단한 메모리 기반 명령 큐
let commandQueue: (CTICommand & { id: number; timestamp: string })[] = [];
let commandIdCounter = 1;

// C# 브리지가 명령을 요청하는 API (폴링 방식)
export async function GET(request: NextRequest) {
  try {
    console.log(`[CTI Command] 명령 조회 요청, 대기 중인 명령: ${commandQueue.length}개`);
    
    // 대기 중인 명령이 있는지 확인
    if (commandQueue.length > 0) {
      // 모든 명령을 배열로 반환하고 큐 비우기
      const commands = [...commandQueue];
      commandQueue = [];
      
      console.log('[CTI Command] 브리지로 전송:', commands);
      return NextResponse.json(commands);
    }
    
    // 대기 중인 명령이 없으면 빈 배열 반환 (C# 브리지 호환)
    return NextResponse.json([]);
  } catch (error) {
    console.error('[CTI Command] 조회 오류:', error);
    return NextResponse.json([]);
  }
}

// Socket.IO와 프론트엔드에서 CTI 명령을 추가하는 API
export async function POST(request: NextRequest) {
  try {
    const commandData: CTICommand = await request.json();
    console.log('[CTI Command] 받은 명령 데이터:', commandData);
    
    // Socket.IO 형식을 기존 형식으로 변환
    let normalizedCommand: CTICommand = {};
    
    if (commandData.command) {
      // Socket.IO 형식 -> 기존 형식 변환
      normalizedCommand.action = commandData.command;
      normalizedCommand.userId = commandData.userId;
      
      // 특정 명령에 따른 파라미터 처리
      if (commandData.command === 'START_CALL' && commandData.params?.phoneNumber) {
        normalizedCommand.phoneNumber = commandData.params.phoneNumber;
        normalizedCommand.recordEnabled = true;
      }
      
      normalizedCommand.parameters = commandData.params;
    } else {
      // 기존 형식 그대로 사용
      normalizedCommand = commandData;
    }
    
    // 명령 검증
    if (!normalizedCommand.action) {
      return NextResponse.json(
        { success: false, message: 'action 또는 command 필드가 필요합니다' },
        { status: 400 }
      );
    }

    // 명령을 큐에 추가
    const commandWithId = {
      id: commandIdCounter++,
      ...normalizedCommand,
      timestamp: commandData.timestamp || new Date().toISOString()
    };
    
    commandQueue.push(commandWithId);
    
    console.log('[CTI Command] 큐에 추가됨:', commandWithId);
    console.log(`[CTI Command] 현재 큐 길이: ${commandQueue.length}`);
    
    // 활동 로그 저장
    await logCommandActivity(commandWithId);
    
    return NextResponse.json({ 
      success: true, 
      message: '명령이 큐에 추가됨',
      commandId: commandWithId.id,
      queueLength: commandQueue.length
    });
  } catch (error) {
    console.error('[CTI Command] 추가 오류:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// 현재 큐 상태 확인용 API
export async function PUT(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'status') {
      return NextResponse.json({
        queueLength: commandQueue.length,
        pendingCommands: commandQueue.map(cmd => ({
          id: cmd.id,
          action: cmd.action || cmd.command,
          phoneNumber: cmd.phoneNumber,
          timestamp: cmd.timestamp,
          userId: cmd.userId
        }))
      });
    }
    
    if (action === 'clear') {
      const clearedCount = commandQueue.length;
      commandQueue = [];
      console.log(`[CTI Command] 큐 초기화됨: ${clearedCount}개 명령 제거`);
      return NextResponse.json({
        success: true,
        message: `${clearedCount}개 명령이 삭제됨`
      });
    }
    
    return NextResponse.json(
      { success: false, message: '지원하지 않는 액션입니다' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[CTI Command] 상태 조회 오류:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// 명령 활동 로그 저장
async function logCommandActivity(command: CTICommand & { id: number; timestamp: string }) {
  try {
    const { connectToDatabase } = await import('@/utils/mongodb');
    const { db } = await connectToDatabase();
    
    await db.collection('activity_logs').insertOne({
      targetType: 'CTI_Command',
      action: 'command_queued',
      details: {
        commandId: command.id,
        action: command.action || command.command,
        phoneNumber: command.phoneNumber,
        recordEnabled: command.recordEnabled,
        userId: command.userId,
        timestamp: command.timestamp
      },
      createdAt: new Date()
    });
    
    console.log('[CTI Command] 활동 로그 저장:', command.action || command.command);
  } catch (error) {
    console.error('[CTI Command] 활동 로그 저장 오류:', error);
  }
}