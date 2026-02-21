const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('d-care-db');

  // V1 오늘 1241 통화
  const v1 = await db.collection('callLogs').find({
    callerNumber: /1241/,
    ringTime: { $gte: '2026-01-08' }
  }).sort({ ringTime: -1 }).toArray();

  console.log('=== V1 오늘 1241 통화 ===');
  v1.forEach(c => {
    console.log(c.callerNumber, c.callStatus, c.ringTime?.slice(11,19), 'dur:', c.duration || 0, c.recordingUrl ? 'REC' : '');
  });

  // 녹취 있는 최근 통화 확인
  const withRec = await db.collection('callLogs_v2').find({ recordingUrl: { $ne: null } }).sort({ startedAt: -1 }).limit(5).toArray();
  console.log('');
  console.log('=== 녹취 있는 최근 V2 통화 5건 ===');
  withRec.forEach(c => {
    const url = c.recordingUrl || '';
    console.log(c.phone, c.status, c.startedAt?.toISOString().slice(0,10), url.slice(0,60));
  });

  await client.close();
}
check().catch(console.error);
