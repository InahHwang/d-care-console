import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';

// 최대 허용 파일 크기: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // multipart/form-data 파싱
    const formData = await request.formData();
    
    // 파일 추출
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { success: false, message: '파일이 없습니다.' },
        { status: 400 }
      );
    }
    
    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: '파일 크기가 2MB를 초과합니다.' },
        { status: 400 }
      );
    }
    
    // 파일 타입 검증
    const fileType = file.type;
    if (!fileType.startsWith('image/')) {
      return NextResponse.json(
        { success: false, message: '이미지 파일만 업로드 가능합니다.' },
        { status: 400 }
      );
    }
    
    // 파일명 생성 (타임스탬프 + 랜덤 문자열 + 확장자)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileExt = fileType.split('/')[1];
    const fileName = `${timestamp}-${randomStr}.${fileExt}`;
    
    // 저장 경로 설정
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    
    // 디렉토리 생성 (없는 경우)
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      console.error('디렉토리 생성 오류:', error);
    }
    
    const filePath = join(uploadsDir, fileName);
    
    // 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(filePath, buffer);
    
    // 클라이언트에서 접근 가능한 URL 생성
    const imageUrl = `/uploads/${fileName}`;
    
    return NextResponse.json({
      success: true,
      imageUrl,
      fileName
    });
  } catch (error: any) {
    console.error('파일 업로드 오류:', error);
    
    return NextResponse.json(
      { success: false, message: error.message || '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}