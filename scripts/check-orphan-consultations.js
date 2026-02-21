const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkOrphanRecords() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // 수동 상담 기록 중 환자가 없는 것 찾기
    const manualConsultations = await db.collection('manualConsultations_v2').find({}).toArray();
    
    let orphanCount = 0;
    const orphanIds = [];
    
    for (const mc of manualConsultations) {
      if (mc.patientId) {
        const patient = await db.collection('patients_v2').findOne({ 
          _id: new ObjectId(mc.patientId) 
        });
        if (!patient) {
          orphanCount++;
          orphanIds.push(mc._id.toString());
          console.log(`고아 기록: ${mc._id} (patientId: ${mc.patientId})`);
        }
      }
    }
    
    console.log(`\n총 수동 상담 기록: ${manualConsultations.length}개`);
    console.log(`고아 기록(환자 삭제됨): ${orphanCount}개`);
    
    // consultations_v2도 확인
    const consultations = await db.collection('consultations_v2').find({}).toArray();
    let consultOrphanCount = 0;
    
    for (const c of consultations) {
      if (c.patientId) {
        const patient = await db.collection('patients_v2').findOne({ 
          _id: new ObjectId(c.patientId) 
        });
        if (!patient) {
          consultOrphanCount++;
        }
      }
    }
    
    console.log(`\n총 상담 기록(consultations_v2): ${consultations.length}개`);
    console.log(`고아 기록(환자 삭제됨): ${consultOrphanCount}개`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkOrphanRecords();
