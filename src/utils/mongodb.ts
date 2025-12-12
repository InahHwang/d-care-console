// src/utils/mongodb.ts - 환경별 DB 분리 적용
import { MongoClient, Db } from 'mongodb';

// 환경 변수에서 MongoDB URI 가져오기
const uri = process.env.MONGODB_URI || '';

// 🔥 환경별 데이터베이스 이름 결정 함수
const getDatabaseName = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseDbName = process.env.MONGODB_DB || process.env.DB_NAME || 'dental_care';
  
  if (isProduction) {
    return 'd-care-db';
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

      // 🔥 성능 최적화용 복합 인덱스 추가
      await db.collection('patients').createIndex(
        { visitConfirmed: 1, postVisitStatus: 1, createdAt: -1 },
        { name: 'idx_visit_status' }
      );
      await db.collection('patients').createIndex(
        { status: 1, createdAt: -1 },
        { name: 'idx_status_date' }
      );
      await db.collection('patients').createIndex(
        { callInDate: 1, status: 1, isCompleted: 1 },
        { name: 'idx_filter_query' }
      );
      await db.collection('patients').createIndex(
        { 'eventTargetInfo.isEventTarget': 1, 'eventTargetInfo.scheduledDate': 1 },
        { name: 'idx_event_target' }
      );
      await db.collection('patients').createIndex(
        { visitConfirmed: 1, createdAt: -1 },
        { name: 'idx_visit_created' }
      );
      await db.collection('patients').createIndex(
        { createdAt: -1 },
        { name: 'idx_created_desc' }
      );

      // 🔥 나이 필드 스키마 검증 규칙 추가
      try {
        await db.command({
          collMod: 'patients',
          validator: {
            $jsonSchema: {
              bsonType: 'object',
              properties: {
                age: {
                  bsonType: ['int', 'null'],
                  minimum: 2,
                  maximum: 120,
                  description: '나이는 2-120 사이의 정수여야 하며, 1은 허용되지 않습니다.'
                },
                name: {
                  bsonType: 'string',
                  description: '환자 이름은 필수입니다.'
                },
                phoneNumber: {
                  bsonType: 'string',
                  description: '전화번호는 필수입니다.'
                }
              },
              required: ['name', 'phoneNumber']
            }
          },
          validationLevel: 'moderate', // 기존 데이터는 영향 없음, 새 데이터만 검증
          validationAction: 'error' // 검증 실패 시 에러 발생
        });
        
        console.log('✅ Patients 컬렉션 스키마 검증 규칙 적용 완료');
      } catch (validationError: any) {
        if (validationError.code === 26) {
          console.log('📋 스키마 검증 규칙이 이미 존재합니다.');
        } else {
          console.warn('⚠️ 스키마 검증 규칙 적용 실패:', validationError.message);
        }
      }
      
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

    // 🔥 CallLogs 컬렉션 인덱스 (통화기록)
    try {
      await db.collection('callLogs').createIndex({ callerNumber: 1 });
      await db.collection('callLogs').createIndex({ calledNumber: 1 });
      await db.collection('callLogs').createIndex({ callStartTime: -1 });
      await db.collection('callLogs').createIndex({ callStatus: 1 });
      await db.collection('callLogs').createIndex({ patientId: 1 });
      await db.collection('callLogs').createIndex({ callId: 1 }, { unique: true, sparse: true });
      // 복합 인덱스
      await db.collection('callLogs').createIndex(
        { callerNumber: 1, callStartTime: -1 },
        { name: 'idx_caller_time' }
      );
    } catch (callLogsIndexError) {
      console.warn('CallLogs 인덱스 생성 중 오류:', callLogsIndexError);
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

// 🔥 통화기록 컬렉션 헬퍼 함수
export async function getCallLogsCollection() {
  const { db } = await connectToDatabase();
  return db.collection('callLogs');
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

// mongodb.ts 파일에 추가할 디버깅 함수들

// 🔥 환자 컬렉션의 나이 필드 분석 함수
export async function analyzeAgeField() {
  try {
    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');
    
    console.log('🔍 나이 필드 분석 시작...');
    
    // 모든 환자의 나이 필드 타입 분석
    const ageAnalysis = await patientsCollection.aggregate([
      {
        $project: {
          name: 1,
          age: 1,
          ageType: { $type: "$age" },
          ageExists: { $ifNull: ["$age", "NOT_EXISTS"] }
        }
      },
      {
        $group: {
          _id: "$ageType",
          count: { $sum: 1 },
          examples: { 
            $push: { 
              name: "$name", 
              age: "$age",
              ageExists: "$ageExists"
            } 
          }
        }
      }
    ]).toArray();
    
    console.log('📊 나이 필드 타입별 분석:', ageAnalysis);
    
    // 나이가 1인 환자들 특별 조회
    const ageOnePatients = await patientsCollection.find(
      { age: 1 },
      { projection: { name: 1, age: 1, createdAt: 1, createdBy: 1 } }
    ).toArray();
    
    console.log('🔍 나이가 1인 환자들:', ageOnePatients);
    
    // 나이 필드가 없는 환자들
    const noAgePatients = await patientsCollection.find(
      { age: { $exists: false } },
      { projection: { name: 1, createdAt: 1, createdBy: 1 } }
    ).limit(5).toArray();
    
    console.log('🔍 나이 필드가 없는 환자들 (샘플 5명):', noAgePatients);
    
    return {
      ageAnalysis,
      ageOnePatients,
      noAgePatients
    };
    
  } catch (error) {
    console.error('❌ 나이 필드 분석 실패:', error);
    throw error;
  }
}

// 🔥 컬렉션 스키마 검증 규칙 확인
export async function checkCollectionValidation() {
  try {
    const { db } = await connectToDatabase();
    
    const collections = await db.listCollections({ name: 'patients' }).toArray();
    
    if (collections.length > 0) {
      const collectionInfo = collections[0] as any; // 타입 안전성을 위해 any로 캐스팅
      console.log('📋 Patients 컬렉션 정보:', JSON.stringify(collectionInfo, null, 2));
      
      // 스키마 검증 규칙이 있는지 확인
      if (collectionInfo.options && collectionInfo.options.validator) {
        console.log('⚠️ 스키마 검증 규칙 발견:', collectionInfo.options.validator);
        return collectionInfo.options.validator;
      } else {
        console.log('✅ 스키마 검증 규칙 없음');
        return null;
      }
    } else {
      console.log('📋 Patients 컬렉션을 찾을 수 없습니다.');
      return null;
    }
    
  } catch (error) {
    console.error('❌ 컬렉션 검증 확인 실패:', error);
    throw error;
  }
}

// mongodb.ts에 추가할 새로운 함수

// 🔥 나이가 1인 환자들의 나이 필드 제거 (프로덕션에서도 안전하게 실행 가능)
export async function fixAgeOnePatients() {
  try {
    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');
    const envInfo = getEnvironmentInfo();
    
    console.log(`🔧 나이가 1인 환자들 수정 시작... (${envInfo.database})`);
    
    // 1. 나이가 1인 환자들 찾기
    const ageOnePatients = await patientsCollection.find({ age: 1 }).toArray();
    console.log(`🔍 나이가 1인 환자 ${ageOnePatients.length}명 발견:`, 
      ageOnePatients.map(p => ({ name: p.name, age: p.age, id: p._id }))
    );
    
    if (ageOnePatients.length === 0) {
      console.log('✅ 나이가 1인 환자가 없습니다.');
      return { fixed: 0, patients: [] };
    }
    
    // 2. 나이 필드 제거 (undefined로 만들어 "데이터 없음" 처리)
    const result = await patientsCollection.updateMany(
      { age: 1 },
      { 
        $unset: { age: "" },
        $set: { 
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: 'system_fix',
          lastModifiedByName: 'Age Bug Fix'
        }
      }
    );
    
    console.log(`✅ ${result.modifiedCount}명의 환자 나이 필드 수정 완료`);
    
    // 3. 수정 후 확인
    const verifyResult = await patientsCollection.find({ age: 1 }).toArray();
    
    return {
      fixed: result.modifiedCount,
      beforeFix: ageOnePatients.map(p => ({ 
        name: p.name, 
        age: p.age, 
        id: p._id.toString() 
      })),
      remainingAgeOnePatients: verifyResult.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ 나이 1 환자 수정 실패:', error);
    throw error;
  }
}

// 🔥 강화된 나이 검증 함수 (API에서 사용할 수 있도록)
export function validateAge(age: any): { isValid: boolean; cleanedAge?: number; shouldRemove: boolean } {
  console.log('🔍 나이 검증:', {
    age,
    type: typeof age,
    isUndefined: age === undefined,
    isNull: age === null,
    isEmpty: age === '',
    isOne: age === 1,
    isNaN: isNaN(age),
    stringified: JSON.stringify(age)
  });

  // 🚨 나이 필드 제거 조건들
  const shouldRemove = (
    age === undefined ||
    age === null ||
    age === '' ||
    age === 0 ||
    age === 1 ||  // 🔥 1도 의심스러운 값으로 처리
    (typeof age === 'string' && age.trim() === '') ||
    (typeof age === 'string' && age.trim() === '1') ||
    isNaN(Number(age)) ||
    Number(age) < 2 ||  // 🔥 최소 나이를 2세로 상향
    Number(age) > 120
  );

  if (shouldRemove) {
    console.log('🚨 나이 필드 제거 대상:', {
      originalValue: age,
      reason: age === 1 ? 'AGE_ONE_BLOCKED' : 'INVALID_VALUE'
    });
    return { isValid: false, shouldRemove: true };
  }

  // 유효한 나이 값으로 변환
  const validAge = parseInt(String(age), 10);
  
  if (validAge === 1) {
    console.log('🚨 변환 후에도 1이므로 제거');
    return { isValid: false, shouldRemove: true };
  }

  console.log('✅ 유효한 나이 값:', validAge);
  return { isValid: true, cleanedAge: validAge, shouldRemove: false };
}

// 🔥 문제가 있는 나이 필드 수정 함수
export async function fixAgeFieldIssues() {
  const envInfo = getEnvironmentInfo();
  
  if (envInfo.isProduction) {
    console.log('❌ 프로덕션에서는 데이터 수정을 할 수 없습니다.');
    return;
  }
  
  try {
    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');
    
    console.log('🔧 나이 필드 문제 수정 시작...');
    
    // 1. 나이가 1인 환자들 찾기 (의도하지 않은 값일 가능성)
    const ageOnePatients = await patientsCollection.find({ age: 1 }).toArray();
    console.log(`🔍 나이가 1인 환자 ${ageOnePatients.length}명 발견`);
    
    // 2. 나이가 1인 환자들의 나이 필드 제거 (개발 환경에서만)
    if (ageOnePatients.length > 0) {
      const result = await patientsCollection.updateMany(
        { age: 1 },
        { $unset: { age: "" } }
      );
      
      console.log(`✅ ${result.modifiedCount}명의 환자에서 나이 필드 제거 완료`);
    }
    
    // 3. 잘못된 타입의 나이 필드 수정
    const invalidAgePatients = await patientsCollection.find({
      age: { 
        $exists: true,
        $not: { $type: "number" }
      }
    }).toArray();
    
    console.log(`🔍 잘못된 타입의 나이 필드 ${invalidAgePatients.length}개 발견`);
    
    for (const patient of invalidAgePatients) {
      const numAge = parseInt(patient.age);
      if (isNaN(numAge) || numAge < 1 || numAge > 120) {
        // 유효하지 않은 나이는 필드 제거
        await patientsCollection.updateOne(
          { _id: patient._id },
          { $unset: { age: "" } }
        );
      } else {
        // 유효한 나이는 숫자로 변환
        await patientsCollection.updateOne(
          { _id: patient._id },
          { $set: { age: numAge } }
        );
      }
    }
    
    console.log('✅ 나이 필드 문제 수정 완료');
    
  } catch (error) {
    console.error('❌ 나이 필드 수정 실패:', error);
    throw error;
  }
}