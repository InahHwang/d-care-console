/**
 * 프로덕션 DB → 로컬 개발 DB 동기화 스크립트
 *
 * 사용법: node scripts/sync-from-production.js [옵션]
 *
 * 옵션:
 *   --anonymize    전화번호 등 민감정보 익명화 (기본: false)
 *   --collections  동기화할 컬렉션 지정 (쉼표 구분, 기본: 전체)
 *   --dry-run      실제 동기화 없이 미리보기만
 *
 * 예시:
 *   node scripts/sync-from-production.js
 *   node scripts/sync-from-production.js --anonymize
 *   node scripts/sync-from-production.js --collections=patients_v2,callLogs_v2
 *   node scripts/sync-from-production.js --dry-run
 */

const { MongoClient } = require('mongodb');

// ============================================
// 설정
// ============================================

const CONFIG = {
  // MongoDB 연결 정보
  uri: 'mongodb+srv://dsbrdent:inahdtcyan2581@d-care-cluster.r4dwbxo.mongodb.net/?retryWrites=true&w=majority&appName=d-care-cluster',

  // 데이터베이스 이름
  productionDb: 'd-care-db',
  developmentDb: 'd-care-db-development',

  // 동기화할 컬렉션 목록
  collections: [
    'patients_v2',
    'callLogs_v2',
    'consultations_v2',
    'manualConsultations_v2',
    'channelChats_v2',
    'callbacks_v2',
    'users',
  ],

  // 익명화 설정
  anonymizeFields: {
    patients_v2: {
      phone: (val) => val ? val.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$3') : val,
      // name은 유지 (테스트에 필요)
    },
    callLogs_v2: {
      phone: (val) => val ? val.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$3') : val,
      recordingPath: () => null, // 녹음 파일 경로 제거
    },
  },
};

// ============================================
// 유틸리티 함수
// ============================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    anonymize: false,
    collections: null,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg === '--anonymize') {
      options.anonymize = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--collections=')) {
      options.collections = arg.replace('--collections=', '').split(',');
    }
  }

  return options;
}

function anonymizeDocument(doc, collectionName, anonymizeFields) {
  if (!anonymizeFields[collectionName]) return doc;

  const anonymized = { ...doc };
  const fields = anonymizeFields[collectionName];

  for (const [field, transformer] of Object.entries(fields)) {
    if (anonymized[field] !== undefined) {
      anonymized[field] = transformer(anonymized[field]);
    }
  }

  return anonymized;
}

function formatNumber(num) {
  return num.toLocaleString('ko-KR');
}

// ============================================
// 메인 동기화 함수
// ============================================

async function syncFromProduction() {
  const options = parseArgs();
  const collectionsToSync = options.collections || CONFIG.collections;

  console.log('\n========================================');
  console.log('🔄 프로덕션 → 개발 DB 동기화');
  console.log('========================================\n');

  console.log('📋 설정:');
  console.log(`   - 프로덕션 DB: ${CONFIG.productionDb}`);
  console.log(`   - 개발 DB: ${CONFIG.developmentDb}`);
  console.log(`   - 익명화: ${options.anonymize ? '✅ 활성화' : '❌ 비활성화'}`);
  console.log(`   - 동기화 컬렉션: ${collectionsToSync.join(', ')}`);
  console.log(`   - 모드: ${options.dryRun ? '🔍 미리보기 (dry-run)' : '🚀 실제 동기화'}`);
  console.log('');

  const client = new MongoClient(CONFIG.uri);

  try {
    await client.connect();
    console.log('✅ MongoDB 연결 성공\n');

    const prodDb = client.db(CONFIG.productionDb);
    const devDb = client.db(CONFIG.developmentDb);

    const results = [];

    for (const collectionName of collectionsToSync) {
      console.log(`\n📦 ${collectionName} 처리 중...`);

      // 프로덕션에서 데이터 조회
      const prodCollection = prodDb.collection(collectionName);
      const documents = await prodCollection.find({}).toArray();

      console.log(`   - 프로덕션 문서 수: ${formatNumber(documents.length)}`);

      if (documents.length === 0) {
        console.log('   - ⏭️ 스킵 (데이터 없음)');
        results.push({ collection: collectionName, count: 0, status: 'skipped' });
        continue;
      }

      // 익명화 처리
      let processedDocs = documents;
      if (options.anonymize) {
        processedDocs = documents.map(doc =>
          anonymizeDocument(doc, collectionName, CONFIG.anonymizeFields)
        );
        console.log('   - 🔒 익명화 처리 완료');
      }

      if (options.dryRun) {
        console.log(`   - 🔍 [미리보기] ${formatNumber(documents.length)}개 문서 동기화 예정`);
        results.push({ collection: collectionName, count: documents.length, status: 'dry-run' });
        continue;
      }

      // 개발 DB에 동기화 (기존 데이터 삭제 후 삽입)
      const devCollection = devDb.collection(collectionName);

      // 기존 데이터 삭제
      const deleteResult = await devCollection.deleteMany({});
      console.log(`   - 🗑️ 기존 데이터 ${formatNumber(deleteResult.deletedCount)}개 삭제`);

      // 새 데이터 삽입
      const insertResult = await devCollection.insertMany(processedDocs);
      console.log(`   - ✅ ${formatNumber(insertResult.insertedCount)}개 문서 삽입 완료`);

      results.push({
        collection: collectionName,
        count: insertResult.insertedCount,
        status: 'synced'
      });
    }

    // 결과 요약
    console.log('\n========================================');
    console.log('📊 동기화 결과 요약');
    console.log('========================================\n');

    let totalSynced = 0;
    for (const result of results) {
      const statusIcon = result.status === 'synced' ? '✅' :
                        result.status === 'dry-run' ? '🔍' : '⏭️';
      console.log(`   ${statusIcon} ${result.collection}: ${formatNumber(result.count)}개`);
      if (result.status === 'synced') totalSynced += result.count;
    }

    console.log('');
    console.log(`   📈 총 동기화된 문서: ${formatNumber(totalSynced)}개`);
    console.log('');

    if (options.dryRun) {
      console.log('💡 실제 동기화하려면 --dry-run 옵션을 제거하고 다시 실행하세요.');
    } else {
      console.log('🎉 동기화 완료!');
    }

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 MongoDB 연결 종료\n');
  }
}

// ============================================
// 실행
// ============================================

syncFromProduction().catch(console.error);
