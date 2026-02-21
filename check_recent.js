const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  
  const db = client.db('d-care-db');
  const patients = db.collection('patients_v2');
  
  // 최근 등록된 환자 3명 확인
  const recentPatients = await patients.find({})
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();
  
  for (const p of recentPatients) {
    console.log(`\n=== ${p.name} ===`);
    console.log('생성일:', p.createdAt);
    console.log('statusHistory:', JSON.stringify(p.statusHistory, null, 2));
  }
  
  await client.close();
}

main().catch(console.error);
