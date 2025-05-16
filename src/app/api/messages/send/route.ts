// app/api/messages/send/route.ts
import { NextRequest, NextResponse } from 'next/server';

// CoolSMS API 설정
const COOLSMS_CONFIG = {
  API_KEY: process.env.COOLSMS_API_KEY || '',
  API_SECRET: process.env.COOLSMS_API_SECRET || '',
  SENDER_NUMBER: process.env.COOLSMS_SENDER_NUMBER || '',
};

// CommonJS 방식으로 SDK 가져오기
let messageService: any;
try {
  // @ts-ignore - CommonJS 모듈 로드
  const coolsms = require('coolsms-node-sdk');
  messageService = new coolsms.default(COOLSMS_CONFIG.API_KEY, COOLSMS_CONFIG.API_SECRET);
} catch (error) {
  console.error('CoolSMS SDK 로드 오류:', error);
  // 오류 발생 시 빈 객체로 초기화
  messageService = {
    sendOne: () => Promise.reject(new Error('CoolSMS SDK를 로드할 수 없습니다.'))
  };
}

export async function POST(request: NextRequest) {
  console.log('======= 메시지 발송 API 호출 시작 (SDK 사용) =======');
  console.log('환경 변수 확인:');
  console.log('API_KEY가 있는지:', !!COOLSMS_CONFIG.API_KEY);
  console.log('API_SECRET이 있는지:', !!COOLSMS_CONFIG.API_SECRET);
  console.log('SENDER_NUMBER가 있는지:', !!COOLSMS_CONFIG.SENDER_NUMBER);
  
  try {
    // 요청 본문 로깅
    const requestText = await request.text();
    console.log('원본 요청 본문:', requestText);
    
    // 요청 파싱 (별도 시도)
    let body;
    try {
      body = JSON.parse(requestText);
    } catch (error: unknown) {
      const parseError = error instanceof Error ? error : new Error(String(error));
      console.error('JSON 파싱 오류:', parseError);
      return NextResponse.json(
        { success: false, message: 'JSON 파싱 오류: ' + parseError.message },
        { status: 400 }
      );
    }
    
    console.log('요청 본문 파싱됨:', body);
    
    const { phoneNumber, content, messageType = 'LMS' } = body; // 기본값 LMS로 변경
    
    // 필수 필드 검증
    if (!phoneNumber || !content) {
      console.error('필수 필드 누락:', { phoneNumber, content });
      return NextResponse.json(
        { success: false, message: '전화번호와 내용은 필수입니다.' },
        { status: 400 }
      );
    }
    
    // 메시지 타입 검증
    const validTypes = ['SMS', 'LMS', 'MMS', 'RCS'];
    if (messageType && !validTypes.includes(messageType)) {
      console.error('유효하지 않은 메시지 타입:', messageType);
      return NextResponse.json(
        { success: false, message: '유효하지 않은 메시지 타입입니다. SMS, LMS, MMS, RCS 중 하나여야 합니다.' },
        { status: 400 }
      );
    }
    
    // 환경 변수 검증
    if (!COOLSMS_CONFIG.API_KEY || !COOLSMS_CONFIG.API_SECRET || !COOLSMS_CONFIG.SENDER_NUMBER) {
      console.error('CoolSMS API 설정이 없습니다.');
      return NextResponse.json(
        { success: false, message: 'API 설정이 올바르지 않습니다. .env.local 파일에 COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER_NUMBER를 설정해주세요.' },
        { status: 500 }
      );
    }
    
    // SDK로 메시지 발송
    const messageParams: any = {
      to: phoneNumber,
      from: COOLSMS_CONFIG.SENDER_NUMBER,
      text: content,
      type: messageType
    };
    
    // MMS 또는 RCS인 경우 이미지 처리
    if ((messageType === 'MMS' || messageType === 'RCS') && body.imageUrl) {
      console.log('이미지 URL 처리:', body.imageUrl);
      messageParams.imageUrl = body.imageUrl;
    }
    
    // RCS인 경우 추가 옵션 처리
    if (messageType === 'RCS' && body.rcsOptions) {
      console.log('RCS 옵션 처리:', body.rcsOptions);
      messageParams.rcsOptions = body.rcsOptions;
    }
    
    console.log('CoolSMS SDK 파라미터:', messageParams);
    
    try {
      // 메시지 발송
      console.log('SDK 메시지 발송 시작...');
      
      // 개발 환경에서 모의 응답 - 실제 서버에서는 주석 처리하고 아래 실제 SDK 호출 코드 사용
      const mockResult = {
        messageId: `mock_${Date.now()}`,
        statusCode: '2000',
        statusMessage: '정상 발송 (개발 모드)',
        to: phoneNumber,
        from: COOLSMS_CONFIG.SENDER_NUMBER,
        type: messageType,
        // 로그에 이미지 URL과 메시지 타입 정보 표시 (디버깅용)
        imageProcessed: body.imageUrl ? body.imageUrl : null,
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString()
      };
      console.log('개발 모드 모의 응답:', mockResult);
      
      // 실제 API 호출 코드 (실제 서버에서 주석 해제)
      /*
      let result;
      // 실행 가능한 모든 SDK 메서드 시도
      // 방법 1: sendOne 메서드
      if (typeof messageService.sendOne === 'function') {
        result = await messageService.sendOne(messageParams);
        console.log('sendOne 메서드 사용 성공');
      } 
      // 방법 2: send 메서드
      else if (typeof messageService.send === 'function') {
        result = await messageService.send(messageParams);
        console.log('send 메서드 사용 성공');
      }
      // 방법 3: 하위 message 객체
      else if (messageService.message && typeof messageService.message.send === 'function') {
        result = await messageService.message.send(messageParams);
        console.log('message.send 메서드 사용 성공');
      } 
      else {
        throw new Error('CoolSMS SDK에서 사용 가능한 메시지 발송 메서드를 찾을 수 없습니다.');
      }
      console.log('SDK 메시지 발송 결과:', result);
      */
      
      // 성공 응답 (개발 모드에서는 모의 결과 사용)
      return NextResponse.json({
        success: true,
        data: mockResult, // 실제 환경에서는 result로 교체
        messageId: mockResult.messageId, // 실제 환경에서는 result.messageId || String(Date.now())
        // 추가: 확실한 로그 저장을 위한 필드들
        messageType: messageType,
        imageUrl: body.imageUrl || null,
        content: content.substring(0, 50) + (content.length > 50 ? '...' : ''), // 내용 일부 포함
        timestamp: new Date().toISOString()
      });
    } catch (sdkError: any) {
      console.error('SDK 메시지 발송 오류:', sdkError);
      
      // 메시지 길이 문제인 경우 특별 처리
      if (sdkError.message && sdkError.message.includes('byte')) {
        return NextResponse.json(
          { 
            success: false, 
            message: '메시지 길이가 제한을 초과했습니다. SMS는 90바이트, LMS는 2000바이트까지 가능합니다.', 
            error: sdkError.message,
            details: sdkError
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: sdkError.message || '메시지 발송 실패', 
          error: sdkError.code || '알 수 없는 오류',
          details: sdkError
        },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const finalError = error instanceof Error ? error : new Error(String(error));
    console.error('메시지 발송 중 예외 발생:', finalError);
    
    return NextResponse.json(
      { 
        success: false, 
        message: finalError.message || '알 수 없는 오류가 발생했습니다.',
        stack: finalError.stack 
      },
      { status: 500 }
    );
  } finally {
    console.log('======= 메시지 발송 API 호출 종료 (SDK 사용) =======');
  }
}

// 테스트용 GET 핸들러 추가
export async function GET() {
  return NextResponse.json({
    message: "CoolSMS SDK가 활성화된 메시지 발송 API입니다. POST 요청을 통해 사용하세요.",
    env_check: {
      api_key_exists: !!COOLSMS_CONFIG.API_KEY,
      api_secret_exists: !!COOLSMS_CONFIG.API_SECRET,
      sender_exists: !!COOLSMS_CONFIG.SENDER_NUMBER,
    },
    sdk_loaded: !!messageService
  });
}