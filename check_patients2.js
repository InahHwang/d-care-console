const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  
  const db = client.db('d-care-db');
  const patients = db.collection('patients_v2');
  const callLogs = db.collection('callLogs');
  
  const names = ['이정수', '최승원', '박덕양'];
  
  for (const name of names) {
    const patient = await patients.findOne({ name });
    if (patient) {
      console.log(`\n=== ${name} ===`);
      console.log('생성일:', patient.createdAt);
      console.log('전화번호:', patient.phone);
      console.log('statusHistory:', JSON.stringify(patient.statusHistory, null, 2));
      
      // 통화기록 확인
      const calls = await callLogs.find({ phone: patient.phone }).sort({ callTime: -1 }).limit(3).toArray();
      if (calls.length > 0) {
        console.log('\n최근 통화기록:');
        for (const call of calls) {
          console.log(`  - ${call.callTime} | ${call.callType} | ${call.duration}초 | ${call.classification}`);
        }
      }
    }
  }
  
  await client.close();
}

main().catch(console.error);
