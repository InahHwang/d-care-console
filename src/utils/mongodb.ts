// utils/mongodb.ts
import { MongoClient } from 'mongodb';

// 환경 변수에서 MongoDB URI 가져오기
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB || 'dental_care';

// 연결 캐싱을 위한 변수
let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

// URI 확인
if (!uri) {
  console.warn(
    'MongoDB URI가 설정되지 않았습니다. 로그 저장 기능이 작동하지 않을 수 있습니다. .env.local 파일에 MONGODB_URI를 설정해주세요.'
  );
}

export async function connectToDatabase() {
  // 이미 연결된 경우 캐시된 연결 반환
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // MongoDB URI가 설정되지 않은 경우 오류 발생
  if (!uri) {
    throw new Error(
      'MONGODB_URI 환경 변수가 설정되지 않았습니다. .env.local 파일에 설정이 필요합니다.'
    );
  }

  try {
    // 새 연결 생성
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    
    // 연결 캐싱
    cachedClient = client;
    cachedDb = db;
    
    return { client, db };
  } catch (error) {
    console.error('MongoDB 연결 오류:', error);
    throw error;
  }
}