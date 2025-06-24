// src/utils/mongodb.ts - 환경별 DB 분리 적용
import { MongoClient, Db } from 'mongodb';

// 환경 변수에서 MongoDB URI 가져오기
const uri = process.env.MONGODB_URI || '';

// 🔥 환경별 데이터베이스 이름 결정 함수
const getDatabaseName = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseDbName = process.env.MONGODB_DB || process.env.DB_NAME || 'dental_care';
  
  if (isProduction) {
    return `${baseDbName}-production`;
  } else {
    return `${baseDbName}-development`;
  }
};

// 연결 캐싱을 위한 변수
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// URI 확인
if (!uri) {
  console.warn(
    'MongoDB URI가 설정되지 않았습니다. 로그 저장 기능이 작동하지 않을 수 있습니다. .env.local 파일에 MONGODB_URI를 설정해주세요.'
  );
}

// 🔥 개발 환경에서 글로벌 변수 사용 (HMR 대응)
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // 개발 환경: 글로벌 변수 사용 (hot reload 대응)
  if (!(global as any)._mongoClientPromise) {
    client = new MongoClient(uri);
    (global as any)._mongoClientPromise = client.connect();
  }
  clientPromise = (global as any)._mongoClientPromise;
} else {
  // 프로덕션 환경: 새 클라이언트 생성
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // MongoDB URI가 설정되지 않은 경우 오류 발생
  if (!uri) {
    throw new Error(
      'MONGODB_URI 환경 변수가 설정되지 않았습니다. .env.local 파일에 설정이 필요합니다.'
    );
  }

  try {
    // 🔥 새로운 연결 방식 사용
    const client = await clientPromise;
    const dbName = getDatabaseName();
    const db = client.db(dbName);
    
    // 🔥 환경 정보 로깅
    console.log(`✅ 연결된 DB: ${dbName} (${process.env.NODE_ENV || 'development'})`);
    
    // 인덱스 생성 (처음 연결 시에만)
    await createIndexesSafely(db);
    
    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB 연결 오류:', error);
    throw error;
  }
}

// 🔥 환경 정보 반환 함수 추가
export const getEnvironmentInfo = () => {
  return {
    environment: process.env.NODE_ENV || 'development',
    database: getDatabaseName(),
    isProduction: process.env.NODE_ENV === 'production'
  };
};

// 컬렉션별 인덱스 생성 - 안전한 방식으로 수정
async function createIndexesSafely(db: Db) {
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

    // Reports 컬렉션 인덱스 (새로 추가)
    try {
      await db.collection('reports').createIndex({ month: 1, year: 1 }, { unique: true });
      await db.collection('reports').createIndex({ createdBy: 1 });
      await db.collection('reports').createIndex({ status: 1 });
      await db.collection('reports').createIndex({ year: -1, month: -1 });
      await db.collection('reports').createIndex({ createdAt: -1 });
    } catch (reportsIndexError) {
      console.warn('Reports 인덱스 생성 중 오류:', reportsIndexError);
    }

    const envInfo = getEnvironmentInfo();
    console.log(`✅ MongoDB 인덱스 생성/확인 완료 (${envInfo.database})`);
  } catch (error) {
    console.warn('인덱스 생성 중 일부 오류 발생:', error);
    // 인덱스 생성 실패는 치명적이지 않으므로 계속 진행
  }
}

// 새로운 헬퍼 함수 추가
export async function getReportsCollection() {
  const { db } = await connectToDatabase();
  return db.collection('reports');
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

// 🔥 환경별 기본 사용자 생성 (최초 설정용)
export async function createDefaultUsers() {
  try {
    const usersCollection = await getUsersCollection();
    const envInfo = getEnvironmentInfo();
    
    // 마스터 관리자가 이미 있는지 확인
    const existingMaster = await usersCollection.findOne({ role: 'master' });
    
    if (!existingMaster) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('ektksqkfms1!', 10);
      
      const masterUser = {
        id: 'master_001',
        username: envInfo.isProduction ? 'dsbrdental' : 'dev_admin',
        email: envInfo.isProduction ? 'dsbrdental@naver.com' : 'dev@test.com',
        name: envInfo.isProduction ? '마스터관리자' : '개발관리자',
        role: 'master',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        password: hashedPassword,
      };
      
      await usersCollection.insertOne(masterUser);
      
      console.log(`✅ 기본 ${envInfo.isProduction ? '프로덕션' : '개발'} 사용자 생성 완료`);
    }
  } catch (error) {
    console.error('❌ 기본 사용자 생성 실패:', error);
  }
}

// 🔥 기존 환자 데이터에 사용자 필드 추가 (마이그레이션 함수)
export async function migratePatientData() {
  try {
    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');
    const envInfo = getEnvironmentInfo();
    
    // 개발 환경에서만 마이그레이션 실행 (안전장치)
    if (!envInfo.isProduction) {
      console.log('🔧 개발 환경에서 환자 데이터 마이그레이션 실행');
    }
    
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
      
      console.log(`✅ 환자 데이터 마이그레이션 완료 (${envInfo.database})`);
    }
  } catch (error) {
    console.error('❌ 환자 데이터 마이그레이션 실패:', error);
  }
}

// 🔥 데이터베이스 초기화 함수 - 환경 정보 포함
export async function initializeDatabase() {
  try {
    await connectToDatabase();
    const envInfo = getEnvironmentInfo();
    
    console.log(`🚀 ${envInfo.database} 데이터베이스 초기화 시작`);
    
    await createDefaultUsers();
    await migratePatientData();
    
    console.log(`✅ ${envInfo.database} 데이터베이스 초기화 완료`);
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
  }
}

// 🔥 개발 전용 테스트 데이터 시딩 함수
export async function seedTestData() {
  const envInfo = getEnvironmentInfo();
  
  if (envInfo.isProduction) {
    console.log('❌ 프로덕션에서는 테스트 데이터를 생성할 수 없습니다.');
    return;
  }
  
  try {
    const { db } = await connectToDatabase();
    
    // 기존 테스트 데이터 삭제
    await db.collection('patients').deleteMany({ isTestData: true });
    
    const testPatients = [
      {
        name: '김테스트',
        phoneNumber: '010-1234-5678',
        consultationType: 'outbound',
        status: 'active',
        interestedServices: ['임플란트'],
        referralSource: 'online_ad',
        notes: '테스트 환자 데이터',
        createdAt: new Date(),
        isTestData: true
      },
      {
        name: '이개발',
        phoneNumber: '010-9876-5432',
        consultationType: 'inbound',
        status: 'consultation',
        interestedServices: ['교정'],
        referralSource: 'referral',
        notes: '개발용 샘플 데이터',
        createdAt: new Date(),
        isTestData: true
      }
    ];
    
    const result = await db.collection('patients').insertMany(testPatients);
    
    console.log(`✅ ${result.insertedCount}개의 테스트 환자 데이터 생성 완료`);
    
    return result;
  } catch (error) {
    console.error('❌ 테스트 데이터 생성 실패:', error);
    throw error;
  }
}

// 🔥 개발 전용 테스트 데이터 삭제 함수
export async function clearTestData() {
  const envInfo = getEnvironmentInfo();
  
  if (envInfo.isProduction) {
    console.log('❌ 프로덕션에서는 테스트 데이터를 삭제할 수 없습니다.');
    return;
  }
  
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('patients').deleteMany({ isTestData: true });
    
    console.log(`✅ ${result.deletedCount}개의 테스트 환자 데이터 삭제 완료`);
    
    return result;
  } catch (error) {
    console.error('❌ 테스트 데이터 삭제 실패:', error);
    throw error;
  }
}

// 기본 export (기존 호환성 유지)
export default clientPromise;