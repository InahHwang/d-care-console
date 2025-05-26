// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  console.log('======= 이미지 업로드 API 시작 =======');
  
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      console.log('❌ 파일이 없습니다');
      return NextResponse.json(
        { success: false, message: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    console.log('📄 업로드된 파일 정보:');
    console.log('- 파일명:', file.name);
    console.log('- 파일 크기:', file.size, 'bytes');
    console.log('- 파일 타입:', file.type);

    // 파일 크기 제한 (1MB = 1024 * 1024 bytes) - 업로드 시점에서는 1MB까지 허용
    const maxUploadSize = 1024 * 1024; // 1MB
    if (file.size > maxUploadSize) {
      console.log('❌ 파일 크기 초과:', file.size, '>', maxUploadSize);
      return NextResponse.json(
        { success: false, message: '파일 크기는 1MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 이미지 파일 형식 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.log('❌ 지원하지 않는 파일 형식:', file.type);
      return NextResponse.json(
        { success: false, message: '지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WebP 가능)' },
        { status: 400 }
      );
    }

    // 업로드 디렉토리 확인 및 생성
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    console.log('📁 업로드 디렉토리:', uploadDir);
    
    if (!existsSync(uploadDir)) {
      console.log('📁 업로드 디렉토리 생성 중...');
      await mkdir(uploadDir, { recursive: true });
      console.log('✅ 업로드 디렉토리 생성 완료');
    }

    // 임시 파일 저장
    const timestamp = Date.now();
    const tempFileName = `temp_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
    const tempFilePath = path.join(uploadDir, tempFileName);
    
    console.log('💾 임시 파일 저장 중:', tempFilePath);

    // 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(tempFilePath, buffer);

    // Sharp로 이미지 처리
    const image = sharp(tempFilePath);
    const metadata = await image.metadata();
    
    console.log('📊 이미지 메타데이터:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length
    });

    // MMS 조건에 맞게 최적화
    const finalFileName = `${timestamp}-mms-optimized.jpg`;
    const finalFilePath = path.join(uploadDir, finalFileName);
    
    let processedImage = image;
    
    // 크기 조정 (1500x1440 이하)
    if (metadata.width! > 1500 || metadata.height! > 1440) {
      console.log('🔄 이미지 크기 조정:', `${metadata.width}x${metadata.height} -> 1500x1440 이하`);
      processedImage = processedImage.resize(1500, 1440, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // JPG로 변환 및 품질 최적화 (200KB 이하)
    let quality = 90;
    let finalSize = 0;
    
    do {
      await processedImage.jpeg({ 
        quality,
        progressive: true,
        mozjpeg: true 
      }).toFile(finalFilePath);
      
      const stats = await import('fs').then(fs => fs.promises.stat(finalFilePath));
      finalSize = stats.size;
      
      console.log(`🔍 품질 ${quality}%로 압축: ${(finalSize / 1024).toFixed(1)}KB`);
      
      if (finalSize <= 200 * 1024) {
        break;
      }
      
      quality -= 5;
      
      // 파일 삭제 후 재생성
      await import('fs').then(fs => fs.promises.unlink(finalFilePath).catch(() => {}));
      
    } while (quality > 20 && finalSize > 200 * 1024);

    // 임시 파일 정리
    await import('fs').then(fs => fs.promises.unlink(tempFilePath).catch(() => {}));

    if (finalSize > 200 * 1024) {
      // 최종 파일도 정리
      await import('fs').then(fs => fs.promises.unlink(finalFilePath).catch(() => {}));
      
      return NextResponse.json({
        success: false,
        message: 'MMS 발송을 위해서는 이미지가 200KB 이하여야 합니다. 더 작은 이미지를 업로드해주세요.',
        originalSize: `${(buffer.length / 1024).toFixed(1)}KB`,
        mmsRequirements: {
          maxSize: '200KB',
          format: 'JPG',
          maxDimensions: '1500x1440px'
        }
      }, { status: 400 });
    }

    // 최종 이미지 정보 확인
    const finalMetadata = await sharp(finalFilePath).metadata();
    const fileUrl = `/uploads/${finalFileName}`;
    
    console.log('✅ MMS 최적화 완료:', {
      fileName: finalFileName,
      size: `${(finalSize / 1024).toFixed(1)}KB`,
      dimensions: `${finalMetadata.width}x${finalMetadata.height}`,
      format: finalMetadata.format
    });

    return NextResponse.json({
      success: true,
      imageUrl: fileUrl,
      fileName: finalFileName,
      originalSize: `${(buffer.length / 1024).toFixed(1)}KB`,
      optimizedSize: `${(finalSize / 1024).toFixed(1)}KB`,
      dimensions: `${finalMetadata.width}x${finalMetadata.height}`,
      format: finalMetadata.format,
      message: 'MMS 발송을 위해 이미지가 최적화되었습니다.',
      mmsReady: true
    });

  } catch (error: any) {
    console.error('💥 이미지 업로드 실패:', error);
    console.error('에러 상세:', error.message);
    
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || '이미지 업로드 실패',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  } finally {
    console.log('======= 이미지 업로드 API 종료 =======');
  }
}

// GET 핸들러 - 업로드 상태 및 MMS 요구사항 확인
export async function GET() {
  const uploadDir = path.join(process.cwd(), 'public/uploads');
  const uploadDirExists = existsSync(uploadDir);
  
  return NextResponse.json({
    message: "MMS 최적화 이미지 업로드 API",
    status: "ready",
    uploadDirectory: uploadDir,
    uploadDirectoryExists: uploadDirExists,
    mmsRequirements: {
      format: "JPG (자동 변환됨)",
      maxSize: "200KB (자동 압축됨)",
      maxWidth: "1500px (자동 조정됨)",
      maxHeight: "1440px (자동 조정됨)",
      uploadLimit: "1MB (업로드 시점 제한)"
    },
    note: "업로드된 이미지는 자동으로 MMS 발송 조건에 맞게 최적화됩니다."
  });
}