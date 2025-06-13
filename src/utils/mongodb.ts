// src/utils/mongodb.ts - 인덱스 오류 해결

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
    
    // 인덱스 생성 (처음 연결 시에만) - 수정된 부분
    await createIndexesSafely(db);
    
    // 연결 캐싱
    cachedClient = client;
    cachedDb = db;
    
    return { client, db };
  } catch (error) {
    console.error('MongoDB 연결 오류:', error);
    throw error;
  }
}

// 컬렉션별 인덱스 생성 - 안전한 방식으로 수정
async function createIndexesSafely(db: any) {
  try {
    // Users 컬렉션 인덱스 - null 값 처리 개선
    try {
      // 기존 인덱스 확인 후 생성
      const existingIndexes = await db.collection('users').indexes();
      const hasEmailIndex = existingIndexes.some((index: any) => index.key && index.key.email);
      const hasUsernameIndex = existingIndexes.some((index: any) => index.key && index.key.username);

      if (!hasEmailIndex) {
        // sparse: true 옵션으로 null 값 무시
        await db.collection('users').createIndex(
          { email: 1 }, 
          { unique: true, sparse: true }
        );
      }
      
      if (!hasUsernameIndex) {
        await db.collection('users').createIndex(
          { username: 1 }, 
          { unique: true, sparse: true }
        );
      }

      // 일반 인덱스들
      await db.collection('users').createIndex({ isActive: 1 });
      await db.collection('users').createIndex({ role: 1 });
      await db.collection('users').createIndex({ createdAt: -1 });
    } catch (userIndexError) {
      console.warn('Users 인덱스 생성 중 오류:', userIndexError);
    }

    // ActivityLogs 컬렉션 인덱스
    try {
      await db.collection('activityLogs').createIndex({ timestamp: -1 });
      await db.collection('activityLogs').createIndex({ userId: 1, timestamp: -1 });
      await db.collection('activityLogs').createIndex({ target: 1, targetId: 1, timestamp: -1 });
      await db.collection('activityLogs').createIndex({ action: 1, timestamp: -1 });
    } catch (activityIndexError) {
      console.warn('ActivityLogs 인덱스 생성 중 오류:', activityIndexError);
    }

    // Patients 컬렉션 인덱스
    try {
      await db.collection('patients').createIndex({ patientId: 1 }, { unique: true });
      await db.collection('patients').createIndex({ phoneNumber: 1 });
      await db.collection('patients').createIndex({ status: 1 });
      await db.collection('patients').createIndex({ createdBy: 1 });
      await db.collection('patients').createIndex({ lastModifiedAt: -1 });
    } catch (patientIndexError) {
      console.warn('Patients 인덱스 생성 중 오류:', patientIndexError);
    }

    console.log('MongoDB 인덱스 생성/확인 완료');
  } catch (error) {
    console.warn('인덱스 생성 중 일부 오류 발생:', error);
    // 인덱스 생성 실패는 치명적이지 않으므로 계속 진행
  }
}

// 타입 안전한 컬렉션 헬퍼 함수들
export async function getUsersCollection() {
  const { db } = await connectToDatabase();
  return db.collection('users');
}

export async function getActivityLogsCollection() {
  const { db } = await connectToDatabase();
  return db.collection('activityLogs');
}

export async function getPatientsCollection() {
  const { db } = await connectToDatabase();
  return db.collection('patients');
}

// 기존 환자 데이터에 사용자 필드 추가 (마이그레이션 함수)
export async function migratePatientData() {
  try {
    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');
    
    // createdBy, lastModifiedBy 필드가 없는 환자들 찾기
    const patientsToUpdate = await patientsCollection.find({
      $or: [
        { createdBy: { $exists: false } },
        { lastModifiedBy: { $exists: false } }
      ]
    }).toArray();

    if (patientsToUpdate.length > 0) {
      console.log(`${patientsToUpdate.length}개의 환자 레코드를 마이그레이션합니다.`);
      
      // 기본값으로 시스템 사용자 설정
      const defaultUserId = 'system';
      const defaultUserName = '시스템';
      const now = new Date().toISOString();
      
      for (const patient of patientsToUpdate) {
        await patientsCollection.updateOne(
          { _id: patient._id },
          {
            $set: {
              createdBy: patient.createdBy || defaultUserId,
              createdByName: patient.createdByName || defaultUserName,
              lastModifiedBy: patient.lastModifiedBy || defaultUserId,
              lastModifiedByName: patient.lastModifiedByName || defaultUserName,
              lastModifiedAt: patient.lastModifiedAt || patient.updatedAt || now,
            }
          }
        );
      }
      
      console.log('환자 데이터 마이그레이션 완료');
    }
  } catch (error) {
    console.error('환자 데이터 마이그레이션 실패:', error);
  }
}

// 기본 사용자 생성 (최초 설정용)
export async function createDefaultUsers() {
  try {
    const usersCollection = await getUsersCollection();
    
    // 마스터 관리자가 이미 있는지 확인
    const existingMaster = await usersCollection.findOne({ role: 'master' });
    
    if (!existingMaster) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('ektksqkfms1!', 10);
      
      const masterUser = {
        id: 'master_001',
        username: 'dsbrdental',
        email: 'dsbrdental@naver.com',
        name: '마스터관리자',
        role: 'master',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        password: hashedPassword,
      };
      
      await usersCollection.insertOne(masterUser);
      
      console.log('기본 마스터 사용자 생성 완료');
    }
  } catch (error) {
    console.error('기본 사용자 생성 실패:', error);
  }
}

// 데이터베이스 초기화 함수
export async function initializeDatabase() {
  try {
    await connectToDatabase();
    await createDefaultUsers();
    await migratePatientData();
    console.log('데이터베이스 초기화 완료');
  } catch (error) {
    console.error('데이터베이스 초기화 실패:', error);
  }
}