// src/app/api/v2/upload/route.ts
// 이미지 업로드 → MMS 최적화 후 base64 데이터 URL 반환

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { message: '파일이 첨부되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 파일 형식 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: '지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WebP 가능)' },
        { status: 400 }
      );
    }

    // 파일 크기 검증 (1MB)
    if (file.size > 1024 * 1024) {
      return NextResponse.json(
        { message: '파일 크기는 1MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const originalSize = imageBuffer.length;

    // sharp로 이미지 최적화 (MMS 규격: 1500x1440, 200KB 이하, JPEG)
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    let processedImage = image;
    let needsProcessing = false;

    // JPG가 아니면 변환
    if (metadata.format !== 'jpeg') {
      processedImage = processedImage.jpeg({ quality: 85 });
      needsProcessing = true;
    }

    // 크기 조정
    if (metadata.width! > 1500 || metadata.height! > 1440) {
      processedImage = processedImage.resize(1500, 1440, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      needsProcessing = true;
    }

    // 파일 크기 최적화 (200KB 이하)
    let quality = 85;
    let finalBuffer: Buffer = imageBuffer;

    if (needsProcessing || imageBuffer.length > 200 * 1024) {
      while (quality > 20) {
        finalBuffer = await sharp(imageBuffer)
          .resize(1500, 1440, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality })
          .toBuffer();

        if (finalBuffer.length <= 200 * 1024) break;
        quality -= 10;
      }

      if (finalBuffer.length > 200 * 1024) {
        return NextResponse.json(
          { message: '이미지를 200KB 이하로 압축할 수 없습니다.' },
          { status: 400 }
        );
      }
    } else {
      finalBuffer = await processedImage.toBuffer();
    }

    // 최적화 후 메타데이터
    const finalMetadata = await sharp(finalBuffer).metadata();

    // base64 데이터 URL 생성
    const base64 = finalBuffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    return NextResponse.json({
      imageUrl,
      originalSize,
      optimizedSize: finalBuffer.length,
      dimensions: `${finalMetadata.width}x${finalMetadata.height}`,
      format: 'jpeg',
      message: originalSize !== finalBuffer.length
        ? `이미지가 최적화되었습니다. (${(originalSize / 1024).toFixed(1)}KB → ${(finalBuffer.length / 1024).toFixed(1)}KB)`
        : undefined,
    });
  } catch (error: any) {
    console.error('이미지 업로드 오류:', error);
    return NextResponse.json(
      { message: '이미지 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
