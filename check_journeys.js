const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  
  const db = client.db('d-care-db');
  const patients = db.collection('patients_v2');
  
  // 방금 등록된 환자 확인
  const patient = await patients.findOne({ name: '김영자, 김옥희' });
  
  if (patient) {
    console.log('=== 김영자, 김옥희 ===');
    console.log('journeys:', JSON.stringify(patient.journeys, null, 2));
  }
  
  await client.close();
}

main().catch(console.error);
