// app/api/messages/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp'; // 이미지 처리용 라이브러리

// 메시지 타입을 바이트 크기에 따라 결정하는 함수 (한글 고려)
function getMessageType(text: string): string {
  // 한글은 3바이트, 영문/숫자/기호는 1바이트로 계산
  let byteLength = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (char.match(/[가-힣]/)) {
      byteLength += 3; // 한글
    } else {
      byteLength += 1; // 영문/숫자/기호
    }
  }
  
  console.log(`📏 메시지 길이: ${text.length}글자, ${byteLength}바이트`);
  
  if (byteLength <= 90) {
    return 'SMS';
  } else if (byteLength <= 2000) {
    return 'LMS';
  } else {
    return 'LMS'; // 2000바이트 초과해도 LMS로
  }
}

// 이미지를 MMS 조건에 맞게 최적화
async function optimizeImageForMMS(imagePath: string): Promise<{ success: boolean; newPath?: string; error?: string }> {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    console.log('📊 원본 이미지 정보:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: fs.statSync(imagePath).size
    });

    // JPG가 아니면 변환
    let needsProcessing = false;
    let processedImage = image;

    if (metadata.format !== 'jpeg') {
      console.log('🔄 JPG로 포맷 변환');
      processedImage = processedImage.jpeg({ quality: 85 });
      needsProcessing = true;
    }

    // 크기 조정이 필요한지 확인
    if (metadata.width! > 1500 || metadata.height! > 1440) {
      console.log('🔄 이미지 크기 조정');
      processedImage = processedImage.resize(1500, 1440, {
        fit: 'inside',
        withoutEnlargement: true
      });
      needsProcessing = true;
    }

    // 파일 크기가 200KB를 초과하는 경우 품질 조정
    let quality = 85;
    let tempPath = imagePath;
    
    if (needsProcessing || fs.statSync(imagePath).size > 200 * 1024) {
      const dir = path.dirname(imagePath);
      const ext = path.extname(imagePath);
      const basename = path.basename(imagePath, ext);
      tempPath = path.join(dir, `${basename}_optimized.jpg`);
      
      while (quality > 20) {
        await processedImage.jpeg({ quality }).toFile(tempPath);
        const fileSize = fs.statSync(tempPath).size;
        
        console.log(`🔍 품질 ${quality}%로 압축: ${(fileSize / 1024).toFixed(2)}KB`);
        
        if (fileSize <= 200 * 1024) {
          break;
        }
        
        quality -= 10;
        processedImage = sharp(imagePath).resize(1500, 1440, {
          fit: 'inside',
          withoutEnlargement: true
        }).jpeg({ quality });
      }
      
      if (fs.statSync(tempPath).size > 200 * 1024) {
        return { 
          success: false, 
          error: '이미지를 200KB 이하로 압축할 수 없습니다.' 
        };
      }
    }

    return { success: true, newPath: tempPath };
  } catch (error: any) {
    console.error('이미지 최적화 실패:', error.message);
    return { success: false, error: error.message };
  }
}

// CoolSMS SDK 임포트
let coolsmsService: any = null;
let sdkImportError: string | null = null;

try {
  coolsmsService = require('coolsms-node-sdk').default;
  console.log('✅ CoolSMS SDK 임포트 성공');
} catch (error: any) {
  sdkImportError = error.message;
  console.error('❌ CoolSMS SDK 임포트 실패:', error.message);
}

// CoolSMS API 설정
const COOLSMS_CONFIG = {
  API_KEY: process.env.COOLSMS_API_KEY || '',
  API_SECRET: process.env.COOLSMS_API_SECRET || '',
  SENDER_NUMBER: process.env.COOLSMS_SENDER_NUMBER || '',
};

export async function POST(request: NextRequest) {
  console.log('======= 메시지 발송 API 시작 =======');
  
  try {
    // SDK 임포트 상태 확인
    if (sdkImportError) {
      console.error('SDK 임포트 에러:', sdkImportError);
      return NextResponse.json(
        { success: false, message: `SDK 임포트 실패: ${sdkImportError}` },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log('📥 요청 본문:', body);
    
    const { phoneNumber, content, messageType, imageUrl } = body;
    
    // 필수 필드 검증
    if (!phoneNumber || !content) {
      return NextResponse.json(
        { success: false, message: '전화번호와 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // 환경변수 확인
    if (!COOLSMS_CONFIG.API_KEY || !COOLSMS_CONFIG.API_SECRET || !COOLSMS_CONFIG.SENDER_NUMBER) {
      return NextResponse.json(
        { success: false, message: 'CoolSMS 설정이 올바르지 않습니다.' },
        { status: 500 }
      );
    }

    // 내용 길이 확인 (2000바이트 제한)
    let contentByteLength = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charAt(i);
      if (char.match(/[가-힣]/)) {
        contentByteLength += 3;
      } else {
        contentByteLength += 1;
      }
    }

    if (contentByteLength > 2000) {
      return NextResponse.json(
        { success: false, message: '메시지 내용이 2000바이트를 초과합니다.' },
        { status: 400 }
      );
    }

    // CoolSMS 서비스 초기화
    const messageService = new coolsmsService(COOLSMS_CONFIG.API_KEY, COOLSMS_CONFIG.API_SECRET);
    console.log('✅ CoolSMS 서비스 초기화 성공');

    // 메시지 타입 결정
    let actualMessageType = getMessageType(content);
    
    // MMS 요청이고 이미지가 있으면 MMS로 처리
    if (messageType === 'MMS' && imageUrl) {
      console.log('🖼️ MMS 요청 - 이미지 처리 시작');
      actualMessageType = 'MMS';
    }

    const messageOptions: any = {
      to: phoneNumber,
      from: COOLSMS_CONFIG.SENDER_NUMBER,
      text: content,
      type: actualMessageType
    };

    // MMS 이미지 처리 - 제목 없이 발송
    if (actualMessageType === 'MMS' && imageUrl) {
      const imagePath = path.join(process.cwd(), 'public', imageUrl);
      console.log('📁 이미지 파일 경로:', imagePath);
      
      if (fs.existsSync(imagePath)) {
        console.log('✅ 이미지 파일 존재 확인');
        
        // 이미지 최적화
        const optimizationResult = await optimizeImageForMMS(imagePath);
        
        if (!optimizationResult.success) {
          console.log('❌ 이미지 최적화 실패, LMS로 대체:', optimizationResult.error);
          actualMessageType = 'LMS';
          messageOptions.type = 'LMS';
          messageOptions.text = content + '\n\n※ 이미지는 별도로 확인해주세요.';
        } else {
          const finalImagePath = optimizationResult.newPath!;
          const finalStats = fs.statSync(finalImagePath);
          
          console.log(`✅ 이미지 최적화 완료: ${(finalStats.size / 1024).toFixed(1)}KB`);
          
          try {
            // CoolSMS 공식 방식: uploadFile 메서드 사용
            console.log('🔄 MMS 발송 시도 - CoolSMS 공식 방식');
            
            const imageId = await messageService.uploadFile(finalImagePath, "MMS")
              .then((res: { fileId: any; }) => res.fileId);
            
            console.log('✅ 이미지 업로드 성공, imageId:', imageId);
            
            // MMS 옵션 설정 - 제목 없음, imageId 사용
            messageOptions.imageId = imageId;
            delete messageOptions.subject; // 제목 제거
            
            console.log('📤 MMS 발송 옵션 (공식 방식):', {
              type: messageOptions.type,
              imageId: messageOptions.imageId,
              hasSubject: !!messageOptions.subject
            });
            
          } catch (uploadError: any) {
            console.log('❌ 공식 uploadFile 실패:', uploadError.message);
            console.log('🔄 LMS로 대체 발송');
            
            actualMessageType = 'LMS';
            messageOptions.type = 'LMS';
            messageOptions.text = content + '\n\n※ 이미지는 별도로 확인해주세요.';
            
            // MMS 관련 필드 정리
            delete messageOptions.imageId;
            delete messageOptions.subject;
          }
          
          // 임시 파일 정리
          if (finalImagePath.includes('_optimized.jpg')) {
            try {
              fs.unlinkSync(finalImagePath);
              console.log('🗑️ 임시 최적화 파일 삭제');
            } catch (e) {
              console.log('⚠️ 임시 파일 삭제 실패');
            }
          }
        }
      } else {
        console.log('❌ 이미지 파일 없음, LMS로 대체');
        actualMessageType = 'LMS';
        messageOptions.type = 'LMS';
      }
    }

    console.log('📤 최종 발송 옵션:', {
      to: messageOptions.to,
      from: messageOptions.from,
      type: messageOptions.type,
      textLength: messageOptions.text.length,
      hasImageId: !!messageOptions.imageId,
      hasSubject: !!messageOptions.subject
    });

    // 메시지 발송 - sendOne 메서드 사용
    console.log(`📨 ${actualMessageType} 발송 시작...`);
    const result = await messageService.sendOne(messageOptions);
    console.log('✅ 메시지 발송 성공!', result);
    
    // 성공 응답
    return NextResponse.json({
      success: true,
      data: result,
      messageId: result.groupId || result.messageId || String(Date.now()),
      timestamp: new Date().toISOString(),
      actualType: actualMessageType,
      note: messageType === 'MMS' && actualMessageType !== 'MMS' ? 
        `MMS 요청이었지만 ${actualMessageType}로 발송됨` : 
        `${actualMessageType}로 정상 발송`
    });

  } catch (error: any) {
    console.error('💥 메시지 발송 실패:', error);
    console.error('에러 상세:', error.message);
    console.error('스택:', error.stack);
    
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || '메시지 발송 실패',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  } finally {
    console.log('======= 메시지 발송 API 종료 =======');
  }
}

// GET 핸들러
export async function GET() {
  return NextResponse.json({
    message: "CoolSMS 메시지 발송 API",
    status: "ready",
    supports: ["SMS", "LMS", "MMS"],
    mmsRequirements: {
      format: "JPG only",
      maxSize: "200KB",
      maxWidth: "1500px",
      maxHeight: "1440px",
      maxSubject: "40 characters",
      maxContent: "2000 bytes (Korean ~1000 chars)"
    },
    note: "MMS 발송 실패 시 자동으로 LMS로 대체됩니다."
  });
}