// src/app/api/messages/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// 🔥 활동 로깅을 위한 함수 추가
async function logActivityToDatabase(activityData: any) {
  try {
    const { connectToDatabase } = await import('@/utils/mongodb');
    const { db } = await connectToDatabase();
    
    const logEntry = {
      ...activityData,
      timestamp: new Date().toISOString(),
      source: 'backend_api',
      level: 'audit'
    };
    
    await db.collection('activity_logs').insertOne(logEntry);
    console.log('✅ 백엔드 활동 로그 기록 완료:', activityData.action);
  } catch (error) {
    console.warn('⚠️ 백엔드 활동 로그 기록 실패:', error);
    // 로그 실패는 무시하고 계속 진행
  }
}

// 요청 헤더에서 사용자 정보 추출 (임시)
function getCurrentUser(request: NextRequest) {
  // 실제로는 JWT 토큰에서 추출해야 함
  return {
    id: 'temp-user-001',
    name: '임시 관리자'
  };
}

// Vercel 환경 감지
const isVercel = process.env.VERCEL === '1';

// 메시지 타입을 바이트 크기에 따라 결정하는 함수 (한글 고려)
function getMessageType(text: string): string {
  let byteLength = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (char.match(/[가-힣]/)) {
      byteLength += 3;
    } else {
      byteLength += 1;
    }
  }
  
  console.log(`📏 메시지 길이: ${text.length}글자, ${byteLength}바이트`);
  
  if (byteLength <= 90) {
    return 'SMS';
  } else if (byteLength <= 2000) {
    return 'LMS';
  } else {
    return 'LMS';
  }
}

// Base64 데이터 URL인지 확인하는 함수
function isBase64DataUrl(str: string): boolean {
  return str.startsWith('data:image/');
}

// 이미지를 MMS 조건에 맞게 최적화 (개선된 버전)
async function optimizeImageForMMS(imageInput: string | Buffer): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    let imageBuffer: Buffer;
    
    if (typeof imageInput === 'string') {
      if (isBase64DataUrl(imageInput)) {
        // Base64 데이터 URL 처리 (Vercel과 로컬 모두 지원)
        const base64Data = imageInput.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log('📱 Base64 이미지 처리');
      } else {
        // 파일 경로 처리 (로컬 환경)
        let imagePath = imageInput;
        
        // 상대 경로를 절대 경로로 변환
        if (imagePath.startsWith('/uploads/')) {
          imagePath = path.join(process.cwd(), 'public', imagePath);
        } else if (imagePath.startsWith('/')) {
          imagePath = path.join(process.cwd(), 'public', imagePath);
        }
        
        console.log('🔍 이미지 파일 경로:', imagePath);
        
        if (!fs.existsSync(imagePath)) {
          console.error('❌ 이미지 파일이 존재하지 않습니다:', imagePath);
          return { success: false, error: '이미지 파일을 찾을 수 없습니다.' };
        }
        
        imageBuffer = fs.readFileSync(imagePath);
        console.log('🏠 파일 시스템에서 이미지 로드 성공');
      }
    } else {
      imageBuffer = imageInput;
    }

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    console.log('📊 원본 이미지 정보:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: imageBuffer.length
    });

    // 이미지 처리가 필요한지 확인
    let needsProcessing = false;
    let processedImage = image;

    // JPG가 아니면 변환
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
    let finalBuffer: Buffer = imageBuffer;
    
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

    console.log('✅ 이미지 최적화 성공:', {
      size: `${(finalBuffer.length / 1024).toFixed(1)}KB`,
      originalSize: `${(imageBuffer.length / 1024).toFixed(1)}KB`
    });

    return { success: true, buffer: finalBuffer };
  } catch (error: any) {
    console.error('💥 이미지 최적화 실패:', error.message);
    return { success: false, error: error.message };
  }
}

// CoolSMS SDK 임포트
let coolsmsService: any = null;
let sdkImportError: string | null = null;

try {
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
  
  const currentUser = getCurrentUser(request);
  
  try {
    // SDK 임포트 상태 확인
    if (sdkImportError) {
      console.error('SDK 임포트 에러:', sdkImportError);
      
      // 🔥 백엔드 로그 - SDK 임포트 실패
      await logActivityToDatabase({
        action: 'message_send_api_error',
        targetId: 'system',
        targetName: 'SMS 서비스',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: `SDK 임포트 실패: ${sdkImportError}`,
          apiEndpoint: '/api/messages/send'
        }
      });
      
      return NextResponse.json(
        { success: false, message: `SDK 임포트 실패: ${sdkImportError}` },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log('📥 요청 본문:', body);

    // 🔥 프론트엔드 로깅 스킵 여부 확인
    const skipFrontendLog = request.headers.get('X-Skip-Activity-Log') === 'true';
    
    // 요청 형태 확인 (단일 vs 다중)
    let patients: any[] = [];
    let content = '';
    let messageType = '';
    let imageUrl = '';
    
    if (body.patients && Array.isArray(body.patients)) {
      patients = body.patients;
      content = body.content || '';
      messageType = body.messageType || 'SMS';
      imageUrl = body.imageUrl || '';
    } else {
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
      // 🔥 백엔드 로그 - 필수 필드 누락
      await logActivityToDatabase({
        action: 'message_send_api_error',
        targetId: patients[0]?.id || 'unknown',
        targetName: patients[0]?.name || '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '필수 필드 누락',
          phoneNumber: patients[0]?.phoneNumber || 'missing',
          contentLength: content.length,
          apiEndpoint: '/api/messages/send'
        }
      });
      
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
      // 🔥 백엔드 로그 - 설정 오류
      await logActivityToDatabase({
        action: 'message_send_api_error',
        targetId: 'system',
        targetName: 'SMS 서비스',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: 'CoolSMS 설정 누락',
          apiEndpoint: '/api/messages/send'
        }
      });
      
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
      // 🔥 백엔드 로그 - 내용 길이 초과
      await logActivityToDatabase({
        action: 'message_send_api_error',
        targetId: patients[0]?.id || 'unknown',
        targetName: patients[0]?.name || '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: '메시지 내용 길이 초과',
          contentLength: content.length,
          contentByteLength: contentByteLength,
          apiEndpoint: '/api/messages/send'
        }
      });
      
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
    
    // MMS 요청이고 이미지가 있으면 MMS로 처리 시도
    let shouldAttemptMMS = messageType === 'MMS' && imageUrl;
    if (shouldAttemptMMS) {
      console.log('🖼️ MMS 요청 - 이미지 처리 시작');
      actualMessageType = 'MMS';
    }

    // 각 환자별로 발송 처리
    const results = [];
    
    // 🔥 백엔드 로그 - 메시지 발송 시작 (프론트엔드 로깅이 없는 경우에만)
    if (!skipFrontendLog) {
      await logActivityToDatabase({
        action: 'message_send_api_start',
        targetId: patients[0]?.id || 'batch',
        targetName: patients.length === 1 ? patients[0]?.name : `${patients.length}명`,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          recipientCount: patients.length,
          messageType: actualMessageType,
          contentLength: content.length,
          hasImage: !!imageUrl,
          apiEndpoint: '/api/messages/send',
          userAgent: request.headers.get('user-agent')?.substring(0, 100)
        }
      });
    }
    
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
        if (shouldAttemptMMS && imageUrl) {
          console.log(`📁 [${patient.name}] MMS 이미지 처리 시작`);
          
          // 이미지 최적화
          const imageProcessResult = await optimizeImageForMMS(imageUrl);
          
          if (!imageProcessResult.success) {
            console.log(`⚠️ [${patient.name}] 이미지 최적화 실패, LMS로 대체:`, imageProcessResult.error);
            
            // LMS로 대체하되, 이미지 실패 안내 문구는 추가하지 않음
            actualMessageType = 'LMS';
            messageOptions.type = 'LMS';
            patientResult.actualType = 'LMS';
            patientResult.error = `이미지 처리 실패로 LMS 발송: ${imageProcessResult.error}`;
          } else {
            console.log(`✅ [${patient.name}] 이미지 최적화 완료: ${(imageProcessResult.buffer!.length / 1024).toFixed(1)}KB`);
            
            try {
              // 임시 파일 생성 및 CoolSMS 업로드
              let tempFilePath = '';
              
              if (isVercel) {
                tempFilePath = `/tmp/temp_${Date.now()}_${patient.id}.jpg`;
              } else {
                const uploadsDir = path.join(process.cwd(), 'public/uploads');
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }
                tempFilePath = path.join(uploadsDir, `temp_${Date.now()}_${patient.id}.jpg`);
              }
              
              // 최적화된 이미지를 임시 파일로 저장
              fs.writeFileSync(tempFilePath, imageProcessResult.buffer!);
              
              console.log(`🔄 [${patient.name}] MMS 이미지 업로드 시도: ${tempFilePath}`);
              
              // CoolSMS 이미지 업로드
              const uploadResult = await messageService.uploadFile(tempFilePath, "MMS");
              const imageId = uploadResult.fileId;
              
              console.log(`✅ [${patient.name}] 이미지 업로드 성공, imageId:`, imageId);
              
              // MMS 옵션 설정
              messageOptions.imageId = imageId;
              messageOptions.type = 'MMS';
              patientResult.actualType = 'MMS';
              
              // 임시 파일 정리
              try {
                fs.unlinkSync(tempFilePath);
                console.log(`🗑️ [${patient.name}] 임시 파일 삭제 완료`);
              } catch (cleanupError) {
                console.log(`⚠️ [${patient.name}] 임시 파일 삭제 실패:`, cleanupError);
              }
              
            } catch (uploadError: any) {
              console.log(`❌ [${patient.name}] 이미지 업로드 실패:`, uploadError.message);
              console.log(`🔄 [${patient.name}] LMS로 대체 발송`);
              
              // LMS로 대체하되, 이미지 실패 안내 문구는 추가하지 않음
              actualMessageType = 'LMS';
              messageOptions.type = 'LMS';
              
              delete messageOptions.imageId;
              patientResult.actualType = 'LMS';
              patientResult.error = `이미지 업로드 실패로 LMS 발송: ${uploadError.message}`;
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

        // 🔥 백엔드 로그 - 개별 메시지 발송 성공 (프론트엔드 로깅이 없는 경우에만)
        if (!skipFrontendLog) {
          await logActivityToDatabase({
            action: 'message_send_api_success',
            targetId: patient.id,
            targetName: patient.name,
            userId: currentUser.id,
            userName: currentUser.name,
            details: {
              phoneNumber: patient.phoneNumber,
              messageType: patientResult.actualType,
              contentLength: messageOptions.text.length,
              hasImage: !!messageOptions.imageId,
              messageId: result.messageId || 'unknown',
              apiEndpoint: '/api/messages/send'
            }
          });
        }
        
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error(`❌ [${patient.name}] 메시지 발송 실패:`, errorMessage);
        
        patientResult.success = false;
        patientResult.error = errorMessage;

        // 🔥 백엔드 로그 - 개별 메시지 발송 실패 (프론트엔드 로깅이 없는 경우에만)
        if (!skipFrontendLog) {
          await logActivityToDatabase({
            action: 'message_send_api_error',
            targetId: patient.id,
            targetName: patient.name,
            userId: currentUser.id,
            userName: currentUser.name,
            details: {
              error: errorMessage,
              phoneNumber: patient.phoneNumber,
              messageType: messageOptions.type,
              apiEndpoint: '/api/messages/send'
            }
          });
        }
      }
      
      results.push(patientResult);
    }

    // 성공/실패 카운트
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    console.log(`📊 발송 결과: 성공 ${successCount}건, 실패 ${failCount}건`);

    // 🔥 백엔드 로그 - 메시지 발송 완료 (프론트엔드 로깅이 없는 경우에만)
    if (!skipFrontendLog) {
      await logActivityToDatabase({
        action: 'message_send_api_complete',
        targetId: patients[0]?.id || 'batch',
        targetName: patients.length === 1 ? patients[0]?.name : `${patients.length}명`,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          totalRecipients: patients.length,
          successCount: successCount,
          failCount: failCount,
          successRate: `${Math.round((successCount / patients.length) * 100)}%`,
          apiEndpoint: '/api/messages/send'
        }
      });
    }
    
    // 응답 (기존 형태와 호환)
    if (patients.length === 1) {
      const result = results[0];
      return NextResponse.json({
        success: result.success,
        data: result.success ? { messageId: String(Date.now()) } : null,
        message: result.success ? '발송 성공' : result.error,
        timestamp: new Date().toISOString(),
        actualType: result.actualType
      });
    } else {
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

    // 🔥 백엔드 로그 - 전체 예외 발생
    try {
      await logActivityToDatabase({
        action: 'message_send_api_exception',
        targetId: 'system',
        targetName: 'SMS 서비스',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: error.message || '알 수 없는 오류',
          stack: error.stack?.substring(0, 500),
          apiEndpoint: '/api/messages/send'
        }
      });
    } catch (logError) {
      console.warn('예외 로그 기록 실패:', logError);
    }
    
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