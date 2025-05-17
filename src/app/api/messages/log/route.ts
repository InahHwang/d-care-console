// app/api/messages/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const logs = await db.collection('messageLogs').find({}).toArray();
    
    return NextResponse.json({ 
      success: true, 
      data: logs 
    });
  } catch (error) {
    console.error('메시지 로그 조회 중 오류 발생:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '로그 조회 실패',
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 요청 데이터 파싱
    const body = await request.json();
    const { 
      template, 
      category, 
      totalCount, 
      successCount, 
      failedCount, 
      messageType 
    } = body;
    
    // 로그 객체 생성
    const logEntry = {
      timestamp: new Date(),
      template,
      category,
      totalCount,
      successCount,
      failedCount,
      messageType
    };
    
    // 콘솔에 로그 출력 (개발용)
    console.log('메시지 발송 로그:', logEntry);
    
    // MongoDB에 저장
    const { db } = await connectToDatabase();
    const result = await db.collection('messageLogs').insertOne(logEntry);
    
    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '로그가 데이터베이스에 저장되었습니다.',
      logId: result.insertedId
    });
  } catch (error) {
    console.error('메시지 로그 저장 중 오류 발생:', error);
    
    // 오류 응답
    return NextResponse.json(
      { 
        success: false,
        message: '로그 저장 실패',
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}