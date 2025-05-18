// src/app/api/test/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET() {
  try {
    console.log('테스트 API 호출: MongoDB 연결 시도...');
    const { db } = await connectToDatabase();
    
    // 간단한 테스트 쿼리 실행
    const result = await db.command({ ping: 1 });
    
    // 컬렉션 목록 가져오기
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((col: { name: any; }) => col.name);
    
    // messageLogs 컬렉션의 문서 수 확인
    let messageLogsCount = 0;
    if (collectionNames.includes('messageLogs')) {
      messageLogsCount = await db.collection('messageLogs').countDocuments();
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'MongoDB 연결 성공',
      ping: result,
      collections: collectionNames,
      messageLogsCount,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        MONGODB_DB: process.env.MONGODB_DB,
        // 비밀 정보는 마스킹하여 표시
        MONGODB_URI_SET: !!process.env.MONGODB_URI,
        JWT_SECRET_SET: !!process.env.JWT_SECRET
      }
    });
  } catch (error) {
    console.error('MongoDB 연결 실패:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'MongoDB 연결 실패',
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          MONGODB_DB: process.env.MONGODB_DB,
          MONGODB_URI_SET: !!process.env.MONGODB_URI,
          JWT_SECRET_SET: !!process.env.JWT_SECRET
        }
      },
      { status: 500 }
    );
  }
}