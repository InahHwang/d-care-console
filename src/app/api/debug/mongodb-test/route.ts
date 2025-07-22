// src/app/api/debug/mongodb-test/route.ts
import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

export async function GET() {
  console.log('🔍 MongoDB 연결 테스트 시작');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [] as any[]
  };

  // 1. 환경 변수 확인
  const mongoUri = process.env.MONGODB_URI;
  results.tests.push({
    name: '환경 변수 확인',
    success: !!mongoUri,
    details: mongoUri ? `URI 존재 (${mongoUri.substring(0, 20)}...)` : 'MONGODB_URI 환경 변수 없음'
  });

  if (!mongoUri) {
    return NextResponse.json(results, { status: 500 });
  }

  // 2. MongoDB 연결 테스트
  let client: MongoClient | null = null;
  try {
    console.log('📡 MongoDB 클라이언트 생성 중...');
    client = new MongoClient(mongoUri);
    
    console.log('🔌 MongoDB 연결 시도 중...');
    await client.connect();
    
    results.tests.push({
      name: 'MongoDB 연결',
      success: true,
      details: '연결 성공'
    });

    // 3. 데이터베이스 목록 확인
    console.log('📋 데이터베이스 목록 조회 중...');
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    results.tests.push({
      name: '데이터베이스 목록',
      success: true,
      details: `총 ${dbs.databases.length}개 DB 발견`,
      data: dbs.databases.map(db => db.name)
    });

    // 4. 현재 데이터베이스 확인
    const dbName = mongoUri.split('/')[3]?.split('?')[0] || 'test';
    const db = client.db(dbName);
    
    console.log(`🗃️ 데이터베이스 '${dbName}' 컬렉션 조회 중...`);
    const collections = await db.listCollections().toArray();
    
    results.tests.push({
      name: `데이터베이스 '${dbName}' 컬렉션`,
      success: true,
      details: `총 ${collections.length}개 컬렉션 발견`,
      data: collections.map(col => col.name)
    });

    // 5. patients 컬렉션 테스트
    try {
      const patientsCount = await db.collection('patients').countDocuments();
      results.tests.push({
        name: 'patients 컬렉션',
        success: true,
        details: `${patientsCount}개 문서 발견`
      });
    } catch (error: any) {
      results.tests.push({
        name: 'patients 컬렉션',
        success: false,
        details: `에러: ${error?.message || '알 수 없는 에러'}`
      });
    }

    // 6. 간단한 쓰기 테스트
    try {
      const testDoc = {
        test: true,
        timestamp: new Date(),
        connectionTest: true
      };
      
      const insertResult = await db.collection('connection_test').insertOne(testDoc);
      await db.collection('connection_test').deleteOne({ _id: insertResult.insertedId });
      
      results.tests.push({
        name: '쓰기/삭제 테스트',
        success: true,
        details: '쓰기 및 삭제 성공'
      });
    } catch (error: any) {
      results.tests.push({
        name: '쓰기/삭제 테스트',
        success: false,
        details: `에러: ${error?.message || '알 수 없는 에러'}`
      });
    }

  } catch (error: any) {
    console.error('❌ MongoDB 연결 실패:', error);
    results.tests.push({
      name: 'MongoDB 연결',
      success: false,
      details: error?.message || '알 수 없는 연결 에러',
      errorType: error?.constructor?.name || 'UnknownError'
    });
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('🔒 MongoDB 연결 닫음');
      } catch (closeError: any) {
        console.error('연결 닫기 실패:', closeError);
      }
    }
  }

  const allSuccess = results.tests.every(test => test.success);
  const status = allSuccess ? 200 : 500;

  console.log('✅ MongoDB 테스트 완료:', results);
  return NextResponse.json(results, { status });
}