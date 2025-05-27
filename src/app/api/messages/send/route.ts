// src/app/api/messages/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp'; // 이미지 처리용 라이브러리

// Vercel 환경 감지
const isVercel = process.env.VERCEL === '1';

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

// 이미지를 MMS 조건에 맞게 최적화 (Vercel 호환)
async function optimizeImageForMMS(imageInput: string | Buffer): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    let imageBuffer: Buffer;
    
    if (isVercel) {
      // Vercel 환경: Base64 데이터 처리
      if (typeof imageInput === 'string' && imageInput.startsWith('data:image')) {
        const base64Data = imageInput.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log('📱 Vercel 환경: Base64 이미지 처리');
      } else {
        throw new Error('Vercel 환경에서는 Base64 이미지만 지원됩니다.');
      }
    } else {
      // 로컬 환경: 파일 경로 처리
      if (typeof imageInput === 'string') {
        if (!fs.existsSync(imageInput)) {
          throw new Error('이미지 파일이 존재하지 않습니다.');
        }
        imageBuffer = fs.readFileSync(imageInput);
        console.log('🏠 로컬 환경: 파일 시스템에서 이미지 로드');
      } else {
        imageBuffer = imageInput;
      }
    }

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    console.log('📊 원본 이미지 정보:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: imageBuffer.length
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
    let finalBuffer: Buffer = imageBuffer; // 기본값 설정
    
    if (needsProcessing || imageBuffer.length > 200 * 1024) {
      while (quality > 20) {
        finalBuffer = await processedImage.jpeg({ quality }).toBuffer();
        
        console.log(`🔍 품질 ${quality}%로 압축: ${(finalBuffer.length / 1024).toFixed(2)}KB`);
        
        if (finalBuffer.length <= 200 * 1024) {
          break;
        }
        
        quality -= 10;
        processedImage = sharp(imageBuffer).resize(1500, 1440, {
          fit: 'inside',
          withoutEnlargement: true
        }).jpeg({ quality });
      }
      
      if (finalBuffer.length > 200 * 1024) {
        return { 
          success: false, 
          error: '이미지를 200KB 이하로 압축할 수 없습니다.' 
        };
      }
    } else {
      finalBuffer = await processedImage.toBuffer();
    }

    return { success: true, buffer: finalBuffer };
  } catch (error: any) {
    console.error('이미지 최적화 실패:', error.message);
    return { success: false, error: error.message };
  }
}

// CoolSMS SDK 임포트
let coolsmsService: any = null;
let sdkImportError: string | null = null;

try {
  // Vercel 환경에서 더 안전한 임포트 방식
  if (isVercel) {
    const coolsmsModule = require('coolsms-node-sdk');
    coolsmsService = coolsmsModule.default || coolsmsModule;
  } else {
    coolsmsService = require('coolsms-node-sdk').default;
  }
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
  console.log('🌍 환경:', isVercel ? 'Vercel (Serverless)' : 'Local Development');
  
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
    
    // 요청 형태 확인 (단일 vs 다중)
    let patients: any[] = [];
    let content = '';
    let messageType = '';
    let imageUrl = '';
    
    if (body.patients && Array.isArray(body.patients)) {
      // 다중 발송 요청
      patients = body.patients;
      content = body.content || '';
      messageType = body.messageType || 'SMS';
      imageUrl = body.imageUrl || '';
    } else {
      // 단일 발송 요청 (기존 형태)
      patients = [{
        id: body.patientId || 'single',
        name: body.patientName || '고객',
        phoneNumber: body.phoneNumber
      }];
      content = body.content || '';
      messageType = body.messageType || 'SMS';
      imageUrl = body.imageUrl || '';
    }
    
    // 필수 필드 검증
    if (patients.length === 0 || !patients[0].phoneNumber || !content) {
      return NextResponse.json(
        { success: false, message: '전화번호와 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // 환경변수 확인
    console.log('🔑 환경 변수 확인:', {
      apiKey: COOLSMS_CONFIG.API_KEY ? '설정됨' : '없음',
      apiSecret: COOLSMS_CONFIG.API_SECRET ? '설정됨' : '없음',
      sender: COOLSMS_CONFIG.SENDER_NUMBER ? '설정됨' : '없음'
    });
    
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

    // 각 환자별로 발송 처리
    const results = [];
    
    for (const patient of patients) {
      const messageOptions: any = {
        to: patient.phoneNumber,
        from: COOLSMS_CONFIG.SENDER_NUMBER,
        text: content.replace(/\[환자명\]/g, patient.name || '고객'),
        type: actualMessageType
      };

      let patientResult = {
        patientId: patient.id,
        patientName: patient.name,
        phoneNumber: patient.phoneNumber,
        success: false,
        error: '',
        actualType: actualMessageType
      };

      try {
        // MMS 이미지 처리
        if (actualMessageType === 'MMS' && imageUrl) {
          console.log(`📁 [${patient.name}] 이미지 처리 시작`);
          
          let imageProcessResult;
          
          if (isVercel) {
            // Vercel: Base64 이미지 처리
            imageProcessResult = await optimizeImageForMMS(imageUrl);
          } else {
            // 로컬: 파일 경로 처리
            const imagePath = path.join(process.cwd(), 'public', imageUrl);
            imageProcessResult = await optimizeImageForMMS(imagePath);
          }
          
          if (!imageProcessResult.success) {
            console.log(`❌ [${patient.name}] 이미지 최적화 실패, LMS로 대체:`, imageProcessResult.error);
            actualMessageType = 'LMS';
            messageOptions.type = 'LMS';
            messageOptions.text += '\n\n※ 이미지는 별도로 확인해주세요.';
            patientResult.actualType = 'LMS';
          } else {
            console.log(`✅ [${patient.name}] 이미지 최적화 완료: ${(imageProcessResult.buffer!.length / 1024).toFixed(1)}KB`);
            
            try {
              // Vercel 환경에서는 Buffer를 임시 파일로 저장 후 업로드
              let tempFilePath = '';
              
              if (isVercel) {
                // 임시 파일 생성 (Vercel /tmp 디렉토리 사용)
                tempFilePath = `/tmp/temp_${Date.now()}.jpg`;
                fs.writeFileSync(tempFilePath, imageProcessResult.buffer!);
              } else {
                // 로컬에서는 최적화된 이미지 경로 사용
                tempFilePath = path.join(process.cwd(), 'public/uploads', `temp_${Date.now()}.jpg`);
                fs.writeFileSync(tempFilePath, imageProcessResult.buffer!);
              }
              
              // CoolSMS 이미지 업로드
              console.log(`🔄 [${patient.name}] MMS 이미지 업로드 시도`);
              const imageId = await messageService.uploadFile(tempFilePath, "MMS")
                .then((res: { fileId: any; }) => res.fileId);
              
              console.log(`✅ [${patient.name}] 이미지 업로드 성공, imageId:`, imageId);
              
              // MMS 옵션 설정
              messageOptions.imageId = imageId;
              delete messageOptions.subject;
              
              // 임시 파일 정리
              try {
                fs.unlinkSync(tempFilePath);
                console.log(`🗑️ [${patient.name}] 임시 파일 삭제`);
              } catch (e) {
                console.log(`⚠️ [${patient.name}] 임시 파일 삭제 실패`);
              }
              
            } catch (uploadError: any) {
              console.log(`❌ [${patient.name}] 이미지 업로드 실패:`, uploadError.message);
              console.log(`🔄 [${patient.name}] LMS로 대체 발송`);
              
              actualMessageType = 'LMS';
              messageOptions.type = 'LMS';
              messageOptions.text += '\n\n※ 이미지는 별도로 확인해주세요.';
              
              delete messageOptions.imageId;
              delete messageOptions.subject;
              patientResult.actualType = 'LMS';
            }
          }
        }

        console.log(`📤 [${patient.name}] 최종 발송 옵션:`, {
          to: messageOptions.to,
          from: messageOptions.from,
          type: messageOptions.type,
          textLength: messageOptions.text.length,
          hasImageId: !!messageOptions.imageId
        });

        // 메시지 발송
        console.log(`📨 [${patient.name}] ${messageOptions.type} 발송 시작...`);
        const result = await messageService.sendOne(messageOptions);
        console.log(`✅ [${patient.name}] 메시지 발송 성공!`, result);
        
        patientResult.success = true;
        patientResult.actualType = messageOptions.type;
        
      } catch (error: any) {
        console.error(`💥 [${patient.name}] 메시지 발송 실패:`, error.message);
        patientResult.success = false;
        patientResult.error = error.message;
      }
      
      results.push(patientResult);
    }

    // 성공/실패 카운트
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    console.log(`📊 발송 결과: 성공 ${successCount}건, 실패 ${failCount}건`);
    
    // 응답 (기존 형태와 호환)
    if (patients.length === 1) {
      // 단일 발송 응답
      const result = results[0];
      return NextResponse.json({
        success: result.success,
        data: result.success ? { messageId: String(Date.now()) } : null,
        message: result.success ? '발송 성공' : result.error,
        timestamp: new Date().toISOString(),
        actualType: result.actualType
      });
    } else {
      // 다중 발송 응답
      return NextResponse.json({
        success: successCount > 0,
        totalCount: results.length,
        successCount,
        failCount,
        results,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('💥 메시지 발송 실패:', error);
    console.error('에러 상세:', error.message);
    console.error('스택:', error.stack);
    
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || '메시지 발송 실패',
        timestamp: new Date().toISOString(),
        environment: isVercel ? 'vercel' : 'local'
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
    environment: isVercel ? 'vercel' : 'local',
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