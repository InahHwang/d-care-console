const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  
  const db = client.db('d-care-db');
  const patients = db.collection('patients_v2');
  
  const names = ['이정수', '최승원', '박덕양'];
  
  for (const name of names) {
    const patient = await patients.findOne({ name });
    if (patient) {
      console.log(`\n=== ${name} ===`);
      console.log('생성일:', patient.createdAt);
      console.log('상태:', patient.status);
      console.log('전화번호:', patient.phone);
      console.log('aiRegistered:', patient.aiRegistered);
      console.log('migratedAt:', patient.migratedAt);
      console.log('v1PatientId:', patient.v1PatientId);
      if (patient.statusHistory && patient.statusHistory.length > 0) {
        console.log('statusHistory[0].changedBy:', patient.statusHistory[0].changedBy);
        console.log('statusHistory[0].changedAt:', patient.statusHistory[0].changedAt);
      }
    } else {
      console.log(`\n=== ${name} === 없음`);
    }
  }
  
  await client.close();
}

main().catch(console.error);
