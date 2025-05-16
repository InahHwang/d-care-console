// app/api/messages/log/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: { json: () => any; }) {
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
    
    // 로그 기록 (콘솔에만 출력)
    console.log('메시지 발송 로그:', {
      timestamp: new Date().toISOString(),
      template,
      category,
      totalCount,
      successCount,
      failedCount,
      messageType
    });
    
    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '로그 저장됨 (콘솔 확인)',
    });
  } catch (error) {
    console.error('메시지 로그 저장 중 오류 발생:', error);
    
    // 오류 응답
    return NextResponse.json(
      { 
        success: true,  // 메시지 발송 자체는 성공으로 처리
        logSaved: false,
        message: '로그 저장 실패',
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      }
    );
  }
}