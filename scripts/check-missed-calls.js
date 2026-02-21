// scripts/check-missed-calls.js
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkMissedCalls() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // duration=0인 통화들 확인
    const missedCalls = await db.collection('callLogs_v2').find({
      duration: 0
    }).sort({ startedAt: -1 }).limit(10).toArray();

    console.log('duration=0인 통화:', missedCalls.length, '건\n');
    missedCalls.forEach((call, i) => {
      console.log(`${i+1}. ${call.phone} - 분류: ${call.aiAnalysis?.classification || 'null'}, aiStatus: ${call.aiStatus}`);
    });

    // 분류별 통계
    const stats = await db.collection('callLogs_v2').aggregate([
      { $match: { duration: 0 } },
      { $group: { _id: '$aiAnalysis.classification', count: { $sum: 1 } } }
    ]).toArray();

    console.log('\n부재중 통화 분류 통계:');
    stats.forEach(s => console.log(`  ${s._id || 'null'}: ${s.count}건`));

  } finally {
    await client.close();
  }
}

checkMissedCalls();
