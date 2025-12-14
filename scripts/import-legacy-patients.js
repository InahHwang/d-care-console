// scripts/import-legacy-patients.js
// 구환 데이터를 MongoDB에 import하는 스크립트

const XLSX = require('xlsx');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function importLegacyPatients() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    // 엑셀 파일 읽기
    console.log('엑셀 파일 읽는 중...');
    const wb = XLSX.readFile('구환데이터.xlsx');
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    // 전화번호 패턴 추출 및 데이터 변환
    const legacyPatients = [];
    let skipped = 0;

    data.forEach(row => {
      const name = row['이름'];
      const phone = row['휴대전화'];

      if (!phone || !name) {
        skipped++;
        return;
      }

      // 010-XXXX-XX** 에서 XXXX-XX 추출
      const match = phone.match(/010-(\d{4})-(\d{2})/);
      if (match) {
        const phonePattern = match[1] + match[2]; // "968228" 형태로 저장 (6자리)
        legacyPatients.push({
          name: name.trim(),
          phonePattern: phonePattern,
          originalPhone: phone,
          importedAt: new Date(),
          source: 'excel_import'
        });
      } else {
        skipped++;
      }
    });

    console.log(`변환 완료: ${legacyPatients.length}건 (스킵: ${skipped}건)`);

    // MongoDB 연결
    console.log('MongoDB 연결 중...');
    await client.connect();
    const db = client.db('d-care-db');
    const collection = db.collection('legacyPatients');

    // 기존 데이터 삭제 (재import 시)
    const deleteResult = await collection.deleteMany({});
    console.log(`기존 데이터 삭제: ${deleteResult.deletedCount}건`);

    // 새 데이터 삽입
    if (legacyPatients.length > 0) {
      const insertResult = await collection.insertMany(legacyPatients);
      console.log(`새 데이터 삽입: ${insertResult.insertedCount}건`);
    }

    // 인덱스 생성 (빠른 검색을 위해)
    await collection.createIndex({ phonePattern: 1 });
    console.log('phonePattern 인덱스 생성 완료');

    console.log('\n=== Import 완료 ===');
    console.log(`총 ${legacyPatients.length}건의 구환 데이터가 저장되었습니다.`);

    // 샘플 데이터 확인
    const sample = await collection.find({}).limit(5).toArray();
    console.log('\n샘플 데이터:');
    sample.forEach(p => console.log(`  ${p.name}: ${p.phonePattern} (${p.originalPhone})`));

  } catch (error) {
    console.error('Import 실패:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

importLegacyPatients();
