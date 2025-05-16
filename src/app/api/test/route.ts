// app/api/test/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: "테스트 API가 활성화되어 있습니다.",
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 로깅
    const requestText = await request.text();
    console.log('테스트 API - 원본 요청 본문:', requestText);
    
    // 요청 파싱 시도
    let body;
    try {
      body = JSON.parse(requestText);
      console.log('테스트 API - 파싱된 요청 본문:', body);
    } catch (error: unknown) {
      const parseError = error instanceof Error ? error : new Error(String(error));
      console.error('테스트 API - JSON 파싱 오류:', parseError);
      
      // 파싱 실패해도 원본 텍스트 반환
      return NextResponse.json({
        success: false,
        message: '요청 파싱 실패',
        error: parseError.message,
        receivedText: requestText
      }, { status: 400 });
    }
    
    // 메시지 타입 확인 로그 (MMS, RCS 등 확인용)
    if (body.messageType) {
      console.log(`테스트 API - 메시지 타입: ${body.messageType}`);
    }
    
    // 이미지 URL 로그 (MMS, RCS 확인용)
    if (body.imageUrl) {
      console.log(`테스트 API - 이미지 URL: ${body.imageUrl}`);
    }
    
    // RCS 옵션 로그 (RCS 확인용)
    if (body.rcsOptions) {
      console.log('테스트 API - RCS 옵션:', body.rcsOptions);
    }
    
    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '요청 수신 완료',
      receivedData: body,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const finalError = error instanceof Error ? error : new Error(String(error));
    console.error('테스트 API - 오류 발생:', finalError);
    
    return NextResponse.json({
      success: false,
      message: '처리 중 오류 발생',
      error: finalError.message
    }, { status: 500 });
  }
}