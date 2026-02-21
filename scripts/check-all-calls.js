// scripts/check-all-calls.js
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkCalls() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // 전체 통화 기록 확인
    const totalCount = await db.collection('callLogs_v2').countDocuments();
    console.log('전체 통화 기록:', totalCount, '건\n');

    // 최근 10건 확인
    const recentCalls = await db.collection('callLogs_v2').find({})
      .sort({ startedAt: -1 })
      .limit(10)
      .toArray();

    console.log('최근 10건:');
    recentCalls.forEach((call, i) => {
      console.log(`${i+1}. ${call.phone} - duration: ${call.duration}, 분류: ${call.aiAnalysis?.classification || 'null'}, status: ${call.status}`);
    });

    // 분류별 통계 (전체)
    const classStats = await db.collection('callLogs_v2').aggregate([
      { $group: { _id: '$aiAnalysis.classification', count: { $sum: 1 } } }
    ]).toArray();

    console.log('\n전체 분류 통계:');
    classStats.forEach(s => console.log(`  ${s._id || 'null'}: ${s.count}건`));

    // duration별 통계
    const durationStats = await db.collection('callLogs_v2').aggregate([
      { $group: { _id: '$duration', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    console.log('\nduration별 통계:');
    durationStats.forEach(s => console.log(`  ${s._id}: ${s.count}건`));

    // status별 통계
    const statusStats = await db.collection('callLogs_v2').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    console.log('\nstatus별 통계:');
    statusStats.forEach(s => console.log(`  ${s._id || 'null'}: ${s.count}건`));

  } finally {
    await client.close();
  }
}

checkCalls();
