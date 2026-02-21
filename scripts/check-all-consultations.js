const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  console.log('=== 전체 상담 기록 확인 ===\n');

  // consultations_v2 전체
  const allConsultations = await db.collection('consultations_v2').find({}).toArray();
  console.log('consultations_v2 전체:', allConsultations.length, '건');
  allConsultations.forEach(c => {
    console.log('  -', c._id.toString(), '| date:', c.date, '| patientId:', c.patientId, '| consultant:', c.consultantName);
  });

  // manualConsultations_v2 전체
  const allManual = await db.collection('manualConsultations_v2').find({}).toArray();
  console.log('\nmanualConsultations_v2 전체:', allManual.length, '건');
  allManual.forEach(m => {
    console.log('  -', m._id.toString(), '| date:', m.date, '| patientId:', m.patientId, '| consultant:', m.consultantName);
  });

  // callLogs_v2에서 최근 것들
  const recentCallLogs = await db.collection('callLogs_v2').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('\ncallLogs_v2 최근 10건:');
  recentCallLogs.forEach(c => {
    console.log('  -', c._id.toString(), '| createdAt:', c.createdAt, '| patientId:', c.patientId || 'null', '| aiStatus:', c.aiStatus);
  });

  // 고아 상담 기록 확인 (환자가 삭제된 상담)
  console.log('\n=== 고아 상담 기록 (환자 삭제됨) ===');

  for (const c of allConsultations) {
    if (c.patientId) {
      try {
        const patient = await db.collection('patients_v2').findOne({ _id: new ObjectId(c.patientId) });
        if (!patient) {
          console.log('consultations_v2:', c._id.toString(), '| patientId:', c.patientId, '| date:', c.date);
        }
      } catch (e) {
        console.log('consultations_v2:', c._id.toString(), '| patientId:', c.patientId, '(잘못된 ID)');
      }
    }
  }

  for (const m of allManual) {
    if (m.patientId) {
      try {
        const patient = await db.collection('patients_v2').findOne({ _id: new ObjectId(m.patientId) });
        if (!patient) {
          console.log('manualConsultations_v2:', m._id.toString(), '| patientId:', m.patientId, '| date:', m.date);
        }
      } catch (e) {
        console.log('manualConsultations_v2:', m._id.toString(), '| patientId:', m.patientId, '(잘못된 ID)');
      }
    }
  }

  await client.close();
}
check();
