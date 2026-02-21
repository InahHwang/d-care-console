const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkRecordings() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('d-care-db');

  // 오늘 통화
  const all = await db.collection('callLogs_v2').find({
    startedAt: { $gte: new Date('2026-01-08T00:00:00Z') }
  }).sort({ startedAt: -1 }).toArray();

  const withRec = all.filter(c => c.recordingUrl);
  const withoutRec = all.filter(c => !c.recordingUrl);

  console.log('=== 녹취 있는 통화 (' + withRec.length + '건) ===');
  withRec.forEach(c => {
    const kst = new Date(c.startedAt);
    kst.setHours(kst.getHours() + 9);
    console.log('- ' + kst.toTimeString().slice(0,5) + ' | ' + c.phone + ' | ' + c.direction + ' | ' + c.status);
  });

  console.log('\n=== 녹취 없는 통화 (' + withoutRec.length + '건) ===');
  withoutRec.forEach(c => {
    const kst = new Date(c.startedAt);
    kst.setHours(kst.getHours() + 9);
    console.log('- ' + kst.toTimeString().slice(0,5) + ' | ' + c.phone + ' | ' + c.direction + ' | ' + c.status);
  });

  await client.close();
}

checkRecordings().catch(console.error);
