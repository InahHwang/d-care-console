// scripts/check-db.js
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkDB() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log('Database name:', db.databaseName);

    // 컬렉션 목록
    const collections = await db.listCollections().toArray();
    console.log('\n컬렉션 목록:');
    collections.forEach(c => console.log(`  - ${c.name}`));

    // 각 컬렉션의 문서 수
    console.log('\n각 컬렉션 문서 수:');
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`  ${c.name}: ${count}건`);
    }

    // callLogs 컬렉션 확인 (v1)
    const callLogsV1 = await db.collection('callLogs').countDocuments();
    console.log('\ncallLogs (v1):', callLogsV1, '건');

    // 최근 callLogs 확인
    const recentV1 = await db.collection('callLogs').find({}).sort({ createdAt: -1 }).limit(5).toArray();
    console.log('\ncallLogs 최근 5건:');
    recentV1.forEach((call, i) => {
      console.log(`${i+1}. ${call.phone} - duration: ${call.duration}, 분류: ${call.aiAnalysis?.classification || 'null'}`);
    });

  } finally {
    await client.close();
  }
}

checkDB();
