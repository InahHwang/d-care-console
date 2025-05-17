// src/utils/mongodb.ts
import { MongoClient } from 'mongodb';

// 환경 변수가 없을 경우를 대비한 타입 단언
const uri = process.env.MONGODB_URI as string;
const dbName = process.env.MONGODB_DB as string;

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

if (!uri) {
  throw new Error('MongoDB URI가 설정되지 않았습니다.');
}

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(uri);

  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}